/**
 * Custom provider adapter — implements IProvider for OpenAI-compatible endpoints.
 *
 * Uses the OpenAI Chat Completions format with a user-supplied base URL,
 * allowing connection to any OpenAI-compatible API (e.g., local LLM servers,
 * alternative hosted endpoints, or proxy services).
 */

import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderConfig,
  ProviderType,
  StreamChunk,
  ThinkingLevel,
} from '../types';
import { mapThinkingLevelOpenAI } from '../../domain/thinking-mapper';
import { buildChatCompletionsRequest, parseChatCompletionsResponse } from '../openai/openai-chat';

/**
 * Custom provider adapter.
 *
 * Delegates to the OpenAI Chat Completions format for request building
 * and response parsing, using a user-supplied base URL rather than the
 * default OpenAI endpoint.
 */
export class CustomProvider implements IProvider {
  readonly type: ProviderType = 'custom';

  /**
   * Temporary in-memory API key storage for request building.
   * Set externally before calling buildRequest.
   */
  private apiKey: string = '';

  /**
   * Set the API key for subsequent requests.
   * This avoids passing apiKey through the IProvider.buildRequest signature.
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Build the HTTP request for a completion.
   *
   * Uses OpenAI Chat Completions format: POST {baseUrl}/chat/completions
   */
  buildRequest(
    config: ProviderConfig,
    request: CompletionRequest
  ): { url: string; headers: Record<string, string>; body: string } {
    const thinkingParams = this.mapThinkingLevel(request.thinkingLevel);
    return buildChatCompletionsRequest(config, request, thinkingParams, this.apiKey);
  }

  /**
   * Parse a non-streaming response.
   *
   * Uses the OpenAI Chat Completions response format (choices[0].message).
   */
  parseResponse(raw: unknown): CompletionResponse {
    return parseChatCompletionsResponse(raw);
  }

  /**
   * Parse a single SSE line into a StreamChunk.
   *
   * Uses the OpenAI SSE format:
   * - Lines starting with "data: " contain JSON payloads
   * - "data: [DONE]" signals stream completion
   * - Empty lines and comments (starting with ":") are skipped
   */
  parseStreamChunk(line: string): StreamChunk | null {
    // Skip empty lines and SSE comments
    if (!line || line.startsWith(':')) {
      return null;
    }

    // Strip "data: " prefix
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
   * Map an abstract ThinkingLevel to OpenAI-compatible request parameters.
   *
   * Custom providers use the same reasoning_effort mapping as OpenAI.
   */
  mapThinkingLevel(level: ThinkingLevel): Record<string, unknown> {
    return mapThinkingLevelOpenAI(level);
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
