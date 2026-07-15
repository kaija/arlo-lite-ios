import fc from 'fast-check';
import { deriveButtonState } from '../SendStopButton';

/**
 * Property-based tests for send button state derivation.
 *
 * **Validates: Requirements 15.1, 15.2, 15.3**
 *
 * Feature: mockup-ui-implementation, Property 4: Send button state derivation
 *
 * For any combination of (inputText: string, isStreaming: boolean), the send button
 * state SHALL be: disabled when inputText.trim() === '' and !isStreaming; send-ready
 * when inputText.trim() !== '' and !isStreaming; stop when isStreaming regardless of
 * input content.
 */

describe('Property: Send button state derivation', () => {
  it('returns "stop" when isStreaming is true, regardless of input content', () => {
    fc.assert(
      fc.property(fc.string(), (inputText) => {
        const hasText = inputText.trim() !== '';
        const result = deriveButtonState(hasText, true);
        return result === 'stop';
      }),
      { numRuns: 100 },
    );
  });

  it('returns "send" when inputText has non-whitespace content and not streaming', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.trim() !== ''),
        (inputText) => {
          const hasText = inputText.trim() !== '';
          const result = deriveButtonState(hasText, false);
          return result === 'send';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns "disabled" when inputText is empty or whitespace-only and not streaming', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '')),
        (inputText) => {
          const hasText = inputText.trim() !== '';
          const result = deriveButtonState(hasText, false);
          return result === 'disabled';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('state derivation is exhaustive: every (hasText, isStreaming) pair maps to exactly one state', () => {
    fc.assert(
      fc.property(fc.string(), fc.boolean(), (inputText, isStreaming) => {
        const hasText = inputText.trim() !== '';
        const result = deriveButtonState(hasText, isStreaming);

        // Result must be one of the three valid states
        if (result !== 'disabled' && result !== 'send' && result !== 'stop') {
          return false;
        }

        // Verify the correct state was returned based on the spec
        if (isStreaming) {
          return result === 'stop';
        }
        if (hasText) {
          return result === 'send';
        }
        return result === 'disabled';
      }),
      { numRuns: 100 },
    );
  });

  it('streaming state takes priority over text content (isStreaming overrides hasText)', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (hasText, isStreaming) => {
        const result = deriveButtonState(hasText, isStreaming);

        if (isStreaming) {
          // When streaming, result must always be "stop" regardless of hasText
          return result === 'stop';
        }
        // When not streaming, result depends on hasText
        return hasText ? result === 'send' : result === 'disabled';
      }),
      { numRuns: 100 },
    );
  });
});
