/**
 * Error classification for API and network errors.
 *
 * Categorizes errors into actionable types (auth, rate-limit, server, network, etc.)
 * and determines whether the error is transient (retryable) or permanent.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

/**
 * Error category determines the handling strategy.
 */
export type ErrorCategory =
  | 'network'       // No connectivity
  | 'auth'          // 401/403 — invalid or expired API key
  | 'rate_limit'    // 429 — provider throttling
  | 'server'        // 5xx — provider-side failure
  | 'stream'        // Connection dropped mid-stream
  | 'format'        // Unexpected response shape
  | 'unknown';      // Catch-all

/**
 * A classified error with user-facing message, detail, category, and retry info.
 */
export interface ClassifiedError {
  /** Short user-facing message (one-line for compact display) */
  message: string;
  /** Full detail for expanded view (may include raw error body) */
  detail: string;
  /** The error category */
  category: ErrorCategory;
  /** Whether this error is transient and a retry may succeed */
  isRetryable: boolean;
}

/**
 * Classify an HTTP status code error into an actionable error object.
 *
 * @param statusCode - The HTTP status code from the response
 * @param responseBody - The raw response body text (may be empty)
 * @param statusText - The HTTP status text (e.g. "Not Found")
 * @returns A ClassifiedError with appropriate messaging
 */
export function classifyHttpError(
  statusCode: number,
  responseBody: string,
  statusText: string
): ClassifiedError {
  // Try to extract a structured error message from JSON response body
  const parsedMessage = extractErrorMessage(responseBody);

  if (statusCode === 401 || statusCode === 403) {
    return {
      message: 'Invalid API key',
      detail: parsedMessage || `HTTP ${statusCode}: ${statusText}. Check your API key in provider settings.`,
      category: 'auth',
      isRetryable: false,
    };
  }

  if (statusCode === 429) {
    return {
      message: 'Rate limited — try again shortly',
      detail: parsedMessage || `HTTP ${statusCode}: Too many requests. The provider is throttling your requests.`,
      category: 'rate_limit',
      isRetryable: true,
    };
  }

  if (statusCode >= 500 && statusCode < 600) {
    return {
      message: 'Server error — try again',
      detail: parsedMessage || `HTTP ${statusCode}: ${statusText}. The provider is experiencing issues.`,
      category: 'server',
      isRetryable: true,
    };
  }

  if (statusCode === 400) {
    return {
      message: 'Bad request',
      detail: parsedMessage || `HTTP ${statusCode}: ${statusText}. The request format may be invalid.`,
      category: 'format',
      isRetryable: false,
    };
  }

  if (statusCode === 404) {
    return {
      message: 'Model or endpoint not found',
      detail: parsedMessage || `HTTP ${statusCode}: ${statusText}. Check the model ID and base URL.`,
      category: 'format',
      isRetryable: false,
    };
  }

  // Generic client/server errors
  return {
    message: `API error (${statusCode})`,
    detail: parsedMessage || `HTTP ${statusCode}: ${statusText}`,
    category: 'unknown',
    isRetryable: statusCode >= 500,
  };
}

/**
 * Classify a network/fetch error (no HTTP response received).
 *
 * @param error - The caught Error object
 * @returns A ClassifiedError for network failures
 */
export function classifyNetworkError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase();

  // AbortError from user-initiated cancel — not really an error to display
  if (error.name === 'AbortError' || message.includes('aborted')) {
    return {
      message: 'Request cancelled',
      detail: 'The request was cancelled.',
      category: 'network',
      isRetryable: false,
    };
  }

  // Timeout
  if (message.includes('timeout') || message.includes('timed out')) {
    return {
      message: 'Request timed out',
      detail: 'The request took too long. Check your connection and try again.',
      category: 'network',
      isRetryable: true,
    };
  }

  // Network connectivity issues
  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('connection') ||
    message.includes('dns') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  ) {
    return {
      message: 'Network unavailable',
      detail: 'Could not reach the server. Check your internet connection.',
      category: 'network',
      isRetryable: true,
    };
  }

  // Generic fallback
  return {
    message: 'Request failed',
    detail: error.message || 'An unexpected error occurred.',
    category: 'unknown',
    isRetryable: true,
  };
}

/**
 * Classify a streaming error (connection dropped mid-stream).
 *
 * @param error - The Error from the SSE stream
 * @returns A ClassifiedError for stream failures
 */
export function classifyStreamError(error: Error): ClassifiedError {
  const message = error.message;

  // Check if the SSE manager already provided an HTTP error (format: "HTTP 429: ...")
  const httpMatch = message.match(/^HTTP (\d+):/);
  if (httpMatch) {
    const statusCode = parseInt(httpMatch[1], 10);
    // Extract everything after "HTTP NNN: status — body"
    const rest = message.slice(httpMatch[0].length).trim();
    const [statusText, ...bodyParts] = rest.split(' — ');
    return classifyHttpError(statusCode, bodyParts.join(' — '), statusText);
  }

  // User-initiated abort
  if (error.name === 'AbortError' || message.toLowerCase().includes('aborted')) {
    return {
      message: 'Generation stopped',
      detail: 'Response generation was stopped.',
      category: 'stream',
      isRetryable: false,
    };
  }

  // Stream interrupted
  return {
    message: 'Stream interrupted — try again',
    detail: message || 'The connection was lost during streaming.',
    category: 'stream',
    isRetryable: true,
  };
}

/**
 * Try to extract a human-readable error message from a JSON response body.
 * Providers typically use { "error": { "message": "..." } } format.
 */
function extractErrorMessage(responseBody: string): string | null {
  if (!responseBody) return null;

  try {
    const parsed = JSON.parse(responseBody);
    // Anthropic may use: { error: { type: "...", message: "..." } }
    if (parsed?.error?.type && parsed?.error?.message) {
      return `${parsed.error.type}: ${parsed.error.message}`;
    }
    // OpenAI / Anthropic format: { error: { message: "..." } }
    if (parsed?.error?.message) {
      return String(parsed.error.message);
    }
    // Some providers use: { message: "..." }
    if (parsed?.message && typeof parsed.message === 'string') {
      return parsed.message;
    }
  } catch {
    // Not JSON — return truncated raw body
    if (responseBody.length > 200) {
      return responseBody.slice(0, 200) + '…';
    }
    return responseBody;
  }

  return null;
}
