/**
 * Unit tests for the Anthropic provider adapter.
 */

import { AnthropicProvider } from '../anthropic-provider';
import type {
  ProviderConfig,
  CompletionRequest,
  ChatMessage,
} from '../../types';

// Mock fetch for validateApiKey tests
const mockFetch = jest.fn();
global.fetch = mockFetch;

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
    mockFetch.mockReset();
  });

  describe('type', () => {
    it('should be anthropic', () => {
      expect(provider.type).toBe('anthropic');
    });
  });

  describe('buildRequest', () => {
    it('constructs correct URL from baseUrl', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);

      expect(result.url).toBe('https://api.anthropic.com/v1/messages');
    });

    it('includes required Anthropic headers', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);

      expect(result.headers['content-type']).toBe('application/json');
      expect(result.headers['anthropic-version']).toBe('2023-06-01');
    });

    it('extracts system message to top-level param', () => {
      const request: CompletionRequest = {
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.system).toBe('You are helpful.');
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].role).toBe('user');
    });

    it('omits system field when no system message present', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.system).toBeUndefined();
    });

    it('uses default max_tokens of 4096 when not specified', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.max_tokens).toBe(4096);
    });

    it('respects custom maxTokens', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
        maxTokens: 2048,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.max_tokens).toBe(2048);
    });

    it('sets stream flag in body', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: true,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.stream).toBe(true);
    });

    it('includes thinking block when thinkingLevel is not off', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-7-sonnet-20250219',
        thinkingLevel: 'medium',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.thinking).toEqual({ type: 'enabled', budget_tokens: 8192 });
    });

    it('includes thinking disabled block when thinkingLevel is off', () => {
      const request: CompletionRequest = {
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'claude-3-7-sonnet-20250219',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.thinking).toEqual({ type: 'disabled' });
    });

    it('handles multimodal content parts', () => {
      const messages: ChatMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Describe this image' },
            { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
          ],
        },
      ];

      const request: CompletionRequest = {
        messages,
        model: 'claude-3-5-sonnet-20241022',
        thinkingLevel: 'off',
        stream: false,
      };

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.messages[0].content).toEqual([
        { type: 'text', text: 'Describe this image' },
        { type: 'image', source: { type: 'url', url: 'https://example.com/img.png' } },
      ]);
    });

    it('concatenates multiple system messages', () => {
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

      const result = provider.buildRequest(config, request);
      const body = JSON.parse(result.body);

      expect(body.system).toBe('Be concise.\nUse markdown.');
    });
  });

  describe('parseResponse', () => {
    it('extracts text content from response', () => {
      const raw = {
        content: [{ type: 'text', text: 'Hello world' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('Hello world');
      expect(result.finishReason).toBe('end_turn');
    });

    it('extracts thinking content when present', () => {
      const raw = {
        content: [
          { type: 'thinking', thinking: 'Let me think about this...' },
          { type: 'text', text: 'The answer is 42.' },
        ],
        usage: { input_tokens: 20, output_tokens: 30 },
        stop_reason: 'end_turn',
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('The answer is 42.');
      expect(result.thinkingContent).toBe('Let me think about this...');
    });

    it('maps usage correctly', () => {
      const raw = {
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 30 },
        stop_reason: 'end_turn',
      };

      const result = provider.parseResponse(raw);

      expect(result.usage.promptTokens).toBe(100);
      expect(result.usage.completionTokens).toBe(50);
      expect(result.usage.totalTokens).toBe(150);
      expect(result.usage.cachedTokens).toBe(30);
    });

    it('handles missing usage gracefully', () => {
      const raw = {
        content: [{ type: 'text', text: 'Hi' }],
        stop_reason: 'end_turn',
      };

      const result = provider.parseResponse(raw);

      expect(result.usage.promptTokens).toBe(0);
      expect(result.usage.completionTokens).toBe(0);
      expect(result.usage.totalTokens).toBe(0);
    });

    it('returns unknown finish reason when missing', () => {
      const raw = {
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      };

      const result = provider.parseResponse(raw);

      expect(result.finishReason).toBe('unknown');
    });
  });

  describe('parseStreamChunk', () => {
    it('returns null for empty lines', () => {
      expect(provider.parseStreamChunk('')).toBeNull();
    });

    it('returns null for comment lines', () => {
      expect(provider.parseStreamChunk(': keepalive')).toBeNull();
    });

    it('returns null for event lines', () => {
      expect(provider.parseStreamChunk('event: content_block_delta')).toBeNull();
    });

    it('parses text_delta content', () => {
      const line = 'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'text', content: 'Hello' });
    });

    it('parses thinking_delta content', () => {
      const line = 'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"Hmm..."}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'thinking', content: 'Hmm...' });
    });

    it('returns done for message_stop', () => {
      const line = 'data: {"type":"message_stop"}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'done', content: '' });
    });

    it('returns done with usage for message_delta', () => {
      const line = 'data: {"type":"message_delta","usage":{"input_tokens":10,"output_tokens":20}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({
        type: 'done',
        content: '',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
    });

    it('returns done for [DONE] signal', () => {
      const line = 'data: [DONE]';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'done', content: '' });
    });

    it('returns error for malformed JSON', () => {
      const line = 'data: {invalid json}';
      const result = provider.parseStreamChunk(line);

      expect(result?.type).toBe('error');
    });

    it('returns null for ping events', () => {
      const line = 'data: {"type":"ping"}';
      const result = provider.parseStreamChunk(line);

      expect(result).toBeNull();
    });

    it('returns null for content_block_start events', () => {
      const line = 'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toBeNull();
    });

    it('handles message_start with usage', () => {
      const line = 'data: {"type":"message_start","message":{"usage":{"input_tokens":25,"output_tokens":0}}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({
        type: 'done',
        content: '',
        usage: { promptTokens: 25, completionTokens: 0, totalTokens: 25 },
      });
    });
  });

  describe('mapThinkingLevel', () => {
    it('returns disabled for off', () => {
      expect(provider.mapThinkingLevel('off')).toEqual({
        thinking: { type: 'disabled' },
      });
    });

    it('returns budget_tokens 1024 for minimal', () => {
      expect(provider.mapThinkingLevel('minimal')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 1024 },
      });
    });

    it('returns budget_tokens 2048 for low', () => {
      expect(provider.mapThinkingLevel('low')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 2048 },
      });
    });

    it('returns budget_tokens 8192 for medium', () => {
      expect(provider.mapThinkingLevel('medium')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 8192 },
      });
    });

    it('returns budget_tokens 16384 for high', () => {
      expect(provider.mapThinkingLevel('high')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 16384 },
      });
    });

    it('clamps xhigh to high (16384)', () => {
      expect(provider.mapThinkingLevel('xhigh')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 16384 },
      });
    });
  });

  describe('listModels', () => {
    it('returns hardcoded list of known models', async () => {
      const models = await provider.listModels(config, 'sk-test');

      expect(models.length).toBeGreaterThan(0);
      expect(models).toContain('claude-3-5-sonnet-20241022');
      expect(models).toContain('claude-sonnet-4-20250514');
    });
  });

  describe('validateApiKey', () => {
    it('returns true for 200 response', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });

      const result = await provider.validateApiKey(config, 'sk-valid-key');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'sk-valid-key',
            'anthropic-version': '2023-06-01',
          }),
        }),
      );
    });

    it('returns false for 401 response', async () => {
      mockFetch.mockResolvedValueOnce({ status: 401 });

      const result = await provider.validateApiKey(config, 'sk-invalid');

      expect(result).toBe(false);
    });

    it('returns false for 403 response', async () => {
      mockFetch.mockResolvedValueOnce({ status: 403 });

      const result = await provider.validateApiKey(config, 'sk-forbidden');

      expect(result).toBe(false);
    });

    it('returns true for 429 (rate limit means key is valid)', async () => {
      mockFetch.mockResolvedValueOnce({ status: 429 });

      const result = await provider.validateApiKey(config, 'sk-valid');

      expect(result).toBe(true);
    });

    it('returns false for network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await provider.validateApiKey(config, 'sk-test');

      expect(result).toBe(false);
    });

    it('sends max_tokens: 10 in validation request', async () => {
      mockFetch.mockResolvedValueOnce({ status: 200 });

      await provider.validateApiKey(config, 'sk-test');

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.max_tokens).toBe(10);
    });
  });
});
