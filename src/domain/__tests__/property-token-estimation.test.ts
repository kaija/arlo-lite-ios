/**
 * Property 6: Token estimation is monotonic
 *
 * For any non-empty string S, the character-based token estimation should
 * produce a positive integer, and for any prefix P of S (where P is non-empty),
 * estimate(P) ≤ estimate(S).
 *
 * Feature: arlo-lite-app, Property 6: Token estimation is monotonic
 * Validates: Requirements 11.3
 */

import * as fc from 'fast-check';
import { estimateTokenCount } from '../token-estimator';

describe('Property 6: Token estimation is monotonic', () => {
  it('for any non-empty string S, estimateTokenCount(S) is a positive integer', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        (s) => {
          const result = estimateTokenCount(s);

          expect(result).toBeGreaterThan(0);
          expect(Number.isInteger(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('for any string S and prefix P (0 < k ≤ S.length), estimateTokenCount(P) ≤ estimateTokenCount(S)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.integer({ min: 1, max: 500 }),
        (s, k) => {
          // Clamp k to valid prefix length
          const prefixLength = Math.min(k, s.length);
          const prefix = s.substring(0, prefixLength);
          const prefixEstimate = estimateTokenCount(prefix);
          const fullEstimate = estimateTokenCount(s);

          expect(prefixEstimate).toBeLessThanOrEqual(fullEstimate);
        }
      ),
      { numRuns: 100 }
    );
  });
});
