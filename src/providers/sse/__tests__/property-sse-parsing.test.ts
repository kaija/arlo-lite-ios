/**
 * Property 3: SSE chunk parsing produces valid output
 *
 * For any valid SSE event line from a supported provider, parsing it through
 * the provider's SSE parser should produce either a valid StreamChunk (with
 * type in {text, thinking, done, error} and non-empty content for text/thinking
 * types), or null for non-content lines.
 *
 * Feature: arlo-lite-app, Property 3: SSE chunk parsing produces valid output
 * Validates: Requirements 4.5, 8.1
 */

import * as fc from 'fast-check';
import { getProvider, clearProviderCache } from '../../registry';
import { OpenAIProvider } from '../../openai/openai-provider';
import { AnthropicProvider } from '../../anthropic/anthropic-provider';
import type { StreamChunk } from '../../types';

// ─── Generators ──────────────────────────────────────────────────────────────

/** Arbitrary non-empty printable text for content payloads. */
const arbContent = fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0);

/**
 * Generate valid OpenAI text chunk SSE lines.
 * Format: data: {"choices":[{"delta":{"content":"<text>"}}]}
 */
const arbOpenAITextLine = arbContent.map(
  (text) =>
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
);

/**
 * Generate valid OpenAI thinking/reasoning chunk SSE lines.
 * Format: data: {"choices":[{"delta":{"reasoning_content":"<text>"}}]}
 */
const arbOpenAIThinkingLine = arbContent.map(
  (text) =>
    `data: ${JSON.stringify({ choices: [{ delta: { reasoning_content: text } }] })}`
);

/**
 * Generate OpenAI stream done signal.
 */
const arbOpenAIDoneLine = fc.constant('data: [DONE]');

/**
 * Generate OpenAI SSE comment lines (keep-alive pings).
 */
const arbOpenAIComment = fc.string({ minLength: 0, maxLength: 50 }).map((s) => `: ${s}`);

/**
 * Generate empty strings (event separators).
 */
const arbEmptyLine = fc.constant('');

/**
 * Generate valid Anthropic text delta SSE lines.
 * Format: data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"<text>"}}
 */
const arbAnthropicTextLine = arbContent.map(
  (text) =>
    `data: ${JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text },
    })}`
);

/**
 * Generate valid Anthropic thinking delta SSE lines.
 * Format: data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"<text>"}}
 */
const arbAnthropicThinkingLine = arbContent.map(
  (text) =>
    `data: ${JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'thinking_delta', thinking: text },
    })}`
);

/**
 * Generate Anthropic message_stop done signal.
 * Format: data: {"type":"message_stop"}
 */
const arbAnthropicDoneLine = fc.constant(
  `data: ${JSON.stringify({ type: 'message_stop' })}`
);

/**
 * Generate Anthropic event type lines (non-data, should be skipped).
 */
const arbAnthropicEventLine = fc.constantFrom(
  'event: content_block_delta',
  'event: message_start',
  'event: content_block_start',
  'event: message_delta',
  'event: message_stop'
);

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe('Feature: arlo-lite-app, Property 3: SSE chunk parsing produces valid output', () => {
  let openaiProvider: OpenAIProvider;
  let anthropicProvider: AnthropicProvider;

  beforeAll(() => {
    clearProviderCache();
    openaiProvider = getProvider('openai') as OpenAIProvider;
    anthropicProvider = getProvider('anthropic') as AnthropicProvider;
  });

  describe('OpenAI SSE parsing', () => {
    it('valid text chunk lines produce non-null result with type text and non-empty content', () => {
      fc.assert(
        fc.property(arbOpenAITextLine, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('text');
          expect(result!.content.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('valid thinking chunk lines produce non-null result with type thinking and non-empty content', () => {
      fc.assert(
        fc.property(arbOpenAIThinkingLine, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('thinking');
          expect(result!.content.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('done signal lines produce result with type done', () => {
      fc.assert(
        fc.property(arbOpenAIDoneLine, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('done');
        }),
        { numRuns: 100 }
      );
    });

    it('comment lines produce null result', () => {
      fc.assert(
        fc.property(arbOpenAIComment, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('empty lines produce null result', () => {
      fc.assert(
        fc.property(arbEmptyLine, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('result type is always in {text, thinking, done, error} when not null', () => {
      const arbAnyOpenAILine = fc.oneof(
        arbOpenAITextLine,
        arbOpenAIThinkingLine,
        arbOpenAIDoneLine,
        arbOpenAIComment,
        arbEmptyLine
      );

      fc.assert(
        fc.property(arbAnyOpenAILine, (line) => {
          const result = openaiProvider.parseStreamChunk(line);
          if (result !== null) {
            expect(['text', 'thinking', 'done', 'error']).toContain(result.type);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Anthropic SSE parsing', () => {
    it('valid text delta lines produce non-null result with type text and non-empty content', () => {
      fc.assert(
        fc.property(arbAnthropicTextLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('text');
          expect(result!.content.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('valid thinking delta lines produce non-null result with type thinking and non-empty content', () => {
      fc.assert(
        fc.property(arbAnthropicThinkingLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('thinking');
          expect(result!.content.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 }
      );
    });

    it('message_stop lines produce result with type done', () => {
      fc.assert(
        fc.property(arbAnthropicDoneLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('done');
        }),
        { numRuns: 100 }
      );
    });

    it('event type lines produce null result', () => {
      fc.assert(
        fc.property(arbAnthropicEventLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('empty lines produce null result', () => {
      fc.assert(
        fc.property(arbEmptyLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          expect(result).toBeNull();
        }),
        { numRuns: 100 }
      );
    });

    it('result type is always in {text, thinking, done, error} when not null', () => {
      const arbAnyAnthropicLine = fc.oneof(
        arbAnthropicTextLine,
        arbAnthropicThinkingLine,
        arbAnthropicDoneLine,
        arbAnthropicEventLine,
        arbEmptyLine
      );

      fc.assert(
        fc.property(arbAnyAnthropicLine, (line) => {
          const result = anthropicProvider.parseStreamChunk(line);
          if (result !== null) {
            expect(['text', 'thinking', 'done', 'error']).toContain(result.type);
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
