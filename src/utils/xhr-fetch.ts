/**
 * Fetch shim that routes HTTP URLs through XMLHttpRequest (which respects
 * iOS ATS NSAllowsArbitraryLoads on RN New Architecture) and HTTPS URLs
 * through expo/fetch.
 *
 * Background: expo/fetch (and globalThis.fetch) fail on plain HTTP URLs when
 * React Native's New Architecture is enabled. XMLHttpRequest uses the classic
 * networking bridge and properly honours the ATS configuration. This shim
 * transparently routes requests so the OpenAI SDK works over HTTP for
 * local/LAN inference servers.
 */

import { fetch as expoFetch } from 'expo/fetch';

/**
 * Fetch-compatible function that uses XHR for HTTP URLs and expo/fetch for HTTPS.
 *
 * For HTTP URLs, constructs a spec-compliant Response object with a ReadableStream
 * body suitable for SSE streaming (as consumed by the OpenAI SDK).
 */
export function xhrFetch(
  input: string | Request,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === 'string' ? input : input.url;

  // Delegate HTTPS (and other schemes) to expo/fetch
  if (!url.toLowerCase().startsWith('http://')) {
    return expoFetch(input as string, init as Parameters<typeof expoFetch>[1]);
  }

  return new Promise<Response>((resolve, reject) => {
    const method = init?.method?.toUpperCase() ?? 'GET';
    const headers = normalizeHeaders(init?.headers);
    const body = init?.body as string | undefined;
    const signal = init?.signal;

    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    // Set request headers
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    // Ensure we get text for streaming (not arraybuffer)
    xhr.responseType = 'text';

    // Track how many bytes we've already pushed into the stream
    let bytesSent = 0;
    let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
    let streamClosed = false;

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
      cancel() {
        streamClosed = true;
        xhr.abort();
      },
    });

    /**
     * Push new data that appeared in responseText since last check.
     */
    function pushNewData() {
      if (streamClosed || !streamController) return;

      const text = xhr.responseText;
      if (text.length > bytesSent) {
        const newChunk = text.slice(bytesSent);
        bytesSent = text.length;
        try {
          streamController.enqueue(encoder.encode(newChunk));
        } catch {
          // Stream may have been closed by consumer
          streamClosed = true;
        }
      }
    }

    xhr.onreadystatechange = () => {
      // When headers arrive, resolve the promise with the Response
      if (xhr.readyState === XMLHttpRequest.HEADERS_RECEIVED) {
        const status = xhr.status;
        const statusText = xhr.statusText || '';
        const responseHeaders = parseXHRHeaders(xhr.getAllResponseHeaders());

        const response = new Response(readableStream, {
          status,
          statusText,
          headers: responseHeaders,
        });

        resolve(response);
      }
    };

    xhr.onprogress = () => {
      pushNewData();
    };

    xhr.onload = () => {
      // Push any remaining data
      pushNewData();

      if (!streamClosed && streamController) {
        try {
          streamController.close();
        } catch {
          // Already closed
        }
        streamClosed = true;
      }
    };

    xhr.onerror = () => {
      if (!streamClosed && streamController) {
        try {
          streamController.error(new TypeError('Network request failed'));
        } catch {
          // Already errored/closed
        }
        streamClosed = true;
      }
      // If we haven't resolved yet (headers never arrived), reject the promise
      reject(new TypeError('Network request failed'));
    };

    xhr.ontimeout = () => {
      if (!streamClosed && streamController) {
        try {
          streamController.error(new TypeError('Request timed out'));
        } catch {
          // Already errored/closed
        }
        streamClosed = true;
      }
      reject(new TypeError('Request timed out'));
    };

    // AbortSignal support
    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', () => {
        xhr.abort();
        if (!streamClosed && streamController) {
          try {
            streamController.error(new DOMException('The operation was aborted.', 'AbortError'));
          } catch {
            // Already closed
          }
          streamClosed = true;
        }
      });
    }

    // Send the request
    xhr.send(body ?? null);
  });
}

/**
 * Normalize various HeadersInit formats into a plain Record.
 */
function normalizeHeaders(
  headers: HeadersInit | undefined | null,
): Record<string, string> {
  const result: Record<string, string> = {};

  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value: string, key: string) => {
      result[key] = value;
    });
  } else if (Array.isArray(headers)) {
    for (const [key, value] of headers) {
      result[key] = value;
    }
  } else {
    Object.assign(result, headers);
  }

  return result;
}

/**
 * Parse the raw header string from XHR into a Headers object.
 */
function parseXHRHeaders(rawHeaders: string): Headers {
  const headers = new Headers();
  const lines = rawHeaders.trim().split(/[\r\n]+/);

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      headers.append(key, value);
    }
  }

  return headers;
}
