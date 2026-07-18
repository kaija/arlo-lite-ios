/**
 * Custom provider adapter — implements IProvider for OpenAI-compatible endpoints.
 *
 * Uses the official OpenAI SDK with a user-supplied base URL, allowing connection
 * to any OpenAI-compatible API (e.g., local LLM servers, alternative hosted
 * endpoints, or proxy services like OpenRouter, Together AI, etc.).
 *
 * The SDK handles streaming properly in React Native (no ReadableStream required).
 * Always operates in Chat Completions mode since that's the universal compatibility format.
 */

import OpenAI, { APIError } from 'openai';
import { xhrFetch } from '@/utils/xhr-fetch';
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
import { mapThinkingLevelCustom } from '../../domain/thinking-mapper';

/**
 * Classify an OpenAI SDK error into a ProviderError.
 */
function classifyOpenAIError(error: unknown): ProviderError {
  if (error instanceof APIError) {
    if (error.status === 401 || error.status === 403) {
      return new ProviderError('Authentication failed', 'authentication');
    }
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after'];
      const seconds = retryAfter ? parseInt(retryAfter, 10) : null;
      return new ProviderError(
        'Rate limited',
        'rate_limit',
        seconds !== null && !isNaN(seconds) ? seconds : null,
      );
    }
    if (error.status && error.status >= 500) {
      return new ProviderError('Server error', 'server');
    }
    return new ProviderError(
      error.message || `HTTP ${error.status}`,
      'server',
    );
  }
  if (error instanceof Error) {
    return new ProviderError(error.message, 'network');
  }
  return new ProviderError('Unknown error', 'server');
}

/**
 * Custom provider adapter.
 *
 * Delegates to the OpenAI SDK in Chat Completions mode with a user-supplied
 * base URL. This approach works reliably in React Native since the SDK
 * handles streaming without requiring ReadableStream support.
 */
export class CustomProvider implements IProvider {
  readonly type: ProviderType = 'custom';

  /** Cached SDK client instance. */
  private client: OpenAI | null = null;

  /** API key used to construct the cached client. */
  private clientKey: string = '';

  /** Base URL used to construct the cached client. */
  private clientBaseUrl: string = '';

  /**
   * Get or create an OpenAI SDK client with the custom base URL.
   *
   * The client is cached and reused as long as apiKey and baseUrl remain unchanged.
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
      fetch: xhrFetch as unknown as OpenAI['_options']['fetch'],
    });
    this.clientKey = apiKey;
    this.clientBaseUrl = baseUrl;
    return this.client;
  }

  /**
   * Execute a non-streaming completion request.
   *
   * Uses OpenAI Chat Completions format via the SDK.
   *
   * @throws ProviderError on auth, network, or server failures
   */
  async complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const client = this.getClient(apiKey, config.baseUrl);
    const thinkingParams = mapThinkingLevelCustom(
      request.thinkingLevel,
      config.reasoningMode ?? 'auto',
      config.thinkingKwargs,
    );

    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((part) =>
              part.type === 'text'
                ? { type: 'text' as const, text: part.text }
                : { type: 'image_url' as const, image_url: { url: part.image_url.url } }
            ),
      }));

      const params: Record<string, unknown> = {
        model: request.model,
        messages,
        stream: false,
      };

      if (request.maxTokens !== undefined) {
        params.max_tokens = request.maxTokens;
      }

      if (thinkingParams.reasoning_effort) {
        params.reasoning_effort = thinkingParams.reasoning_effort;
      }
      if (thinkingParams.chat_template_kwargs) {
        params.chat_template_kwargs = thinkingParams.chat_template_kwargs;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const response = await client.chat.completions.create(params as any);

      const choice = response.choices?.[0];
      const content = choice?.message?.content || '';
      const reasoningContent = (choice?.message as unknown as Record<string, unknown>)?.reasoning_content as string | undefined;
      const finishReason = choice?.finish_reason || 'stop';

      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
        cachedTokens: (response.usage as unknown as Record<string, unknown>)?.prompt_tokens_details
          ? ((response.usage as unknown as Record<string, unknown>).prompt_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined
          : undefined,
      };

      return {
        content,
        thinkingContent: reasoningContent,
        usage,
        finishReason,
      };
    } catch (error) {
      throw classifyOpenAIError(error);
    }
  }

  /**
   * Execute a streaming completion request via the OpenAI SDK.
   *
   * Uses the SDK's built-in streaming which works in React Native
   * (no ReadableStream/response.body required).
   */
  async *streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    if (signal.aborted) {
      yield { type: 'error', content: 'Request cancelled' };
      yield { type: 'done', content: '' };
      return;
    }

    const client = this.getClient(apiKey, config.baseUrl);
    const thinkingParams = mapThinkingLevelCustom(
      request.thinkingLevel,
      config.reasoningMode ?? 'auto',
      config.thinkingKwargs,
    );

    try {
      const messages = request.messages.map((msg) => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: typeof msg.content === 'string'
          ? msg.content
          : msg.content.map((part) =>
              part.type === 'text'
                ? { type: 'text' as const, text: part.text }
                : { type: 'image_url' as const, image_url: { url: part.image_url.url } }
            ),
      }));

      const params: Record<string, unknown> = {
        model: request.model,
        messages,
        stream: true,
      };

      if (request.maxTokens !== undefined) {
        params.max_tokens = request.maxTokens;
      }

      if (thinkingParams.reasoning_effort) {
        params.reasoning_effort = thinkingParams.reasoning_effort;
      }
      if (thinkingParams.chat_template_kwargs) {
        params.chat_template_kwargs = thinkingParams.chat_template_kwargs;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await client.chat.completions.create(
        params as any,
        { signal },
      );

      let usage: TokenUsage | undefined;

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
              continue;
            }

            // Regular text content
            if (delta.content) {
              yield { type: 'text', content: delta.content as string };
              continue;
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

      // Emit final done chunk with accumulated usage
      yield { type: 'done', content: '', ...(usage ? { usage } : {}) };
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }
      const classified = classifyOpenAIError(error);
      yield { type: 'error', content: `${classified.category}: ${classified.message}` };
      yield { type: 'done', content: '' };
    }
  }

  /**
   * List available models from the custom endpoint.
   *
   * GET {baseUrl}/models — may fail gracefully if the endpoint doesn't support
   * the OpenAI models listing format.
   */
  async listModels(config: ProviderConfig, apiKey: string): Promise<string[]> {
    // Try with the primary client (uses expo/fetch)
    try {
      console.log('[listModels] SDK attempt, baseUrl:', config.baseUrl);
      const client = this.getClient(apiKey, config.baseUrl);
      const list = await client.models.list();
      console.log('[listModels] SDK list obtained, iterating...');
      const modelIds: string[] = [];
      for await (const model of list) {
        console.log('[listModels] SDK model:', model.id);
        modelIds.push(model.id);
      }
      console.log('[listModels] SDK result count:', modelIds.length);
      if (modelIds.length > 0) {
        return modelIds.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      }
    } catch (err) {
      console.log('[listModels] SDK failed:', err instanceof Error ? err.message : err);
    }

    // Fallback: use XMLHttpRequest which goes through RN's classic networking
    // bridge and properly respects NSAllowsArbitraryLoads ATS configuration.
    // Both expo/fetch and globalThis.fetch fail on HTTP URLs with New Architecture.
    try {
      const url = config.baseUrl.replace(/\/+$/, '') + '/models';
      console.log('[listModels] XHR fallback fetch:', url);
      
      const json = await new Promise<Record<string, unknown>>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.setRequestHeader('Accept', 'application/json');
        if (apiKey && apiKey !== 'sk-no-key-required') {
          xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
        }
        xhr.timeout = 10000;
        xhr.onload = () => {
          console.log('[listModels] XHR status:', xhr.status);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              console.log('[listModels] XHR response (first 500):', xhr.responseText.substring(0, 500));
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              reject(new Error('Invalid JSON response'));
            }
          } else {
            reject(new Error(`HTTP ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error('XHR network error'));
        xhr.ontimeout = () => reject(new Error('XHR timeout'));
        xhr.send();
      });

      const modelIds: string[] = [];

      // OpenAI format: { data: [{ id: "model-name" }] }
      if (Array.isArray(json.data)) {
        for (const item of json.data as Array<{ id?: string }>) {
          if (item.id) modelIds.push(item.id);
        }
        console.log('[listModels] Parsed from data[]:', modelIds.length);
      }
      // Ollama format: { models: [{ name: "model-name", model?: "model-name" }] }
      if (modelIds.length === 0 && Array.isArray(json.models)) {
        for (const item of json.models as Array<{ name?: string; model?: string }>) {
          if (item.name) modelIds.push(item.name);
          else if (item.model) modelIds.push(item.model);
        }
        console.log('[listModels] Parsed from models[]:', modelIds.length);
      }

      console.log('[listModels] XHR fallback total:', modelIds.length, modelIds);
      return modelIds.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch (err) {
      console.log('[listModels] XHR fallback failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Validate an API key by attempting to list models or a minimal completion.
   *
   * Falls back gracefully since not all custom endpoints support the same features.
   */
  async validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean> {
    const client = this.getClient(apiKey, config.baseUrl);

    try {
      // Try listing models first
      const list = await client.models.list();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _model of list) {
        break; // Only need one to confirm validity
      }
      return true;
    } catch (error) {
      if (error instanceof APIError) {
        if (error.status === 401 || error.status === 403) {
          return false;
        }
        // Other errors (429, 500, etc.) mean the key is likely valid
        return true;
      }
      // Network errors — can't validate, but don't reject the key
      return false;
    }
  }
}
