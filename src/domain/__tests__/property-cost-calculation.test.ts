/**
 * Property 4: Cost calculation accuracy
 *
 * For any token usage with non-negative promptTokens and completionTokens,
 * and any non-negative input/output prices, the computed cost should equal
 * (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000,
 * and the running session total should equal the sum of all individual message costs.
 *
 * Feature: arlo-lite-app, Property 4: Cost calculation accuracy
 * Validates: Requirements 12.1, 12.2
 */

import * as fc from 'fast-check';
import { calculateMessageCost, calculateSessionTotal } from '../cost-calculator';

describe('Property 4: Cost calculation accuracy', () => {
  it('calculateMessageCost equals (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
        (promptTokens, completionTokens, inputPrice, outputPrice) => {
          const result = calculateMessageCost(promptTokens, completionTokens, inputPrice, outputPrice);
          const expected = (promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000;

          expect(result).not.toBeNull();
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('calculateSessionTotal equals the sum of all non-null individual message costs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
            fc.constant(null as number | null)
          ),
          { minLength: 0, maxLength: 50 }
        ),
        (costs) => {
          const result = calculateSessionTotal(costs);
          const expected = costs.reduce<number>(
            (sum, cost) => (cost !== null ? sum + cost : sum),
            0
          );

          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('calculateMessageCost with null price returns null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.oneof(
          fc.tuple(fc.constant(null as number | null), fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })),
          fc.tuple(fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }), fc.constant(null as number | null)),
          fc.tuple(fc.constant(null as number | null), fc.constant(null as number | null))
        ),
        (promptTokens, completionTokens, [inputPrice, outputPrice]) => {
          const result = calculateMessageCost(promptTokens, completionTokens, inputPrice, outputPrice);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
