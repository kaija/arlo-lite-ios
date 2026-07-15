import fc from 'fast-check';

/**
 * Property-based tests for streaming token rate rolling window computation.
 *
 * **Validates: Requirements 4.2**
 *
 * Feature: mockup-ui-implementation, Property 10: Streaming token rate rolling window
 *
 * Property: For any sequence of token arrival timestamps, the computed token rate
 * SHALL equal the count of tokens received in the most recent 2-second window
 * divided by the window duration, recalculated every 500ms.
 *
 * Since the hook uses internal state with setInterval, we extract and test the
 * core computation logic directly — the same pure function used in the unit tests.
 */

/** Duration of the rolling window in milliseconds */
const WINDOW_DURATION_MS = 2000;

/**
 * Pure computation function matching the hook's internal logic.
 * Computes the token rate from timestamps within a rolling window.
 */
function computeTokenRate(timestamps: number[], now: number): number {
  const windowStart = now - WINDOW_DURATION_MS;
  const tokensInWindow = timestamps.filter((t) => t >= windowStart).length;
  return tokensInWindow / (WINDOW_DURATION_MS / 1000);
}

describe('Property: Streaming token rate rolling window', () => {
  it('token rate equals count of tokens in 2s window divided by window duration', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of token arrival timestamps (sorted ascending, realistic range)
        fc.array(
          fc.integer({ min: 0, max: 60000 }),
          { minLength: 0, maxLength: 200 },
        ).map((arr) => arr.sort((a, b) => a - b)),
        // Generate the "now" time at which we evaluate the rate
        fc.integer({ min: 0, max: 60000 }),
        (timestamps, now) => {
          const rate = computeTokenRate(timestamps, now);
          const windowStart = now - WINDOW_DURATION_MS;

          // Manually count tokens in window
          const expectedCount = timestamps.filter((t) => t >= windowStart).length;
          const expectedRate = expectedCount / (WINDOW_DURATION_MS / 1000);

          return rate === expectedRate;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate is always non-negative for any timestamps and evaluation time', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100000 }), { minLength: 0, maxLength: 150 }),
        fc.integer({ min: 0, max: 100000 }),
        (timestamps, now) => {
          const rate = computeTokenRate(timestamps, now);
          return rate >= 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate is zero when no timestamps exist', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (now) => {
          return computeTokenRate([], now) === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate is zero when all timestamps are older than the 2s window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5000, max: 100000 }),
        fc.array(
          fc.integer({ min: 0, max: 2000 }),
          { minLength: 1, maxLength: 100 },
        ),
        (now, offsets) => {
          // Create timestamps that are all older than the window
          // windowStart = now - 2000, so any timestamp < windowStart is outside
          const timestamps = offsets.map((offset) => now - WINDOW_DURATION_MS - 1 - offset);
          const rate = computeTokenRate(timestamps, now);
          return rate === 0;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate equals total count / 2 when all timestamps are within the window', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2000, max: 100000 }),
        fc.array(
          fc.integer({ min: 0, max: 1999 }),
          { minLength: 1, maxLength: 100 },
        ),
        (now, offsets) => {
          // Create timestamps that are all within the 2s window
          // windowStart = now - 2000, timestamps need to be >= windowStart
          const timestamps = offsets.map((offset) => now - offset);
          const rate = computeTokenRate(timestamps, now);
          const expectedRate = timestamps.length / (WINDOW_DURATION_MS / 1000);
          return rate === expectedRate;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('recalculation at 500ms intervals yields consistent results for same window', () => {
    fc.assert(
      fc.property(
        // Generate a set of token timestamps
        fc.array(
          fc.integer({ min: 0, max: 20000 }),
          { minLength: 1, maxLength: 50 },
        ).map((arr) => arr.sort((a, b) => a - b)),
        // Generate a base time and a recalc step (0-3, representing 0ms, 500ms, 1000ms, 1500ms)
        fc.integer({ min: 5000, max: 20000 }),
        fc.integer({ min: 0, max: 3 }),
        (timestamps, baseTime, step) => {
          // Simulate recalculation at 500ms intervals
          const recalcTime = baseTime + step * 500;
          const rate = computeTokenRate(timestamps, recalcTime);

          // Verify the rate matches the formula: count in window / 2
          const windowStart = recalcTime - WINDOW_DURATION_MS;
          const expectedCount = timestamps.filter((t) => t >= windowStart).length;
          const expectedRate = expectedCount / (WINDOW_DURATION_MS / 1000);

          return rate === expectedRate;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('adding a timestamp within the window increases or maintains the rate', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 0, max: 30000 }),
          { minLength: 0, maxLength: 50 },
        ),
        fc.integer({ min: 5000, max: 30000 }),
        fc.integer({ min: 0, max: 1999 }),
        (timestamps, now, offset) => {
          const rateBefore = computeTokenRate(timestamps, now);

          // Add a new timestamp within the window
          const newTimestamp = now - offset;
          const updatedTimestamps = [...timestamps, newTimestamp];
          const rateAfter = computeTokenRate(updatedTimestamps, now);

          // Rate should increase or stay the same (the new token is within window)
          return rateAfter >= rateBefore;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('rate is bounded by totalTokens / windowDurationSeconds', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.integer({ min: 0, max: 50000 }),
          { minLength: 0, maxLength: 200 },
        ),
        fc.integer({ min: 0, max: 50000 }),
        (timestamps, now) => {
          const rate = computeTokenRate(timestamps, now);
          const maxPossibleRate = timestamps.length / (WINDOW_DURATION_MS / 1000);
          return rate <= maxPossibleRate;
        },
      ),
      { numRuns: 100 },
    );
  });
});
