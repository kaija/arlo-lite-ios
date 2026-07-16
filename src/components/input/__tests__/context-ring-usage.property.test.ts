import fc from 'fast-check';
import { computeContextRingPercentage, getRingColor } from '../context-ring-utils';

/**
 * Property-based tests for context ring usage computation and color thresholds.
 *
 * **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
 *
 * Feature: provider-ui-integration
 * Property 13: Context Ring Usage Computation
 * Property 14: Context Ring Color Thresholds
 */

const ACCENT = '#5856D6';
const CONTEXT_WARNING = '#FF9500';
const CONTEXT_CRITICAL = '#FF3B30';

describe('Property 13: Context Ring Usage Computation', () => {
  it('for any totalChars N >= 0 and contextWindow W > 0, percentage = min(ceil(N/4) / W * 100, 100)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (totalChars, contextWindow) => {
          const result = computeContextRingPercentage(totalChars, contextWindow);
          const expected = Math.min(
            (Math.ceil(totalChars / 4) / contextWindow) * 100,
            100,
          );
          expect(result).toBeCloseTo(expected, 10);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('when contextWindow is null, percentage is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        (totalChars) => {
          const result = computeContextRingPercentage(totalChars, null);
          expect(result).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when contextWindow is 0, percentage is 0', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        (totalChars) => {
          const result = computeContextRingPercentage(totalChars, 0);
          expect(result).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('percentage is always in [0, 100] for any valid inputs', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (totalChars, contextWindow) => {
          const result = computeContextRingPercentage(totalChars, contextWindow);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('when totalChars is 0, percentage is 0 for any positive contextWindow', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500_000 }),
        (contextWindow) => {
          const result = computeContextRingPercentage(0, contextWindow);
          expect(result).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('percentage is monotonically non-decreasing as totalChars increases', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (baseChars, extraChars, contextWindow) => {
          const lower = computeContextRingPercentage(baseChars, contextWindow);
          const higher = computeContextRingPercentage(
            baseChars + extraChars,
            contextWindow,
          );
          expect(higher).toBeGreaterThanOrEqual(lower);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('Property 14: Context Ring Color Thresholds', () => {
  it('if percentage < 50, ring color is accent', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 49 }),
        (percentage) => {
          const color = getRingColor(
            percentage,
            ACCENT,
            CONTEXT_WARNING,
            CONTEXT_CRITICAL,
          );
          expect(color).toBe(ACCENT);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('if 50 <= percentage < 75, ring color is contextWarning (orange)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 50, max: 74 }),
        (percentage) => {
          const color = getRingColor(
            percentage,
            ACCENT,
            CONTEXT_WARNING,
            CONTEXT_CRITICAL,
          );
          expect(color).toBe(CONTEXT_WARNING);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('if percentage >= 75, ring color is contextCritical (red)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 75, max: 100 }),
        (percentage) => {
          const color = getRingColor(
            percentage,
            ACCENT,
            CONTEXT_WARNING,
            CONTEXT_CRITICAL,
          );
          expect(color).toBe(CONTEXT_CRITICAL);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('color thresholds are correct for computed percentages from char count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 1, max: 500_000 }),
        (totalChars, contextWindow) => {
          const percentage = computeContextRingPercentage(totalChars, contextWindow);
          const color = getRingColor(
            percentage,
            ACCENT,
            CONTEXT_WARNING,
            CONTEXT_CRITICAL,
          );

          if (percentage < 50) {
            expect(color).toBe(ACCENT);
          } else if (percentage < 75) {
            expect(color).toBe(CONTEXT_WARNING);
          } else {
            expect(color).toBe(CONTEXT_CRITICAL);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
