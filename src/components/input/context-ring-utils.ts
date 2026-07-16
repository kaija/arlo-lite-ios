/**
 * Pure computation utilities for the ContextRing component.
 *
 * These functions encapsulate the logic for computing context window
 * usage percentage from raw character counts and determining the
 * appropriate color threshold.
 */

import { getRingColor } from './ContextRing';

/**
 * Compute the context ring usage percentage from total character count
 * and context window size.
 *
 * Uses the chars/4 heuristic to approximate token count, then calculates
 * the ratio against the context window. Result is clamped to [0, 100].
 *
 * @param totalChars - Total character count of all messages (>= 0)
 * @param contextWindow - The model's context window size in tokens (null/0 = unknown)
 * @returns Usage percentage in [0, 100]
 */
export function computeContextRingPercentage(
  totalChars: number,
  contextWindow: number | null | undefined,
): number {
  if (!contextWindow || contextWindow === 0) return 0;
  const approxTokens = Math.ceil(totalChars / 4);
  return Math.min((approxTokens / contextWindow) * 100, 100);
}

/**
 * Determine the ring color for a given usage percentage.
 *
 * Re-exports the logic from ContextRing for pure-function testing:
 * - < 50%: accent color
 * - 50–74%: contextWarning (orange)
 * - >= 75%: contextCritical (red)
 */
export { getRingColor };
