/**
 * OpenAI SSE format parser utilities.
 *
 * OpenAI streams use the standard SSE protocol with:
 * - `data: {...}` lines containing JSON payloads
 * - `data: [DONE]` as the stream terminator
 * - `:` prefixed lines as comments (keep-alive pings)
 * - Empty lines as event separators
 */

/**
 * Result of parsing a single SSE line from an OpenAI stream.
 */
export interface OpenAIParsedLine {
  /** Whether this line marks the end of the stream. */
  done: boolean;
  /** The parsed JSON object, or null if the line was empty/comment/done. */
  data: Record<string, unknown> | null;
}

/**
 * Parse a single SSE line from an OpenAI stream.
 *
 * @param line - A raw line from the SSE stream
 * @returns Parsed result with done flag and optional data payload
 */
export function parseOpenAISSELine(line: string): OpenAIParsedLine {
  // Skip empty lines (event separators)
  if (!line || line.trim() === '') {
    return { done: false, data: null };
  }

  // Skip SSE comments (keep-alive pings)
  if (line.startsWith(':')) {
    return { done: false, data: null };
  }

  // Only process data: lines
  if (!line.startsWith('data:')) {
    return { done: false, data: null };
  }

  // Extract payload after "data:" (with or without space)
  const payload = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
  const trimmed = payload.trim();

  // Handle [DONE] terminator
  if (trimmed === '[DONE]') {
    return { done: true, data: null };
  }

  // Parse JSON payload
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    return { done: false, data };
  } catch {
    // Malformed JSON — skip
    return { done: false, data: null };
  }
}

/**
 * Split a raw SSE text buffer into individual lines.
 *
 * SSE events are separated by double newlines (\n\n), and within an event,
 * fields are separated by single newlines. This function splits on single
 * newlines so each field (e.g., `data: ...`) becomes its own line.
 *
 * @param buffer - Raw text from the stream
 * @returns An object with parsed lines and any remaining incomplete data
 */
export function splitSSEBuffer(buffer: string): {
  lines: string[];
  remainder: string;
} {
  // Split on newlines — SSE uses \n, \r\n, or \r
  const parts = buffer.split(/\r?\n|\r/);

  // The last element may be an incomplete line if the buffer was cut mid-event
  const remainder = parts.pop() ?? '';

  return { lines: parts, remainder };
}
