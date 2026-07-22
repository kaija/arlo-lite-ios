/**
 * OpenAI provider adapter — implements IProvider using the official `openai` SDK.
 *
 * Supports both the Responses API and Chat Completions API based on
 * the provider's apiMode configuration. Uses the SDK's native streaming
 * iterators and error types for type-safe event handling.
 *
 * The SDK client is lazily constructed and cached, keyed by (apiKey, baseUrl).
 * Configuration:
 * - maxRetries: 2 (SDK handles exponential backoff for 5xx)
 * - dangerouslyAllowBrowser: true (required for React Native non-Node env)
 */

import OpenAI, { APIError } from 'openai';
import { fetch } from 'expo/fetch';
import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderConfig,
  ProviderType,
  StreamChunk,
  TokenUsage,
  ChatMessage,
  ContentPart,
} from '../types';
import { ProviderError } from '../errors';
import { mapThinkingLevelOpenAI } from '../../domain/thinking-mapper';

/**
 * OpenAI provider adapter implementing the IProvider interface via the official SDK.
 */
export class OpenAIProvider implements IProvider {
  readonly type: ProviderType = 'openai';

  /** Cached SDK client instance. */
  private client: OpenAI | null = null;

  /** API key used to construct the cached client. */
  private clientKey: string = '';

  /** Base URL used to construct the cached client. */
  private clientBaseUrl: string = '';

  /**
   * Get or create an OpenAI SDK client.
   *
   * The client is cached and reused as long as apiKey and baseUrl remain unchanged.
   * When either changes, a new client is constructed.
   */
  private getClient(apiKey: string, baseUrl: string): OpenAI {
    if (this.client && this.clientKey === apiKey && this.clientBaseUrl === baseUrl) {
      return this.client;
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      maxRetries: 2,
      dangerouslyAllowBrowser: true,
      fetch: fetch as unknown as OpenAI['_options']['fetch'],
    });
    this.clientKey = apiKey;
    this.clientBaseUrl = baseUrl;
    return this.client;
  }

  /**
   * Execute a non-streaming completion request.
   *
   * Routes to Chat Completions or Responses API based on config.apiMode.
   */
  async complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const client = this.getClient(apiKey, config.baseUrl);
    const thinkingParams = mapThinkingLevelOpenAI(request.thinkingLevel);

    try {
      if (config.apiMode === 'chat-completions') {
        return await this.completeChatCompletions(client, request, thinkingParams);
      }
      // Default: Responses API
      return await this.completeResponses(client, request, thinkingParams);
    } catch (error) {
      throw classifyOpenAIError(error, client.baseURL);
    }
  }

  /**
   * Execute a streaming completion request.
   *
   * Returns an AsyncIterable that yields StreamChunks mapped from SDK events.
   * Handles abort via the provided signal.
   */
  async *streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    // If signal is already aborted, emit error and return without network request
    if (signal.aborted) {
      yield { type: 'error', content: 'Request cancelled' };
      yield { type: 'done', content: '' };
      return;
    }

    const client = this.getClient(apiKey, config.baseUrl);
    const thinkingParams = mapThinkingLevelOpenAI(request.thinkingLevel);

    try {
      if (config.apiMode === 'chat-completions') {
        yield* this.streamChatCompletions(client, request, thinkingParams, signal);
      } else {
        yield* this.streamResponses(client, request, thinkingParams, signal);
      }
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }
      const classified = classifyOpenAIError(error, client.baseURL);
      yield { type: 'error', content: `${classified.category}: ${classified.message}` };
      yield { type: 'done', content: '' };
    }
  }

  /**
   * List available models from the OpenAI API using the SDK.
   *
   * Returns model IDs sorted alphabetically (case-insensitive).
   */
  async listModels(config: ProviderConfig, apiKey: string): Promise<string[]> {
    const client = this.getClient(apiKey, config.baseUrl);

    try {
      const list = await client.models.list();
      const modelIds: string[] = [];
      for await (const model of list) {
        modelIds.push(model.id);
      }
      return modelIds.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch (error) {
      throw classifyOpenAIError(error, client.baseURL);
    }
  }

  /**
   * Validate an API key by attempting to list models.
   *
   * Returns false on authentication errors, true otherwise.
   */
  async validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean> {
    const client = this.getClient(apiKey, config.baseUrl);

    try {
      // Attempt to list models — if it succeeds, the key is valid
      const list = await client.models.list();
      // Consume at least one item to ensure the request completes
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _model of list) {
        break; // Only need one to confirm validity
      }
      return true;
    } catch (error) {
      if (error instanceof APIError) {
        // Auth errors mean the key is invalid
        if (error.status === 401 || error.status === 403) {
          return false;
        }
        // Other errors (429, 500, etc.) mean the key is likely valid
        // but the service has other issues
        return true;
      }
      // Network errors — can't validate
      return false;
    }
  }

  // ─── Private: Chat Completions Mode ─────────────────────────────────────────

  /**
   * Non-streaming completion via Chat Completions API.
   */
  private async completeChatCompletions(
    client: OpenAI,
    request: CompletionRequest,
    thinkingParams: Record<string, unknown>,
  ): Promise<CompletionResponse> {
    const messages = request.messages.map(toChatCompletionMessage);

    const params: Record<string, unknown> = {
      model: request.model,
      messages,
      stream: false,
      ...(request.tools?.length && { tools: request.tools }),
    };

    if (request.maxTokens !== undefined) {
      params.max_tokens = request.maxTokens;
    }

    if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort) {
      params.reasoning_effort = thinkingParams.reasoning_effort;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await client.chat.completions.create(params as any);
    return mapChatCompletionResponse(response);
  }

  /**
   * Non-streaming completion via Responses API.
   */
  private async completeResponses(
    client: OpenAI,
    request: CompletionRequest,
    thinkingParams: Record<string, unknown>,
  ): Promise<CompletionResponse> {
    const { input, instructions } = convertToResponsesInput(request.messages);

    const params: Record<string, unknown> = {
      model: request.model,
      input,
      stream: false,
      ...(request.tools?.length && { tools: request.tools }),
    };

    if (instructions) {
      params.instructions = instructions;
    }

    if (request.maxTokens !== undefined) {
      params.max_output_tokens = request.maxTokens;
    }

    if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort) {
      params.reasoning = { effort: thinkingParams.reasoning_effort };
    }

    console.log('[OpenAI Responses API] Request params:', JSON.stringify(params, null, 2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await client.responses.create(params as any);
    return mapResponsesResponse(response);
  }

  // ─── Private: Streaming ─────────────────────────────────────────────────────

  /**
   * Streaming via Chat Completions API.
   * Iterates SDK async iterable, maps chunks to StreamChunk.
   */
  private async *streamChatCompletions(
    client: OpenAI,
    request: CompletionRequest,
    thinkingParams: Record<string, unknown>,
    signal: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const messages = request.messages.map(toChatCompletionMessage);

    const params: Record<string, unknown> = {
      model: request.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(request.tools?.length && { tools: request.tools }),
    };

    if (request.maxTokens !== undefined) {
      params.max_tokens = request.maxTokens;
    }

    if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort) {
      params.reasoning_effort = thinkingParams.reasoning_effort;
    }

    console.log('[OpenAI Chat Completions] Full request payload:', JSON.stringify(params, null, 2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await client.chat.completions.create(
      params as any,
      { signal },
    );

    let usage: TokenUsage | undefined;

    // Accumulate streamed tool calls: index → {id, name, arguments}
    const toolCallAccum = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream as unknown as AsyncIterable<Record<string, unknown>>) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }

      const choices = chunk.choices as Array<Record<string, unknown>> | undefined;

      if (choices && choices.length > 0) {
        const choice = choices[0];
        const delta = choice.delta as Record<string, unknown> | undefined;

        if (delta) {
          // Reasoning/thinking content
          if (delta.reasoning_content) {
            yield { type: 'thinking', content: delta.reasoning_content as string };
          }

          // Regular text content
          if (delta.content) {
            yield { type: 'text', content: delta.content as string };
          }

          // Accumulate tool_calls deltas
          const toolCalls = delta.tool_calls as Array<Record<string, unknown>> | undefined;
          if (toolCalls) {
            for (const tc of toolCalls) {
              const idx = (tc.index as number) ?? 0;
              const fn = tc.function as Record<string, unknown> | undefined;
              const existing = toolCallAccum.get(idx);
              if (!existing) {
                toolCallAccum.set(idx, {
                  id: (tc.id as string) ?? `call_${idx}`,
                  name: (fn?.name as string) ?? '',
                  args: (fn?.arguments as string) ?? '',
                });
              } else {
                if (fn?.name) existing.name = fn.name as string;
                if (fn?.arguments) existing.args += fn.arguments as string;
              }
            }
          }
        }
      }

      // Usage-only chunk (typically at end of stream with stream_options.include_usage)
      if (chunk.usage) {
        const u = chunk.usage as Record<string, unknown>;
        usage = {
          promptTokens: (u.prompt_tokens as number) || 0,
          completionTokens: (u.completion_tokens as number) || 0,
          totalTokens: (u.total_tokens as number) || 0,
          cachedTokens: (u.prompt_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
        };
      }
    }

    // Emit accumulated tool calls as tool_call chunks
    for (const [, tc] of toolCallAccum) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.args); } catch { /* malformed args — send empty */ }
      yield { type: 'tool_call', content: '', toolCall: { id: tc.id, name: tc.name, arguments: args } };
    }

    // Emit final done chunk with accumulated usage
    yield { type: 'done', content: '', ...(usage ? { usage } : {}) };
  }

  /**
   * Streaming via Responses API.
   * Iterates SDK async iterable of response events, maps to StreamChunk.
   */
  private async *streamResponses(
    client: OpenAI,
    request: CompletionRequest,
    thinkingParams: Record<string, unknown>,
    signal: AbortSignal,
  ): AsyncGenerator<StreamChunk> {
    const { input, instructions } = convertToResponsesInput(request.messages);

    const params: Record<string, unknown> = {
      model: request.model,
      input,
      stream: true,
      ...(request.tools?.length && { tools: request.tools }),
    };

    if (instructions) {
      params.instructions = instructions;
    }

    if (request.maxTokens !== undefined) {
      params.max_output_tokens = request.maxTokens;
    }

    if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort) {
      params.reasoning = { effort: thinkingParams.reasoning_effort };
    }

    console.log(`[OpenAI Responses API Stream] Request params:`, JSON.stringify(params, null, 2));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await client.responses.create(
      params as any,
      { signal },
    );

    let usage: TokenUsage | undefined;

    // Accumulate function call items: output_index → {call_id, name, arguments}
    const toolCallAccum = new Map<number, { callId: string; name: string; args: string }>();

    for await (const event of stream as unknown as AsyncIterable<Record<string, unknown>>) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }

      const eventType = event.type as string;

      switch (eventType) {
        case 'response.output_text.delta': {
          const delta = (event.delta as string) || '';
          if (delta) {
            yield { type: 'text', content: delta };
          }
          break;
        }

        case 'response.reasoning.delta': {
          const delta = (event.delta as string) || '';
          if (delta) {
            yield { type: 'thinking', content: delta };
          }
          break;
        }

        // Tool call: new function_call output item added
        case 'response.output_item.added': {
          const item = event.item as Record<string, unknown> | undefined;
          if (item?.type === 'function_call') {
            const idx = (event.output_index as number) ?? 0;
            toolCallAccum.set(idx, {
              callId: (item.call_id as string) ?? `call_${idx}`,
              name: (item.name as string) ?? '',
              args: '',
            });
          }
          break;
        }

        // Tool call: streaming argument deltas
        case 'response.function_call_arguments.delta': {
          const idx = (event.output_index as number) ?? 0;
          const existing = toolCallAccum.get(idx);
          if (existing) {
            existing.args += (event.delta as string) ?? '';
          }
          break;
        }

        // Tool call: arguments done — update with final values
        case 'response.function_call_arguments.done': {
          const idx = (event.output_index as number) ?? 0;
          const existing = toolCallAccum.get(idx);
          if (existing) {
            existing.args = (event.arguments as string) ?? existing.args;
            if (event.name) existing.name = event.name as string;
            if (event.call_id) existing.callId = event.call_id as string;
          }
          break;
        }

        case 'response.completed': {
          const response = event.response as Record<string, unknown> | undefined;
          if (response?.usage) {
            const u = response.usage as Record<string, unknown>;
            usage = {
              promptTokens: (u.input_tokens as number) || 0,
              completionTokens: (u.output_tokens as number) || 0,
              totalTokens: ((u.input_tokens as number) || 0) + ((u.output_tokens as number) || 0),
            };
          }
          break;
        }

        case 'response.failed':
        case 'response.incomplete': {
          yield { type: 'error', content: eventType };
          break;
        }

        default:
          // Skip unrecognized events
          break;
      }
    }

    // Emit accumulated tool calls
    for (const [, tc] of toolCallAccum) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.args); } catch { /* malformed args — send empty */ }
      yield { type: 'tool_call', content: '', toolCall: { id: tc.callId, name: tc.name, arguments: args } };
    }

    // Emit final done chunk with accumulated usage
    yield { type: 'done', content: '', ...(usage ? { usage } : {}) };
  }
}

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Convert a ChatMessage to the format expected by the Chat Completions API.
 */
function toChatCompletionMessage(
  msg: ChatMessage,
): Record<string, unknown> {
  const out: Record<string, unknown> = { role: msg.role };

  if (typeof msg.content === 'string') {
    out.content = msg.content;
  } else {
    // Multimodal content parts
    out.content = (msg.content as ContentPart[]).map((part) => {
      if (part.type === 'text') {
        return { type: 'text', text: part.text };
      }
      return { type: 'image_url', image_url: { url: part.image_url.url } };
    });
  }

  // Include tool_calls on assistant messages for multi-turn tool use
  if (msg.toolCalls?.length) {
    out.tool_calls = msg.toolCalls.map((tc) => ({
      id: tc.id,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
    }));
  }

  // Include tool_call_id on tool result messages
  if (msg.tool_call_id) {
    out.tool_call_id = msg.tool_call_id;
  }

  return out;
}

/**
 * Convert messages to the Responses API input format.
 *
 * The Responses API does not accept 'system' role in the input array.
 * System messages are extracted and returned separately as `instructions`.
 * Tool-related messages are converted to function_call / function_call_output items.
 */
function convertToResponsesInput(
  messages: ChatMessage[],
): { input: Array<Record<string, unknown>>; instructions: string | undefined } {
  const systemMessages: string[] = [];
  const input: Array<Record<string, unknown>> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      // Collect system messages for the instructions parameter
      const text = typeof msg.content === 'string'
        ? msg.content
        : msg.content.filter((p) => p.type === 'text').map((p) => (p as { type: 'text'; text: string }).text).join('\n');
      if (text) systemMessages.push(text);
      continue;
    }

    // Assistant message with tool calls → emit function_call items
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      // Emit any text content as a message item first
      const textContent = typeof msg.content === 'string' ? msg.content : '';
      if (textContent) {
        input.push({ role: 'assistant', content: textContent });
      }
      // Emit each tool call as a function_call item
      for (const tc of msg.toolCalls) {
        input.push({
          type: 'function_call',
          call_id: tc.id,
          name: tc.name,
          arguments: JSON.stringify(tc.arguments),
        });
      }
      continue;
    }

    // Tool result message → function_call_output item
    if (msg.role === 'tool') {
      // Skip tool results without call_id — can't send to API without it
      if (!msg.tool_call_id) continue;
      input.push({
        type: 'function_call_output',
        call_id: msg.tool_call_id,
        output: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      });
      continue;
    }

    // Regular user/assistant messages
    if (typeof msg.content === 'string') {
      input.push({ role: msg.role, content: msg.content });
    } else {
      // Multimodal content parts in Responses format
      const parts = (msg.content as ContentPart[]).map((part) => {
        if (part.type === 'text') {
          return { type: 'input_text', text: part.text };
        }
        return { type: 'input_image', image_url: part.image_url.url };
      });
      input.push({ role: msg.role, content: parts });
    }
  }

  const instructions = systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined;

  return { input, instructions };
}

/**
 * Map a Chat Completions API response to CompletionResponse.
 */
function mapChatCompletionResponse(response: unknown): CompletionResponse {
  const data = response as Record<string, unknown>;
  const choices = data.choices as Array<Record<string, unknown>> | undefined;

  let content = '';
  let thinkingContent: string | undefined;
  let finishReason = 'stop';

  if (choices && choices.length > 0) {
    const choice = choices[0];
    const message = choice.message as Record<string, unknown> | undefined;

    if (message) {
      content = (message.content as string) || '';

      // Some reasoning models return thinking content separately
      if (message.reasoning_content) {
        thinkingContent = message.reasoning_content as string;
      }
    }

    finishReason = (choice.finish_reason as string) || 'stop';
  }

  const usage = parseChatCompletionsUsage(data.usage);

  return {
    content,
    thinkingContent,
    usage,
    finishReason,
  };
}

/**
 * Map a Responses API response to CompletionResponse.
 */
function mapResponsesResponse(response: unknown): CompletionResponse {
  const data = response as Record<string, unknown>;

  let content = '';
  let thinkingContent: string | undefined;

  const output = data.output as Array<Record<string, unknown>> | undefined;
  if (output) {
    for (const block of output) {
      if (block.type === 'message') {
        const messageContent = block.content as Array<Record<string, unknown>> | undefined;
        if (messageContent) {
          for (const part of messageContent) {
            if (part.type === 'output_text') {
              content += (part.text as string) || '';
            }
          }
        }
      } else if (block.type === 'reasoning') {
        const summary = block.summary as Array<Record<string, unknown>> | undefined;
        if (summary) {
          thinkingContent = summary.map((s) => (s.text as string) || '').join('');
        }
      }
    }
  }

  const usage = parseResponsesUsage(data.usage);

  return {
    content,
    thinkingContent,
    usage,
    finishReason: (data.status as string) || 'stop',
  };
}

/**
 * Parse usage from a Chat Completions API response.
 */
function parseChatCompletionsUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const u = usage as Record<string, unknown>;
  const promptTokens = (u.prompt_tokens as number) || 0;
  const completionTokens = (u.completion_tokens as number) || 0;
  const totalTokens = (u.total_tokens as number) || (promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens: (u.prompt_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
  };
}

/**
 * Parse usage from a Responses API response.
 */
function parseResponsesUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const u = usage as Record<string, unknown>;
  const promptTokens = (u.input_tokens as number) || 0;
  const completionTokens = (u.output_tokens as number) || 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cachedTokens: (u.input_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
  };
}

/**
 * Classify an OpenAI SDK error into a ProviderError.
 *
 * Maps HTTP status codes to error categories:
 * - 401/403 → authentication
 * - 429 → rate_limit (with Retry-After extraction)
 * - 500-599 → server
 * - Network/timeout → network
 */
function classifyOpenAIError(error: unknown, baseUrl?: string): ProviderError {
  if (error instanceof APIError) {
    const status = error.status;

    // Log full error details for debugging
    console.warn('[OpenAI API Error]', {
      url: baseUrl,
      status,
      message: error.message,
      code: (error as unknown as Record<string, unknown>).code,
      type: (error as unknown as Record<string, unknown>).type,
      body: JSON.stringify(error.error, null, 2),
    });

    if (status === 401 || status === 403) {
      return new ProviderError(
        'Authentication failed. Please check your API key.',
        'authentication',
      );
    }

    if (status === 429) {
      const retryAfter = extractRetryAfter(error);
      return new ProviderError(
        retryAfter !== null
          ? `Rate limited. Retry after ${retryAfter} seconds.`
          : 'Rate limited. Please wait before retrying.',
        'rate_limit',
        retryAfter,
      );
    }

    if (status && status >= 500 && status < 600) {
      return new ProviderError(
        'Server error. The provider is experiencing issues.',
        'server',
      );
    }

    // Other API errors (400, etc.) — include the actual error message for debugging
    const detail = error.message || `HTTP ${status}`;
    return new ProviderError(
      `API error ${status}: ${detail}`,
      'server',
    );
  }

  // Network/timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('dns') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('fetch') ||
      msg.includes('abort')
    ) {
      return new ProviderError(
        'Network error. Please check your connection.',
        'network',
      );
    }
  }

  // Fallback
  return new ProviderError(
    'An unexpected error occurred.',
    'server',
  );
}

/**
 * Extract the Retry-After value from a rate-limit error.
 *
 * The OpenAI SDK exposes response headers via the error object.
 * Returns the parsed seconds as an integer, or null if not present.
 */
function extractRetryAfter(error: APIError): number | null {
  try {
    // The SDK APIError has a `headers` property (standard fetch Headers)
    const headers = error.headers;
    if (headers) {
      const retryAfter = headers.get('retry-after');
      if (retryAfter) {
        const seconds = parseInt(retryAfter, 10);
        if (!isNaN(seconds) && seconds > 0) {
          return seconds;
        }
      }
    }
  } catch {
    // Ignore header parsing failures
  }
  return null;
}
