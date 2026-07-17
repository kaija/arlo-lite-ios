/**
 * Integration tests for CustomProvider request building.
 *
 * Verifies that the provider correctly passes reasoning params to the OpenAI SDK
 * based on the configured reasoningMode and thinkingKwargs.
 *
 * **Validates: Requirements 6.3, 6.5, 4.1, 4.2, 4.3**
 */

import type { ProviderConfig, CompletionRequest } from '../../types';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
      models: { list: jest.fn() },
    })),
    APIError: class APIError extends Error {
      status: number;
      constructor(msg: string, status: number) {
        super(msg);
        this.status = status;
      }
    },
  };
});

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { CustomProvider } from '../custom-provider';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-provider',
    type: 'custom',
    name: 'Test Custom',
    baseUrl: 'http://localhost:8080/v1',
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    reasoningMode: null,
    thinkingKwargs: null,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'qwen3-8b',
    thinkingLevel: 'medium',
    stream: false,
    ...overrides,
  };
}

const mockCompletionResponse = {
  choices: [
    {
      message: { content: 'test response', role: 'assistant' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomProvider request building', () => {
  let provider: CustomProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockResolvedValue(mockCompletionResponse);
    provider = new CustomProvider();
  });

  describe('complete() reasoning mode params', () => {
    it('auto mode with level medium sends reasoning_effort AND chat_template_kwargs', async () => {
      const config = makeConfig({ reasoningMode: 'auto' });
      const request = makeRequest({ thinkingLevel: 'medium' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBe('medium');
      expect(params.chat_template_kwargs).toEqual({ enable_thinking: true });
    });

    it('auto mode with level off sends only chat_template_kwargs with enable_thinking false', async () => {
      const config = makeConfig({ reasoningMode: 'auto' });
      const request = makeRequest({ thinkingLevel: 'off' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBeUndefined();
      expect(params.chat_template_kwargs).toEqual({ enable_thinking: false });
    });

    it('openai-reasoning-effort mode with level high sends only reasoning_effort', async () => {
      const config = makeConfig({ reasoningMode: 'openai-reasoning-effort' });
      const request = makeRequest({ thinkingLevel: 'high' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBe('high');
      expect(params.chat_template_kwargs).toBeUndefined();
    });

    it('chat-template-kwargs mode with level low sends only chat_template_kwargs', async () => {
      const config = makeConfig({ reasoningMode: 'chat-template-kwargs' });
      const request = makeRequest({ thinkingLevel: 'low' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.chat_template_kwargs).toEqual({ enable_thinking: true });
      expect(params.reasoning_effort).toBeUndefined();
    });

    it('none mode sends no reasoning params regardless of level', async () => {
      const config = makeConfig({ reasoningMode: 'none' });
      const request = makeRequest({ thinkingLevel: 'high' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBeUndefined();
      expect(params.chat_template_kwargs).toBeUndefined();
    });

    it('null reasoningMode (backward compat) behaves as auto — Property 4', async () => {
      const configNull = makeConfig({ reasoningMode: null });
      const configAuto = makeConfig({ reasoningMode: 'auto' });
      const request = makeRequest({ thinkingLevel: 'medium' });

      await provider.complete(configNull, request, 'test-key');
      const paramsNull = mockCreate.mock.calls[0][0];

      mockCreate.mockClear();
      mockCreate.mockResolvedValue(mockCompletionResponse);

      // Create a fresh provider to avoid client caching issues
      const provider2 = new CustomProvider();
      await provider2.complete(configAuto, request, 'test-key');
      const paramsAuto = mockCreate.mock.calls[0][0];

      expect(paramsNull.reasoning_effort).toBe(paramsAuto.reasoning_effort);
      expect(paramsNull.chat_template_kwargs).toEqual(paramsAuto.chat_template_kwargs);
    });

    it('custom thinkingKwargs in auto mode with level medium uses provided kwargs', async () => {
      const config = makeConfig({
        reasoningMode: 'auto',
        thinkingKwargs: { my_kwarg: true },
      });
      const request = makeRequest({ thinkingLevel: 'medium' });

      await provider.complete(config, request, 'test-key');

      const params = mockCreate.mock.calls[0][0];
      expect(params.chat_template_kwargs).toEqual({ my_kwarg: true });
      expect(params.reasoning_effort).toBe('medium');
    });
  });

  describe('streamCompletion() reasoning mode params', () => {
    it('auto mode with level medium sends reasoning_effort AND chat_template_kwargs', async () => {
      // Mock an async iterable stream
      const mockStream = (async function* () {
        yield {
          choices: [{ delta: { content: 'hello' } }],
        };
      })();
      mockCreate.mockResolvedValue(mockStream);

      const config = makeConfig({ reasoningMode: 'auto' });
      const request = makeRequest({ thinkingLevel: 'medium', stream: true });
      const controller = new AbortController();

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'test-key', controller.signal)) {
        chunks.push(chunk);
      }

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBe('medium');
      expect(params.chat_template_kwargs).toEqual({ enable_thinking: true });
      expect(params.stream).toBe(true);
    });

    it('none mode sends no reasoning params in streaming', async () => {
      const mockStream = (async function* () {
        yield {
          choices: [{ delta: { content: 'hi' } }],
        };
      })();
      mockCreate.mockResolvedValue(mockStream);

      const config = makeConfig({ reasoningMode: 'none' });
      const request = makeRequest({ thinkingLevel: 'high', stream: true });
      const controller = new AbortController();

      const chunks: unknown[] = [];
      for await (const chunk of provider.streamCompletion(config, request, 'test-key', controller.signal)) {
        chunks.push(chunk);
      }

      const params = mockCreate.mock.calls[0][0];
      expect(params.reasoning_effort).toBeUndefined();
      expect(params.chat_template_kwargs).toBeUndefined();
    });
  });
});
