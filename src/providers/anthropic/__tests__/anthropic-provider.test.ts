/**
 * Unit tests for the SDK-based Anthropic provider adapter.
 */

import { AnthropicProvider } from '../anthropic-provider';
import type { ProviderConfig, CompletionRequest } from '../../types';

// Mock SDK client methods
const mockCreate = jest.fn();
const mockStream = jest.fn();
const mockModelsList = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  // Return a constructor function that produces our mock client
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate,
      stream: mockStream,
    },
    models: {
      list: mockModelsList,
    },
  }));

  // Re-export the real error classes for instanceof checks
  const actual = jest.requireActual('@anthropic-ai/sdk');

  // The SDK exports itself as both callable and as default
  const mockModule: any = MockAnthropic;
  mockModule.default = MockAnthropic;
  mockModule.__esModule = true;
  // Copy over error classes from the real module
  mockModule.APIError = actual.APIError;
  mockModule.APIConnectionError = actual.APIConnectionError;
  mockModule.APIConnectionTimeoutError = actual.APIConnectionTimeoutError;
  mockModule.APIUserAbortError = actual.APIUserAbortError;
  mockModule.AuthenticationError = actual.AuthenticationError;
  mockModule.PermissionDeniedError = actual.PermissionDeniedError;
  mockModule.RateLimitError = actual.RateLimitError;

  return mockModule;
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    provider = new AnthropicProvider();
    config = {
      id: 'anthropic-1',
      type: 'anthropic',
      name: 'Anthropic',
      baseUrl: 'https://api.anthropic.com',
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockCreate.mockReset();
    mockStream.mockReset();
    mockModelsList.mockReset();
  });

  describe('type', () => {
    it('should be anthropic', () => {
      expect(provider.type).toBe('anthropic');
    });
  });

  describe('complete', () => {
    it('calls SDK with correct parameters', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hello world' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 4096,
          stream: false,
          thinking: { type: 'disabled' },
        }),
      );
    });

    it('extracts system message to top-level param', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are helpful.',
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });

    it('omits system field when no system message present', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      const call = mockCreate.mock.calls[0][0];
      expect(call.system).toBeUndefined();
    });

    it('uses default max_tokens of 4096 when not specified', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 4096 }),
      );
    });

    it('respects custom maxTokens', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
        maxTokens: 2048,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ max_tokens: 2048 }),
      );
    });

    it('includes thinking block when thinkingLevel is not off', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-7-sonnet-20250219',
        thinkingLevel: 'medium',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          thinking: { type: 'enabled', budget_tokens: 8192 },
        }),
      );
    });

    it('maps response with text and thinking content', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          { type: 'thinking', thinking: 'Let me think...' },
          { type: 'text', text: 'The answer is 42.' },
        ],
        usage: { input_tokens: 20, output_tokens: 30, cache_read_input_tokens: 5 },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-7-sonnet-20250219',
        thinkingLevel: 'high',
        stream: false,
      };

      const result = await provider.complete(config, request, 'sk-test');

      expect(result.content).toBe('The answer is 42.');
      expect(result.thinkingContent).toBe('Let me think...');
      expect(result.usage.promptTokens).toBe(20);
      expect(result.usage.completionTokens).toBe(30);
      expect(result.usage.totalTokens).toBe(50);
      expect(result.usage.cachedTokens).toBe(5);
      expect(result.finishReason).toBe('end_turn');
    });

    it('concatenates multiple system messages', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'Be concise.' },
          { role: 'system', content: 'Use markdown.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'Be concise.\nUse markdown.',
        }),
      );
    });

    it('throws ProviderError on authentication failure', async () => {
      const { AuthenticationError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new AuthenticationError(401, { type: 'error' }, 'Invalid API key', new Headers()),
      );

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await expect(provider.complete(config, request, 'sk-bad')).rejects.toMatchObject({
        name: 'ProviderError',
        category: 'authentication',
      });
    });

    it('throws ProviderError with rate_limit category on 429', async () => {
      const { RateLimitError } = require('@anthropic-ai/sdk');
      const headers = new Headers({ 'retry-after': '30' });
      mockCreate.mockRejectedValueOnce(
        new RateLimitError(429, { type: 'error' }, 'Rate limited', headers),
      );

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await expect(provider.complete(config, request, 'sk-test')).rejects.toMatchObject({
        name: 'ProviderError',
        category: 'rate_limit',
        retryAfterSeconds: 30,
      });
    });

    it('throws ProviderError with overloaded category on 529', async () => {
      const { APIError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new APIError(529, { type: 'error' }, 'Overloaded', new Headers()),
      );

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      await expect(provider.complete(config, request, 'sk-test')).rejects.toMatchObject({
        name: 'ProviderError',
        category: 'overloaded',
      });
    });
  });

  describe('streamCompletion', () => {
    it('yields text chunks from stream events', async () => {
      const events = [
        { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } },
        { type: 'message_delta', usage: { output_tokens: 5 } },
        { type: 'message_stop' },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks: any[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: 'text', content: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'text', content: ' world' });
      // Final done chunk with usage
      const doneChunk = chunks[chunks.length - 1];
      expect(doneChunk.type).toBe('done');
      expect(doneChunk.usage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      });
    });

    it('yields thinking chunks from thinking_delta events', async () => {
      const events = [
        { type: 'message_start', message: { usage: { input_tokens: 10, output_tokens: 0 } } },
        { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Hmm...' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Answer' } },
        { type: 'message_delta', usage: { output_tokens: 8 } },
        { type: 'message_stop' },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-7-sonnet-20250219',
        thinkingLevel: 'high',
        stream: true,
      };

      const controller = new AbortController();
      const chunks: any[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: 'thinking', content: 'Hmm...' });
      expect(chunks[1]).toEqual({ type: 'text', content: 'Answer' });
    });

    it('skips unrecognized delta types', async () => {
      const events = [
        { type: 'message_start', message: { usage: { input_tokens: 5, output_tokens: 0 } } },
        { type: 'content_block_delta', delta: { type: 'input_json_delta', partial_json: '{}' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi' } },
        { type: 'message_delta', usage: { output_tokens: 2 } },
        { type: 'message_stop' },
      ];

      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) yield event;
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks: any[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      const textChunks = chunks.filter((c) => c.type === 'text');
      expect(textChunks).toHaveLength(1);
      expect(textChunks[0].content).toBe('Hi');
    });

    it('emits error+done on SDK error during stream', async () => {
      const { RateLimitError } = require('@anthropic-ai/sdk');
      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          throw new RateLimitError(429, { type: 'error' }, 'Rate limited', new Headers());
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks: any[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks.some((c) => c.type === 'error')).toBe(true);
      expect(chunks[chunks.length - 1].type).toBe('done');
    });

    it('emits done chunk on abort', async () => {
      const { APIUserAbortError } = require('@anthropic-ai/sdk');
      mockStream.mockReturnValueOnce({
        [Symbol.asyncIterator]: async function* () {
          throw new APIUserAbortError();
        },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      controller.abort();
      const chunks: any[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[chunks.length - 1].type).toBe('done');
      expect(chunks.some((c) => c.type === 'error')).toBe(false);
    });
  });

  describe('listModels', () => {
    it('returns models from SDK endpoint when available', async () => {
      mockModelsList.mockResolvedValueOnce({
        data: [
          { id: 'claude-3-5-sonnet-20241022' },
          { id: 'claude-3-opus-20240229' },
        ],
      });

      const models = await provider.listModels(config, 'sk-test');
      expect(models).toEqual(['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229']);
    });

    it('falls back to curated list on non-auth failure', async () => {
      mockModelsList.mockRejectedValueOnce(new Error('Network error'));

      const models = await provider.listModels(config, 'sk-test');
      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-sonnet-4-20250514');
    });

    it('throws ProviderError on auth failure', async () => {
      const { AuthenticationError } = require('@anthropic-ai/sdk');
      mockModelsList.mockRejectedValueOnce(
        new AuthenticationError(401, { type: 'error' }, 'Invalid key', new Headers()),
      );

      await expect(provider.listModels(config, 'sk-bad')).rejects.toMatchObject({
        name: 'ProviderError',
        category: 'authentication',
      });
    });
  });

  describe('validateApiKey', () => {
    it('returns true when SDK request succeeds', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      const result = await provider.validateApiKey(config, 'sk-valid-key');
      expect(result).toBe(true);
    });

    it('returns false for AuthenticationError', async () => {
      const { AuthenticationError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new AuthenticationError(401, { type: 'error' }, 'Invalid key', new Headers()),
      );

      const result = await provider.validateApiKey(config, 'sk-invalid');
      expect(result).toBe(false);
    });

    it('returns false for PermissionDeniedError', async () => {
      const { PermissionDeniedError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new PermissionDeniedError(403, { type: 'error' }, 'Forbidden', new Headers()),
      );

      const result = await provider.validateApiKey(config, 'sk-forbidden');
      expect(result).toBe(false);
    });

    it('returns true for rate limit (key is valid)', async () => {
      const { RateLimitError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new RateLimitError(429, { type: 'error' }, 'Rate limited', new Headers()),
      );

      const result = await provider.validateApiKey(config, 'sk-valid');
      expect(result).toBe(true);
    });

    it('returns false for network error', async () => {
      const { APIConnectionError } = require('@anthropic-ai/sdk');
      mockCreate.mockRejectedValueOnce(
        new APIConnectionError({ message: 'Network error' }),
      );

      const result = await provider.validateApiKey(config, 'sk-test');
      expect(result).toBe(false);
    });

    it('sends minimal request for validation', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: null },
        stop_reason: 'end_turn',
      });

      await provider.validateApiKey(config, 'sk-test');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
        }),
      );
    });
  });
});
