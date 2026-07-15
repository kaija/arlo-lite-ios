import * as fc from 'fast-check';
import {
  abbreviateTokenCount,
  formatTokenMetadata,
} from '../token-formatting';

/**
 * **Validates: Requirements 1.4**
 *
 * Property 5: Token metadata formatting round-trip
 *
 * For any token count pair (inputTokens, outputTokens) and price pair
 * (inputPrice, outputPrice), formatting as "Xk in / Yk out · $Z.ZZZ"
 * and parsing back SHALL preserve the original values within rounding
 * tolerance (counts abbreviated at ≥1000 as "X.Xk", cost to 3 decimal places).
 */

/**
 * Parses an abbreviated token count string back to a numeric value.
 * - "1.5k" → 1500
 * - "1k" → 1000
 * - "500" → 500
 */
function parseAbbreviatedCount(str: string): number {
  if (str.endsWith('k')) {
    return parseFloat(str.slice(0, -1)) * 1000;
  }
  return parseInt(str, 10);
}

/**
 * Parses a formatted token metadata string back into its component values.
 * Handles both forms:
 *   "Xk in / Yk out"
 *   "Xk in / Yk out · $Z.ZZZ"
 */
function parseTokenMetadata(formatted: string): {
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
} {
  const costSplit = formatted.split(' · ');
  const tokenPart = costSplit[0];
  const costPart = costSplit.length > 1 ? costSplit[1] : null;

  // Parse "Xk in / Yk out"
  const tokenMatch = tokenPart.match(/^(.+)\s+in\s+\/\s+(.+)\s+out$/);
  if (!tokenMatch) {
    throw new Error(`Failed to parse token part: "${tokenPart}"`);
  }

  const inputTokens = parseAbbreviatedCount(tokenMatch[1]);
  const outputTokens = parseAbbreviatedCount(tokenMatch[2]);

  let cost: number | null = null;
  if (costPart) {
    cost = parseFloat(costPart.replace('$', ''));
  }

  return { inputTokens, outputTokens, cost };
}

describe('Token metadata formatting round-trip (Property 5)', () => {
  it('abbreviateTokenCount round-trips within rounding tolerance for all non-negative integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        (count) => {
          const formatted = abbreviateTokenCount(count);
          const parsed = parseAbbreviatedCount(formatted);

          if (count < 1000) {
            // Below 1000: exact representation
            expect(parsed).toBe(count);
          } else {
            // ≥1000: abbreviated as "X.Xk" with 1 decimal place
            // Tolerance: rounding to 1 decimal of (count/1000) means
            // max error is 50 (half of 100, the last significant digit in "X.Xk" * 1000)
            const tolerance = 50;
            expect(Math.abs(parsed - count)).toBeLessThanOrEqual(tolerance);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('formatTokenMetadata round-trips token counts within abbreviation tolerance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        (inputTokens, outputTokens) => {
          const formatted = formatTokenMetadata(inputTokens, outputTokens);
          const parsed = parseTokenMetadata(formatted);

          // No cost when prices not provided
          expect(parsed.cost).toBeNull();

          // Token counts within rounding tolerance
          if (inputTokens < 1000) {
            expect(parsed.inputTokens).toBe(inputTokens);
          } else {
            expect(Math.abs(parsed.inputTokens - inputTokens)).toBeLessThanOrEqual(50);
          }

          if (outputTokens < 1000) {
            expect(parsed.outputTokens).toBe(outputTokens);
          } else {
            expect(Math.abs(parsed.outputTokens - outputTokens)).toBeLessThanOrEqual(50);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('formatTokenMetadata round-trips cost within 3 decimal place tolerance', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200_000 }),
        fc.integer({ min: 0, max: 200_000 }),
        // Prices per token: realistic range from very cheap to moderately expensive
        fc.double({ min: 0.000001, max: 0.1, noNaN: true }),
        fc.double({ min: 0.000001, max: 0.1, noNaN: true }),
        (inputTokens, outputTokens, inputPrice, outputPrice) => {
          const formatted = formatTokenMetadata(
            inputTokens,
            outputTokens,
            inputPrice,
            outputPrice
          );
          const parsed = parseTokenMetadata(formatted);

          // Cost should be present
          expect(parsed.cost).not.toBeNull();

          // Verify cost is within 3 decimal place rounding tolerance
          const expectedCost =
            inputTokens * inputPrice + outputTokens * outputPrice;
          const roundedExpectedCost = parseFloat(expectedCost.toFixed(3));

          // The parsed cost should match the expected cost rounded to 3 decimals
          // Tolerance accounts for floating-point representation in toFixed(3)
          expect(parsed.cost).toBeCloseTo(roundedExpectedCost, 3);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('formatted string always matches the expected pattern', () => {
    const tokenOnlyPattern = /^\d+(\.\d)?k?\s+in\s+\/\s+\d+(\.\d)?k?\s+out$/;
    const withCostPattern =
      /^\d+(\.\d)?k?\s+in\s+\/\s+\d+(\.\d)?k?\s+out\s+·\s+\$\d+\.\d{3}$/;

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.option(fc.double({ min: 0.000001, max: 0.1, noNaN: true })),
        fc.option(fc.double({ min: 0.000001, max: 0.1, noNaN: true })),
        (inputTokens, outputTokens, inputPrice, outputPrice) => {
          const hasCost = inputPrice != null && outputPrice != null;
          const formatted = formatTokenMetadata(
            inputTokens,
            outputTokens,
            inputPrice ?? undefined,
            outputPrice ?? undefined
          );

          if (hasCost) {
            expect(formatted).toMatch(withCostPattern);
          } else {
            expect(formatted).toMatch(tokenOnlyPattern);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
