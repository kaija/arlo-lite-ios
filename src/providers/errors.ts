/**
 * Error categories for provider failures.
 * Enables UI branching without inspecting HTTP status codes.
 */
export type ProviderErrorCategory =
  | 'authentication' // 401, 403
  | 'rate_limit' // 429
  | 'overloaded' // 529 (Anthropic-specific)
  | 'network' // DNS, TCP, TLS, timeout
  | 'server'; // 500-599 (excluding 529 for Anthropic)

/**
 * Structured provider error with classification metadata.
 * Messages are human-readable and do not expose raw API response bodies.
 */
export class ProviderError extends Error {
  /** Error category for UI branching */
  readonly category: ProviderErrorCategory;

  /** Seconds to wait before retrying (from Retry-After header), or null */
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    category: ProviderErrorCategory,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'ProviderError';
    this.category = category;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  /** Whether this error is potentially transient and retryable */
  get isRetryable(): boolean {
    return (
      this.category === 'rate_limit' ||
      this.category === 'overloaded' ||
      this.category === 'server' ||
      this.category === 'network'
    );
  }
}
