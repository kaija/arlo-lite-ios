/**
 * Property-based tests for Anthropic provider streaming behavior and error classification.
 *
 * Feature: sdk-provider-integration, Property 3: Anthropic stream event-to-chunk mapping
 * Feature: sdk-provider-integration, Property 4: Anthropic stream usage accumulation
 * Feature: sdk-provider-integration, Property 5: Unrecognized stream events are silently skipped
 * Feature: sdk-provider-integration, Property 7: Anthropic error classification
 *
 * **Validates: Requirements 1.4, 2.3, 2.4, 2.5, 2.8, 7.1**
 */

import fc from 'fast-check';
import { AnthropicProvider } from '../anthropic/anthropic-provider';
import { ProviderError } from '../errors';
import type { ProviderConfig, CompletionRequest, StreamChunk } from '../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Build mock classes with proper inheritance so that `instanceof` checks
// in the provider's `classifyError` function work correctly.
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
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal ProviderConfig for testing. */
function makeConfig(): ProviderConfig {
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

/** Create a minimal CompletionRequest for testing. */
function makeRequest(): CompletionRequest {
  return {
    messages: [{ role: 'user', content: 'Hello' }],
    model: 'claude-3-haiku-20240307',
    thinkingLevel: 'off',
    stream: true,
  };
}

/**
 * Set up the mock so that the next `new Anthropic()` call returns
 * a client whose `messages.stream()` yields the provided events.
 */
function createMockClient(events: any[]) {
  const Anthropic = require('@anthropic-ai/sdk').default;
  Anthropic.mockImplementation(() => ({
    messages: {
      stream: () => ({
        [Symbol.asyncIterator]: async function* () {
          for (const event of events) {
            yield event;
          }
        },
      }),
    },
  }));
}

/**
 * Set up the mock so that the next `new Anthropic()` call returns
 * a client whose `messages.create()` rejects with the provided error.
 */
function createMockClientThatThrows(error: Error) {
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

/** Collect all StreamChunks from the provider's streamCompletion. */
async function collectChunks(
  provider: AnthropicProvider,
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

/** Generate arbitrary text content for deltas. */
const arbText = fc.string({ minLength: 0, maxLength: 500 });

/** Generate a text_delta event. */
const arbTextDeltaEvent = fc.record({
  type: fc.constant('content_block_delta' as const),
  index: fc.nat({ max: 10 }),
  delta: fc.record({
    type: fc.constant('text_delta' as const),
    text: arbText,
  }),
});

/** Generate a thinking_delta event. */
const arbThinkingDeltaEvent = fc.record({
  type: fc.constant('content_block_delta' as const),
  index: fc.nat({ max: 10 }),
  delta: fc.record({
    type: fc.constant('thinking_delta' as const),
    thinking: arbText,
  }),
});

/** Generate a content_block_delta event with an unrecognized delta type. */
const arbUnrecognizedDeltaEvent = fc.record({
  type: fc.constant('content_block_delta' as const),
  index: fc.nat({ max: 10 }),
  delta: fc.record({
    type: fc.constantFrom(
      'input_json_delta',
      'citations_delta',
      'signature_delta',
      'tool_use_delta',
    ),
    partial_json: fc.string(),
  }),
});

/**
 * Generate non-chunk-producing top-level events with proper structure.
 * These events are recognized by streamCompletion for usage accumulation
 * but do NOT produce StreamChunks via mapStreamEvent.
 */
const arbNonChunkProducingEvent: fc.Arbitrary<any> = fc.oneof(
  fc.constant({ type: 'ping' }),
  fc.record({
    type: fc.constant('content_block_start'),
    index: fc.nat({ max: 10 }),
    content_block: fc.record({ type: fc.constant('text') }),
  }),
  fc.record({
    type: fc.constant('content_block_stop'),
    index: fc.nat({ max: 10 }),
  }),
  fc.constant({ type: 'message_stop' }),
  // message_start with proper structure (accumulates usage but doesn't emit chunk)
  fc.record({
    type: fc.constant('message_start'),
    message: fc.record({
      usage: fc.record({
        input_tokens: fc.nat({ max: 1000 }),
        output_tokens: fc.constant(0),
      }),
    }),
  }),
  // message_delta with proper structure (accumulates usage but doesn't emit chunk)
  fc.record({
    type: fc.constant('message_delta'),
    delta: fc.record({ stop_reason: fc.constant('end_turn') }),
    usage: fc.record({
      output_tokens: fc.nat({ max: 1000 }),
    }),
  }),
);

/** Generate positive integers for token usage. */
const arbTokenCount = fc.nat({ max: 100000 }).filter((n) => n > 0);

// ─── Property 3: Anthropic stream event-to-chunk mapping ─────────────────────

// Feature: sdk-provider-integration, Property 3: Anthropic stream event-to-chunk mapping
describe('Property 3: Anthropic stream event-to-chunk mapping', () => {
  it('text_delta events emit StreamChunk with type "text" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbTextDeltaEvent, async (event) => {
        const provider = new AnthropicProvider();
        createMockClient([event]);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // Filter to only text/thinking chunks
        const contentChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        expect(contentChunks).toHaveLength(1);
        expect(contentChunks[0].type).toBe('text');
        expect(contentChunks[0].content).toBe(event.delta.text ?? '');
      }),
      { numRuns: 100 },
    );
  });

  it('thinking_delta events emit StreamChunk with type "thinking" and matching content', async () => {
    await fc.assert(
      fc.asyncProperty(arbThinkingDeltaEvent, async (event) => {
        const provider = new AnthropicProvider();
        createMockClient([event]);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // Filter to only text/thinking chunks
        const contentChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        expect(contentChunks).toHaveLength(1);
        expect(contentChunks[0].type).toBe('thinking');
        expect(contentChunks[0].content).toBe(event.delta.thinking ?? '');
      }),
      { numRuns: 100 },
    );
  });

  it('content_block_delta events with unrecognized delta.type do not emit a StreamChunk', async () => {
    await fc.assert(
      fc.asyncProperty(arbUnrecognizedDeltaEvent, async (event) => {
        const provider = new AnthropicProvider();
        createMockClient([event]);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // No text/thinking chunks should be produced
        const contentChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');
        expect(contentChunks).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4: Anthropic stream usage accumulation ─────────────────────────

// Feature: sdk-provider-integration, Property 4: Anthropic stream usage accumulation
describe('Property 4: Anthropic stream usage accumulation', () => {
  it('final done chunk has correct usage from message_start and message_delta events', async () => {
    await fc.assert(
      fc.asyncProperty(arbTokenCount, arbTokenCount, arbText, async (inputTokens, outputTokens, text) => {
        const provider = new AnthropicProvider();

        // Construct a full event sequence: message_start -> content_block_delta -> message_delta -> message_stop
        const events = [
          {
            type: 'message_start',
            message: {
              usage: { input_tokens: inputTokens, output_tokens: 0 },
            },
          },
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'text_delta', text },
          },
          {
            type: 'message_delta',
            delta: { stop_reason: 'end_turn' },
            usage: { output_tokens: outputTokens },
          },
          {
            type: 'message_stop',
          },
        ];

        createMockClient(events);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // Find the final 'done' chunk
        const doneChunks = chunks.filter((c) => c.type === 'done');
        expect(doneChunks.length).toBeGreaterThanOrEqual(1);

        const finalDone = doneChunks[doneChunks.length - 1];
        expect(finalDone.usage).toBeDefined();
        expect(finalDone.usage!.promptTokens).toBe(inputTokens);
        expect(finalDone.usage!.completionTokens).toBe(outputTokens);
        expect(finalDone.usage!.totalTokens).toBe(inputTokens + outputTokens);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Unrecognized stream events are silently skipped ─────────────

// Feature: sdk-provider-integration, Property 5: Unrecognized stream events are silently skipped
describe('Property 5: Unrecognized stream events are silently skipped', () => {
  it('unrecognized events interspersed with valid events produce chunks only for valid events, in order', async () => {
    // Generator for valid text_delta events
    const arbValidEvent = fc.record({
      type: fc.constant('content_block_delta' as const),
      index: fc.constant(0),
      delta: fc.record({
        type: fc.constant('text_delta' as const),
        text: fc.string({ minLength: 1, maxLength: 50 }),
      }),
    });

    // Non-chunk-producing events (unrecognized delta types + non-chunk top-level events)
    const arbSkippedEvent = fc.oneof(
      arbUnrecognizedDeltaEvent,
      arbNonChunkProducingEvent,
    );

    // Generate interleaved valid and skipped events
    const arbInterleavedEvents = fc
      .tuple(
        fc.array(arbValidEvent, { minLength: 1, maxLength: 10 }),
        fc.array(arbSkippedEvent, { minLength: 1, maxLength: 10 }),
      )
      .map(([validEvents, skippedEvents]) => {
        // Interleave: skipped, valid, skipped, valid, ...
        const result: any[] = [];
        const maxLen = Math.max(validEvents.length, skippedEvents.length);
        for (let i = 0; i < maxLen; i++) {
          if (i < skippedEvents.length) result.push(skippedEvents[i]);
          if (i < validEvents.length) result.push(validEvents[i]);
        }
        return { validEvents, result };
      });

    await fc.assert(
      fc.asyncProperty(arbInterleavedEvents, async ({ validEvents, result }) => {
        const provider = new AnthropicProvider();
        createMockClient(result);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // Filter to only text/thinking chunks (exclude done/error)
        const contentChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');

        // Should have exactly as many content chunks as valid events
        expect(contentChunks).toHaveLength(validEvents.length);

        // Each content chunk should match the corresponding valid event's text, in order
        for (let i = 0; i < validEvents.length; i++) {
          expect(contentChunks[i].type).toBe('text');
          expect(contentChunks[i].content).toBe(validEvents[i].delta.text);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('a stream with only non-chunk-producing events produces no text/thinking chunks', async () => {
    const arbOnlySkippedEvents = fc.array(
      fc.oneof(arbUnrecognizedDeltaEvent, arbNonChunkProducingEvent),
      { minLength: 1, maxLength: 20 },
    );

    await fc.assert(
      fc.asyncProperty(arbOnlySkippedEvents, async (events) => {
        const provider = new AnthropicProvider();
        createMockClient(events);
        const chunks = await collectChunks(provider, makeConfig(), makeRequest());

        // No text or thinking chunks should be emitted
        const contentChunks = chunks.filter((c) => c.type === 'text' || c.type === 'thinking');
        expect(contentChunks).toHaveLength(0);

        // The done chunk should still be present (stream always terminates with done)
        const doneChunks = chunks.filter((c) => c.type === 'done');
        expect(doneChunks.length).toBeGreaterThanOrEqual(1);
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 7: Anthropic error classification ──────────────────────────────

// Feature: sdk-provider-integration, Property 7: Anthropic error classification
describe('Property 7: Anthropic error classification', () => {
  /**
   * **Validates: Requirements 1.4, 7.1**
   *
   * For any SDK error with HTTP status code, the resulting ProviderError SHALL have
   * category 'authentication' for 401/403, 'rate_limit' for 429, 'overloaded' for 529,
   * 'server' for 500-599 (excluding 529), and 'network' for connection/DNS/timeout
   * failures. The ProviderError message SHALL not expose raw API response bodies.
   */

  /**
   * Helper: mock client.messages.create() to throw the given error,
   * then call provider.complete() and return the resulting ProviderError.
   */
  async function getClassifiedError(error: Error): Promise<ProviderError> {
    const provider = new AnthropicProvider();
    createMockClientThatThrows(error);
    try {
      await provider.complete(makeConfig(), { ...makeRequest(), stream: false }, 'test-key');
      throw new Error('Expected provider.complete to throw');
    } catch (e) {
      return e as ProviderError;
    }
  }

  // ─── Authentication errors (401/403) -> 'authentication' ──────────────────

  it('AuthenticationError (401) classifies as authentication', async () => {
    const arbBody = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.record({
        error: fc.record({
          type: fc.constant('authentication_error'),
          message: fc.string({ minLength: 1, maxLength: 200 }),
        }),
      }),
    );

    await fc.assert(
      fc.asyncProperty(arbBody, async (body) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.AuthenticationError();
        err.headers = new Headers();
        err.error = body;

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('authentication');
      }),
      { numRuns: 100 },
    );
  });

  it('PermissionDeniedError (403) classifies as authentication', async () => {
    const arbBody = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.record({
        error: fc.record({
          type: fc.constant('permission_error'),
          message: fc.string({ minLength: 1, maxLength: 200 }),
        }),
      }),
    );

    await fc.assert(
      fc.asyncProperty(arbBody, async (body) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.PermissionDeniedError();
        err.headers = new Headers();
        err.error = body;

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('authentication');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Rate limit errors (429) -> 'rate_limit' ─────────────────────────────

  it('RateLimitError (429) classifies as rate_limit with retryAfterSeconds from header', async () => {
    const arbRetryAfter = fc.oneof(
      fc.constant(null as number | null),
      fc.integer({ min: 1, max: 3600 }),
    );

    await fc.assert(
      fc.asyncProperty(arbRetryAfter, async (retryAfterValue) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.RateLimitError();
        const headers = new Headers();
        if (retryAfterValue !== null) {
          headers.set('retry-after', String(retryAfterValue));
        }
        err.headers = headers;

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

  // ─── Overloaded (529) -> 'overloaded' ─────────────────────────────────────

  it('APIError with status 529 classifies as overloaded', async () => {
    const arbBody = fc.oneof(
      fc.constant(undefined),
      fc.record({
        error: fc.record({
          type: fc.constant('overloaded_error'),
          message: fc.string({ minLength: 1, maxLength: 200 }),
        }),
      }),
    );

    await fc.assert(
      fc.asyncProperty(arbBody, async (body) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIError('529 Overloaded', 529);
        err.headers = new Headers();
        err.error = body;

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('overloaded');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Server errors (500-599, excluding 529) -> 'server' ──────────────────

  it('APIError with 5xx status (excluding 529) classifies as server', async () => {
    const arbServerStatus = fc
      .integer({ min: 500, max: 599 })
      .filter((s) => s !== 529);

    const arbBody = fc.oneof(
      fc.constant(undefined),
      fc.record({
        error: fc.record({
          type: fc.constant('api_error'),
          message: fc.string({ minLength: 1, maxLength: 200 }),
        }),
      }),
    );

    await fc.assert(
      fc.asyncProperty(arbServerStatus, arbBody, async (status, body) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIError(`${status} Server Error`, status);
        err.headers = new Headers();
        err.error = body;

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('server');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Network/connection errors -> 'network' ──────────────────────────────

  it('APIConnectionError classifies as network', async () => {
    const arbMessage = fc.string({ minLength: 1, maxLength: 200 });

    await fc.assert(
      fc.asyncProperty(arbMessage, async (message) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIConnectionError({ message });

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('network');
      }),
      { numRuns: 100 },
    );
  });

  it('APIConnectionTimeoutError classifies as network', async () => {
    const arbMessage = fc.string({ minLength: 1, maxLength: 200 });

    await fc.assert(
      fc.asyncProperty(arbMessage, async (message) => {
        const sdk = require('@anthropic-ai/sdk');
        const err = new sdk.APIConnectionTimeoutError({ message });

        const result = await getClassifiedError(err);
        expect(result).toBeInstanceOf(ProviderError);
        expect(result.category).toBe('network');
      }),
      { numRuns: 100 },
    );
  });

  // ─── Error messages do NOT expose raw API response bodies ─────────────────

  it('classified error messages do not contain raw response body content', async () => {
    // Use distinctly identifiable strings that cannot coincidentally appear
    // in the provider's hardcoded human-readable error messages
    const arbSensitiveBody = fc.record({
      error: fc.record({
        type: fc.stringMatching(/^xtype_[a-z]{5,15}$/),
        message: fc.stringMatching(/^XBODY_[A-Z0-9]{10,40}$/),
      }),
    });

    const arbErrorType = fc.constantFrom(
      'auth',
      'rate_limit',
      'server',
      'connection',
      'timeout',
    ) as fc.Arbitrary<'auth' | 'rate_limit' | 'server' | 'connection' | 'timeout'>;

    await fc.assert(
      fc.asyncProperty(arbSensitiveBody, arbErrorType, async (body, errorType) => {
        const sdk = require('@anthropic-ai/sdk');
        let err: Error;

        switch (errorType) {
          case 'auth': {
            err = new sdk.AuthenticationError();
            (err as any).headers = new Headers();
            (err as any).error = body;
            break;
          }
          case 'rate_limit': {
            err = new sdk.RateLimitError();
            (err as any).headers = new Headers();
            (err as any).error = body;
            break;
          }
          case 'server': {
            err = new sdk.APIError('500 Internal', 500);
            (err as any).headers = new Headers();
            (err as any).error = body;
            break;
          }
          case 'connection': {
            err = new sdk.APIConnectionError({ message: 'Connection failed' });
            break;
          }
          case 'timeout': {
            err = new sdk.APIConnectionTimeoutError({ message: 'Timed out' });
            break;
          }
        }

        const result = await getClassifiedError(err!);
        expect(result).toBeInstanceOf(ProviderError);

        // The classified error message should NOT contain the raw JSON body
        const rawBodyStr = JSON.stringify(body);
        expect(result.message).not.toContain(rawBodyStr);

        // Should not contain the sensitive body type or message field content
        expect(result.message).not.toContain(body.error.type);
        expect(result.message).not.toContain(body.error.message);
      }),
      { numRuns: 100 },
    );
  });
});
