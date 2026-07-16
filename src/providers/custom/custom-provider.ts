/**
 * Custom provider adapter — implements IProvider for OpenAI-compatible endpoints.
 *
 * Uses the OpenAI Chat Completions format with a user-supplied base URL,
 * allowing connection to any OpenAI-compatible API (e.g., local LLM servers,
 * alternative hosted endpoints, or proxy services).
 *
 * Performs raw fetch + inline SSE line parsing (does NOT depend on SSE_Manager)
 * since the SSE_Manager still references the removed `parseStreamChunk` interface.
 */

import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderConfig,
  ProviderType,
  StreamChunk,
  TokenUsage,
} from '../types';
import { ProviderError } from '../errors';
import { mapThinkingLevelOpenAI } from '../../domain/thinking-mapper';
import { buildChatCompletionsRequest, parseChatCompletionsResponse } from '../openai/openai-chat';

/**
 * Classify an HTTP status code into a ProviderError.
 *
 * Maps common failure codes to structured error categories so that
 * callers can branch on category without inspecting raw status codes.
 */
function classifyHttpError(status: number, retryAfter?: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('Authentication failed', 'authentication');
  }
  if (status === 429) {
    const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
    return new ProviderError(
      'Rate limited',
      'rate_limit',
      seconds !== null && !isNaN(seconds) ? seconds : null,
    );
  }
  if (status >= 500) {
    return new ProviderError('Server error', 'server');
  }
  return new ProviderError(`HTTP ${status}`, 'server');
}

/**
 * Parse a single SSE line into a StreamChunk.
 *
 * Uses the OpenAI SSE format:
 * - Lines starting with "data: " contain JSON payloads
 * - "data: [DONE]" signals stream completion
 * - Empty lines and comments (starting with ":") are skipped
 */
function parseSSELine(line: string): StreamChunk | null {
  // Skip empty lines and SSE comments
  if (!line || line.startsWith(':')) {
    return null;
  }

  // Only handle "data: " prefixed lines
  if (!line.startsWith('data: ')) {
    return null;
  }

  const payload = line.slice(6); // Remove "data: "

  // Handle stream terminator
  if (payload === '[DONE]') {
    return { type: 'done', content: '' };
  }

  try {
    const data = JSON.parse(payload) as Record<string, unknown>;
    const choices = data.choices as Array<Record<string, unknown>> | undefined;

    if (!choices || choices.length === 0) {
      // Usage-only chunk at end of stream
      if (data.usage) {
        const u = data.usage as Record<string, unknown>;
        return {
          type: 'done',
          content: '',
          usage: {
            promptTokens: (u.prompt_tokens as number) || 0,
            completionTokens: (u.completion_tokens as number) || 0,
            totalTokens: (u.total_tokens as number) || 0,
            cachedTokens: (u.prompt_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
          },
        };
      }
      return null;
    }

    const choice = choices[0];
    const delta = choice.delta as Record<string, unknown> | undefined;

    if (!delta) {
      // finish_reason only chunk
      if (choice.finish_reason) {
        return { type: 'done', content: '' };
      }
      return null;
    }

    // Reasoning/thinking content
    if (delta.reasoning_content) {
      return { type: 'thinking', content: delta.reasoning_content as string };
    }

    // Regular text content
    if (delta.content) {
      return { type: 'text', content: delta.content as string };
    }

    return null;
  } catch {
    return { type: 'error', content: 'Failed to parse stream chunk' };
  }
}

/**
 * Custom provider adapter.
 *
 * Delegates to the OpenAI Chat Completions format for request building
 * and response parsing, using a user-supplied base URL rather than the
 * default OpenAI endpoint. Performs inline SSE parsing for streaming.
 */
export class CustomProvider implements IProvider {
  readonly type: ProviderType = 'custom';

  /**
   * Execute a non-streaming completion request.
   *
   * Uses OpenAI Chat Completions format: POST {baseUrl}/chat/completions
   *
   * @throws ProviderError on auth, network, or server failures
   */
  async complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const thinkingParams = mapThinkingLevelOpenAI(request.thinkingLevel);
    const { url, headers, body } = buildChatCompletionsRequest(config, request, thinkingParams, apiKey);

    const response = await fetch(url, { method: 'POST', headers, body });

    if (!response.ok) {
      throw classifyHttpError(response.status, response.headers.get('Retry-After') ?? undefined);
    }

    return parseChatCompletionsResponse(await response.json());
  }

  /**
   * Execute a streaming completion request via inline SSE parsing.
   *
   * Returns an AsyncIterable that yields StreamChunks as they arrive.
   * Terminates with a 'done' chunk on success or an 'error' chunk on failure.
   *
   * @param config - Provider configuration
   * @param request - The completion request parameters (stream flag forced to true)
   * @param apiKey - API key for authentication
   * @param signal - AbortSignal for cancellation
   */
  async *streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    const thinkingParams = mapThinkingLevelOpenAI(request.thinkingLevel);
    const streamRequest = { ...request, stream: true };
    const { url, headers, body } = buildChatCompletionsRequest(config, streamRequest, thinkingParams, apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { ...headers, Accept: 'text/event-stream' },
        body,
        signal,
      });
    } catch (error: unknown) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }
      yield { type: 'error', content: error instanceof Error ? error.message : 'Network error' };
      yield { type: 'done', content: '' };
      return;
    }

    if (!response.ok) {
      const classified = classifyHttpError(
        response.status,
        response.headers.get('Retry-After') ?? undefined,
      );
      yield { type: 'error', content: `${classified.category}: ${classified.message}` };
      yield { type: 'done', content: '' };
      return;
    }

    if (!response.body) {
      yield { type: 'error', content: 'Response body is null' };
      yield { type: 'done', content: '' };
      return;
    }

    // Read and parse SSE stream inline
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!signal.aborted) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n|\r/);
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (signal.aborted) break;
          const chunk = parseSSELine(line);
          if (chunk) {
            yield chunk;
            if (chunk.type === 'done') return;
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const chunk = parseSSELine(buffer);
        if (chunk) yield chunk;
      }

      yield { type: 'done', content: '' };
    } catch (error: unknown) {
      if (!signal.aborted) {
        yield { type: 'error', content: error instanceof Error ? error.message : 'Stream error' };
      }
      yield { type: 'done', content: '' };
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * List available models from the custom endpoint.
   *
   * GET {baseUrl}/models — may fail gracefully if the endpoint doesn't support
   * the OpenAI models listing format.
   */
  async listModels(config: ProviderConfig, apiKey: string): Promise<string[]> {
    const url = `${config.baseUrl}/models`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        // Many custom endpoints don't support /models — fail gracefully
        return [];
      }

      const data = (await response.json()) as { data?: Array<{ id: string }> };

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.map((model) => model.id);
    } catch {
      // Graceful failure — custom endpoints may not support model listing
      return [];
    }
  }

  /**
   * Validate an API key by attempting a minimal completion request.
   *
   * Falls back to the models list endpoint if chat completions isn't available.
   */
  async validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean> {
    // First try a minimal chat completion
    const chatUrl = `${config.baseUrl}/chat/completions`;

    try {
      const response = await fetch(chatUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 10,
        }),
      });

      if (response.ok) {
        return true;
      }

      // If chat completions fails with 404 (endpoint doesn't exist),
      // try the models endpoint instead
      if (response.status === 404) {
        return this.validateViaModels(config, apiKey);
      }

      // 401/403 means the key is invalid
      if (response.status === 401 || response.status === 403) {
        return false;
      }

      // Other errors (e.g., model not found) — key might still be valid
      // Try models endpoint as fallback
      return this.validateViaModels(config, apiKey);
    } catch {
      // Network error — try models endpoint as fallback
      return this.validateViaModels(config, apiKey);
    }
  }

  /**
   * Validate the API key using the models list endpoint.
   */
  private async validateViaModels(config: ProviderConfig, apiKey: string): Promise<boolean> {
    const modelsUrl = `${config.baseUrl}/models`;

    try {
      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}
