import { calculateContextUsage, getContextStatus } from '../context-tracker';

describe('context-tracker', () => {
  describe('calculateContextUsage', () => {
    it('returns 0 when contextWindow is 0', () => {
      expect(calculateContextUsage(5000, 0)).toBe(0);
    });

    it('returns 0 when contextWindow is null', () => {
      expect(calculateContextUsage(5000, null)).toBe(0);
    });

    it('returns 0 when contextWindow is undefined', () => {
      expect(calculateContextUsage(5000, undefined)).toBe(0);
    });

    it('calculates correct percentage for normal usage', () => {
      // 4000 / 8000 = 50%
      expect(calculateContextUsage(4000, 8000)).toBe(50);
    });

    it('calculates correct percentage at 0 tokens', () => {
      expect(calculateContextUsage(0, 128000)).toBe(0);
    });

    it('calculates correct percentage at exact context window', () => {
      // 128000 / 128000 = 100%
      expect(calculateContextUsage(128000, 128000)).toBe(100);
    });

    it('allows percentage to exceed 100 (no clamping)', () => {
      // 200000 / 128000 = 156.25%
      expect(calculateContextUsage(200000, 128000)).toBeCloseTo(156.25);
    });

    it('handles small fractional percentages', () => {
      // 1 / 128000 ≈ 0.00078125%
      expect(calculateContextUsage(1, 128000)).toBeCloseTo(0.00078125);
    });

    it('handles typical large context windows', () => {
      // 50000 / 200000 = 25%
      expect(calculateContextUsage(50000, 200000)).toBe(25);
    });
  });

  describe('getContextStatus', () => {
    it('returns normal for 0%', () => {
      expect(getContextStatus(0)).toBe('normal');
    });

    it('returns normal for 50%', () => {
      expect(getContextStatus(50)).toBe('normal');
    });

    it('returns normal for 79.99%', () => {
      expect(getContextStatus(79.99)).toBe('normal');
    });

    it('returns warning at exactly 80%', () => {
      expect(getContextStatus(80)).toBe('warning');
    });

    it('returns warning for 90%', () => {
      expect(getContextStatus(90)).toBe('warning');
    });

    it('returns warning at exactly 95%', () => {
      expect(getContextStatus(95)).toBe('warning');
    });

    it('returns critical just above 95%', () => {
      expect(getContextStatus(95.01)).toBe('critical');
    });

    it('returns critical for 100%', () => {
      expect(getContextStatus(100)).toBe('critical');
    });

    it('returns critical for values over 100%', () => {
      expect(getContextStatus(150)).toBe('critical');
    });
  });
});
