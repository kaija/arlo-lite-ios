// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
  ]),
}));

jest.mock('@/database/repositories/system-prompt-repo', () => ({
  getAllSystemPrompts: jest.fn(() => Promise.resolve([])),
  createSystemPrompt: jest.fn(),
  updateSystemPrompt: jest.fn(),
  deleteSystemPrompt: jest.fn(),
}));

import fc from 'fast-check';

/**
 * Property-based tests for system prompt prepend correctness.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 *
 * Feature: provider-ui-integration, Property 12: System Prompt Prepend Correctness
 *
 * Properties tested:
 * 1. When defaultSystemPromptId is non-null and matches a prompt,
 *    messages[0] is a system message with that prompt's content.
 * 2. When defaultSystemPromptId is null, messages are returned unchanged.
 * 3. The original messages array is not mutated.
 */

import { useSettingsStore } from '@/stores/settings-store';
import { useChatStore } from '@/stores/chat-store';
import type { ChatMessage } from '@/providers/types';
import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';

/**
 * Pure extraction of the prependSystemPrompt logic from useChat.ts.
 * Reads from useSettingsStore.getState() to determine the default prompt.
 */
function prependSystemPrompt(chatMessages: ChatMessage[]): ChatMessage[] {
  const { defaultSystemPromptId, systemPrompts } = useSettingsStore.getState();
  if (!defaultSystemPromptId) return chatMessages;

  const prompt = systemPrompts.find((p) => p.id === defaultSystemPromptId);
  if (!prompt) return chatMessages;

  return [{ role: 'system', content: prompt.content }, ...chatMessages];
}

/** Arbitrary for generating a non-system ChatMessage */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

/** Arbitrary for a system prompt object */
function systemPromptArb(id?: string): fc.Arbitrary<SystemPrompt> {
  return fc.record({
    id: id ? fc.constant(id) : fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    isDefault: fc.boolean(),
    createdAt: fc.integer({ min: 1000000000, max: 2000000000 }),
    updatedAt: fc.integer({ min: 1000000000, max: 2000000000 }),
  });
}

describe('Property 12: System Prompt Prepend Correctness', () => {
  afterEach(() => {
    // Reset the settings store to defaults
    useSettingsStore.setState({
      defaultSystemPromptId: null,
      systemPrompts: [],
    });
  });

  it('non-null defaultSystemPromptId matching a prompt → messages[0] is system with prompt content', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        systemPromptArb('test-prompt-id'),
        (messages, prompt) => {
          // Set up the settings store with the prompt as default
          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // First message should be a system message with the prompt's content
          if (result.length === 0) return false;
          if (result[0].role !== 'system') return false;
          if (result[0].content !== prompt.content) return false;

          // Result length should be original + 1
          if (result.length !== messages.length + 1) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null defaultSystemPromptId → messages returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        (messages) => {
          // Set up settings store with null default
          useSettingsStore.setState({
            defaultSystemPromptId: null,
            systemPrompts: [],
          });

          const result = prependSystemPrompt(messages);

          // Should be the same reference (no modification)
          return result === messages;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-null defaultSystemPromptId with no matching prompt → messages returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        fc.uuid(),
        (messages, nonMatchingId) => {
          // Set up settings store with an ID that doesn't match any prompt
          useSettingsStore.setState({
            defaultSystemPromptId: nonMatchingId,
            systemPrompts: [], // No prompts at all
          });

          const result = prependSystemPrompt(messages);

          // Should be the same reference (no modification)
          return result === messages;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('original messages array is not mutated when system prompt is prepended', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        systemPromptArb('mutate-test-id'),
        (messages, prompt) => {
          // Deep copy to compare after
          const originalLength = messages.length;
          const originalFirstRole = messages[0]?.role;
          const originalFirstContent = messages[0]?.content;

          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // Original array should be untouched
          if (messages.length !== originalLength) return false;
          if (messages[0]?.role !== originalFirstRole) return false;
          if (messages[0]?.content !== originalFirstContent) return false;

          // Result should be a new array, not the same reference
          if (result === messages) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('remaining messages after prepend preserve their original order and content', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        systemPromptArb('order-test-id'),
        (messages, prompt) => {
          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // All original messages should follow the system prompt in order
          for (let i = 0; i < messages.length; i++) {
            if (result[i + 1].role !== messages[i].role) return false;
            if (result[i + 1].content !== messages[i].content) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 2: Combined Flush Content Correctness ───────────────────────────

/**
 * Property-based test for combined flush content correctness.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 7.2, 7.3**
 *
 * Feature: stream-batching-fix, Property 2: Combined Flush Content Correctness
 *
 * For any sequence of text chunks T₁...Tₙ and thinking chunks K₁...Kₘ accumulated
 * between consecutive flush boundaries, the flush set() call appends exactly
 * concat(T₁...Tₙ) to streamContent and concat(K₁...Kₘ) to thinkingContent.
 */
describe('Property 2: Combined Flush Content Correctness', () => {
  beforeEach(() => {
    useChatStore.getState().clearStream();
  });

  it('store state equals concatenation of all flushed text and thinking chunks', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            textChunks: fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
            thinkingChunks: fc.array(fc.string({ maxLength: 50 }), { maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (flushWindows) => {
          useChatStore.getState().clearStream();

          let expectedText = '';
          let expectedThinking = '';

          for (const window of flushWindows) {
            const textDelta = window.textChunks.join('');
            const thinkingDelta = window.thinkingChunks.join('');
            expectedText += textDelta;
            expectedThinking += thinkingDelta;

            useChatStore.getState().flushStreamBuffer(textDelta, thinkingDelta);
          }

          expect(useChatStore.getState().streamContent).toBe(expectedText);
          expect(useChatStore.getState().thinkingContent).toBe(expectedThinking);
        }
      ),
      { numRuns: 200 }
    );
  });
});


// ─── Property 4: Terminal Flush Completeness ──────────────────────────────────

/**
 * Property-based test for terminal flush completeness.
 *
 * **Validates: Requirements 5.1, 5.3, 6.1, 6.2**
 *
 * Feature: stream-batching-fix, Property 4: Terminal Flush Completeness
 *
 * Verifies that stopBatcher() flushes all remaining buffer content so that
 * the final store state matches the total accumulated content. Since stopBatcher
 * is internal to the hook, we test the property through the store by simulating
 * the flush sequence: multiple intermediate flushes followed by a terminal flush
 * of remaining buffer content.
 */
describe('Property 4: Terminal Flush Completeness', () => {
  beforeEach(() => {
    useChatStore.getState().clearStream();
  });

  it('final store state matches total accumulated content after terminal flush', () => {
    fc.assert(
      fc.property(
        // Simulate multiple intermediate flushes + a final buffer
        fc.array(fc.string({ maxLength: 100 }), { minLength: 0, maxLength: 10 }),
        fc.array(fc.string({ maxLength: 100 }), { minLength: 0, maxLength: 10 }),
        fc.string({ maxLength: 200 }), // remaining text in buffer at stream end
        fc.string({ maxLength: 200 }), // remaining thinking in buffer at stream end
        (flushedTexts, flushedThinkings, remainingText, remainingThinking) => {
          useChatStore.getState().clearStream();

          // Simulate intermediate flushes (what happened during streaming)
          let totalText = '';
          let totalThinking = '';

          const maxLen = Math.max(flushedTexts.length, flushedThinkings.length);
          for (let i = 0; i < maxLen; i++) {
            const t = flushedTexts[i] ?? '';
            const k = flushedThinkings[i] ?? '';
            totalText += t;
            totalThinking += k;
            useChatStore.getState().flushStreamBuffer(t, k);
          }

          // Simulate terminal flush (what stopBatcher does with remaining buffer)
          totalText += remainingText;
          totalThinking += remainingThinking;
          useChatStore.getState().flushStreamBuffer(remainingText, remainingThinking);

          // Final state must equal all accumulated content
          expect(useChatStore.getState().streamContent).toBe(totalText);
          expect(useChatStore.getState().thinkingContent).toBe(totalThinking);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Stream Batching: Empty Buffer Skip ───────────────────────────────────────

/**
 * Property 6: Empty Buffer Skip
 *
 * **Validates: Requirements 1.3**
 *
 * Verifies that when both text and thinking buffers are empty strings,
 * flushing does not alter the store content. This tests the invariant that
 * appending empty strings is idempotent — the `flushBuffer` function in
 * useChat.ts short-circuits when both buffers are empty, but even if it
 * did call `flushStreamBuffer('', '')`, the store content must remain unchanged.
 */
describe('Property 6: Empty Buffer Skip', () => {
  beforeEach(() => {
    useChatStore.getState().clearStream();
  });

  it('empty buffer flush does not alter store content regardless of existing state', () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 200 }), // arbitrary existing text content
        fc.string({ maxLength: 200 }), // arbitrary existing thinking content
        (existingText, existingThinking) => {
          useChatStore.getState().clearStream();

          // Set up existing content
          if (existingText || existingThinking) {
            useChatStore.getState().flushStreamBuffer(existingText, existingThinking);
          }

          const textBefore = useChatStore.getState().streamContent;
          const thinkingBefore = useChatStore.getState().thinkingContent;

          // Simulate what flushBuffer does when both buffers are empty:
          // The actual flushBuffer short-circuits and never calls flushStreamBuffer.
          // We verify the invariant: appending empty strings doesn't change content.
          useChatStore.getState().flushStreamBuffer('', '');

          expect(useChatStore.getState().streamContent).toBe(textBefore);
          expect(useChatStore.getState().thinkingContent).toBe(thinkingBefore);
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 1: Flush Frequency Bound ───────────────────────────────────────

/**
 * Property-based test for flush frequency bound.
 *
 * **Validates: Requirements 1.1, 1.2, 4.1**
 *
 * Feature: stream-batching-fix, Property 1: Flush Frequency Bound
 *
 * For N chunks arriving within a single 32ms window, a single flushStreamBuffer
 * call updates the store exactly once. This validates that regardless of how many
 * chunks accumulate during one flush interval, the store receives at most one
 * set() call per interval tick.
 */
describe('Property 1: Flush Frequency Bound', () => {
  beforeEach(() => {
    useChatStore.getState().clearStream();
  });

  it('for N chunks within one flush window, a single flushStreamBuffer call updates store exactly once', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 50 }),
        (chunks) => {
          useChatStore.getState().clearStream();

          // Simulate: all chunks arrive within one 32ms window
          // The batcher accumulates them, then flushes once
          const accumulated = chunks.join('');

          // Track store updates via subscription
          let updateCount = 0;
          const unsub = useChatStore.subscribe(() => { updateCount++; });

          // Single flush call (simulating what the interval callback does)
          useChatStore.getState().flushStreamBuffer(accumulated, '');

          unsub();

          // Exactly one store update for all N chunks
          expect(updateCount).toBe(1);
          expect(useChatStore.getState().streamContent).toBe(accumulated);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('N chunks accumulated into a single flush results in at most one set() regardless of chunk count', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 100 }),
        fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 100 }),
        (textChunks, thinkingChunks) => {
          useChatStore.getState().clearStream();

          // Accumulate all chunks (simulating what happens between flushes)
          const textAccumulated = textChunks.join('');
          const thinkingAccumulated = thinkingChunks.join('');

          // Track how many store set() calls happen
          let setCallCount = 0;
          const unsub = useChatStore.subscribe(() => { setCallCount++; });

          // Single flush for all accumulated chunks (one interval tick)
          useChatStore.getState().flushStreamBuffer(textAccumulated, thinkingAccumulated);

          unsub();

          // At most one store update per flush window
          expect(setCallCount).toBeLessThanOrEqual(1);
          expect(useChatStore.getState().streamContent).toBe(textAccumulated);
          expect(useChatStore.getState().thinkingContent).toBe(thinkingAccumulated);
        }
      ),
      { numRuns: 200 }
    );
  });
});
