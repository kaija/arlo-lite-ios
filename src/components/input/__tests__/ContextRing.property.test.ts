import fc from 'fast-check';
import { getRingColor } from '../ContextRing';

/**
 * Property-based tests for context ring color thresholds.
 *
 * **Validates: Requirements 6.7**
 *
 * Feature: mockup-ui-implementation, Property 3: Context ring color thresholds
 */

const ACCENT = '#5856D6';
const CONTEXT_WARNING = '#FF9500';
const CONTEXT_CRITICAL = '#FF3B30';

describe('Property: Context ring color thresholds', () => {
  it('returns accent color when percentage < 50', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: Math.fround(49.99), noNaN: true }),
        (percentage) => {
          const color = getRingColor(percentage, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
          return color === ACCENT;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns contextWarning (orange) when 50 <= percentage < 75', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 50, max: Math.fround(74.99), noNaN: true }),
        (percentage) => {
          const color = getRingColor(percentage, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
          return color === CONTEXT_WARNING;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns contextCritical (red) when percentage >= 75', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 75, max: 100, noNaN: true }),
        (percentage) => {
          const color = getRingColor(percentage, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
          return color === CONTEXT_CRITICAL;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('always returns one of the three valid colors for any percentage in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        (percentage) => {
          const color = getRingColor(percentage, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
          return color === ACCENT || color === CONTEXT_WARNING || color === CONTEXT_CRITICAL;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('boundary: exactly 50 returns contextWarning', () => {
    const color = getRingColor(50, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
    expect(color).toBe(CONTEXT_WARNING);
  });

  it('boundary: exactly 75 returns contextCritical', () => {
    const color = getRingColor(75, ACCENT, CONTEXT_WARNING, CONTEXT_CRITICAL);
    expect(color).toBe(CONTEXT_CRITICAL);
  });
});
