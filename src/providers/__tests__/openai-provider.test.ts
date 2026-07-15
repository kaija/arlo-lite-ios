/**
 * Unit tests for the OpenAI provider adapter.
 *
 * Tests request building (both API modes), response parsing,
 * stream chunk parsing, and thinking level mapping.
 */

import { OpenAIProvider } from '../openai/openai-provider';
import type { CompletionRequest, ProviderConfig } from '../types';

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  const baseResponsesConfig: ProviderConfig = {
    id: 'test-provider',
    type: 'openai',
    name: 'Test OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiMode: 'responses',
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const baseChatConfig: ProviderConfig = {
    ...baseResponsesConfig,
    apiMode: 'chat-completions',
  };

  const baseRequest: CompletionRequest = {
    messages: [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hello' },
    ],
    model: 'gpt-4o',
    thinkingLevel: 'off',
    stream: true,
  };

  beforeEach(() => {
    provider = new OpenAIProvider();
    provider.setApiKey('sk-test-key');
  });

  describe('type', () => {
    it('should have type "openai"', () => {
      expect(provider.type).toBe('openai');
    });
  });

  describe('buildRequest - Responses API', () => {
    it('should build a request for the Responses API', () => {
      const result = provider.buildRequest(baseResponsesConfig, baseRequest);

      expect(result.url).toBe('https://api.openai.com/v1/responses');
      expect(result.headers['Authorization']).toBe('Bearer sk-test-key');
      expect(result.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(result.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.input).toHaveLength(2);
      expect(body.input[0].role).toBe('system');
      expect(body.input[1].role).toBe('user');
      expect(body.stream).toBe(true);
    });

    it('should include reasoning params when thinking level is not off', () => {
      const request: CompletionRequest = { ...baseRequest, thinkingLevel: 'high' };
      const result = provider.buildRequest(baseResponsesConfig, request);
      const body = JSON.parse(result.body);

      expect(body.reasoning).toEqual({ effort: 'high' });
    });

    it('should not include reasoning params when thinking level is off', () => {
      const result = provider.buildRequest(baseResponsesConfig, baseRequest);
      const body = JSON.parse(result.body);

      expect(body.reasoning).toBeUndefined();
    });

    it('should include max_output_tokens when maxTokens is set', () => {
      const request: CompletionRequest = { ...baseRequest, maxTokens: 500 };
      const result = provider.buildRequest(baseResponsesConfig, request);
      const body = JSON.parse(result.body);

      expect(body.max_output_tokens).toBe(500);
    });
  });

  describe('buildRequest - Chat Completions API', () => {
    it('should build a request for the Chat Completions API', () => {
      const result = provider.buildRequest(baseChatConfig, baseRequest);

      expect(result.url).toBe('https://api.openai.com/v1/chat/completions');
      expect(result.headers['Authorization']).toBe('Bearer sk-test-key');

      const body = JSON.parse(result.body);
      expect(body.model).toBe('gpt-4o');
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe('system');
      expect(body.messages[1].content).toBe('Hello');
      expect(body.stream).toBe(true);
    });

    it('should include reasoning_effort when thinking level is not off', () => {
      const request: CompletionRequest = { ...baseRequest, thinkingLevel: 'medium' };
      const result = provider.buildRequest(baseChatConfig, request);
      const body = JSON.parse(result.body);

      expect(body.reasoning_effort).toBe('medium');
    });

    it('should include max_tokens when maxTokens is set', () => {
      const request: CompletionRequest = { ...baseRequest, maxTokens: 1000 };
      const result = provider.buildRequest(baseChatConfig, request);
      const body = JSON.parse(result.body);

      expect(body.max_tokens).toBe(1000);
    });
  });

  describe('parseResponse - Chat Completions format', () => {
    it('should parse a standard Chat Completions response', () => {
      const raw = {
        choices: [
          {
            message: { role: 'assistant', content: 'Hello there!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('Hello there!');
      expect(result.finishReason).toBe('stop');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
    });

    it('should parse reasoning content from Chat Completions', () => {
      const raw = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'The answer is 42.',
              reasoning_content: 'Let me think step by step...',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 20, total_tokens: 25 },
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('The answer is 42.');
      expect(result.thinkingContent).toBe('Let me think step by step...');
    });
  });

  describe('parseResponse - Responses API format', () => {
    it('should parse a standard Responses API response', () => {
      const raw = {
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: 'Hello from responses!' }],
          },
        ],
        usage: {
          input_tokens: 8,
          output_tokens: 4,
        },
        status: 'completed',
      };

      const result = provider.parseResponse(raw);

      expect(result.content).toBe('Hello from responses!');
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(4);
      expect(result.usage.totalTokens).toBe(12);
      expect(result.finishReason).toBe('completed');
    });
  });

  describe('parseStreamChunk', () => {
    it('should return null for empty lines', () => {
      expect(provider.parseStreamChunk('')).toBeNull();
    });

    it('should return null for SSE comments', () => {
      expect(provider.parseStreamChunk(': ping')).toBeNull();
    });

    it('should return null for lines without data: prefix', () => {
      expect(provider.parseStreamChunk('event: message')).toBeNull();
    });

    it('should return done chunk for [DONE]', () => {
      const result = provider.parseStreamChunk('data: [DONE]');
      expect(result).toEqual({ type: 'done', content: '' });
    });

    it('should parse a Chat Completions text delta', () => {
      const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'text', content: 'Hello' });
    });

    it('should parse a Chat Completions reasoning delta', () => {
      const line = 'data: {"choices":[{"delta":{"reasoning_content":"Thinking..."}}]}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'thinking', content: 'Thinking...' });
    });

    it('should parse a Responses API text delta', () => {
      const line = 'data: {"type":"response.output_text.delta","delta":"World"}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'text', content: 'World' });
    });

    it('should parse a Responses API completed event', () => {
      const line = 'data: {"type":"response.completed","response":{"usage":{"input_tokens":10,"output_tokens":5}}}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({
        type: 'done',
        content: '',
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      });
    });

    it('should return error chunk for invalid JSON', () => {
      const line = 'data: {invalid json}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'error', content: 'Failed to parse stream chunk' });
    });

    it('should parse a Responses API error event', () => {
      const line = 'data: {"type":"response.failed"}';
      const result = provider.parseStreamChunk(line);

      expect(result).toEqual({ type: 'error', content: 'response.failed' });
    });
  });

  describe('mapThinkingLevel', () => {
    it('should return empty object for off', () => {
      expect(provider.mapThinkingLevel('off')).toEqual({});
    });

    it('should return reasoning_effort low for minimal', () => {
      expect(provider.mapThinkingLevel('minimal')).toEqual({ reasoning_effort: 'low' });
    });

    it('should return reasoning_effort low for low', () => {
      expect(provider.mapThinkingLevel('low')).toEqual({ reasoning_effort: 'low' });
    });

    it('should return reasoning_effort medium for medium', () => {
      expect(provider.mapThinkingLevel('medium')).toEqual({ reasoning_effort: 'medium' });
    });

    it('should return reasoning_effort high for high', () => {
      expect(provider.mapThinkingLevel('high')).toEqual({ reasoning_effort: 'high' });
    });

    it('should clamp xhigh to high', () => {
      expect(provider.mapThinkingLevel('xhigh')).toEqual({ reasoning_effort: 'high' });
    });
  });

  describe('buildRequest with multimodal content', () => {
    it('should format image content parts in Responses API mode', () => {
      const request: CompletionRequest = {
        ...baseRequest,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is this?' },
              { type: 'image_url', image_url: { url: 'data:image/png;base64,abc' } },
            ],
          },
        ],
      };

      const result = provider.buildRequest(baseResponsesConfig, request);
      const body = JSON.parse(result.body);

      expect(body.input[0].content).toEqual([
        { type: 'input_text', text: 'What is this?' },
        { type: 'input_image', image_url: 'data:image/png;base64,abc' },
      ]);
    });

    it('should format image content parts in Chat Completions mode', () => {
      const request: CompletionRequest = {
        ...baseRequest,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Describe this' },
              { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
            ],
          },
        ],
      };

      const result = provider.buildRequest(baseChatConfig, request);
      const body = JSON.parse(result.body);

      expect(body.messages[0].content).toEqual([
        { type: 'text', text: 'Describe this' },
        { type: 'image_url', image_url: { url: 'https://example.com/img.png' } },
      ]);
    });
  });
});
