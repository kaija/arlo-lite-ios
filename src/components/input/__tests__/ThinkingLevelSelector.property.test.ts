import fc from 'fast-check';
import { cycleThinkingLevel, THINKING_LEVELS } from '../ThinkingLevelSelector';
import type { ThinkingLevel } from '@/stores/chat-store';

/**
 * Property-based tests for thinking level cycle rotation.
 *
 * **Validates: Requirements 6.5**
 *
 * Feature: mockup-ui-implementation, Property 2: Thinking level cycle is a closed rotation
 */

/**
 * The expected cycle sequence: Off → Minimal → Low → Medium → High → XHigh → Off.
 */
const EXPECTED_SEQUENCE: ThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
];

/** Arbitrary that generates a valid ThinkingLevel. */
const thinkingLevelArbitrary: fc.Arbitrary<ThinkingLevel> = fc.constantFrom(
  ...EXPECTED_SEQUENCE,
);

/**
 * Applies cycleThinkingLevel N times starting from a given level.
 */
function applyNCycles(level: ThinkingLevel, n: number): ThinkingLevel {
  let current = level;
  for (let i = 0; i < n; i++) {
    current = cycleThinkingLevel(current);
  }
  return current;
}

describe('Property: Thinking level cycle is a closed rotation', () => {
  it('applying N cycles produces the same result as applying (N mod 6) cycles', () => {
    fc.assert(
      fc.property(
        thinkingLevelArbitrary,
        fc.nat({ max: 100 }),
        (startLevel, n) => {
          const fullResult = applyNCycles(startLevel, n);
          const moduloResult = applyNCycles(startLevel, n % 6);
          return fullResult === moduloResult;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('cycling 6 times from any level returns to the original level', () => {
    fc.assert(
      fc.property(thinkingLevelArbitrary, (startLevel) => {
        return applyNCycles(startLevel, 6) === startLevel;
      }),
      { numRuns: 100 },
    );
  });

  it('the sequence follows Off → Minimal → Low → Medium → High → XHigh → Off', () => {
    fc.assert(
      fc.property(thinkingLevelArbitrary, (startLevel) => {
        const startIndex = EXPECTED_SEQUENCE.indexOf(startLevel);

        // Cycle once and verify it produces the next element in the expected sequence
        const nextLevel = cycleThinkingLevel(startLevel);
        const expectedNext = EXPECTED_SEQUENCE[(startIndex + 1) % 6];

        return nextLevel === expectedNext;
      }),
      { numRuns: 100 },
    );
  });

  it('the full cycle sequence matches the expected order starting from any level', () => {
    fc.assert(
      fc.property(thinkingLevelArbitrary, (startLevel) => {
        const startIndex = EXPECTED_SEQUENCE.indexOf(startLevel);

        // Generate the full sequence of 6 steps from the start level
        const producedSequence: ThinkingLevel[] = [];
        let current = startLevel;
        for (let i = 0; i < 6; i++) {
          current = cycleThinkingLevel(current);
          producedSequence.push(current);
        }

        // The sequence should be the rotated expected sequence
        for (let i = 0; i < 6; i++) {
          const expectedLevel = EXPECTED_SEQUENCE[(startIndex + 1 + i) % 6];
          if (producedSequence[i] !== expectedLevel) {
            return false;
          }
        }
        return true;
      }),
      { numRuns: 100 },
    );
  });

  it('the exported THINKING_LEVELS array matches the expected sequence', () => {
    // Verify the exported constant is correct
    expect(THINKING_LEVELS).toEqual(EXPECTED_SEQUENCE);
    expect(THINKING_LEVELS).toHaveLength(6);
  });
});
