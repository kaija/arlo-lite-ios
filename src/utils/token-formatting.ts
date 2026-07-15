/**
 * Formats token counts and optional cost into a compact metadata string.
 *
 * Counts ≥ 1000 are abbreviated as "X.Xk" (one decimal place).
 * Cost is formatted to 3 decimal places.
 *
 * Examples:
 * - formatTokenMetadata(500, 200) → "500 in / 200 out"
 * - formatTokenMetadata(1500, 3200) → "1.5k in / 3.2k out"
 * - formatTokenMetadata(1500, 3200, 0.003, 0.015) → "1.5k in / 3.2k out · $0.053"
 * - formatTokenMetadata(0, 0) → "0 in / 0 out"
 */

/**
 * Abbreviates a token count: values ≥ 1000 become "X.Xk", values below are left as-is.
 */
export function abbreviateTokenCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    // Use one decimal place, drop trailing zero (e.g. 2.0k → 2k)
    const formatted = k.toFixed(1);
    const trimmed = formatted.endsWith('.0')
      ? formatted.slice(0, -2)
      : formatted;
    return `${trimmed}k`;
  }
  return String(count);
}

/**
 * Formats token metadata into a display string.
 *
 * @param inputTokens - Number of input/prompt tokens
 * @param outputTokens - Number of output/completion tokens
 * @param inputPrice - Price per token for input (optional)
 * @param outputPrice - Price per token for output (optional)
 * @returns Formatted string like "1.5k in / 3.2k out" or "1.5k in / 3.2k out · $0.053"
 */
export function formatTokenMetadata(
  inputTokens: number,
  outputTokens: number,
  inputPrice?: number,
  outputPrice?: number
): string {
  const inputStr = abbreviateTokenCount(inputTokens);
  const outputStr = abbreviateTokenCount(outputTokens);
  const tokenPart = `${inputStr} in / ${outputStr} out`;

  if (inputPrice != null && outputPrice != null) {
    const cost = inputTokens * inputPrice + outputTokens * outputPrice;
    const costStr = `$${cost.toFixed(3)}`;
    return `${tokenPart} · ${costStr}`;
  }

  return tokenPart;
}
