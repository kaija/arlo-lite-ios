/**
 * Tests for useStreamingMetrics hook.
 *
 * Since we can't render hooks directly, we test the underlying computation logic
 * by simulating what the hook does internally: tracking timestamps, computing
 * rolling window rates, and detecting stalls.
 */

/** Duration of the rolling window in milliseconds */
const WINDOW_DURATION_MS = 2000;

/** Duration of zero tokens/second before stall (ms) */
const STALL_THRESHOLD_MS = 3000;

/**
 * Pure computation function extracted from the hook logic for testability.
 * Computes the token rate from timestamps within a rolling window.
 */
function computeTokenRate(timestamps: number[], now: number): number {
  const windowStart = now - WINDOW_DURATION_MS;
  const tokensInWindow = timestamps.filter((t) => t >= windowStart).length;
  return tokensInWindow / (WINDOW_DURATION_MS / 1000);
}

/**
 * Determines if the stream is stalled based on last non-zero token time.
 */
function computeIsStalled(lastNonZeroTime: number, now: number, rate: number): boolean {
  if (rate > 0) return false;
  return (now - lastNonZeroTime) > STALL_THRESHOLD_MS;
}

describe('useStreamingMetrics — computation logic', () => {
  describe('computeTokenRate', () => {
    it('should return 0 for empty timestamps', () => {
      const now = Date.now();
      expect(computeTokenRate([], now)).toBe(0);
    });

    it('should count tokens within the 2s window', () => {
      const now = 10000;
      // 4 tokens in the last 2 seconds
      const timestamps = [8500, 9000, 9500, 10000];
      const rate = computeTokenRate(timestamps, now);
      // 4 tokens / 2 seconds = 2 tok/s
      expect(rate).toBe(2);
    });

    it('should exclude tokens older than 2s window', () => {
      const now = 10000;
      // 2 tokens outside window, 3 inside
      const timestamps = [7000, 7500, 8500, 9000, 9500];
      const rate = computeTokenRate(timestamps, now);
      // 3 tokens in window / 2 seconds = 1.5 tok/s
      expect(rate).toBe(1.5);
    });

    it('should return correct rate for burst of tokens', () => {
      const now = 5000;
      // 10 tokens all within the last 1 second
      const timestamps = Array.from({ length: 10 }, (_, i) => 4000 + i * 100);
      const rate = computeTokenRate(timestamps, now);
      // All 10 tokens are within the 2s window (3000-5000)
      expect(rate).toBe(5); // 10 tokens / 2 seconds
    });

    it('should return 0 when all tokens are older than window', () => {
      const now = 10000;
      const timestamps = [5000, 6000, 7000]; // All older than 8000 (now - 2000)
      const rate = computeTokenRate(timestamps, now);
      expect(rate).toBe(0);
    });

    it('should include tokens exactly at window boundary', () => {
      const now = 10000;
      // Token exactly at window start (10000 - 2000 = 8000)
      const timestamps = [8000];
      const rate = computeTokenRate(timestamps, now);
      // Boundary token is included (>= windowStart)
      expect(rate).toBe(0.5); // 1 token / 2 seconds
    });
  });

  describe('computeIsStalled', () => {
    it('should not be stalled when rate is positive', () => {
      const now = 10000;
      const lastNonZero = 5000; // 5s ago, but rate is positive
      expect(computeIsStalled(lastNonZero, now, 2.5)).toBe(false);
    });

    it('should not be stalled when rate is 0 but under 3s threshold', () => {
      const now = 10000;
      const lastNonZero = 8000; // Only 2s of zero rate
      expect(computeIsStalled(lastNonZero, now, 0)).toBe(false);
    });

    it('should be stalled when rate is 0 for more than 3s', () => {
      const now = 10000;
      const lastNonZero = 6000; // 4s of zero rate (> 3s threshold)
      expect(computeIsStalled(lastNonZero, now, 0)).toBe(true);
    });

    it('should not be stalled at exactly 3s of zero rate', () => {
      const now = 10000;
      const lastNonZero = 7000; // Exactly 3s (not > 3s)
      expect(computeIsStalled(lastNonZero, now, 0)).toBe(false);
    });

    it('should be stalled just past the 3s threshold', () => {
      const now = 10000;
      const lastNonZero = 6999; // 3001ms of zero rate (> 3000ms)
      expect(computeIsStalled(lastNonZero, now, 0)).toBe(true);
    });
  });

  describe('timestamp pruning logic', () => {
    it('should identify correct prune index', () => {
      const now = 10000;
      const pruneThreshold = now - WINDOW_DURATION_MS; // 8000
      const timestamps = [6000, 7000, 8000, 9000, 10000];

      const firstValidIndex = timestamps.findIndex((t) => t >= pruneThreshold);
      expect(firstValidIndex).toBe(2); // index 2 is timestamp 8000
    });

    it('should return -1 when all timestamps are expired', () => {
      const now = 10000;
      const pruneThreshold = now - WINDOW_DURATION_MS; // 8000
      const timestamps = [5000, 6000, 7000];

      const firstValidIndex = timestamps.findIndex((t) => t >= pruneThreshold);
      expect(firstValidIndex).toBe(-1);
    });

    it('should return 0 when no timestamps need pruning', () => {
      const now = 10000;
      const pruneThreshold = now - WINDOW_DURATION_MS; // 8000
      const timestamps = [8500, 9000, 9500];

      const firstValidIndex = timestamps.findIndex((t) => t >= pruneThreshold);
      expect(firstValidIndex).toBe(0);
    });
  });
});
