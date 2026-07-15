/**
 * OpenAI provider adapter implementing the IProvider interface.
 *
 * Supports both the Responses API and Chat Completions API based on
 * the provider's apiMode configuration. Delegates request building
 * and response parsing to the appropriate module.
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
import { buildResponsesRequest, parseResponsesResponse } from './openai-responses';
import { buildChatCompletionsRequest, parseChatCompletionsResponse } from './openai-chat';

/**
 * OpenAI provider adapter.
 *
 * Handles both the Responses API (default for new OpenAI providers)
 * and the Chat Completions API, routing to the appropriate format
 * based on the provider's `apiMode` setting.
 */
export class OpenAIProvider implements IProvider {
  readonly type: ProviderType = 'openai';

  /** API key for request authorization. */
  apiKey: string;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  /**
   * Set the API key for subsequent requests.
   */
  setApiKey(key: string): void {
    this.apiKey = key;
  }

  /**
   * Build the HTTP request for a completion.
   *
   * Delegates to openai-responses.ts or openai-chat.ts based on config.apiMode.
   */
  buildRequest(
    config: ProviderConfig,
    request: CompletionRequest
  ): { url: string; headers: Record<string, string>; body: string } {
    const thinkingParams = this.mapThinkingLevel(request.thinkingLevel);

    if (config.apiMode === 'chat-completions') {
      return buildChatCompletionsRequest(config, request, thinkingParams, this.apiKey);
    }

    // Default: Responses API
    return buildResponsesRequest(config, request, thinkingParams, this.apiKey);
  }

  /**
   * Parse a non-streaming response.
   *
   * Delegates based on the response shape — Responses API has `output`,
   * Chat Completions has `choices`.
   */
  parseResponse(raw: unknown): CompletionResponse {
    const data = raw as Record<string, unknown>;

    // Detect format by presence of `choices` (Chat Completions) vs `output` (Responses)
    if (data.choices) {
      return parseChatCompletionsResponse(raw);
    }

    return parseResponsesResponse(raw);
  }

  /**
   * Parse a single SSE line into a StreamChunk.
   *
   * OpenAI SSE format:
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

      // Chat Completions streaming format
      if (data.choices) {
        return this.parseChatCompletionsChunk(data);
      }

      // Responses API streaming format
      if (data.type) {
        return this.parseResponsesChunk(data);
      }

      return null;
    } catch {
      return { type: 'error', content: 'Failed to parse stream chunk' };
    }
  }

  /**
   * Map an abstract ThinkingLevel to OpenAI-specific request parameters.
   *
   * Uses the thinking-mapper domain function.
   */
  mapThinkingLevel(level: ThinkingLevel): Record<string, unknown> {
    return mapThinkingLevelOpenAI(level);
  }

  /**
   * List available models from the OpenAI API.
   *
   * GET /models endpoint returns a list of available model objects.
   */
  async listModels(config: ProviderConfig, apiKey: string): Promise<string[]> {
    const url = `${config.baseUrl}/models`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list models: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { data: Array<{ id: string }> };
    return data.data.map((model) => model.id);
  }

  /**
   * Validate an API key by sending a minimal completion request.
   *
   * Uses max_tokens: 10 to minimize cost while confirming the key works.
   */
  async validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean> {
    const url = `${config.baseUrl}/chat/completions`;

    try {
      const response = await fetch(url, {
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

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Parse a Chat Completions streaming chunk.
   */
  private parseChatCompletionsChunk(data: Record<string, unknown>): StreamChunk | null {
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
  }

  /**
   * Parse a Responses API streaming event.
   */
  private parseResponsesChunk(data: Record<string, unknown>): StreamChunk | null {
    const eventType = data.type as string;

    switch (eventType) {
      case 'response.output_text.delta': {
        const delta = (data.delta as string) || '';
        return { type: 'text', content: delta };
      }

      case 'response.reasoning.delta': {
        const delta = (data.delta as string) || '';
        return { type: 'thinking', content: delta };
      }

      case 'response.completed': {
        const response = data.response as Record<string, unknown> | undefined;
        if (response?.usage) {
          const u = response.usage as Record<string, unknown>;
          return {
            type: 'done',
            content: '',
            usage: {
              promptTokens: (u.input_tokens as number) || 0,
              completionTokens: (u.output_tokens as number) || 0,
              totalTokens: ((u.input_tokens as number) || 0) + ((u.output_tokens as number) || 0),
            },
          };
        }
        return { type: 'done', content: '' };
      }

      case 'response.failed':
      case 'response.incomplete': {
        return { type: 'error', content: eventType };
      }

      default:
        return null;
    }
  }
}
