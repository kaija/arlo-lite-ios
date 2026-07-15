/**
 * Token estimator — character-based approximation for when
 * the provider doesn't return token usage in its response.
 *
 * Uses the common heuristic of ~4 characters per token for English text.
 * Guarantees monotonicity: for any prefix P of string S,
 * estimateTokenCount(P) ≤ estimateTokenCount(S).
 */

/**
 * Estimate the token count for a given text string.
 *
 * @param text - The text to estimate tokens for.
 * @returns Estimated token count (non-negative integer).
 */
export function estimateTokenCount(text: string): number {
  if (text.length === 0) {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/** Overhead tokens added per message to account for role/delimiter framing. */
const MESSAGE_FRAMING_OVERHEAD = 4;

/**
 * Estimate total tokens for a session's messages, including
 * per-message framing overhead.
 *
 * @param messages - Array of message objects with a `content` string field.
 * @returns Estimated total token count for the session.
 */
export function estimateSessionTokens(
  messages: Array<{ content: string }>
): number {
  return messages.reduce((total, message) => {
    return total + estimateTokenCount(message.content) + MESSAGE_FRAMING_OVERHEAD;
  }, 0);
}
