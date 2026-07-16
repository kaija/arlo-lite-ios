import fc from 'fast-check';
import { isNearBottom } from '../useScrollBehavior';

/**
 * Property-based tests for isNearBottom pure function.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
 *
 * Feature: chat-feature-wiring, Property 4: Scroll threshold determines auto-scroll and FAB visibility
 *
 * For any (contentHeight, scrollOffset, layoutHeight) tuple where all values are
 * non-negative and contentHeight >= scrollOffset + layoutHeight, isNearBottom SHALL
 * return true if and only if contentHeight - scrollOffset - layoutHeight <= 100.
 */

describe('Property: Scroll threshold determines auto-scroll and FAB visibility', () => {
  /**
   * Arbitrary that generates valid scroll state tuples where:
   * - All values are non-negative
   * - contentHeight >= scrollOffset + layoutHeight (content is at least as tall as viewport + offset)
   */
  const validScrollState = fc
    .record({
      layoutHeight: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
      scrollOffset: fc.double({ min: 0, max: 50000, noNaN: true, noDefaultInfinity: true }),
      extraContent: fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
    })
    .map(({ layoutHeight, scrollOffset, extraContent }) => ({
      contentHeight: scrollOffset + layoutHeight + extraContent,
      scrollOffset,
      layoutHeight,
      distanceFromBottom: extraContent,
    }));

  it('returns true when distance from bottom <= 100', () => {
    fc.assert(
      fc.property(
        validScrollState.filter(({ distanceFromBottom }) => distanceFromBottom <= 100),
        ({ contentHeight, scrollOffset, layoutHeight }) => {
          return isNearBottom(contentHeight, scrollOffset, layoutHeight) === true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns false when distance from bottom > 100', () => {
    fc.assert(
      fc.property(
        validScrollState.filter(({ distanceFromBottom }) => distanceFromBottom > 100),
        ({ contentHeight, scrollOffset, layoutHeight }) => {
          return isNearBottom(contentHeight, scrollOffset, layoutHeight) === false;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns true at exact boundary of 100 points from bottom', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        (scrollOffset, layoutHeight) => {
          const contentHeight = scrollOffset + layoutHeight + 100;
          return isNearBottom(contentHeight, scrollOffset, layoutHeight) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns false at 101 points from bottom (just over threshold)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        (scrollOffset, layoutHeight) => {
          const contentHeight = scrollOffset + layoutHeight + 101;
          return isNearBottom(contentHeight, scrollOffset, layoutHeight) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('custom threshold parameter works correctly', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0, max: 10000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 500, noNaN: true, noDefaultInfinity: true }),
        (scrollOffset, layoutHeight, extraContent, threshold) => {
          const contentHeight = scrollOffset + layoutHeight + extraContent;
          const distanceFromBottom = extraContent;
          const expected = distanceFromBottom <= threshold;
          return isNearBottom(contentHeight, scrollOffset, layoutHeight, threshold) === expected;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('isNearBottom decision is equivalent to distance <= threshold for all valid inputs', () => {
    fc.assert(
      fc.property(
        validScrollState,
        ({ contentHeight, scrollOffset, layoutHeight, distanceFromBottom }) => {
          const result = isNearBottom(contentHeight, scrollOffset, layoutHeight);
          return result === (distanceFromBottom <= 100);
        },
      ),
      { numRuns: 200 },
    );
  });
});
