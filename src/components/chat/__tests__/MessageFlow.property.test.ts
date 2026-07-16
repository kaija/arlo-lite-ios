import fc from 'fast-check';
import { formatTokenMetadata } from '@/utils/token-formatting';

/**
 * Property-based tests for cost metadata conditional formatting.
 *
 * **Validates: Requirements 7.1, 7.2, 7.4**
 *
 * Feature: provider-ui-integration, Property 10: Cost Metadata Conditional Formatting
 *
 * Property: For any assistant message, if promptTokens, completionTokens, and cost
 * are all non-null, the MessageFlow SHALL render a metadata line matching the format
 * "{promptTokens} in / {completionTokens} out · ${cost.toFixed(3)}". If any of those
 * fields is null, no metadata line SHALL be rendered.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Pure logic extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mirrors the conditional formatting logic in MessageFlow.tsx:
 *
 * ```
 * const formattedMetadata =
 *   message.promptTokens != null &&
 *   message.completionTokens != null &&
 *   message.cost != null
 *     ? `${formatTokenMetadata(message.promptTokens, message.completionTokens)} · $${message.cost.toFixed(3)}`
 *     : null;
 * ```
 */
function deriveCostMetadata(
  promptTokens: number | null,
  completionTokens: number | null,
  cost: number | null,
): string | null {
  if (promptTokens != null && completionTokens != null && cost != null) {
    return `${formatTokenMetadata(promptTokens, completionTokens)} · $${cost.toFixed(3)}`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 10: Cost Metadata Conditional Formatting
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 10: Cost Metadata Conditional Formatting', () => {
  describe('non-null fields produce formatted output', () => {
    it('for any non-null promptTokens, completionTokens, and cost, a formatted string is produced', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          fc.float({ min: 0, noNaN: true }),
          (promptTokens, completionTokens, cost) => {
            const result = deriveCostMetadata(promptTokens, completionTokens, cost);
            return result !== null;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('formatted output matches the pattern "{tokens} in / {tokens} out · $X.XXX"', () => {
      // Pattern accounts for abbreviated token counts (e.g. "1.5k") and dollar costs
      const pattern = /^.+\s+in\s+\/\s+.+\s+out\s+·\s+\$\d+\.\d{3}$/;

      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          fc.float({ min: 0, max: 999, noNaN: true, noDefaultInfinity: true }),
          (promptTokens, completionTokens, cost) => {
            const result = deriveCostMetadata(promptTokens, completionTokens, cost);
            return result !== null && pattern.test(result);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('the cost portion equals cost.toFixed(3)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          fc.float({ min: 0, noNaN: true }),
          (promptTokens, completionTokens, cost) => {
            const result = deriveCostMetadata(promptTokens, completionTokens, cost);
            if (result === null) return false;

            const expectedCostStr = `$${cost.toFixed(3)}`;
            return result.endsWith(expectedCostStr);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('the token portion matches formatTokenMetadata output', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          fc.float({ min: 0, noNaN: true }),
          (promptTokens, completionTokens, cost) => {
            const result = deriveCostMetadata(promptTokens, completionTokens, cost);
            if (result === null) return false;

            const expectedTokenPart = formatTokenMetadata(promptTokens, completionTokens);
            return result.startsWith(expectedTokenPart);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('any null field produces no output', () => {
    it('null promptTokens → no metadata rendered', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.float({ min: 0, noNaN: true }),
          (completionTokens, cost) => {
            const result = deriveCostMetadata(null, completionTokens, cost);
            return result === null;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('null completionTokens → no metadata rendered', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.float({ min: 0, noNaN: true }),
          (promptTokens, cost) => {
            const result = deriveCostMetadata(promptTokens, null, cost);
            return result === null;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('null cost → no metadata rendered', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0 }),
          fc.integer({ min: 0 }),
          (promptTokens, completionTokens) => {
            const result = deriveCostMetadata(promptTokens, completionTokens, null);
            return result === null;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('all fields null → no metadata rendered', () => {
      const result = deriveCostMetadata(null, null, null);
      expect(result).toBeNull();
    });

    it('for any combination with at least one null, no metadata is rendered', () => {
      // Generate a tuple where at least one value is null
      const atLeastOneNull = fc
        .tuple(
          fc.option(fc.integer({ min: 0 }), { nil: null }),
          fc.option(fc.integer({ min: 0 }), { nil: null }),
          fc.option(fc.float({ min: 0, noNaN: true }), { nil: null }),
        )
        .filter(
          ([a, b, c]) => a === null || b === null || c === null,
        );

      fc.assert(
        fc.property(atLeastOneNull, ([promptTokens, completionTokens, cost]) => {
          const result = deriveCostMetadata(promptTokens, completionTokens, cost);
          return result === null;
        }),
        { numRuns: 200 },
      );
    });
  });

  describe('the derivation is pure — same inputs always yield same outputs', () => {
    it('for any inputs, repeated calls produce identical results', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 0 }), { nil: null }),
          fc.option(fc.integer({ min: 0 }), { nil: null }),
          fc.option(fc.float({ min: 0, noNaN: true }), { nil: null }),
          (promptTokens, completionTokens, cost) => {
            const first = deriveCostMetadata(promptTokens, completionTokens, cost);
            const second = deriveCostMetadata(promptTokens, completionTokens, cost);
            return first === second;
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
