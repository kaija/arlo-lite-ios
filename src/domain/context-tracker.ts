/**
 * Context window tracking utilities.
 *
 * Pure functions for calculating how much of a model's context window
 * has been consumed and classifying the usage level. These functions
 * never auto-truncate or modify messages.
 */

export type ContextStatus = 'normal' | 'warning' | 'critical';

/**
 * Calculate context usage as a percentage of the model's context window.
 *
 * @param tokenCount - Total tokens used in the session (must be >= 0)
 * @param contextWindow - The model's maximum context window size
 * @returns Percentage of context used. Returns 0 if contextWindow is 0, null, or undefined.
 *          Result can exceed 100 (no clamping at the domain level).
 */
export function calculateContextUsage(
  tokenCount: number,
  contextWindow: number | null | undefined
): number {
  if (!contextWindow || contextWindow === 0) {
    return 0;
  }
  return (tokenCount / contextWindow) * 100;
}

/**
 * Classify the context usage percentage into a status level.
 *
 * - normal: < 80%
 * - warning: 80% to 95% (inclusive of 80, inclusive of 95)
 * - critical: > 95%
 *
 * @param percentage - Context usage percentage (from calculateContextUsage)
 * @returns The status classification
 */
export function getContextStatus(percentage: number): ContextStatus {
  if (percentage > 95) {
    return 'critical';
  }
  if (percentage >= 80) {
    return 'warning';
  }
  return 'normal';
}
