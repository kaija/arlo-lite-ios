/**
 * SSE stream manager for LLM provider communication.
 *
 * Uses fetch with ReadableStream to consume Server-Sent Events from
 * provider APIs. Delegates chunk parsing to a caller-supplied parse function,
 * enabling provider-specific SSE format handling.
 *
 * Supports abort/cancel via AbortController for user-initiated stop.
 */

import type { StreamChunk, TokenUsage } from '../types';

/**
 * A function that parses a single SSE line into a StreamChunk or null.
 * Providers supply their own implementation when using createSSEStream.
 */
export type SSELineParser = (line: string) => StreamChunk | null;

/**
 * Callbacks invoked during SSE stream processing.
 */
export interface SSECallbacks {
  /** Called for each text or thinking chunk received from the stream. */
  onChunk: (chunk: StreamChunk) => void;
  /** Called when the stream completes successfully, optionally with usage data. */
  onComplete: (usage?: TokenUsage) => void;
  /** Called when an error occurs during streaming. */
  onError: (error: Error) => void;
}

/**
 * Handle to a live SSE connection, allowing the caller to abort the stream.
 */
export interface SSEConnection {
  /** Abort the SSE connection, cancelling the in-flight fetch request. */
  abort: () => void;
}

/**
 * Create and start an SSE stream connection to a provider API.
 *
 * Sends a POST request with the given headers and body, then reads the
 * response as a text stream. Each line is passed to the supplied parse
 * function to produce typed StreamChunk objects.
 *
 * @param url - The full API endpoint URL
 * @param headers - HTTP headers (including auth and content-type)
 * @param body - JSON-serialized request body
 * @param parseChunk - Function that parses a single SSE line into a StreamChunk or null
 * @param callbacks - Event callbacks for chunks, completion, and errors
 * @returns An SSEConnection with an abort method for cancellation
 */
export function createSSEStream(
  url: string,
  headers: Record<string, string>,
  body: string,
  parseChunk: SSELineParser,
  callbacks: SSECallbacks
): SSEConnection {
  const controller = new AbortController();

  // Start the streaming request asynchronously
  processStream(url, headers, body, parseChunk, callbacks, controller.signal).catch(
    (error: unknown) => {
      // Only report errors that aren't from intentional abort
      if (!controller.signal.aborted) {
        const err = error instanceof Error ? error : new Error(String(error));
        callbacks.onError(err);
      }
    }
  );

  return {
    abort: () => {
      controller.abort();
    },
  };
}

/**
 * Internal: Execute the fetch request and process the response stream.
 */
async function processStream(
  url: string,
  headers: Record<string, string>,
  body: string,
  parseChunk: SSELineParser,
  callbacks: SSECallbacks,
  signal: AbortSignal
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      Accept: 'text/event-stream',
    },
    body,
    signal,
  });

  // Handle non-OK responses
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorBody = await response.text();
      if (errorBody) {
        errorMessage += ` — ${errorBody}`;
      }
    } catch {
      // Ignore errors reading error body
    }
    callbacks.onError(new Error(errorMessage));
    return;
  }

  // Ensure we have a readable body
  if (!response.body) {
    callbacks.onError(new Error('Response body is null — streaming not supported'));
    return;
  }

  await readStream(response.body, parseChunk, callbacks, signal);
}

/**
 * Internal: Read from a ReadableStream, splitting into SSE lines and
 * delegating parsing to the supplied parse function.
 */
async function readStream(
  body: ReadableStream<Uint8Array>,
  parseChunk: SSELineParser,
  callbacks: SSECallbacks,
  signal: AbortSignal
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();

      if (done) {
        // Process any remaining buffered data
        if (buffer.trim()) {
          processLine(buffer, parseChunk, callbacks);
        }
        callbacks.onComplete();
        return;
      }

      // Decode the chunk and append to buffer
      buffer += decoder.decode(value, { stream: true });

      // Split buffer into lines on newline boundaries
      const lines = buffer.split(/\r?\n|\r/);

      // Keep the last element as it may be incomplete
      buffer = lines.pop() ?? '';

      // Process each complete line
      for (const line of lines) {
        if (signal.aborted) return;
        processLine(line, parseChunk, callbacks);
      }
    }
  } catch (error: unknown) {
    // AbortError is expected when the user cancels
    if (signal.aborted) return;

    const err = error instanceof Error ? error : new Error(String(error));
    callbacks.onError(err);
  } finally {
    reader.releaseLock();
  }
}

/**
 * Internal: Process a single SSE line through the parse function.
 */
function processLine(
  line: string,
  parseChunk: SSELineParser,
  callbacks: SSECallbacks
): void {
  const chunk = parseChunk(line);

  if (!chunk) return;

  switch (chunk.type) {
    case 'text':
    case 'thinking':
      callbacks.onChunk(chunk);
      break;

    case 'done':
      callbacks.onComplete(chunk.usage);
      break;

    case 'error':
      callbacks.onError(new Error(chunk.content || 'Stream error'));
      break;
  }
}
