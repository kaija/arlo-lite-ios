/**
 * Unit tests for the Custom provider adapter.
 *
 * The Custom provider uses OpenAI Chat Completions format
 * with a user-supplied base URL. Implements the new IProvider
 * interface with complete() and streamCompletion().
 */

import { CustomProvider } from '../custom/custom-provider';
import { ProviderError } from '../errors';
import type { CompletionRequest, ProviderConfig } from '../types';

describe('CustomProvider', () => {
  let provider: CustomProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    provider = new CustomProvider();
    config = {
      id: 'custom-1',
      type: 'custom',
      name: 'Local LLM',
      baseUrl: 'http://localhost:8080/v1',
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  describe('type', () => {
    it('should be "custom"', () => {
      expect(provider.type).toBe('custom');
    });
  });

  describe('complete()', () => {
    it('sends request to the correct URL with proper headers', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: 'Hello!' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockResponse);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test-key');

      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk-test-key',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });

    it('returns parsed CompletionResponse', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            { message: { content: 'The answer is 42.', reasoning_content: 'Let me think...' }, finish_reason: 'stop' },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 6, total_tokens: 16 },
        }),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'What is the meaning of life?' }],
        model: 'deepseek-r1',
        thinkingLevel: 'medium',
        stream: false,
      };

      const result = await provider.complete(config, request, 'sk-test');

      expect(result.content).toBe('The answer is 42.');
      expect(result.thinkingContent).toBe('Let me think...');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(6);
      expect(result.usage.totalTokens).toBe(16);
    });

    it('includes reasoning_effort when thinking level is not off', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Think about this' }],
        model: 'deepseek-r1',
        thinkingLevel: 'medium',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.reasoning_effort).toBe('medium');
    });

    it('omits reasoning_effort when thinking level is off', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 5, completion_tokens: 1, total_tokens: 6 },
        }),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      await provider.complete(config, request, 'sk-test');

      const fetchCall = (fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.reasoning_effort).toBeUndefined();
    });

    it('throws ProviderError on 401', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Map(),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      await expect(provider.complete(config, request, 'sk-bad')).rejects.toThrow(ProviderError);
      await expect(provider.complete(config, request, 'sk-bad')).rejects.toMatchObject({
        category: 'authentication',
      });
    });

    it('throws ProviderError with rate_limit on 429', async () => {
      const headers = new Map([['Retry-After', '30']]);
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: (key: string) => headers.get(key) ?? null },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      try {
        await provider.complete(config, request, 'sk-test');
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        const pe = error as ProviderError;
        expect(pe.category).toBe('rate_limit');
        expect(pe.retryAfterSeconds).toBe(30);
      }
    });

    it('throws ProviderError with server category on 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => null },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      await expect(provider.complete(config, request, 'sk-test')).rejects.toMatchObject({
        category: 'server',
      });
    });
  });

  describe('streamCompletion()', () => {
    function createMockSSEStream(lines: string[]): ReadableStream<Uint8Array> {
      const encoder = new TextEncoder();
      const data = lines.join('\n') + '\n';
      return new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(data));
          controller.close();
        },
      });
    }

    it('yields text chunks from SSE stream', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}',
        'data: {"choices":[{"delta":{"content":" world"}}]}',
        'data: [DONE]',
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEStream(sseData),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual([
        { type: 'text', content: 'Hello' },
        { type: 'text', content: ' world' },
        { type: 'done', content: '' },
      ]);
    });

    it('yields thinking chunks from SSE stream', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"reasoning_content":"Thinking..."}}]}',
        'data: {"choices":[{"delta":{"content":"Answer"}}]}',
        'data: [DONE]',
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEStream(sseData),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Think' }],
        model: 'deepseek-r1',
        thinkingLevel: 'high',
        stream: true,
      };

      const controller = new AbortController();
      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: 'thinking', content: 'Thinking...' });
      expect(chunks[1]).toEqual({ type: 'text', content: 'Answer' });
      expect(chunks[2]).toEqual({ type: 'done', content: '' });
    });

    it('yields error chunk on non-OK HTTP response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => null },
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0].type).toBe('error');
      expect(chunks[0].content).toContain('rate_limit');
      expect(chunks[1]).toEqual({ type: 'done', content: '' });
    });

    it('yields error chunk on null response body', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: 'error', content: 'Response body is null' });
      expect(chunks[1]).toEqual({ type: 'done', content: '' });
    });

    it('yields done chunk on abort during fetch', async () => {
      const controller = new AbortController();
      controller.abort();

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      global.fetch = jest.fn().mockRejectedValue(abortError);

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: true,
      };

      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      // When aborted, should get just a done chunk
      expect(chunks[chunks.length - 1]).toEqual({ type: 'done', content: '' });
    });

    it('yields usage data from final stream chunk', async () => {
      const sseData = [
        'data: {"choices":[{"delta":{"content":"Hi"}}]}',
        'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}',
        'data: [DONE]',
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        body: createMockSSEStream(sseData),
      });

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hi' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: true,
      };

      const controller = new AbortController();
      const chunks = [];
      for await (const chunk of provider.streamCompletion(config, request, 'sk-test', controller.signal)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toEqual({ type: 'text', content: 'Hi' });
      // The usage-only chunk produces a done with usage
      expect(chunks[1]).toEqual({
        type: 'done',
        content: '',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
          cachedTokens: undefined,
        },
      });
    });
  });

  describe('listModels', () => {
    it('returns model IDs from a successful response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: 'llama-3-8b' }, { id: 'mistral-7b' }],
        }),
      });

      const models = await provider.listModels(config, 'sk-test');
      expect(models).toEqual(['llama-3-8b', 'mistral-7b']);
      expect(fetch).toHaveBeenCalledWith('http://localhost:8080/v1/models', {
        method: 'GET',
        headers: { 'Authorization': 'Bearer sk-test' },
      });
    });

    it('returns empty array when endpoint is not supported', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const models = await provider.listModels(config, 'sk-test');
      expect(models).toEqual([]);
    });

    it('returns empty array on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const models = await provider.listModels(config, 'sk-test');
      expect(models).toEqual([]);
    });

    it('returns empty array when response has no data field', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: ['a', 'b'] }),
      });

      const models = await provider.listModels(config, 'sk-test');
      expect(models).toEqual([]);
    });
  });

  describe('validateApiKey', () => {
    it('returns true when chat completions succeeds', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: true });

      const result = await provider.validateApiKey(config, 'sk-valid');
      expect(result).toBe(true);
    });

    it('returns false when auth fails (401)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

      const result = await provider.validateApiKey(config, 'sk-invalid');
      expect(result).toBe(false);
    });

    it('returns false when auth fails (403)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

      const result = await provider.validateApiKey(config, 'sk-invalid');
      expect(result).toBe(false);
    });

    it('falls back to models endpoint when chat completions returns 404', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({ ok: true });

      const result = await provider.validateApiKey(config, 'sk-test');
      expect(result).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('falls back to models endpoint on network error', async () => {
      global.fetch = jest.fn()
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce({ ok: true });

      const result = await provider.validateApiKey(config, 'sk-test');
      expect(result).toBe(true);
    });

    it('returns false when both endpoints fail', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({ ok: false, status: 500 });

      const result = await provider.validateApiKey(config, 'sk-test');
      expect(result).toBe(false);
    });
  });
});
