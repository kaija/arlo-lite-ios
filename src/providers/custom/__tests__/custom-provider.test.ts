/**
 * Tests for the XHR-based CustomProvider.
 *
 * Fixtures mirror real llama-server (llama.cpp) wire responses captured from
 * a live instance: /v1/models dual format, non-streaming completions with
 * reasoning_content, and single-line `data:` SSE chunks ending in [DONE].
 */

import { CustomProvider } from '../custom-provider';
import { ProviderError } from '../../errors';
import type { CompletionRequest, ProviderConfig, StreamChunk } from '../../types';

// ─── XHR mock ────────────────────────────────────────────────────────────────

class FakeXHR {
  static instances: FakeXHR[] = [];
  /** Set per-test: called on send() to script the response. */
  static respond: (xhr: FakeXHR) => void = () => {};

  method = '';
  url = '';
  requestHeaders: Record<string, string> = {};
  body: string | null = null;
  timeout = 0;
  responseType = '';

  status = 0;
  responseText = '';
  responseHeaders: Record<string, string> = {};

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onprogress: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
    FakeXHR.instances.push(this);
  }
  setRequestHeader(k: string, v: string) {
    this.requestHeaders[k] = v;
  }
  getResponseHeader(k: string): string | null {
    return this.responseHeaders[k.toLowerCase()] ?? null;
  }
  abort() {}
  send(body?: string | null) {
    this.body = body ?? null;
    queueMicrotask(() => FakeXHR.respond(this));
  }
}

function respondJson(status: number, json: unknown, headers: Record<string, string> = {}) {
  FakeXHR.respond = (xhr) => {
    xhr.status = status;
    xhr.responseText = JSON.stringify(json);
    xhr.responseHeaders = headers;
    xhr.onload?.();
  };
}

function respondSSE(lines: string[]) {
  FakeXHR.respond = (xhr) => {
    xhr.status = 200;
    // Deliver in two progress events to exercise incremental parsing
    const half = Math.ceil(lines.length / 2);
    xhr.responseText = lines.slice(0, half).join('');
    xhr.onprogress?.();
    xhr.responseText = lines.join('');
    xhr.onprogress?.();
    xhr.onload?.();
  };
}

function lastRequestBody(): Record<string, unknown> {
  const xhr = FakeXHR.instances[FakeXHR.instances.length - 1];
  return JSON.parse(xhr.body ?? '{}') as Record<string, unknown>;
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).XMLHttpRequest = FakeXHR;
});

beforeEach(() => {
  FakeXHR.instances = [];
  FakeXHR.respond = () => {};
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-provider',
    type: 'custom',
    name: 'llama-server',
    baseUrl: 'http://100.68.20.95:30000/v1',
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
    model: 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf',
    thinkingLevel: 'medium',
    stream: false,
    ...overrides,
  };
}

const completionFixture = {
  choices: [
    {
      finish_reason: 'stop',
      index: 0,
      message: { role: 'assistant', content: '2', reasoning_content: 'Simple math.' },
    },
  ],
  model: 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf',
  object: 'chat.completion',
  usage: {
    completion_tokens: 2,
    prompt_tokens: 19,
    total_tokens: 21,
    prompt_tokens_details: { cached_tokens: 13 },
  },
};

async function collect(iter: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of iter) out.push(c);
  return out;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CustomProvider', () => {
  const provider = new CustomProvider();

  describe('complete()', () => {
    it('POSTs to {baseUrl}/chat/completions with auth header and parses response', async () => {
      respondJson(200, completionFixture);

      const result = await provider.complete(makeConfig(), makeRequest(), 'sk-test');
      const xhr = FakeXHR.instances[0];

      expect(xhr.method).toBe('POST');
      expect(xhr.url).toBe('http://100.68.20.95:30000/v1/chat/completions');
      expect(xhr.requestHeaders['Authorization']).toBe('Bearer sk-test');
      expect(result.content).toBe('2');
      expect(result.thinkingContent).toBe('Simple math.');
      expect(result.finishReason).toBe('stop');
      expect(result.usage).toEqual({
        promptTokens: 19,
        completionTokens: 2,
        totalTokens: 21,
        cachedTokens: 13,
      });
    });

    it('omits Authorization header for the no-key sentinel', async () => {
      respondJson(200, completionFixture);
      await provider.complete(makeConfig(), makeRequest(), 'sk-no-key-required');
      expect(FakeXHR.instances[0].requestHeaders['Authorization']).toBeUndefined();
    });

    it('auto mode sends reasoning_effort AND chat_template_kwargs', async () => {
      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'auto' }),
        makeRequest({ thinkingLevel: 'medium' }),
        'k',
      );
      const body = lastRequestBody();
      expect(body.reasoning_effort).toBe('medium');
      expect(body.chat_template_kwargs).toEqual({
        enable_thinking: true,
        reasoning_effort: 'medium',
      });
    });

    it('chat-template-kwargs mode sends only chat_template_kwargs', async () => {
      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'chat-template-kwargs' }),
        makeRequest({ thinkingLevel: 'high' }),
        'k',
      );
      const body = lastRequestBody();
      expect(body.reasoning_effort).toBeUndefined();
      expect(body.chat_template_kwargs).toEqual({
        enable_thinking: true,
        reasoning_effort: 'high',
      });
    });

    it('openai-reasoning-effort mode sends only reasoning_effort', async () => {
      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'openai-reasoning-effort' }),
        makeRequest({ thinkingLevel: 'low' }),
        'k',
      );
      const body = lastRequestBody();
      expect(body.reasoning_effort).toBe('low');
      expect(body.chat_template_kwargs).toBeUndefined();
    });

    it('none mode sends no thinking params; off disables via kwargs in auto', async () => {
      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'none' }),
        makeRequest({ thinkingLevel: 'high' }),
        'k',
      );
      let body = lastRequestBody();
      expect(body.reasoning_effort).toBeUndefined();
      expect(body.chat_template_kwargs).toBeUndefined();

      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'auto' }),
        makeRequest({ thinkingLevel: 'off' }),
        'k',
      );
      body = lastRequestBody();
      expect(body.reasoning_effort).toBeUndefined();
      expect(body.chat_template_kwargs).toEqual({ enable_thinking: false });
    });

    it('custom thinkingKwargs replace the defaults', async () => {
      respondJson(200, completionFixture);
      await provider.complete(
        makeConfig({ reasoningMode: 'chat-template-kwargs', thinkingKwargs: { my_kwarg: true } }),
        makeRequest({ thinkingLevel: 'medium' }),
        'k',
      );
      expect(lastRequestBody().chat_template_kwargs).toEqual({ my_kwarg: true });
    });

    it('passes max_tokens when set and omits it otherwise', async () => {
      respondJson(200, completionFixture);
      await provider.complete(makeConfig(), makeRequest({ maxTokens: 500 }), 'k');
      expect(lastRequestBody().max_tokens).toBe(500);

      respondJson(200, completionFixture);
      await provider.complete(makeConfig(), makeRequest(), 'k');
      expect(lastRequestBody().max_tokens).toBeUndefined();
    });

    it('classifies 401 as authentication error', async () => {
      respondJson(401, { error: { message: 'bad key' } });
      await expect(provider.complete(makeConfig(), makeRequest(), 'k')).rejects.toMatchObject({
        category: 'authentication',
      });
    });

    it('classifies 429 as rate_limit with retry-after', async () => {
      respondJson(429, {}, { 'retry-after': '30' });
      await expect(provider.complete(makeConfig(), makeRequest(), 'k')).rejects.toMatchObject({
        category: 'rate_limit',
        retryAfterSeconds: 30,
      });
    });

    it('surfaces server error message from the body', async () => {
      respondJson(500, { error: { message: 'model loading failed' } });
      await expect(provider.complete(makeConfig(), makeRequest(), 'k')).rejects.toMatchObject({
        category: 'server',
        message: 'model loading failed',
      });
    });

    it('classifies network failure', async () => {
      FakeXHR.respond = (xhr) => xhr.onerror?.();
      await expect(provider.complete(makeConfig(), makeRequest(), 'k')).rejects.toMatchObject({
        category: 'network',
      });
    });
  });

  describe('streamCompletion()', () => {
    // Real llama-server SSE shape (single-line data events, [DONE] terminator)
    const sseFixture = [
      'data: {"choices":[{"finish_reason":null,"index":0,"delta":{"role":"assistant","content":null}}],"object":"chat.completion.chunk"}\n\n',
      'data: {"choices":[{"finish_reason":null,"index":0,"delta":{"reasoning_content":"Thinking"}}],"object":"chat.completion.chunk"}\n\n',
      'data: {"choices":[{"finish_reason":null,"index":0,"delta":{"content":"Hel"}}],"object":"chat.completion.chunk"}\n\n',
      'data: {"choices":[{"finish_reason":null,"index":0,"delta":{"content":"lo"}}],"object":"chat.completion.chunk"}\n\n',
      'data: {"choices":[{"finish_reason":"stop","index":0,"delta":{}}],"object":"chat.completion.chunk"}\n\n',
      'data: {"choices":[],"object":"chat.completion.chunk","usage":{"completion_tokens":10,"prompt_tokens":13,"total_tokens":23,"prompt_tokens_details":{"cached_tokens":9}}}\n\n',
      'data: [DONE]\n\n',
    ];

    it('yields thinking, text, and done-with-usage chunks and requests usage', async () => {
      respondSSE(sseFixture);
      const chunks = await collect(
        provider.streamCompletion(makeConfig(), makeRequest(), 'k', new AbortController().signal),
      );

      expect(chunks).toEqual([
        { type: 'thinking', content: 'Thinking' },
        { type: 'text', content: 'Hel' },
        { type: 'text', content: 'lo' },
        {
          type: 'done',
          content: '',
          usage: { promptTokens: 13, completionTokens: 10, totalTokens: 23, cachedTokens: 9 },
        },
      ]);

      const body = lastRequestBody();
      expect(body.stream).toBe(true);
      expect(body.stream_options).toEqual({ include_usage: true });
    });

    it('handles OpenRouter-style delta.reasoning', async () => {
      respondSSE([
        'data: {"choices":[{"delta":{"reasoning":"hmm"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n',
        'data: [DONE]\n\n',
      ]);
      const chunks = await collect(
        provider.streamCompletion(makeConfig(), makeRequest(), 'k', new AbortController().signal),
      );
      expect(chunks[0]).toEqual({ type: 'thinking', content: 'hmm' });
      expect(chunks[1]).toEqual({ type: 'text', content: 'hi' });
    });

    it('yields error then done on HTTP error', async () => {
      respondJson(401, { error: { message: 'bad key' } });
      const chunks = await collect(
        provider.streamCompletion(makeConfig(), makeRequest(), 'k', new AbortController().signal),
      );
      expect(chunks).toEqual([
        { type: 'error', content: 'authentication: Authentication failed' },
        { type: 'done', content: '' },
      ]);
    });

    it('yields only done when aborted before start', async () => {
      const controller = new AbortController();
      controller.abort();
      const chunks = await collect(
        provider.streamCompletion(makeConfig(), makeRequest(), 'k', controller.signal),
      );
      expect(chunks).toEqual([{ type: 'done', content: '' }]);
    });
  });

  describe('listModels()', () => {
    it('parses OpenAI data[] format (llama-server)', async () => {
      respondJson(200, {
        models: [{ name: 'ignored-when-data-present.gguf' }],
        data: [{ id: 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf' }, { id: 'another-model' }],
        object: 'list',
      });
      const models = await provider.listModels(makeConfig(), 'k');
      expect(models).toEqual(['another-model', 'Qwen3.6-35B-A3B-UD-Q4_K_M.gguf']);
    });

    it('falls back to Ollama models[] format', async () => {
      respondJson(200, { models: [{ name: 'llama3:8b' }, { model: 'qwen3:4b' }] });
      const models = await provider.listModels(makeConfig(), 'k');
      expect(models).toEqual(['llama3:8b', 'qwen3:4b']);
    });

    it('returns [] on failure', async () => {
      FakeXHR.respond = (xhr) => xhr.onerror?.();
      expect(await provider.listModels(makeConfig(), 'k')).toEqual([]);
    });
  });

  describe('validateApiKey()', () => {
    it('accepts on 200, rejects on 401, rejects on network failure', async () => {
      respondJson(200, { data: [] });
      expect(await provider.validateApiKey(makeConfig(), 'k')).toBe(true);

      respondJson(401, {});
      expect(await provider.validateApiKey(makeConfig(), 'k')).toBe(false);

      FakeXHR.respond = (xhr) => xhr.onerror?.();
      expect(await provider.validateApiKey(makeConfig(), 'k')).toBe(false);
    });

    it('treats non-auth HTTP errors as reachable (valid)', async () => {
      respondJson(500, {});
      expect(await provider.validateApiKey(makeConfig(), 'k')).toBe(true);
    });
  });

  it('exposes type "custom" and rejects with ProviderError instances', async () => {
    expect(provider.type).toBe('custom');
    respondJson(500, {});
    await expect(provider.complete(makeConfig(), makeRequest(), 'k')).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});
