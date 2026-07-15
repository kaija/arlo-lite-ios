/**
 * Anthropic provider adapter — implements IProvider for the Anthropic Messages API.
 *
 * Key differences from OpenAI:
 * - API key sent via `x-api-key` header (not Bearer token)
 * - System message is a top-level parameter, not in the messages array
 * - Thinking/reasoning uses a `thinking` block with `budget_tokens`
 * - SSE format uses event types (content_block_delta, message_delta, message_stop)
 * - `anthropic-version` header required on all requests
 */

import type {
  IProvider,
  ProviderType,
  ProviderConfig,
  CompletionRequest,
  CompletionResponse,
  StreamChunk,
  TokenUsage,
  ChatMessage,
  ThinkingLevel,
} from '../types';
import { mapThinkingLevelAnthropic } from '../../domain/thinking-mapper';

/** Anthropic API version header value. */
const ANTHROPIC_VERSION = '2023-06-01';

/** Default max_tokens if not specified in the request. */
const DEFAULT_MAX_TOKENS = 4096;

/**
 * Hardcoded list of known Anthropic models.
 * Anthropic does not provide a standard model listing endpoint.
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
 * Anthropic provider adapter implementing the IProvider interface.
 */
export class AnthropicProvider implements IProvider {
  readonly type: ProviderType = 'anthropic';

  /**
   * Build the HTTP request for an Anthropic Messages API completion.
   *
   * - URL: `{baseUrl}/v1/messages`
   * - Headers: x-api-key, content-type, anthropic-version
   * - Body: system as top-level param, messages array without system messages,
   *   thinking block if applicable
   */
  buildRequest(
    config: ProviderConfig,
    request: CompletionRequest,
  ): { url: string; headers: Record<string, string>; body: string } {
    const url = `${config.baseUrl}/v1/messages`;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'anthropic-version': ANTHROPIC_VERSION,
    };

    // Extract system message from messages array
    const systemMessage = extractSystemMessage(request.messages);
    const nonSystemMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map(formatMessage);

    // Build body
    const body: Record<string, unknown> = {
      model: request.model,
      messages: nonSystemMessages,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream: request.stream,
    };

    // Add system message as top-level param if present
    if (systemMessage) {
      body.system = systemMessage;
    }

    // Add thinking configuration based on thinking level
    const thinkingParams = this.mapThinkingLevel(request.thinkingLevel);
    if (thinkingParams.thinking) {
      body.thinking = thinkingParams.thinking;
    }

    return { url, headers, body: JSON.stringify(body) };
  }

  /**
   * Parse a non-streaming Anthropic Messages API response.
   *
   * Response shape:
   * {
   *   content: [{ type: 'text', text: '...' }, { type: 'thinking', thinking: '...' }],
   *   usage: { input_tokens, output_tokens },
   *   stop_reason: 'end_turn' | 'max_tokens' | ...
   * }
   */
  parseResponse(raw: unknown): CompletionResponse {
    const response = raw as AnthropicResponse;

    let content = '';
    let thinkingContent: string | undefined;

    if (response.content && Array.isArray(response.content)) {
      for (const block of response.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'thinking') {
          thinkingContent = block.thinking;
        }
      }
    }

    const usage: TokenUsage = {
      promptTokens: response.usage?.input_tokens ?? 0,
      completionTokens: response.usage?.output_tokens ?? 0,
      totalTokens:
        (response.usage?.input_tokens ?? 0) +
        (response.usage?.output_tokens ?? 0),
      cachedTokens: response.usage?.cache_read_input_tokens,
    };

    return {
      content,
      thinkingContent,
      usage,
      finishReason: response.stop_reason ?? 'unknown',
    };
  }

  /**
   * Parse a single SSE line from an Anthropic stream.
   *
   * Anthropic SSE format:
   * - `event: content_block_delta` with `delta.type === 'text_delta'` → text chunk
   * - `event: content_block_delta` with `delta.type === 'thinking_delta'` → thinking chunk
   * - `event: message_delta` → may contain usage/stop_reason
   * - `event: message_stop` → done
   *
   * Lines come as: `event: {type}\ndata: {...}`
   * This parser handles `data:` lines.
   */
  parseStreamChunk(line: string): StreamChunk | null {
    // Skip empty lines, comments, and event lines
    if (!line || line.startsWith(':') || line.startsWith('event:')) {
      return null;
    }

    // Handle data lines
    if (!line.startsWith('data:')) {
      return null;
    }

    const jsonStr = line.slice(5).trim();
    if (!jsonStr || jsonStr === '[DONE]') {
      return { type: 'done', content: '' };
    }

    try {
      const data = JSON.parse(jsonStr) as AnthropicStreamEvent;

      // content_block_delta events
      if (data.type === 'content_block_delta') {
        if (data.delta?.type === 'text_delta') {
          return { type: 'text', content: data.delta.text ?? '' };
        }
        if (data.delta?.type === 'thinking_delta') {
          return { type: 'thinking', content: data.delta.thinking ?? '' };
        }
        return null;
      }

      // message_delta — may contain usage info
      if (data.type === 'message_delta') {
        const usage: TokenUsage | undefined = data.usage
          ? {
              promptTokens: data.usage.input_tokens ?? 0,
              completionTokens: data.usage.output_tokens ?? 0,
              totalTokens:
                (data.usage.input_tokens ?? 0) +
                (data.usage.output_tokens ?? 0),
            }
          : undefined;

        return { type: 'done', content: '', usage };
      }

      // message_stop — stream complete
      if (data.type === 'message_stop') {
        return { type: 'done', content: '' };
      }

      // message_start — contains initial usage info
      if (data.type === 'message_start') {
        const msg = data.message;
        if (msg?.usage) {
          const usage: TokenUsage = {
            promptTokens: msg.usage.input_tokens ?? 0,
            completionTokens: msg.usage.output_tokens ?? 0,
            totalTokens:
              (msg.usage.input_tokens ?? 0) +
              (msg.usage.output_tokens ?? 0),
          };
          return { type: 'done', content: '', usage };
        }
        return null;
      }

      // content_block_start, ping, etc. — skip
      return null;
    } catch {
      return { type: 'error', content: `Failed to parse stream data: ${jsonStr}` };
    }
  }

  /**
   * Map abstract ThinkingLevel to Anthropic-specific parameters.
   * Delegates to the thinking-mapper domain function.
   */
  mapThinkingLevel(level: ThinkingLevel): Record<string, unknown> {
    return mapThinkingLevelAnthropic(level);
  }

  /**
   * List available models from Anthropic.
   * Anthropic doesn't expose a standard model listing endpoint,
   * so we return a hardcoded list of known models.
   */
  async listModels(
    _config: ProviderConfig,
    _apiKey: string,
  ): Promise<string[]> {
    return KNOWN_ANTHROPIC_MODELS;
  }

  /**
   * Validate an API key by sending a minimal request to the Anthropic Messages API.
   * Sends a tiny request with max_tokens: 10 and checks for a non-auth-error response.
   */
  async validateApiKey(
    config: ProviderConfig,
    apiKey: string,
  ): Promise<boolean> {
    const url = `${config.baseUrl}/v1/messages`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10,
        }),
      });

      // 401/403 means invalid key
      if (response.status === 401 || response.status === 403) {
        return false;
      }

      // 200 or other non-auth errors (429, 500, etc.) mean the key is valid
      return true;
    } catch {
      // Network error — can't validate, assume invalid
      return false;
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
 * Format a ChatMessage into Anthropic's message format.
 * Handles both string content and multimodal content parts.
 */
function formatMessage(
  msg: ChatMessage,
): { role: string; content: string | AnthropicContentPart[] } {
  if (typeof msg.content === 'string') {
    return { role: msg.role, content: msg.content };
  }

  // Convert multimodal content parts to Anthropic format
  const parts: AnthropicContentPart[] = msg.content.map((part) => {
    if (part.type === 'text') {
      return { type: 'text' as const, text: part.text };
    }
    // image_url → Anthropic image block
    return {
      type: 'image' as const,
      source: {
        type: 'url',
        url: part.image_url.url,
      },
    };
  });

  return { role: msg.role, content: parts };
}

// ─── Internal Types ──────────────────────────────────────────────────────────

/** Anthropic content part in request/response. */
interface AnthropicContentPart {
  type: string;
  text?: string;
  source?: { type: string; url: string };
}

/** Anthropic Messages API response structure. */
interface AnthropicResponse {
  content?: Array<{
    type: string;
    text?: string;
    thinking?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_read_input_tokens?: number;
  };
  stop_reason?: string;
}

/** Anthropic SSE stream event structure. */
interface AnthropicStreamEvent {
  type: string;
  delta?: {
    type: string;
    text?: string;
    thinking?: string;
  };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  message?: {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
}
