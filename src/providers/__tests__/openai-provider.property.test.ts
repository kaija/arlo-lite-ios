/**
 * Property-based tests for OpenAI provider response mapping, streaming behavior,
 * and error classification.
 *
 * Feature: sdk-provider-integration, Property 9: OpenAI non-streaming response mapping
 * Feature: sdk-provider-integration, Property 10: OpenAI stream event-to-chunk mapping
 * Feature: sdk-provider-integration, Property 11: OpenAI stream completion with optional usage
 * Feature: sdk-provider-integration, Property 12: OpenAI error classification
 *
 * **Validates: Requirements 3.4, 3.5, 4.3, 4.4, 4.5, 7.2**
 */

import fc from 'fast-check';
import { OpenAIProvider } from '../openai/openai-provider';
import { ProviderError } from '../errors';
import type { ProviderConfig, CompletionRequest, StreamChunk } from '../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockChatCompletionsCreate = jest.fn();
const mockResponsesCreate = jest.fn();
const mockModelsList = jest.fn();

jest.mock('openai', () => {
  class MockAPIError extends Error {
    status: number | undefined;
    headers: Headers | undefined;
    body: any;
    constructor(status?: number, body?: any, message?: string, headers?: Headers) {
      super(message ?? '');
      this.status = status;
      this.body = body;
      this.headers = headers;
      this.name = 'APIError';
    }
  }

  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockChatCompletionsCreate,
      },
    },
    responses: {
      create: mockResponsesCreate,
    },
    models: {
      list: mockModelsList,
    },
  }));

  return {
    __esModule: true,
    default: MockOpenAI,
    APIError: MockAPIError,
  };
});

jest.mock('../../domain/thinking-mapper', () => ({
  mapThinkingLevelOpenAI: (level: string) => {
    if (level === 'off') return {};
    if (level === 'minimal' || level === 'low') return { reasoning_effort: 'low' };
    if (level === 'medium') return { reasoning_effort: 'medium' };
    return { reasoning_effort: 'high' };
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a ProviderConfig for chat-completions mode. */
function makeChatConfig(): ProviderConfig {
  return {
    id: 'test-openai',
    type: 'openai',
    name: 'Test OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiMode: 'chat-completions',
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Create a ProviderConfig for responses mode. */
function makeResponsesConfig(): ProviderConfig {
  return {
    id: 'test-openai',
    type: 'openai',
    name: 'Test OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiMode: 'responses',
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Create a minimal CompletionRequest. */
function makeRequest(overrides?: Partial<CompletionRequest>): CompletionRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'gpt-4o',
    thinkingLevel: 'off',
    stream: false,
    ...overrides,
  };
}

/** Collect all StreamChunks from the provider's streamCompletion. */
async function collectStreamChunks(
  provider: OpenAIProvider,
  config: ProviderConfig,
  request: CompletionRequest,
): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  const signal = new AbortController().signal;
  for await (const chunk of provider.streamCompletion(config, request, 'test-key', signal)) {
    chunks.push(chunk);
  }
  return chunks;
}

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate arbitrary non-negative token counts. */
const arbTokenCount = fc.nat({ max: 100000 });

/** Generate arbitrary positive token counts. */
const arbPositiveTokenCount = fc.nat({ max: 100000 }).filter((n) => n > 0);

/** Generate arbitrary text content. */
const arbText = fc.string({ minLength: 0, maxLength: 500 });

/** Generate non-empty text content. */
const arbNonEmptyText = fc.string({ minLength: 1, maxLength: 500 });

/** Generate a finish reason for Chat Completions. */
const arbChatFinishReason = fc.constantFrom('stop', 'length', 'content_filter', 'tool_calls');

/** Generate a status for Responses API. */
const arbResponsesStatus = fc.constantFrom('completed', 'incomplete', 'failed');

/** Generate optional cached tokens count. */
const arbOptionalCachedTokens = fc.option(fc.nat({ max: 50000 }), { nil: undefined });

// ─── Property 9: OpenAI non-streaming response mapping ───────────────────────

// Feature: sdk-provider-integration, Property 9: OpenAI non-streaming response mapping
describe('Property 9: OpenAI non-streaming response mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Chat Completions response maps all fields correctly to CompletionResponse', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbNonEmptyText,
        fc.option(arbNonEmptyText, { nil: undefined }),
        arbPositiveTokenCount,
        arbPositiveTokenCount,
        arbOptionalCachedTokens,
        arbChatFinishReason,
        async (content, reasoningContent, promptTokens, completionTokens, cachedTokens, finishReason) => {
          const provider = new OpenAIProvider();
          const totalTokens = promptTokens + completionTokens;

          // Build a mock Chat Completions response
          const mockResponse: Record<string, unknown> = {
            id: 'chatcmpl-test',
            object: 'chat.completion',
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content,
                  ...(reasoningContent !== undefined ? { reasoning_content: reasoningContent } : {}),
                },
                finish_reason: finishReason,
              },
            ],
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              total_tokens: totalTokens,
              ...(cachedTokens !== undefined
                ? { prompt_tokens_details: { cached_tokens: cachedTokens } }
                : {}),
            },
          };

          mockChatCompletionsCreate.mockResolvedValue(mockResponse);

          const result = await provider.complete(makeChatConfig(), makeRequest(), 'test-key');

          expect(result.content).toBe(content);
          if (reasoningContent !== undefined) {
            expect(result.thinkingContent).toBe(reasoningContent);
          } else {
            expect(result.thinkingContent).toBeUndefined();
          }
          expect(result.usage.promptTokens).toBe(promptTokens);
          expect(result.usage.completionTokens).toBe(completionTokens);
          expect(result.usage.totalTokens).toBe(totalTokens);
          if (cachedTokens !== undefined) {
            expect(result.usage.cachedTokens).toBe(cachedTokens);
          }
          expect(result.finishReason).toBe(finishReason);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Responses API response maps all fields correctly to CompletionResponse', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbNonEmptyText,
        fc.option(arbNonEmptyText, { nil: undefined }),
        arbPositiveTokenCount,
        arbPositiveTokenCount,
        arbOptionalCachedTokens,
        arbResponsesStatus,
        async (content, thinkingContent, inputTokens, outputTokens, cachedTokens, status) => {
          const provider = new OpenAIProvider();

          // Build a mock Responses API response
          const output: Array<Record<string, unknown>> = [
            {
              type: 'message',
              content: [{ type: 'output_text', text: content }],
            },
          ];

          if (thinkingContent !== undefined) {
            output.unshift({
              type: 'reasoning',
              summary: [{ type: 'summary_text', text: thinkingContent }],
            });
          }

          const mockResponse: Record<string, unknown> = {
            id: 'resp-test',
            output,
            usage: {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              ...(cachedTokens !== undefined
                ? { input_tokens_details: { cached_tokens: cachedTokens } }
                : {}),
            },
            status,
          };

          mockResponsesCreate.mockResolvedValue(mockResponse);

          const result = await provider.complete(makeResponsesConfig(), makeRequest(), 'test-key');

          expect(result.content).toBe(content);
          if (thinkingContent !== undefined) {
            expect(result.thinkingContent).toBe(thinkingContent);
          } else {
            expect(result.thinkingContent).toBeUndefined();
          }
          expect(result.usage.promptTokens).toBe(inputTokens);
          expect(result.usage.completionTokens).toBe(outputTokens);
          expect(result.usage.totalTokens).toBe(inputTokens + outputTokens);
          if (cachedTokens !== undefined) {
            expect(result.usage.cachedTokens).toBe(cachedTokens);
          }
          expect(result.finishReason).toBe(status);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 10: OpenAI stream event-to-chunk mapping ───────────────────────

// Feature: sdk-provider-integration, Property 10: OpenAI stream event-to-chunk mapping
describe('Property 10: OpenAI stream event-to-chunk mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Chat Completions text delta emits StreamChunk with type "text" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (deltaContent) => {
        const provider = new OpenAIProvider();

        const chunks = [
          {
            choices: [{ index: 0, delta: { content: deltaContent } }],
          },
        ];

        mockChatCompletionsCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeChatConfig(),
          makeRequest({ stream: true }),
        );

        const textChunks = streamChunks.filter((c) => c.type === 'text');
        expect(textChunks).toHaveLength(1);
        expect(textChunks[0].content).toBe(deltaContent);
      }),
      { numRuns: 100 },
    );
  });

  it('Chat Completions reasoning_content delta emits StreamChunk with type "thinking" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (reasoningDelta) => {
        const provider = new OpenAIProvider();

        const chunks = [
          {
            choices: [{ index: 0, delta: { reasoning_content: reasoningDelta } }],
          },
        ];

        mockChatCompletionsCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeChatConfig(),
          makeRequest({ stream: true }),
        );

        const thinkingChunks = streamChunks.filter((c) => c.type === 'thinking');
        expect(thinkingChunks).toHaveLength(1);
        expect(thinkingChunks[0].content).toBe(reasoningDelta);
      }),
      { numRuns: 100 },
    );
  });

  it('Responses API response.output_text.delta events emit StreamChunk with type "text" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (deltaText) => {
        const provider = new OpenAIProvider();

        const events = [
          {
            type: 'response.output_text.delta',
            delta: deltaText,
          },
        ];

        mockResponsesCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const event of events) yield event;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeResponsesConfig(),
          makeRequest({ stream: true }),
        );

        const textChunks = streamChunks.filter((c) => c.type === 'text');
        expect(textChunks).toHaveLength(1);
        expect(textChunks[0].content).toBe(deltaText);
      }),
      { numRuns: 100 },
    );
  });

  it('Responses API response.reasoning.delta events emit StreamChunk with type "thinking" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (deltaThinking) => {
        const provider = new OpenAIProvider();

        const events = [
          {
            type: 'response.reasoning.delta',
            delta: deltaThinking,
          },
        ];

        mockResponsesCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const event of events) yield event;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeResponsesConfig(),
          makeRequest({ stream: true }),
        );

        const thinkingChunks = streamChunks.filter((c) => c.type === 'thinking');
        expect(thinkingChunks).toHaveLength(1);
        expect(thinkingChunks[0].content).toBe(deltaThinking);
      }),
      { numRuns: 100 },
    );
  });

  it('content field matches the delta string for mixed sequences of text and thinking events', async () => {
    /** Generate a sequence of mixed chat-completions streaming events. */
    const arbChatStreamEvent = fc.oneof(
      fc.record({
        _type: fc.constant('text' as const),
        text: arbNonEmptyText,
      }),
      fc.record({
        _type: fc.constant('thinking' as const),
        text: arbNonEmptyText,
      }),
    );

    await fc.assert(
      fc.asyncProperty(
        fc.array(arbChatStreamEvent, { minLength: 1, maxLength: 10 }),
        async (eventDefs) => {
          const provider = new OpenAIProvider();

          const chunks = eventDefs.map((def) => {
            if (def._type === 'text') {
              return { choices: [{ index: 0, delta: { content: def.text } }] };
            }
            return { choices: [{ index: 0, delta: { reasoning_content: def.text } }] };
          });

          mockChatCompletionsCreate.mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) yield chunk;
            },
          });

          const streamChunks = await collectStreamChunks(
            provider,
            makeChatConfig(),
            makeRequest({ stream: true }),
          );

          const contentChunks = streamChunks.filter(
            (c) => c.type === 'text' || c.type === 'thinking',
          );

          expect(contentChunks).toHaveLength(eventDefs.length);
          for (let i = 0; i < eventDefs.length; i++) {
            expect(contentChunks[i].type).toBe(eventDefs[i]._type);
            expect(contentChunks[i].content).toBe(eventDefs[i].text);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 11: OpenAI stream completion with optional usage ───────────────

// Feature: sdk-provider-integration, Property 11: OpenAI stream completion with optional usage
describe('Property 11: OpenAI stream completion with optional usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Chat Completions done chunk includes usage when final event provides token counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPositiveTokenCount,
        arbPositiveTokenCount,
        arbOptionalCachedTokens,
        async (promptTokens, completionTokens, cachedTokens) => {
          const provider = new OpenAIProvider();
          const totalTokens = promptTokens + completionTokens;

          // Stream events: one text chunk, then a usage-only chunk at end
          const chunks = [
            { choices: [{ index: 0, delta: { content: 'hi' } }] },
            {
              choices: [],
              usage: {
                prompt_tokens: promptTokens,
                completion_tokens: completionTokens,
                total_tokens: totalTokens,
                ...(cachedTokens !== undefined
                  ? { prompt_tokens_details: { cached_tokens: cachedTokens } }
                  : {}),
              },
            },
          ];

          mockChatCompletionsCreate.mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const chunk of chunks) yield chunk;
            },
          });

          const streamChunks = await collectStreamChunks(
            provider,
            makeChatConfig(),
            makeRequest({ stream: true }),
          );

          const doneChunks = streamChunks.filter((c) => c.type === 'done');
          expect(doneChunks).toHaveLength(1);

          const done = doneChunks[0];
          expect(done.usage).toBeDefined();
          expect(done.usage!.promptTokens).toBe(promptTokens);
          expect(done.usage!.completionTokens).toBe(completionTokens);
          expect(done.usage!.totalTokens).toBe(totalTokens);
          if (cachedTokens !== undefined) {
            expect(done.usage!.cachedTokens).toBe(cachedTokens);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Chat Completions done chunk omits usage when no token counts provided', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (textContent) => {
        const provider = new OpenAIProvider();

        // Stream events: only text chunks, no usage chunk
        const chunks = [
          { choices: [{ index: 0, delta: { content: textContent } }] },
        ];

        mockChatCompletionsCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const chunk of chunks) yield chunk;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeChatConfig(),
          makeRequest({ stream: true }),
        );

        const doneChunks = streamChunks.filter((c) => c.type === 'done');
        expect(doneChunks).toHaveLength(1);
        expect(doneChunks[0].usage).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });

  it('Responses API done chunk includes usage when response.completed event provides token counts', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbPositiveTokenCount,
        arbPositiveTokenCount,
        async (inputTokens, outputTokens) => {
          const provider = new OpenAIProvider();

          // Stream events: text delta, then response.completed with usage
          const events = [
            { type: 'response.output_text.delta', delta: 'hello' },
            {
              type: 'response.completed',
              response: {
                usage: {
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                },
              },
            },
          ];

          mockResponsesCreate.mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const event of events) yield event;
            },
          });

          const streamChunks = await collectStreamChunks(
            provider,
            makeResponsesConfig(),
            makeRequest({ stream: true }),
          );

          const doneChunks = streamChunks.filter((c) => c.type === 'done');
          expect(doneChunks).toHaveLength(1);

          const done = doneChunks[0];
          expect(done.usage).toBeDefined();
          expect(done.usage!.promptTokens).toBe(inputTokens);
          expect(done.usage!.completionTokens).toBe(outputTokens);
          expect(done.usage!.totalTokens).toBe(inputTokens + outputTokens);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Responses API done chunk omits usage when response.completed has no usage', async () => {
    await fc.assert(
      fc.asyncProperty(arbNonEmptyText, async (textContent) => {
        const provider = new OpenAIProvider();

        // Stream events: text delta only, no response.completed event
        const events = [
          { type: 'response.output_text.delta', delta: textContent },
        ];

        mockResponsesCreate.mockResolvedValue({
          [Symbol.asyncIterator]: async function* () {
            for (const event of events) yield event;
          },
        });

        const streamChunks = await collectStreamChunks(
          provider,
          makeResponsesConfig(),
          makeRequest({ stream: true }),
        );

        const doneChunks = streamChunks.filter((c) => c.type === 'done');
        expect(doneChunks).toHaveLength(1);
        expect(doneChunks[0].usage).toBeUndefined();
      }),
      { numRuns: 100 },
    );
  });
});


// ─── Property 12: OpenAI error classification ────────────────────────────────

// Feature: sdk-provider-integration, Property 12: OpenAI error classification
describe('Property 12: OpenAI error classification', () => {
  /**
   * **Validates: Requirements 3.5, 7.2**
   *
   * For any SDK error with HTTP status code, the resulting ProviderError SHALL have
   * category 'authentication' for 401/403, 'rate_limit' for 429, 'server' for 500-599,
   * and 'network' for connection/DNS/timeout failures. The ProviderError message SHALL
   * not expose raw API response bodies.
   */

  /** Helper: create a fresh provider and mock client that throws, then capture error. */
  async function getClassifiedError(error: Error): Promise<ProviderError> {
    // Override mock to throw the provided error
    mockChatCompletionsCreate.mockRejectedValue(error);
    const provider = new OpenAIProvider();
    const config: ProviderConfig = {
      id: 'test-openai',
      type: 'openai',
      name: 'Test OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiMode: 'chat-completions',
      streamingEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const request: CompletionRequest = {
      messages: [{ role: 'user', content: 'Hello' }],
      model: 'gpt-4o',
      thinkingLevel: 'off',
      stream: false,
    };

    try {
      await provider.complete(config, request, 'sk-test');
      throw new Error('Expected provider.complete to throw');
    } catch (e) {
      return e as ProviderError;
    }
  }

  // ─── Authentication errors (401/403) -> 'authentication' ──────────────────

  it('APIError with status 401 or 403 classifies as authentication', async () => {
    const arbAuthStatus = fc.constantFrom(401, 403);

    await fc.assert(
      fc.asyncProperty(arbAuthStatus, async (status) => {
        const { APIError } = require('openai');
        const err = new APIError(status, undefined, `${status} Unauthorized`, new Headers());

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('authentication');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Rate limit errors (429) -> 'rate_limit' ─────────────────────────────

  it('APIError with status 429 classifies as rate_limit with retryAfterSeconds from header', async () => {
    const arbRetryAfter = fc.oneof(
      fc.constant(null as number | null),
      fc.integer({ min: 1, max: 3600 }),
    );

    await fc.assert(
      fc.asyncProperty(arbRetryAfter, async (retryAfterValue) => {
        const { APIError } = require('openai');
        const headers = new Headers();
        if (retryAfterValue !== null) {
          headers.set('retry-after', String(retryAfterValue));
        }
        const err = new APIError(429, undefined, '429 Too Many Requests', headers);

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('rate_limit');
        if (retryAfterValue !== null) {
          expect(result.retryAfterSeconds).toBe(retryAfterValue);
        } else {
          expect(result.retryAfterSeconds).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  // ─── Server errors (500-599) -> 'server' ──────────────────────────────────

  it('APIError with 5xx status classifies as server', async () => {
    const arbServerStatus = fc.integer({ min: 500, max: 599 });

    await fc.assert(
      fc.asyncProperty(arbServerStatus, async (status) => {
        const { APIError } = require('openai');
        const err = new APIError(status, undefined, `${status} Server Error`, new Headers());

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('server');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Network/connection errors -> 'network' ──────────────────────────────

  it('plain Error with network-related message classifies as network', async () => {
    const arbNetworkErrorMessage = fc.oneof(
      fc.constant('network error occurred'),
      fc.constant('request timeout after 30s'),
      fc.constant('dns resolution failed'),
      fc.constant('econnrefused 127.0.0.1:443'),
      fc.constant('enotfound api.openai.com'),
      fc.constant('fetch failed'),
      fc.constant('abort signal received'),
      // Prefix/suffix arbitrary text around the keyword
      fc.tuple(
        fc.string({ minLength: 0, maxLength: 20 }),
        fc.constantFrom('network', 'timeout', 'dns', 'econnrefused', 'enotfound', 'fetch', 'abort'),
        fc.string({ minLength: 0, maxLength: 20 }),
      ).map(([prefix, keyword, suffix]) => `${prefix} ${keyword} ${suffix}`.trim()),
    );

    await fc.assert(
      fc.asyncProperty(arbNetworkErrorMessage, async (message) => {
        const err = new Error(message);

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('network');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Error messages do NOT expose raw API response bodies ─────────────────

  it('classified error messages do not contain raw response body content', async () => {
    const arbSensitiveBody = fc.record({
      error: fc.record({
        type: fc.stringMatching(/^xtype_[a-z]{5,15}$/),
        message: fc.stringMatching(/^XBODY_[A-Z0-9]{10,40}$/),
        code: fc.stringMatching(/^xcode_[a-z]{5,10}$/),
      }),
    });

    const arbErrorScenario = fc.constantFrom(
      'auth',
      'rate_limit',
      'server',
      'network',
    ) as fc.Arbitrary<'auth' | 'rate_limit' | 'server' | 'network'>;

    await fc.assert(
      fc.asyncProperty(arbSensitiveBody, arbErrorScenario, async (body, errorType) => {
        const { APIError } = require('openai');
        let err: Error;

        switch (errorType) {
          case 'auth': {
            err = new APIError(401, body, body.error.message, new Headers());
            break;
          }
          case 'rate_limit': {
            err = new APIError(429, body, body.error.message, new Headers());
            break;
          }
          case 'server': {
            err = new APIError(500, body, body.error.message, new Headers());
            break;
          }
          case 'network': {
            // Network errors are plain Errors; verify classified error doesn't leak
            err = new Error('network error');
            break;
          }
        }

        const result = await getClassifiedError(err!);
        expect(result).toBeInstanceOf(ProviderError);

        // The classified error message should NOT contain the raw JSON body
        const rawBodyStr = JSON.stringify(body);
        expect(result.message).not.toContain(rawBodyStr);

        // Should not contain the sensitive body type, message, or code field content
        expect(result.message).not.toContain(body.error.type);
        expect(result.message).not.toContain(body.error.message);
        expect(result.message).not.toContain(body.error.code);
      }),
      { numRuns: 100 },
    );
  });

  // ─── Fallback: non-APIError without network keywords -> 'server' ──────────

  it('non-APIError without network keywords classifies as server (fallback)', async () => {
    // Generate error messages that do NOT contain any network keywords
    const arbNonNetworkMessage = fc.string({ minLength: 1, maxLength: 100 }).filter((msg) => {
      const lower = msg.toLowerCase();
      return (
        !lower.includes('network') &&
        !lower.includes('timeout') &&
        !lower.includes('dns') &&
        !lower.includes('econnrefused') &&
        !lower.includes('enotfound') &&
        !lower.includes('fetch') &&
        !lower.includes('abort')
      );
    });

    await fc.assert(
      fc.asyncProperty(arbNonNetworkMessage, async (message) => {
        const err = new Error(message);

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('server');
      }),
      { numRuns: 100 },
    );
  });
});
