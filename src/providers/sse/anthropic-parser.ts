/**
 * Anthropic SSE format parser utilities.
 *
 * Anthropic streams use SSE with event type annotations:
 * - `event: {type}\ndata: {...}` pairs
 * - Event types: message_start, content_block_start, content_block_delta,
 *   content_block_stop, message_delta, message_stop
 * - No `[DONE]` terminator — uses `message_stop` event type instead
 */

/**
 * Result of parsing an Anthropic SSE event.
 */
export interface AnthropicParsedEvent {
  /** Whether this event marks the end of the stream. */
  done: boolean;
  /** The event type (e.g., 'content_block_delta', 'message_stop'). */
  eventType: string | null;
  /** The parsed JSON data payload, or null if the line should be skipped. */
  data: Record<string, unknown> | null;
}

/**
 * Accumulated state for parsing Anthropic SSE lines.
 *
 * Anthropic sends `event:` and `data:` on separate lines, so we need
 * to track the current event type across lines.
 */
export interface AnthropicParserState {
  /** The most recently seen event type. */
  currentEventType: string | null;
}

/**
 * Create a fresh Anthropic parser state.
 */
export function createAnthropicParserState(): AnthropicParserState {
  return { currentEventType: null };
}

/**
 * Parse a single SSE line from an Anthropic stream.
 *
 * Must be called with state tracking since Anthropic uses separate
 * `event:` and `data:` lines. The event type is captured on `event:`
 * lines and used when the subsequent `data:` line is parsed.
 *
 * @param line - A raw line from the SSE stream
 * @param state - Mutable parser state tracking the current event type
 * @returns Parsed result with done flag, event type, and optional data
 */
export function parseAnthropicSSELine(
  line: string,
  state: AnthropicParserState
): AnthropicParsedEvent {
  // Skip empty lines
  if (!line || line.trim() === '') {
    return { done: false, eventType: null, data: null };
  }

  // Skip SSE comments
  if (line.startsWith(':')) {
    return { done: false, eventType: null, data: null };
  }

  // Capture event type for the next data line
  if (line.startsWith('event:')) {
    const eventType = line.startsWith('event: ') ? line.slice(7) : line.slice(6);
    state.currentEventType = eventType.trim();
    return { done: false, eventType: state.currentEventType, data: null };
  }

  // Process data lines
  if (line.startsWith('data:')) {
    const payload = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
    const trimmed = payload.trim();

    // Empty data line — skip
    if (!trimmed) {
      return { done: false, eventType: state.currentEventType, data: null };
    }

    // Parse JSON payload
    try {
      const data = JSON.parse(trimmed) as Record<string, unknown>;
      const eventType = state.currentEventType;

      // Check for message_stop — this signals end of stream
      const isDone = eventType === 'message_stop' || data.type === 'message_stop';

      // Reset state after consuming the event
      const result: AnthropicParsedEvent = {
        done: isDone,
        eventType,
        data,
      };

      return result;
    } catch {
      // Malformed JSON — skip
      return { done: false, eventType: state.currentEventType, data: null };
    }
  }

  // Unknown line format — skip
  return { done: false, eventType: null, data: null };
}
