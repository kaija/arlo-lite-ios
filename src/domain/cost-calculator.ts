/**
 * Cost calculator for LLM API usage.
 *
 * Computes per-message and per-session costs based on token usage
 * and model pricing (per million tokens).
 */

/**
 * Calculate the cost of a single message based on token usage and model pricing.
 *
 * @param promptTokens - Number of prompt (input) tokens used
 * @param completionTokens - Number of completion (output) tokens used
 * @param inputPrice - Price per million input tokens, or null if not configured
 * @param outputPrice - Price per million output tokens, or null if not configured
 * @returns The cost in dollars, or null if prices are not configured
 */
export function calculateMessageCost(
  promptTokens: number,
  completionTokens: number,
  inputPrice: number | null,
  outputPrice: number | null
): number | null {
  if (inputPrice === null || outputPrice === null) {
    return null;
  }

  return (promptTokens * inputPrice + completionTokens * outputPrice) / 1_000_000;
}

/**
 * Calculate the total cost of a session by summing all non-null message costs.
 *
 * @param messageCosts - Array of per-message costs (null entries are skipped)
 * @returns The total session cost in dollars (0 if all costs are null or array is empty)
 */
export function calculateSessionTotal(messageCosts: (number | null)[]): number {
  let total = 0;
  for (const cost of messageCosts) {
    if (cost !== null) {
      total += cost;
    }
  }
  return total;
}
