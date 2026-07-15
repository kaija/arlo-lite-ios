import { getCurrentTimestamp, formatDate, formatRelativeTime } from '../date';

describe('date utilities', () => {
  describe('getCurrentTimestamp', () => {
    it('returns a number representing epoch milliseconds', () => {
      const before = Date.now();
      const ts = getCurrentTimestamp();
      const after = Date.now();

      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });
  });

  describe('formatDate', () => {
    it('returns a non-empty string for a valid timestamp', () => {
      const result = formatDate(1700000000000);
      expect(result.length).toBeGreaterThan(0);
    });

    it('uses custom options when provided', () => {
      const result = formatDate(1700000000000, { year: 'numeric' });
      expect(result).toContain('2023');
    });
  });

  describe('formatRelativeTime', () => {
    it('returns "Just now" for timestamps less than 60 seconds ago', () => {
      const recent = Date.now() - 30_000;
      expect(formatRelativeTime(recent)).toBe('Just now');
    });

    it('returns minutes ago for timestamps under an hour', () => {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago');
    });

    it('returns hours ago for timestamps under a day', () => {
      const threeHoursAgo = Date.now() - 3 * 60 * 60 * 1000;
      expect(formatRelativeTime(threeHoursAgo)).toBe('3h ago');
    });

    it('returns "Yesterday" for timestamps one day ago', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      expect(formatRelativeTime(yesterday)).toBe('Yesterday');
    });

    it('returns days ago for timestamps under a week', () => {
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
      expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
    });

    it('returns a formatted date for timestamps over a week ago', () => {
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      const result = formatRelativeTime(twoWeeksAgo);
      // Should be a date string, not a relative time
      expect(result).not.toContain('ago');
      expect(result).not.toBe('Just now');
    });
  });
});
