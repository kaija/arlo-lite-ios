import {
  abbreviateTokenCount,
  formatTokenMetadata,
} from '../token-formatting';

describe('token-formatting', () => {
  describe('abbreviateTokenCount', () => {
    it('returns the number as-is when below 1000', () => {
      expect(abbreviateTokenCount(0)).toBe('0');
      expect(abbreviateTokenCount(1)).toBe('1');
      expect(abbreviateTokenCount(999)).toBe('999');
    });

    it('abbreviates exactly 1000 as "1k"', () => {
      expect(abbreviateTokenCount(1000)).toBe('1k');
    });

    it('abbreviates with one decimal place', () => {
      expect(abbreviateTokenCount(1500)).toBe('1.5k');
      expect(abbreviateTokenCount(3200)).toBe('3.2k');
      expect(abbreviateTokenCount(12345)).toBe('12.3k');
    });

    it('drops trailing zero after decimal', () => {
      expect(abbreviateTokenCount(2000)).toBe('2k');
      expect(abbreviateTokenCount(10000)).toBe('10k');
    });
  });

  describe('formatTokenMetadata', () => {
    it('returns only token counts when no prices are provided', () => {
      expect(formatTokenMetadata(500, 200)).toBe('500 in / 200 out');
    });

    it('abbreviates counts >= 1000', () => {
      expect(formatTokenMetadata(1500, 3200)).toBe('1.5k in / 3.2k out');
    });

    it('includes cost when both prices are provided', () => {
      // cost = 1500 * 0.003 + 3200 * 0.015 = 4.5 + 48 = 52.5
      expect(formatTokenMetadata(1500, 3200, 0.003, 0.015)).toBe(
        '1.5k in / 3.2k out · $52.500'
      );
    });

    it('formats cost to 3 decimal places', () => {
      // cost = 100 * 0.00001 + 50 * 0.00002 = 0.001 + 0.001 = 0.002
      expect(formatTokenMetadata(100, 50, 0.00001, 0.00002)).toBe(
        '100 in / 50 out · $0.002'
      );
    });

    it('handles zero tokens with prices', () => {
      expect(formatTokenMetadata(0, 0, 0.01, 0.03)).toBe(
        '0 in / 0 out · $0.000'
      );
    });

    it('returns only token counts when inputPrice is undefined', () => {
      expect(formatTokenMetadata(500, 200, undefined, 0.01)).toBe(
        '500 in / 200 out'
      );
    });

    it('returns only token counts when outputPrice is undefined', () => {
      expect(formatTokenMetadata(500, 200, 0.01, undefined)).toBe(
        '500 in / 200 out'
      );
    });

    it('handles large token counts', () => {
      expect(formatTokenMetadata(128000, 4096)).toBe('128k in / 4.1k out');
    });
  });
});
