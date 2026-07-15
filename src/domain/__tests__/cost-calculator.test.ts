import { calculateMessageCost, calculateSessionTotal } from '../cost-calculator';

describe('cost-calculator', () => {
  describe('calculateMessageCost', () => {
    it('computes cost using the formula (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000', () => {
      // GPT-4o pricing: $2.50 input, $10.00 output per million tokens
      const result = calculateMessageCost(1000, 500, 2.5, 10.0);
      // (1000 * 2.5 + 500 * 10.0) / 1_000_000 = (2500 + 5000) / 1_000_000 = 0.0075
      expect(result).toBeCloseTo(0.0075, 10);
    });

    it('returns null when inputPrice is null', () => {
      expect(calculateMessageCost(100, 50, null, 10.0)).toBeNull();
    });

    it('returns null when outputPrice is null', () => {
      expect(calculateMessageCost(100, 50, 2.5, null)).toBeNull();
    });

    it('returns null when both prices are null', () => {
      expect(calculateMessageCost(100, 50, null, null)).toBeNull();
    });

    it('returns 0 when both token counts are 0', () => {
      expect(calculateMessageCost(0, 0, 2.5, 10.0)).toBe(0);
    });

    it('handles large token counts correctly', () => {
      // 1 million prompt tokens at $2.50 per million = $2.50
      const result = calculateMessageCost(1_000_000, 0, 2.5, 10.0);
      expect(result).toBeCloseTo(2.5, 10);
    });

    it('handles only completion tokens', () => {
      // 1 million completion tokens at $10.00 per million = $10.00
      const result = calculateMessageCost(0, 1_000_000, 2.5, 10.0);
      expect(result).toBeCloseTo(10.0, 10);
    });

    it('handles zero prices', () => {
      const result = calculateMessageCost(1000, 500, 0, 0);
      expect(result).toBe(0);
    });
  });

  describe('calculateSessionTotal', () => {
    it('sums all non-null message costs', () => {
      const costs = [0.001, 0.002, 0.003];
      expect(calculateSessionTotal(costs)).toBeCloseTo(0.006, 10);
    });

    it('skips null entries', () => {
      const costs: (number | null)[] = [0.001, null, 0.003, null, 0.005];
      expect(calculateSessionTotal(costs)).toBeCloseTo(0.009, 10);
    });

    it('returns 0 when all costs are null', () => {
      const costs: (number | null)[] = [null, null, null];
      expect(calculateSessionTotal(costs)).toBe(0);
    });

    it('returns 0 for an empty array', () => {
      expect(calculateSessionTotal([])).toBe(0);
    });

    it('handles a single non-null cost', () => {
      expect(calculateSessionTotal([0.0075])).toBeCloseTo(0.0075, 10);
    });

    it('handles a single null cost', () => {
      expect(calculateSessionTotal([null])).toBe(0);
    });
  });
});
