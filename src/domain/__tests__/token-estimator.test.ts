import { estimateTokenCount, estimateSessionTokens } from '../token-estimator';

describe('token-estimator', () => {
  describe('estimateTokenCount', () => {
    it('returns 0 for empty string', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('returns 1 for a single character', () => {
      expect(estimateTokenCount('a')).toBe(1);
    });

    it('returns 1 for up to 4 characters', () => {
      expect(estimateTokenCount('ab')).toBe(1);
      expect(estimateTokenCount('abc')).toBe(1);
      expect(estimateTokenCount('abcd')).toBe(1);
    });

    it('returns 2 for 5 characters', () => {
      expect(estimateTokenCount('abcde')).toBe(2);
    });

    it('correctly estimates longer strings', () => {
      // 20 chars -> ceil(20/4) = 5
      expect(estimateTokenCount('12345678901234567890')).toBe(5);
    });

    it('always returns a non-negative integer', () => {
      const result = estimateTokenCount('hello world');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result)).toBe(true);
    });

    describe('monotonicity', () => {
      it('estimate(prefix) ≤ estimate(fullString) for various prefixes', () => {
        const fullString = 'The quick brown fox jumps over the lazy dog';

        for (let i = 0; i <= fullString.length; i++) {
          const prefix = fullString.substring(0, i);
          expect(estimateTokenCount(prefix)).toBeLessThanOrEqual(
            estimateTokenCount(fullString)
          );
        }
      });

      it('estimates are non-decreasing as string grows', () => {
        const base = 'abcdefghijklmnopqrstuvwxyz';
        let previous = 0;

        for (let i = 0; i <= base.length; i++) {
          const current = estimateTokenCount(base.substring(0, i));
          expect(current).toBeGreaterThanOrEqual(previous);
          previous = current;
        }
      });
    });
  });

  describe('estimateSessionTokens', () => {
    it('returns 0 for empty messages array', () => {
      expect(estimateSessionTokens([])).toBe(0);
    });

    it('includes framing overhead per message (4 tokens)', () => {
      // Empty content message: 0 content tokens + 4 framing = 4
      expect(estimateSessionTokens([{ content: '' }])).toBe(4);
    });

    it('sums content tokens and framing for multiple messages', () => {
      const messages = [
        { content: 'hi' },   // ceil(2/4) + 4 = 1 + 4 = 5
        { content: 'hello' }, // ceil(5/4) + 4 = 2 + 4 = 6
      ];
      expect(estimateSessionTokens(messages)).toBe(11);
    });

    it('handles a realistic session', () => {
      const messages = [
        { content: 'What is TypeScript?' },        // ceil(19/4) + 4 = 5 + 4 = 9
        { content: 'TypeScript is a typed superset of JavaScript.' }, // ceil(46/4) + 4 = 12 + 4 = 16
      ];
      expect(estimateSessionTokens(messages)).toBe(25);
    });

    it('returns non-negative for any input', () => {
      const result = estimateSessionTokens([
        { content: 'a' },
        { content: '' },
        { content: 'bc' },
      ]);
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
