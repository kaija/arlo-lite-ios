/**
 * Property-based test for streaming and non-streaming parameter consistency.
 *
 * Feature: sdk-provider-integration, Property 6: Streaming and non-streaming parameter consistency
 *
 * **Validates: Requirements 2.9**
 *
 * For any CompletionRequest, the parameters passed to the SDK method (model, messages,
 * max_tokens, system, thinking configuration) SHALL be identical between the streaming
 * and non-streaming code paths, differing only in the `stream` flag.
 */

import fc from 'fast-check';
import type { ProviderConfig, CompletionRequest, ThinkingLevel } from '../types';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Variables prefixed with "mock" are allowed in jest.mock() factories
const mockMessagesCreate = jest.fn();
const mockMessagesStream = jest.fn();

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
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockMessagesCreate,
        stream: mockMessagesStream,
      },
    })),
    APIError: MockAPIError,
    APIConnectionError: MockAPIConnectionError,
    APIConnectionTimeoutError: MockAPIConnectionTimeoutError,
    APIUserAbortError: MockAPIUserAbortError,
    AuthenticationError: MockAuthenticationError,
    PermissionDeniedError: MockPermissionDeniedError,
    RateLimitError: MockRateLimitError,
  };
});

// Import after mock setup
import { AnthropicProvider } from '../anthropic/anthropic-provider';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Drain the async iterable to ensure all code paths execute. */
async function drainStream(iterable: AsyncIterable<any>): Promise<void> {
  for await (const _ of iterable) {
    // consume all chunks
  }
}

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid model ID string. */
const arbModelId = fc.stringMatching(/^[a-z0-9-]{3,50}$/);

/** Generate a thinking level. */
const arbThinkingLevel: fc.Arbitrary<ThinkingLevel> = fc.constantFrom(
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
);

/** Generate a simple text message content. */
const arbTextContent = fc.string({ minLength: 1, maxLength: 200 });

/** Generate a user or assistant message (not system). */
const arbNonSystemMessage = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: arbTextContent,
});

/** Generate a system message. */
const arbSystemMessage = fc.record({
  role: fc.constant('system' as const),
  content: arbTextContent,
});

/** Generate a messages array with 0-2 system messages and 1-5 non-system messages. */
const arbMessages = fc
  .tuple(
    fc.array(arbSystemMessage, { minLength: 0, maxLength: 2 }),
    fc.array(arbNonSystemMessage, { minLength: 1, maxLength: 5 }),
  )
  .map(([systemMsgs, otherMsgs]) => [...systemMsgs, ...otherMsgs]);

/** Generate an optional maxTokens value. */
const arbMaxTokens = fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined });

/** Generate a CompletionRequest. */
const arbCompletionRequest: fc.Arbitrary<CompletionRequest> = fc
  .tuple(arbMessages, arbModelId, arbThinkingLevel, arbMaxTokens)
  .map(([messages, model, thinkingLevel, maxTokens]) => ({
    messages,
    model,
    thinkingLevel,
    stream: false,
    ...(maxTokens !== undefined ? { maxTokens } : {}),
  }));

// ─── Property 6: Streaming and non-streaming parameter consistency ───────────

// Feature: sdk-provider-integration, Property 6: Streaming and non-streaming parameter consistency
describe('Property 6: Streaming and non-streaming parameter consistency', () => {
  let capturedCreateParams: any;
  let capturedStreamParams: any;
  let capturedStreamOptions: any;

  beforeEach(() => {
    capturedCreateParams = null;
    capturedStreamParams = null;
    capturedStreamOptions = null;

    mockMessagesCreate.mockReset();
    mockMessagesStream.mockReset();

    mockMessagesCreate.mockImplementation((params: any) => {
      capturedCreateParams = JSON.parse(JSON.stringify(params));
      return Promise.resolve({
        content: [{ type: 'text', text: 'response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        stop_reason: 'end_turn',
      });
    });

    mockMessagesStream.mockImplementation((params: any, options?: any) => {
      capturedStreamParams = JSON.parse(JSON.stringify(params));
      capturedStreamOptions = options;
      const events = [{ type: 'message_stop' }];
      let index = 0;
      return {
        [Symbol.asyncIterator]() {
          return {
            async next() {
              if (index < events.length) {
                return { value: events[index++], done: false };
              }
              return { value: undefined, done: true };
            },
          };
        },
      };
    });
  });

  it('parameters passed to create() and stream() are identical except for the stream flag', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        // Reset captures for this iteration
        capturedCreateParams = null;
        capturedStreamParams = null;
        capturedStreamOptions = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        // Call complete() (non-streaming) — captures params in create()
        await provider.complete(config, { ...request, stream: false }, apiKey);

        // Call streamCompletion() (streaming) — captures params in stream()
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        // Both should have captured params
        expect(capturedCreateParams).not.toBeNull();
        expect(capturedStreamParams).not.toBeNull();

        // Extract the stream flag from create params and remove it for comparison
        const { stream, ...createParamsWithoutStream } = capturedCreateParams;

        // The create() call should include stream: false
        expect(stream).toBe(false);

        // The stream() call should NOT include a stream flag
        expect(capturedStreamParams).not.toHaveProperty('stream');

        // All other parameters should be identical
        expect(createParamsWithoutStream).toEqual(capturedStreamParams);

        // The stream call should pass options with signal as second argument
        expect(capturedStreamOptions).toBeDefined();
        expect(capturedStreamOptions.signal).toBe(signal);
      }),
      { numRuns: 100 },
    );
  });

  it('model parameter is consistent between streaming and non-streaming', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        capturedCreateParams = null;
        capturedStreamParams = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        await provider.complete(config, { ...request, stream: false }, apiKey);
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        expect(capturedCreateParams.model).toBe(capturedStreamParams.model);
        expect(capturedCreateParams.model).toBe(request.model);
      }),
      { numRuns: 100 },
    );
  });

  it('max_tokens parameter is consistent between streaming and non-streaming', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        capturedCreateParams = null;
        capturedStreamParams = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        await provider.complete(config, { ...request, stream: false }, apiKey);
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        expect(capturedCreateParams.max_tokens).toBe(capturedStreamParams.max_tokens);
        // Should be request.maxTokens or 4096 default
        const expected = request.maxTokens ?? 4096;
        expect(capturedCreateParams.max_tokens).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('system parameter is consistent between streaming and non-streaming', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        capturedCreateParams = null;
        capturedStreamParams = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        await provider.complete(config, { ...request, stream: false }, apiKey);
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        // Both should have the same system param (or both should omit it)
        expect(capturedCreateParams.system).toEqual(capturedStreamParams.system);
      }),
      { numRuns: 100 },
    );
  });

  it('thinking configuration is consistent between streaming and non-streaming', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        capturedCreateParams = null;
        capturedStreamParams = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        await provider.complete(config, { ...request, stream: false }, apiKey);
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        // Both should have the same thinking param (or both should omit it)
        expect(capturedCreateParams.thinking).toEqual(capturedStreamParams.thinking);
      }),
      { numRuns: 100 },
    );
  });

  it('messages array is consistent between streaming and non-streaming', async () => {
    await fc.assert(
      fc.asyncProperty(arbCompletionRequest, async (request) => {
        capturedCreateParams = null;
        capturedStreamParams = null;

        const provider = new AnthropicProvider();
        const config = makeConfig();
        const apiKey = 'test-api-key';
        const signal = new AbortController().signal;

        await provider.complete(config, { ...request, stream: false }, apiKey);
        await drainStream(
          provider.streamCompletion(config, { ...request, stream: true }, apiKey, signal),
        );

        // Messages array should be identical (excluding system messages)
        expect(capturedCreateParams.messages).toEqual(capturedStreamParams.messages);

        // Neither should contain system-role messages
        for (const msg of capturedCreateParams.messages) {
          expect(msg.role).not.toBe('system');
        }
        for (const msg of capturedStreamParams.messages) {
          expect(msg.role).not.toBe('system');
        }
      }),
      { numRuns: 100 },
    );
  });
});
