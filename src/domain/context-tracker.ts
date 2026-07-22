/**
 * Context window tracking utilities.
 *
 * Pure functions for calculating how much of a model's context window
 * has been consumed and classifying the usage level. These functions
 * never auto-truncate or modify messages.
 */

export type ContextStatus = 'normal' | 'warning' | 'critical';

/** Default context window size when the model doesn't specify one (256K tokens). */
export const DEFAULT_CONTEXT_WINDOW = 256_000;

/**
 * Breakdown of token usage within a session, aggregated from message-level data.
 */
export interface TokenUsageBreakdown {
  /** Total tokens consumed in the session (all roles combined) */
  totalTokens: number;
  /** Tokens from system prompt messages */
  systemPromptTokens: number;
  /** Tokens from user messages (promptTokens on user-role messages) */
  userPromptTokens: number;
  /** Tokens from assistant output (completionTokens on assistant-role messages) */
  assistantOutputTokens: number;
  /** Cached tokens (from provider cache hits) */
  cachedTokens: number;
}

/**
 * Minimal message shape needed for token usage calculation.
 * Matches a subset of the Message interface from message-repo.
 */
export interface TokenMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  content: string;
}

/**
 * Compute a token usage breakdown from a list of session messages.
 *
 * Uses actual token counts from provider responses when available.
 * Falls back to a rough char/4 heuristic for messages without token data.
 *
 * @param messages - Messages in the current session
 * @returns Aggregated token breakdown by role
 */
export function computeTokenBreakdown(messages: TokenMessage[]): TokenUsageBreakdown {
  let systemPromptTokens = 0;
  let userPromptTokens = 0;
  let assistantOutputTokens = 0;
  let cachedTokens = 0;
  let totalTokens = 0;

  for (const msg of messages) {
    // Estimate tokens for this message if no actual count provided
    const msgTokens = msg.totalTokens ?? Math.ceil((msg.content?.length ?? 0) / 4);

    switch (msg.role) {
      case 'system':
        systemPromptTokens += msg.promptTokens ?? msgTokens;
        break;
      case 'user':
        userPromptTokens += msg.promptTokens ?? msgTokens;
        break;
      case 'assistant':
        assistantOutputTokens += msg.completionTokens ?? msgTokens;
        break;
    }

    cachedTokens += msg.cachedTokens ?? 0;
    totalTokens += msgTokens;
  }

  return {
    totalTokens,
    systemPromptTokens,
    userPromptTokens,
    assistantOutputTokens,
    cachedTokens,
  };
}

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
