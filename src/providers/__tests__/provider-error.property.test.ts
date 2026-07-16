/**
 * Property-based tests for ProviderError retry behavior and error handling.
 *
 * Feature: sdk-provider-integration, Property 13: Rate-limit Retry-After handling
 * Feature: sdk-provider-integration, Property 14: Auth/network errors throw with correct category
 * Feature: sdk-provider-integration, Property 15: Retriable errors emit error+done chunk sequence
 * Feature: sdk-provider-integration, Property 16: Network errors during streaming emit error chunk
 *
 * **Validates: Requirements 7.3, 7.4, 5.8, 5.9, 2.7**
 */

import fc from 'fast-check';
import { ProviderError } from '../errors';
import type { ProviderConfig, CompletionRequest, StreamChunk } from '../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// ─── OpenAI Mock ─────────────────────────────────────────────────────────────

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

// ─── Anthropic Mock ──────────────────────────────────────────────────────────

jest.mock('@anthropic-ai/sdk', () => {
  class MockAPIError extends Error {
    status: number | undefined;
    headers: Headers | undefined;
    error: any;
    constructor(message?: string, status?: number) {
      super(message ?? '');
      this.status = status;
      this.name = 'APIError';
    }
  }
  class MockAPIConnectionError extends MockAPIError {
    constructor(opts?: { message?: string; cause?: Error }) {
      super(opts?.message ?? 'Connection error.', undefined);
      this.status = undefined;
      this.name = 'APIConnectionError';
    }
  }
  class MockAPIConnectionTimeoutError extends MockAPIConnectionError {
    constructor(opts?: { message?: string }) {
      super({ message: opts?.message ?? 'Request timed out.' });
      this.name = 'APIConnectionTimeoutError';
    }
  }
  class MockAPIUserAbortError extends MockAPIError {
    constructor(opts?: { message?: string }) {
      super(opts?.message ?? 'Request was aborted.', undefined);
      this.name = 'APIUserAbortError';
    }
  }
  class MockAuthenticationError extends MockAPIError {
    constructor() {
      super('Authentication error', 401);
      this.status = 401;
      this.name = 'AuthenticationError';
    }
  }
  class MockPermissionDeniedError extends MockAPIError {
    constructor() {
      super('Permission denied', 403);
      this.status = 403;
      this.name = 'PermissionDeniedError';
    }
  }
  class MockRateLimitError extends MockAPIError {
    constructor() {
      super('Rate limit exceeded', 429);
      this.status = 429;
      this.name = 'RateLimitError';
    }
  }

  return {
    __esModule: true,
    default: jest.fn(),
    APIError: MockAPIError,
    APIConnectionError: MockAPIConnectionError,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
    APIUserAbortError: MockAPIUserAbortError,
    AuthenticationError: MockAuthenticationError,
    PermissionDeniedError: MockPermissionDeniedError,
    RateLimitError: MockRateLimitError,
  };
});

jest.mock('../../domain/thinking-mapper', () => ({
  mapThinkingLevelAnthropic: () => ({ thinking: { type: 'disabled' } }),
  mapThinkingLevelOpenAI: () => ({}),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import { OpenAIProvider } from '../openai/openai-provider';
import { AnthropicProvider } from '../anthropic/anthropic-provider';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeOpenAIConfig(): ProviderConfig {
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

function makeAnthropicConfig(): ProviderConfig {
  return {
    id: 'test-anthropic',
    type: 'anthropic',
    name: 'Test Anthropic',
    baseUrl: 'https://api.anthropic.com',
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function makeRequest(stream = false): CompletionRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'test-model',
    thinkingLevel: 'off',
    stream,
  };
}

/** Collect all StreamChunks from an AsyncIterable. */
async function collectChunks(iterable: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const chunks: StreamChunk[] = [];
  for await (const chunk of iterable) {
    chunks.push(chunk);
  }
  return chunks;
}

/** Set up Anthropic mock client that throws during streaming. */
function createAnthropicStreamingError(error: Error) {
  const Anthropic = require('@anthropic-ai/sdk').default;
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockRejectedValue(error),
      stream: () => ({
        [Symbol.asyncIterator]: async function* () {
          throw error;
        },
      }),
    },
  }));
}

/** Set up Anthropic mock client that throws during complete(). */
function createAnthropicCompleteError(error: Error) {
  const Anthropic = require('@anthropic-ai/sdk').default;
  Anthropic.mockImplementation(() => ({
    messages: {
      create: jest.fn().mockRejectedValue(error),
      stream: () => ({
        [Symbol.asyncIterator]: async function* () {
          throw error;
        },
      }),
    },
  }));
}

// ─── Property 13: Rate-limit Retry-After handling ────────────────────────────

// Feature: sdk-provider-integration, Property 13: Rate-limit Retry-After handling
describe('Property 13: Rate-limit Retry-After handling', () => {
  /**
   * **Validates: Requirements 7.3, 7.4**
   *
   * For any rate-limit error (HTTP 429) with an optional Retry-After header value,
   * the ProviderError SHALL have retryAfterSeconds set to the parsed integer value
   * when the header is present, or null when absent. During streaming, the emitted
   * error StreamChunk content SHALL contain the retry duration (or "unknown" when null).
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('OpenAI: ProviderError has correct retryAfterSeconds from 429 with Retry-After header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 7200 }),
        async (retrySeconds) => {
          const { APIError } = require('openai');
          const headers = new Headers();
          headers.set('retry-after', String(retrySeconds));
          const err = new APIError(429, undefined, '429 Too Many Requests', headers);

          mockChatCompletionsCreate.mockRejectedValue(err);
          const provider = new OpenAIProvider();

          try {
            await provider.complete(makeOpenAIConfig(), makeRequest(), 'test-key');
            throw new Error('Expected to throw');
          } catch (e) {
            const pe = e as ProviderError;
            expect(pe).toBeInstanceOf(ProviderError);
            expect(pe.category).toBe('rate_limit');
            expect(pe.retryAfterSeconds).toBe(retrySeconds);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('OpenAI: ProviderError has null retryAfterSeconds when Retry-After header absent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const { APIError } = require('openai');
        const headers = new Headers(); // No retry-after header
        const err = new APIError(429, undefined, '429 Too Many Requests', headers);

        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();

        try {
          await provider.complete(makeOpenAIConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('rate_limit');
          expect(pe.retryAfterSeconds).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: ProviderError has correct retryAfterSeconds from 429 with Retry-After header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 7200 }),
        async (retrySeconds) => {
          const sdk = require('@anthropic-ai/sdk');
          const err = new sdk.RateLimitError();
          const headers = new Headers();
          headers.set('retry-after', String(retrySeconds));
          err.headers = headers;

          createAnthropicCompleteError(err);
          const provider = new AnthropicProvider();

          try {
            await provider.complete(makeAnthropicConfig(), makeRequest(), 'test-key');
            throw new Error('Expected to throw');
          } catch (e) {
            const pe = e as ProviderError;
            expect(pe).toBeInstanceOf(ProviderError);
            expect(pe.category).toBe('rate_limit');
            expect(pe.retryAfterSeconds).toBe(retrySeconds);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Anthropic: ProviderError has null retryAfterSeconds when Retry-After absent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.RateLimitError();
        err.headers = new Headers(); // No retry-after header

        createAnthropicCompleteError(err);
        const provider = new AnthropicProvider();

        try {
          await provider.complete(makeAnthropicConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('rate_limit');
          expect(pe.retryAfterSeconds).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it('OpenAI streaming: error chunk content contains retry duration when present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 7200 }),
        async (retrySeconds) => {
          const { APIError } = require('openai');
          const headers = new Headers();
          headers.set('retry-after', String(retrySeconds));
          const err = new APIError(429, undefined, '429 Too Many Requests', headers);

          mockChatCompletionsCreate.mockRejectedValue(err);
          const provider = new OpenAIProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
          );

          const errorChunks = chunks.filter((c) => c.type === 'error');
          expect(errorChunks).toHaveLength(1);
          expect(errorChunks[0].content).toContain('rate_limit');
          expect(errorChunks[0].content).toContain(String(retrySeconds));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Anthropic streaming: error chunk content contains "unknown" when Retry-After absent', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.RateLimitError();
        err.headers = new Headers(); // No retry-after

        createAnthropicStreamingError(err);
        const provider = new AnthropicProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
        );

        const errorChunks = chunks.filter((c) => c.type === 'error');
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0].content).toContain('rate_limit');
        expect(errorChunks[0].content).toContain('unknown');
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic streaming: error chunk content contains retry duration when header present', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 7200 }),
        async (retrySeconds) => {
          const sdk = require('@anthropic-ai/sdk');
          const err = new sdk.RateLimitError();
          const headers = new Headers();
          headers.set('retry-after', String(retrySeconds));
          err.headers = headers;

          createAnthropicStreamingError(err);
          const provider = new AnthropicProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
          );

          const errorChunks = chunks.filter((c) => c.type === 'error');
          expect(errorChunks).toHaveLength(1);
          expect(errorChunks[0].content).toContain('rate_limit');
          expect(errorChunks[0].content).toContain(String(retrySeconds));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14: Auth/network errors throw with correct category ────────────

// Feature: sdk-provider-integration, Property 14: Auth/network errors throw with correct category
describe('Property 14: Auth/network errors throw with correct category', () => {
  /**
   * **Validates: Requirements 5.8**
   *
   * For any authentication error (401/403) or network error during `complete`
   * or `streamCompletion`, the provider SHALL throw a ProviderError with the
   * corresponding category and SHALL NOT return a partial CompletionResponse
   * or yield partial content after the error.
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('OpenAI: auth errors (401/403) throw ProviderError with category authentication', async () => {
    const arbAuthStatus = fc.constantFrom(401, 403);

    await fc.assert(
      fc.asyncProperty(arbAuthStatus, async (status) => {
        const { APIError } = require('openai');
        const err = new APIError(status, undefined, `${status} Unauthorized`, new Headers());

        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();

        try {
          await provider.complete(makeOpenAIConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('authentication');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('OpenAI: network errors throw ProviderError with category network', async () => {
    const arbNetworkMsg = fc.constantFrom(
      'network error',
      'request timeout',
      'dns resolution failed',
      'econnrefused 127.0.0.1',
      'fetch failed',
    );

    await fc.assert(
      fc.asyncProperty(arbNetworkMsg, async (message) => {
        const err = new Error(message);
        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();

        try {
          await provider.complete(makeOpenAIConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('network');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: auth errors throw ProviderError with category authentication', async () => {
    const arbAuthError = fc.constantFrom('AuthenticationError', 'PermissionDeniedError');

    await fc.assert(
      fc.asyncProperty(arbAuthError, async (errorType) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = errorType === 'AuthenticationError'
          ? new sdk.AuthenticationError()
          : new sdk.PermissionDeniedError();
        err.headers = new Headers();

        createAnthropicCompleteError(err);
        const provider = new AnthropicProvider();

        try {
          await provider.complete(makeAnthropicConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('authentication');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: network errors throw ProviderError with category network', async () => {
    const arbNetworkError = fc.constantFrom('APIConnectionError', 'APIConnectionTimeoutError');

    await fc.assert(
      fc.asyncProperty(arbNetworkError, async (errorType) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = errorType === 'APIConnectionError'
          ? new sdk.APIConnectionError({ message: 'Connection failed' })
          : new sdk.APIConnectionTimeoutError({ message: 'Timed out' });

        createAnthropicCompleteError(err);
        const provider = new AnthropicProvider();

        try {
          await provider.complete(makeAnthropicConfig(), makeRequest(), 'test-key');
          throw new Error('Expected to throw');
        } catch (e) {
          const pe = e as ProviderError;
          expect(pe).toBeInstanceOf(ProviderError);
          expect(pe.category).toBe('network');
        }
      }),
      { numRuns: 100 },
    );
  });

  it('OpenAI streaming: auth errors do not yield partial content before error', async () => {
    const arbAuthStatus = fc.constantFrom(401, 403);

    await fc.assert(
      fc.asyncProperty(arbAuthStatus, async (status) => {
        const { APIError } = require('openai');
        const err = new APIError(status, undefined, `${status} Unauthorized`, new Headers());

        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
        );

        // No text or thinking chunks should appear before error
        const textChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');
        expect(textChunks).toHaveLength(0);

        const errorChunks = chunks.filter((c) => c.type === 'error');
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0].content).toContain('authentication');
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic streaming: network errors do not yield partial content before error', async () => {
    const arbNetworkError = fc.constantFrom('APIConnectionError', 'APIConnectionTimeoutError');

    await fc.assert(
      fc.asyncProperty(arbNetworkError, async (errorType) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = errorType === 'APIConnectionError'
          ? new sdk.APIConnectionError({ message: 'Connection failed' })
          : new sdk.APIConnectionTimeoutError({ message: 'Timed out' });

        createAnthropicStreamingError(err);
        const provider = new AnthropicProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
        );

        // No text or thinking chunks should appear before error
        const textChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');
        expect(textChunks).toHaveLength(0);

        const errorChunks = chunks.filter((c) => c.type === 'error');
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0].content).toContain('network');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 15: Retriable errors emit error+done chunk sequence ────────────

// Feature: sdk-provider-integration, Property 15: Retriable errors emit error+done chunk sequence
describe('Property 15: Retriable errors emit error+done chunk sequence', () => {
  /**
   * **Validates: Requirements 5.9**
   *
   * For any retriable error (HTTP 429 or 5xx) occurring during `streamCompletion`,
   * the provider SHALL yield exactly one StreamChunk of type 'error' containing the
   * failure reason, followed by exactly one StreamChunk of type 'done', and SHALL
   * yield no further chunks.
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('OpenAI: retriable 429 error emits exactly error+done sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.integer({ min: 1, max: 3600 }), { nil: null }),
        async (retryAfter) => {
          const { APIError } = require('openai');
          const headers = new Headers();
          if (retryAfter !== null) {
            headers.set('retry-after', String(retryAfter));
          }
          const err = new APIError(429, undefined, '429 Too Many Requests', headers);

          mockChatCompletionsCreate.mockRejectedValue(err);
          const provider = new OpenAIProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
          );

          // Exactly: error, done (and nothing before or after)
          const errorChunks = chunks.filter((c) => c.type === 'error');
          const doneChunks = chunks.filter((c) => c.type === 'done');
          const otherChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

          expect(errorChunks).toHaveLength(1);
          expect(doneChunks).toHaveLength(1);
          expect(otherChunks).toHaveLength(0);

          // Error comes before done
          const errorIdx = chunks.indexOf(errorChunks[0]);
          const doneIdx = chunks.indexOf(doneChunks[0]);
          expect(errorIdx).toBeLessThan(doneIdx);

          // Error chunk contains failure reason
          expect(errorChunks[0].content).toContain('rate_limit');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('OpenAI: retriable 5xx error emits exactly error+done sequence', async () => {
    const arbServerStatus = fc.integer({ min: 500, max: 599 });

    await fc.assert(
      fc.asyncProperty(arbServerStatus, async (status) => {
        const { APIError } = require('openai');
        const err = new APIError(status, undefined, `${status} Server Error`, new Headers());

        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
        );

        const errorChunks = chunks.filter((c) => c.type === 'error');
        const doneChunks = chunks.filter((c) => c.type === 'done');
        const otherChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        expect(errorChunks).toHaveLength(1);
        expect(doneChunks).toHaveLength(1);
        expect(otherChunks).toHaveLength(0);

        // Error before done
        const errorIdx = chunks.indexOf(errorChunks[0]);
        const doneIdx = chunks.indexOf(doneChunks[0]);
        expect(errorIdx).toBeLessThan(doneIdx);

        // Error chunk contains failure reason
        expect(errorChunks[0].content).toContain('server');
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: retriable 429 error emits exactly error+done sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.integer({ min: 1, max: 3600 }), { nil: null }),
        async (retryAfter) => {
          const sdk = require('@anthropic-ai/sdk');
          const err = new sdk.RateLimitError();
          const headers = new Headers();
          if (retryAfter !== null) {
            headers.set('retry-after', String(retryAfter));
          }
          err.headers = headers;

          createAnthropicStreamingError(err);
          const provider = new AnthropicProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
          );

          const errorChunks = chunks.filter((c) => c.type === 'error');
          const doneChunks = chunks.filter((c) => c.type === 'done');
          const otherChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

          expect(errorChunks).toHaveLength(1);
          expect(doneChunks).toHaveLength(1);
          expect(otherChunks).toHaveLength(0);

          const errorIdx = chunks.indexOf(errorChunks[0]);
          const doneIdx = chunks.indexOf(doneChunks[0]);
          expect(errorIdx).toBeLessThan(doneIdx);

          expect(errorChunks[0].content).toContain('rate_limit');
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Anthropic: retriable 5xx error emits exactly error+done sequence', async () => {
    const arbServerStatus = fc.integer({ min: 500, max: 599 }).filter((s) => s !== 529);

    await fc.assert(
      fc.asyncProperty(arbServerStatus, async (status) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIError(`${status} Server Error`, status);
        err.headers = new Headers();

        createAnthropicStreamingError(err);
        const provider = new AnthropicProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
        );

        const errorChunks = chunks.filter((c) => c.type === 'error');
        const doneChunks = chunks.filter((c) => c.type === 'done');
        const otherChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        expect(errorChunks).toHaveLength(1);
        expect(doneChunks).toHaveLength(1);
        expect(otherChunks).toHaveLength(0);

        const errorIdx = chunks.indexOf(errorChunks[0]);
        const doneIdx = chunks.indexOf(doneChunks[0]);
        expect(errorIdx).toBeLessThan(doneIdx);

        expect(errorChunks[0].content).toContain('server');
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: retriable 529 overloaded error emits exactly error+done sequence', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(529), async (status) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIError('529 Overloaded', status);
        err.headers = new Headers();

        createAnthropicStreamingError(err);
        const provider = new AnthropicProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
        );

        const errorChunks = chunks.filter((c) => c.type === 'error');
        const doneChunks = chunks.filter((c) => c.type === 'done');
        const otherChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        expect(errorChunks).toHaveLength(1);
        expect(doneChunks).toHaveLength(1);
        expect(otherChunks).toHaveLength(0);

        const errorIdx = chunks.indexOf(errorChunks[0]);
        const doneIdx = chunks.indexOf(doneChunks[0]);
        expect(errorIdx).toBeLessThan(doneIdx);

        expect(errorChunks[0].content).toContain('overloaded');
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 16: Network errors during streaming emit error chunk ───────────

// Feature: sdk-provider-integration, Property 16: Network errors during streaming emit error chunk
describe('Property 16: Network errors during streaming emit error chunk', () => {
  /**
   * **Validates: Requirements 2.7**
   *
   * For any network failure (DNS, TCP, TLS, timeout) occurring during an active
   * stream, the provider SHALL emit a StreamChunk of type 'error' whose content
   * identifies the failure type, and SHALL cease further chunk emission from that
   * stream.
   */

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('OpenAI: network errors during streaming emit error chunk identifying failure type', async () => {
    const arbNetworkError = fc.constantFrom(
      { message: 'network error: connection reset', keyword: 'network' },
      { message: 'request timeout after 60s', keyword: 'timeout' },
      { message: 'dns resolution failed for api.openai.com', keyword: 'dns' },
      { message: 'econnrefused 127.0.0.1:443', keyword: 'econnrefused' },
      { message: 'enotfound api.openai.com', keyword: 'enotfound' },
      { message: 'fetch failed: TLS handshake error', keyword: 'fetch' },
    );

    await fc.assert(
      fc.asyncProperty(arbNetworkError, async ({ message }) => {
        const err = new Error(message);
        mockChatCompletionsCreate.mockRejectedValue(err);
        const provider = new OpenAIProvider();
        const signal = new AbortController().signal;

        const chunks = await collectChunks(
          provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
        );

        const errorChunks = chunks.filter((c) => c.type === 'error');
        expect(errorChunks).toHaveLength(1);
        expect(errorChunks[0].content).toContain('network');

        // No further chunks after the done chunk
        const doneIdx = chunks.findIndex((c) => c.type === 'done');
        expect(doneIdx).toBeGreaterThan(-1);
        const chunksAfterDone = chunks.slice(doneIdx + 1);
        expect(chunksAfterDone).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('Anthropic: connection errors during streaming emit error chunk identifying failure type', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'APIConnectionError',
          'APIConnectionTimeoutError',
        ),
        async (errorType) => {
          const sdk = require('@anthropic-ai/sdk');
          const err = errorType === 'APIConnectionError'
            ? new sdk.APIConnectionError({ message: 'Connection refused' })
            : new sdk.APIConnectionTimeoutError({ message: 'Request timed out' });

          createAnthropicStreamingError(err);
          const provider = new AnthropicProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
          );

          const errorChunks = chunks.filter((c) => c.type === 'error');
          expect(errorChunks).toHaveLength(1);
          expect(errorChunks[0].content).toContain('network');

          // No further chunks after done
          const doneIdx = chunks.findIndex((c) => c.type === 'done');
          expect(doneIdx).toBeGreaterThan(-1);
          const chunksAfterDone = chunks.slice(doneIdx + 1);
          expect(chunksAfterDone).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Anthropic: mid-stream network errors cease further chunk emission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
        async (textsBefore) => {
          // Simulate a stream that yields some text events then throws a network error
          const sdk = require('@anthropic-ai/sdk');
          const networkErr = new sdk.APIConnectionError({ message: 'Connection lost' });

          const Anthropic = sdk.default;
          Anthropic.mockImplementation(() => ({
            messages: {
              stream: () => ({
                [Symbol.asyncIterator]: async function* () {
                  for (const text of textsBefore) {
                    yield {
                      type: 'content_block_delta',
                      index: 0,
                      delta: { type: 'text_delta', text },
                    };
                  }
                  throw networkErr;
                },
              }),
            },
          }));

          const provider = new AnthropicProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeAnthropicConfig(), makeRequest(true), 'test-key', signal),
          );

          // Error chunk should be present
          const errorChunks = chunks.filter((c) => c.type === 'error');
          expect(errorChunks).toHaveLength(1);
          expect(errorChunks[0].content).toContain('network');

          // Done chunk should terminate the stream
          const doneChunks = chunks.filter((c) => c.type === 'done');
          expect(doneChunks.length).toBeGreaterThanOrEqual(1);

          // No chunks after the final done
          const lastDoneIdx = chunks.lastIndexOf(doneChunks[doneChunks.length - 1]);
          const chunksAfterDone = chunks.slice(lastDoneIdx + 1);
          expect(chunksAfterDone).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('OpenAI: mid-stream network errors cease further chunk emission', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 0, maxLength: 5 }),
        async (textsBefore) => {
          // Simulate an async iterable that yields some chunks then throws
          const err = new Error('network error: connection reset');

          mockChatCompletionsCreate.mockResolvedValue({
            [Symbol.asyncIterator]: async function* () {
              for (const text of textsBefore) {
                yield { choices: [{ index: 0, delta: { content: text } }] };
              }
              throw err;
            },
          });

          const provider = new OpenAIProvider();
          const signal = new AbortController().signal;

          const chunks = await collectChunks(
            provider.streamCompletion(makeOpenAIConfig(), makeRequest(true), 'test-key', signal),
          );

          // Error chunk should be present
          const errorChunks = chunks.filter((c) => c.type === 'error');
          expect(errorChunks).toHaveLength(1);
          expect(errorChunks[0].content).toContain('network');

          // Done chunk terminates
          const doneChunks = chunks.filter((c) => c.type === 'done');
          expect(doneChunks.length).toBeGreaterThanOrEqual(1);

          // No chunks after the final done
          const lastDoneIdx = chunks.lastIndexOf(doneChunks[doneChunks.length - 1]);
          const chunksAfterDone = chunks.slice(lastDoneIdx + 1);
          expect(chunksAfterDone).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
