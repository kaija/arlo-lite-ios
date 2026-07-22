/**
 * Anthropic provider adapter — implements IProvider using the official @anthropic-ai/sdk.
 *
 * The SDK handles authentication, request construction, streaming iteration, and retries.
 * This adapter maps between the app's IProvider interface and the SDK's typed API.
 */

import Anthropic from '@anthropic-ai/sdk';
import { fetch } from 'expo/fetch';
import {
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from '@anthropic-ai/sdk';
import type {
  MessageParam,
  ContentBlockParam,
  RawMessageStreamEvent,
} from '@anthropic-ai/sdk/resources/messages/messages';

import type {
  IProvider,
  ProviderType,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
} from '../types';
import { ProviderError } from '../errors';
import { mapThinkingLevelAnthropic } from '../../domain/thinking-mapper';

/** Anthropic API version header value. */
const ANTHROPIC_VERSION = '2023-06-01';

/** Default max_tokens if not specified in the request. */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Hardcoded list of known Anthropic models.
 * Used as fallback when the models endpoint is unavailable.
 */
const KNOWN_ANTHROPIC_MODELS: string[] = [
  'claude-sonnet-4-20250514',
  'claude-haiku-4-20250514',
  'claude-3-7-sonnet-20250219',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-haiku-20240307',
];

/**
 * Anthropic provider adapter implementing the IProvider interface via the official SDK.
 */
export class AnthropicProvider implements IProvider {
  readonly type: ProviderType = 'anthropic';

  /** Cached SDK client instance. */
  private client: Anthropic | null = null;
  /** API key used to create the cached client. */
  private clientKey: string = '';
  /** Base URL used to create the cached client. */
  private clientBaseUrl: string = '';

  /**
   * Get or create an SDK client, reusing cached instance when (apiKey, baseUrl) match.
   */
  private getClient(apiKey: string, baseUrl: string): Anthropic {
    if (this.client && this.clientKey === apiKey && this.clientBaseUrl === baseUrl) {
      return this.client;
    }
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl,
      defaultHeaders: { 'anthropic-version': ANTHROPIC_VERSION },
      fetch: fetch as unknown as Anthropic['_options']['fetch'],
    });
    this.clientKey = apiKey;
    this.clientBaseUrl = baseUrl;
    return this.client;
  }

  /**
   * Execute a non-streaming completion request via the Anthropic SDK.
   */
  async complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const client = this.getClient(apiKey, config.baseUrl);
    const systemMessage = extractSystemMessage(request.messages);
    const messages = formatMessages(request.messages);
    const thinkingParams = mapThinkingLevelAnthropic(request.thinkingLevel);

    try {
      const requestParams = {
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        stream: false,
        ...(systemMessage ? { system: systemMessage } : {}),
        ...(thinkingParams.thinking ? { thinking: thinkingParams.thinking as any } : {}),
        ...(request.tools?.length ? { tools: request.tools as any } : {}),
      };
      console.log('[Anthropic API] Full request payload:', JSON.stringify(requestParams, null, 2));

      const response = await client.messages.create(requestParams as any);

      return mapResponse(response);
    } catch (error) {
      throw classifyError(error);
    }
  }

  /**
   * Execute a streaming completion request via the Anthropic SDK.
   * Returns an AsyncIterable of StreamChunks mapped from SDK stream events.
   */
  async *streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    const client = this.getClient(apiKey, config.baseUrl);
    const systemMessage = extractSystemMessage(request.messages);
    const messages = formatMessages(request.messages);
    const thinkingParams = mapThinkingLevelAnthropic(request.thinkingLevel);

    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const requestParams = {
        model: request.model,
        messages,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        ...(systemMessage ? { system: systemMessage } : {}),
        ...(thinkingParams.thinking ? { thinking: thinkingParams.thinking as any } : {}),
        ...(request.tools?.length ? { tools: request.tools as any } : {}),
      };
      console.log('[Anthropic API] Full request payload:', JSON.stringify(requestParams, null, 2));

      const stream = client.messages.stream(
        requestParams as any,
        { signal },
      );

      // Accumulate tool_use blocks from the stream
      const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();
      let currentBlockIndex = -1;

      for await (const event of stream) {
        if (signal.aborted) break;

        // Track content block starts for tool_use
        if (event.type === 'content_block_start') {
          currentBlockIndex = event.index;
          if (event.content_block.type === 'tool_use') {
            toolCallAccum.set(currentBlockIndex, {
              id: event.content_block.id,
              name: event.content_block.name,
              args: '',
            });
          }
        }

        // Accumulate tool_use input JSON deltas
        if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          const existing = toolCallAccum.get(currentBlockIndex);
          if (existing) {
            existing.args += (event.delta as any).partial_json ?? '';
          }
          continue; // Don't pass to mapStreamEvent
        }

        const chunk = mapStreamEvent(event);
        if (chunk) {
          yield chunk;
        }

        // Accumulate usage from message events
        if (event.type === 'message_start') {
          inputTokens = event.message.usage?.input_tokens ?? 0;
          outputTokens = event.message.usage?.output_tokens ?? 0;
        }
        if (event.type === 'message_delta') {
          outputTokens = event.usage?.output_tokens ?? outputTokens;
        }
      }

      // Emit accumulated tool calls
      for (const [, tc] of toolCallAccum) {
        let args: Record<string, unknown> = {};
        try { args = JSON.parse(tc.args); } catch { /* malformed args — send empty */ }
        yield { type: 'tool_call' as const, content: '', toolCall: { id: tc.id, name: tc.name, arguments: args } };
      }

      // Final done chunk with accumulated usage
      yield {
        type: 'done',
        content: '',
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: inputTokens + outputTokens,
        },
      };
    } catch (error) {
      if (signal.aborted || error instanceof APIUserAbortError) {
        yield { type: 'done', content: '' };
        return;
      }
      const classified = classifyError(error);
      const retryInfo = classified.retryAfterSeconds != null
        ? ` (retry after ${classified.retryAfterSeconds}s)`
        : classified.category === 'rate_limit'
          ? ' (retry after unknown)'
          : '';
      yield { type: 'error', content: `${classified.category}: ${classified.message}${retryInfo}` };
      yield { type: 'done', content: '' };
    }
  }

  /**
   * List available models from Anthropic.
   * Attempts the SDK models endpoint, falls back to curated list on non-auth failures.
   */
  async listModels(
    config: ProviderConfig,
    apiKey: string,
  ): Promise<string[]> {
    const client = this.getClient(apiKey, config.baseUrl);

    try {
      const page = await client.models.list({ limit: 100 });
      const modelIds = page.data.map((m) => m.id);
      if (modelIds.length > 0) {
        return modelIds;
      }
      return KNOWN_ANTHROPIC_MODELS;
    } catch (error) {
      // Auth errors should propagate — don't fall back to curated list
      if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
        throw classifyError(error);
      }
      // All other failures: fall back to curated list
      return KNOWN_ANTHROPIC_MODELS;
    }
  }

  /**
   * Validate an API key by sending a minimal request via the SDK.
   * Returns false on auth errors, true on any other response.
   */
  async validateApiKey(
    config: ProviderConfig,
    apiKey: string,
  ): Promise<boolean> {
    const client = this.getClient(apiKey, config.baseUrl);

    try {
      await client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
        stream: false,
      });
      return true;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
        return false;
      }
      if (error instanceof APIConnectionError) {
        return false;
      }
      // Other errors (429, 500, etc.) mean the key is valid
      return true;
    }
  }
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Extract the system message content from a messages array.
 * Returns the concatenated text of all system messages, or undefined if none.
 */
function extractSystemMessage(messages: ChatMessage[]): string | undefined {
  const systemMessages = messages.filter((m) => m.role === 'system');
  if (systemMessages.length === 0) return undefined;

  return systemMessages
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .join('\n');
}

/**
 * Format app ChatMessages into Anthropic SDK MessageParam format.
 * Excludes system messages (they go into the top-level `system` param).
 * Handles tool_use (assistant) and tool_result (user) message conversion.
 *
 * Anthropic requires:
 * - Only 'user' and 'assistant' roles
 * - Assistant tool calls → content blocks with type:'tool_use'
 * - Tool results → user message with type:'tool_result' content blocks
 */
function formatMessages(messages: ChatMessage[]): MessageParam[] {
  const result: MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    if (msg.role === 'tool') {
      // Anthropic tool_result format: role:'user', content:[{type:'tool_result',...}]
      // Group consecutive tool messages into one user message
      const lastMsg = result[result.length - 1];
      const toolResultBlock = {
        type: 'tool_result' as const,
        tool_use_id: msg.tool_call_id ?? '',
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      };

      if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content) &&
          (lastMsg.content as any[]).every((b: any) => b.type === 'tool_result')) {
        // Merge into existing tool_result user message
        (lastMsg.content as any[]).push(toolResultBlock);
      } else {
        result.push({ role: 'user', content: [toolResultBlock] as any });
      }
      continue;
    }

    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      // Assistant message with tool calls → content blocks
      const blocks: any[] = [];
      const textContent = typeof msg.content === 'string' ? msg.content : '';
      if (textContent) {
        blocks.push({ type: 'text', text: textContent });
      }
      for (const tc of msg.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.arguments,
        });
      }
      result.push({ role: 'assistant', content: blocks as any });
      continue;
    }

    // Regular user/assistant message
    result.push(formatMessage(msg));
  }

  return result;
}

/**
 * Format a single ChatMessage into Anthropic SDK MessageParam.
 * Handles plain text and multimodal content parts.
 */
function formatMessage(msg: ChatMessage): MessageParam {
  if (typeof msg.content === 'string') {
    return { role: msg.role as 'user' | 'assistant', content: msg.content };
  }

  // Convert multimodal content parts to Anthropic format
  const parts: ContentBlockParam[] = msg.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    // image_url → Anthropic image block
    return {
      type: 'image' as const,
      source: {
        type: 'url' as const,
        url: part.image_url.url,
      },
    };
  });

  return { role: msg.role as 'user' | 'assistant', content: parts };
}

/**
 * Map a non-streaming Anthropic SDK Message response to CompletionResponse.
 */
function mapResponse(response: Anthropic.Message): CompletionResponse {
  let content = '';
  let thinkingContent: string | undefined;

  for (const block of response.content) {
    if (block.type === 'text') {
      content += block.text;
    } else if (block.type === 'thinking') {
      thinkingContent = block.thinking;
    }
  }

  const usage: TokenUsage = {
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
    cachedTokens: response.usage.cache_read_input_tokens ?? undefined,
  };

  return {
    content,
    thinkingContent,
    usage,
    finishReason: response.stop_reason ?? 'unknown',
  };
}

/**
 * Map a single Anthropic stream event to a StreamChunk, or null if skipped.
 */
function mapStreamEvent(event: RawMessageStreamEvent): StreamChunk | null {
  if (event.type === 'content_block_delta') {
    if (event.delta.type === 'text_delta') {
      return { type: 'text', content: event.delta.text ?? '' };
    }
    if (event.delta.type === 'thinking_delta') {
      return { type: 'thinking', content: event.delta.thinking ?? '' };
    }
    // Unrecognized delta type (input_json_delta, citations_delta, signature_delta, etc.)
    return null;
  }

  // Skip other event types — usage is accumulated separately, done is emitted at end
  return null;
}

/**
 * Classify an SDK error into a ProviderError with the correct category.
 */
function classifyError(error: unknown): ProviderError {
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) {
    return new ProviderError(
      'Authentication failed. Please check your API key.',
      'authentication',
    );
  }

  if (error instanceof RateLimitError) {
    const retryAfter = extractRetryAfter(error.headers);
    return new ProviderError(
      'Rate limit exceeded.',
      'rate_limit',
      retryAfter,
    );
  }

  if (error instanceof APIError) {
    const status = error.status;
    if (status === 529) {
      return new ProviderError(
        'Anthropic API is overloaded. Please try again later.',
        'overloaded',
      );
    }
    if (status != null && status >= 500 && status < 600) {
      return new ProviderError(
        'Anthropic server error. Please try again later.',
        'server',
      );
    }
  }

  if (error instanceof APIConnectionTimeoutError) {
    return new ProviderError(
      'Request timed out.',
      'network',
    );
  }

  if (error instanceof APIConnectionError) {
    return new ProviderError(
      'Network error. Please check your connection.',
      'network',
    );
  }

  // Fallback for unknown errors
  return new ProviderError(
    'An unexpected error occurred.',
    'server',
  );
}

/**
 * Extract Retry-After value in seconds from response headers.
 */
function extractRetryAfter(headers: Headers | undefined | null): number | null {
  if (!headers) return null;
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) return null;

  const seconds = parseInt(retryAfter, 10);
  if (isNaN(seconds)) return null;
  return seconds;
}

/** @internal Exported for testing only. */
export { formatMessages as _formatMessages };
