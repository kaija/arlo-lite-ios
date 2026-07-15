/**
 * Unit tests for the Custom provider adapter.
 *
 * The Custom provider uses OpenAI Chat Completions format
 * with a user-supplied base URL.
 */

import { CustomProvider } from '../custom/custom-provider';
import type { CompletionRequest, ProviderConfig } from '../types';

describe('CustomProvider', () => {
  let provider: CustomProvider;
  let config: ProviderConfig;

  beforeEach(() => {
    provider = new CustomProvider();
    provider.setApiKey('sk-test-key');
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

  describe('buildRequest', () => {
    it('builds a request using the custom base URL', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);

      expect(result.url).toBe('http://localhost:8080/v1/chat/completions');
      expect(result.headers['Authorization']).toBe('Bearer sk-test-key');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('includes model and messages in body', () => {
      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hi' },
        ],
        model: 'mistral-7b',
        thinkingLevel: 'off',
        stream: true,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.model).toBe('mistral-7b');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'You are helpful.' });
      expect(body.messages[1]).toEqual({ role: 'user', content: 'Hi' });
      expect(body.stream).toBe(true);
    });

    it('includes max_tokens when specified', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
        maxTokens: 500,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.max_tokens).toBe(500);
    });

    it('includes reasoning_effort when thinking level is not off', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Think about this' }],
        model: 'deepseek-r1',
        thinkingLevel: 'medium',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.reasoning_effort).toBe('medium');
    });

    it('omits reasoning_effort when thinking level is off', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'llama-3-8b',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.reasoning_effort).toBeUndefined();
    });

    it('uses different base URLs correctly', () => {
      const customConfig: ProviderConfig = {
        ...config,
        baseUrl: 'https://my-proxy.example.com/api',
      };

      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-4',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(customConfig, request);
      expect(result.url).toBe('https://my-proxy.example.com/api/chat/completions');
    });
  });

  describe('parseResponse', () => {
    it('parses a standard Chat Completions response', () => {
      const raw = {
        choices: [
          {
            message: { content: 'Hello! How can I help?' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 6,
          total_tokens: 16,
        },
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('Hello! How can I help?');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(6);
      expect(result.usage.totalTokens).toBe(16);
    });

    it('parses response with reasoning_content', () => {
      const raw = {
        choices: [
          {
            message: {
              content: 'The answer is 42.',
              reasoning_content: 'Let me think step by step...',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 20,
          total_tokens: 35,
        },
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('The answer is 42.');
      expect(result.thinkingContent).toBe('Let me think step by step...');
    });

    it('handles empty choices gracefully', () => {
      const raw = {
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };

      const result = provider.parseResponse(raw);
      expect(result.content).toBe('');
    });
  });

  describe('parseStreamChunk', () => {
    it('returns null for empty lines', () => {
      expect(provider.parseStreamChunk('')).toBeNull();
    });

    it('returns null for SSE comments', () => {
      expect(provider.parseStreamChunk(': keep-alive')).toBeNull();
    });

    it('returns null for lines without data: prefix', () => {
      expect(provider.parseStreamChunk('event: message')).toBeNull();
    });

    it('returns done for [DONE] terminator', () => {
      const result = provider.parseStreamChunk('data: [DONE]');
      expect(result).toEqual({ type: 'done', content: '' });
    });

    it('parses text content from delta', () => {
      const chunk = JSON.stringify({
        choices: [{ delta: { content: 'Hello' } }],
      });

      const result = provider.parseStreamChunk(`data: ${chunk}`);
      expect(result).toEqual({ type: 'text', content: 'Hello' });
    });

    it('parses thinking content from delta', () => {
      const chunk = JSON.stringify({
        choices: [{ delta: { reasoning_content: 'Thinking...' } }],
      });

      const result = provider.parseStreamChunk(`data: ${chunk}`);
      expect(result).toEqual({ type: 'thinking', content: 'Thinking...' });
    });

    it('parses done with usage data', () => {
      const chunk = JSON.stringify({
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      });

      const result = provider.parseStreamChunk(`data: ${chunk}`);
      expect(result).toEqual({
        type: 'done',
        content: '',
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
          cachedTokens: undefined,
        },
      });
    });

    it('returns error for malformed JSON', () => {
      const result = provider.parseStreamChunk('data: {invalid json}');
      expect(result).toEqual({ type: 'error', content: 'Failed to parse stream chunk' });
    });

    it('returns done for finish_reason chunk', () => {
      const chunk = JSON.stringify({
        choices: [{ delta: {}, finish_reason: 'stop' }],
      });

      const result = provider.parseStreamChunk(`data: ${chunk}`);
      // delta is empty object but has no content/reasoning_content, should return null
      expect(result).toBeNull();
    });
  });

  describe('mapThinkingLevel', () => {
    it('returns empty object for "off"', () => {
      expect(provider.mapThinkingLevel('off')).toEqual({});
    });

    it('returns reasoning_effort "low" for "minimal"', () => {
      expect(provider.mapThinkingLevel('minimal')).toEqual({ reasoning_effort: 'low' });
    });

    it('returns reasoning_effort "low" for "low"', () => {
      expect(provider.mapThinkingLevel('low')).toEqual({ reasoning_effort: 'low' });
    });

    it('returns reasoning_effort "medium" for "medium"', () => {
      expect(provider.mapThinkingLevel('medium')).toEqual({ reasoning_effort: 'medium' });
    });

    it('returns reasoning_effort "high" for "high"', () => {
      expect(provider.mapThinkingLevel('high')).toEqual({ reasoning_effort: 'high' });
    });

    it('clamps "xhigh" to "high"', () => {
      expect(provider.mapThinkingLevel('xhigh')).toEqual({ reasoning_effort: 'high' });
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
