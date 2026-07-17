/**
 * Streaming phase detection for the thinking-effort lifecycle.
 *
 * Derives the current UI phase from ChatStore ephemeral state,
 * enabling phase-aware rendering in StreamingMessage.
 */

/** The four discrete streaming phases that drive UI transitions. */
export type StreamingPhase =
  | 'idle'
  | 'thinking-pending'
  | 'thinking-active'
  | 'text-streaming';

/**
 * Derives the current streaming phase from ChatStore state.
 * Pure function — no side effects.
 *
 * @param state - The relevant slice of ChatStore streaming state.
 * @returns The current streaming phase.
 */
export function deriveStreamingPhase(state: {
  isStreaming: boolean;
  thinkingContent: string;
  streamContent: string;
}): StreamingPhase {
  if (!state.isStreaming) return 'idle';
  if (state.streamContent.length > 0) return 'text-streaming';
  if (state.thinkingContent.length > 0) return 'thinking-active';
  return 'thinking-pending';
}
