/**
 * Property 14: Context never auto-truncated
 *
 * For any message list in a session, regardless of total token count relative
 * to context window size, the system should never automatically remove, shorten,
 * or truncate any message.
 *
 * Feature: arlo-lite-app, Property 14: Context never auto-truncated
 * Validates: Requirements 11.4
 */

import * as fc from 'fast-check';
import { calculateContextUsage } from '../context-tracker';
import { estimateSessionTokens, estimateTokenCount } from '../token-estimator';

/** Arbitrary for a single message with random content length 1–5000 chars */
const messageArb = fc.string({ minLength: 1, maxLength: 5000 }).map((content) => ({
  content,
}));

/** Arbitrary for a message list of 1–50 messages */
const messageListArb = fc.array(messageArb, { minLength: 1, maxLength: 50 });

/** Arbitrary for context window sizes (1000–128000 tokens) */
const contextWindowArb = fc.integer({ min: 1000, max: 128000 });

describe('Property 14: Context never auto-truncated', () => {
  it('after context usage calculation, all messages remain unmodified (same count, same content)', () => {
    fc.assert(
      fc.property(messageListArb, contextWindowArb, (messages, contextWindow) => {
        // Snapshot the original messages before passing through the pipeline
        const originalContents = messages.map((m) => m.content);
        const originalCount = messages.length;

        // Pass messages through the context tracking pipeline
        const totalTokens = estimateSessionTokens(messages);
        calculateContextUsage(totalTokens, contextWindow);

        // Verify: message count unchanged
        expect(messages.length).toBe(originalCount);

        // Verify: each message content unchanged
        for (let i = 0; i < messages.length; i++) {
          expect(messages[i].content).toBe(originalContents[i]);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('calculateContextUsage never removes or modifies the input messages', () => {
    fc.assert(
      fc.property(messageListArb, contextWindowArb, (messages, contextWindow) => {
        // Deep copy to compare after
        const snapshotBefore = JSON.stringify(messages);

        // Run through the full pipeline
        const tokenCount = estimateSessionTokens(messages);
        calculateContextUsage(tokenCount, contextWindow);

        // The messages array must be byte-for-byte identical
        expect(JSON.stringify(messages)).toBe(snapshotBefore);
      }),
      { numRuns: 100 }
    );
  });

  it('even when context usage exceeds 100%, the message array is unchanged', () => {
    fc.assert(
      fc.property(messageListArb, (messages) => {
        // Use a tiny context window to guarantee exceeding 100%
        const tinyContextWindow = 1;
        const snapshotBefore = JSON.stringify(messages);

        const tokenCount = estimateSessionTokens(messages);
        const usage = calculateContextUsage(tokenCount, tinyContextWindow);

        // Confirm we actually exceed 100%
        expect(usage).toBeGreaterThan(100);

        // Messages must still be unchanged
        expect(JSON.stringify(messages)).toBe(snapshotBefore);
      }),
      { numRuns: 100 }
    );
  });

  it('the token estimator reads messages but never mutates them', () => {
    fc.assert(
      fc.property(messageListArb, (messages) => {
        // Snapshot individual message contents
        const originalContents = messages.map((m) => m.content);

        // Run estimator
        estimateSessionTokens(messages);

        // Also run individual estimation on each content string
        for (const msg of messages) {
          estimateTokenCount(msg.content);
        }

        // Verify no mutation occurred
        for (let i = 0; i < messages.length; i++) {
          expect(messages[i].content).toBe(originalContents[i]);
        }
      }),
      { numRuns: 100 }
    );
  });
});
