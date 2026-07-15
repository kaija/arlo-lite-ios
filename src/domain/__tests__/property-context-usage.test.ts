/**
 * Property 5: Context usage percentage is bounded
 *
 * For any non-negative session token count and positive model context window size,
 * the calculated context usage percentage should equal (tokenCount / contextWindow) × 100,
 * and should always be within the range [0, ∞) without capping.
 *
 * Feature: arlo-lite-app, Property 5: Context usage percentage is bounded
 * Validates: Requirements 11.2
 */

import * as fc from 'fast-check';
import { calculateContextUsage } from '../context-tracker';

describe('Property 5: Context usage percentage is bounded', () => {
  it('calculateContextUsage(tc, cw) === (tc / cw) * 100 for non-negative tokenCount and positive contextWindow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (tokenCount, contextWindow) => {
          const result = calculateContextUsage(tokenCount, contextWindow);
          const expected = (tokenCount / contextWindow) * 100;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is always >= 0 for non-negative tokenCount and positive contextWindow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (tokenCount, contextWindow) => {
          const result = calculateContextUsage(tokenCount, contextWindow);
          expect(result).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result is NOT clamped to 100 (can exceed when tokenCount > contextWindow)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }),
        (contextWindow) => {
          // Use a tokenCount that exceeds the context window
          const tokenCount = contextWindow + 1;
          const result = calculateContextUsage(tokenCount, contextWindow);
          expect(result).toBeGreaterThan(100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when tokenCount is 0, result is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }),
        (contextWindow) => {
          const result = calculateContextUsage(0, contextWindow);
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
