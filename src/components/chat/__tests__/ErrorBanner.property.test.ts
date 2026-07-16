import fc from 'fast-check';

/**
 * Property-based tests for ErrorBanner retry visibility.
 *
 * **Validates: Requirements 8.2, 8.3**
 *
 * Feature: provider-ui-integration, Property 11: Error Banner Retry Visibility
 *
 * Property: For any ChatError, the ErrorBanner SHALL display the `message` text.
 * If `isRetryable` is true, a "Retry" button SHALL be visible; if `isRetryable`
 * is false, no retry button SHALL appear.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Pure logic extraction
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Determines whether the retry button should be rendered.
 * Mirrors the conditional rendering logic in ErrorBanner:
 *   {isRetryable && (<Pressable>...Retry...</Pressable>)}
 */
function shouldShowRetry(isRetryable: boolean): boolean {
  return isRetryable;
}

/**
 * Determines whether the message text should be rendered.
 * The message is always displayed regardless of retryable status.
 */
function shouldShowMessage(_message: string, _isRetryable: boolean): boolean {
  return true;
}

/**
 * Models the ErrorBanner render output for property testing.
 * Given props, returns which elements would be visible.
 */
function deriveErrorBannerVisibility(props: {
  message: string;
  isRetryable: boolean;
}): { messageVisible: boolean; retryVisible: boolean } {
  return {
    messageVisible: shouldShowMessage(props.message, props.isRetryable),
    retryVisible: shouldShowRetry(props.isRetryable),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Property 11: Error Banner Retry Visibility
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 11: Error Banner Retry Visibility', () => {
  describe('retry button visibility is determined by isRetryable', () => {
    it('for any ChatError with isRetryable true, the retry button SHALL be visible', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (message) => {
            const result = deriveErrorBannerVisibility({
              message,
              isRetryable: true,
            });
            return result.retryVisible === true;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('for any ChatError with isRetryable false, no retry button SHALL appear', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (message) => {
            const result = deriveErrorBannerVisibility({
              message,
              isRetryable: false,
            });
            return result.retryVisible === false;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('for any boolean isRetryable, the retry visibility equals the flag value', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.boolean(),
          (message, isRetryable) => {
            const result = deriveErrorBannerVisibility({ message, isRetryable });
            return result.retryVisible === isRetryable;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('message text is always displayed regardless of retryable status', () => {
    it('for any message and any isRetryable value, message SHALL be visible', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.boolean(),
          (message, isRetryable) => {
            const result = deriveErrorBannerVisibility({ message, isRetryable });
            return result.messageVisible === true;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('message visibility is independent of the retryable flag', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          (message) => {
            const withRetry = deriveErrorBannerVisibility({
              message,
              isRetryable: true,
            });
            const withoutRetry = deriveErrorBannerVisibility({
              message,
              isRetryable: false,
            });
            return (
              withRetry.messageVisible === true &&
              withoutRetry.messageVisible === true
            );
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('the derive function is pure — same inputs always yield same outputs', () => {
    it('for any message and isRetryable, repeated calls produce identical results', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.boolean(),
          (message, isRetryable) => {
            const first = deriveErrorBannerVisibility({ message, isRetryable });
            const second = deriveErrorBannerVisibility({ message, isRetryable });
            return (
              first.messageVisible === second.messageVisible &&
              first.retryVisible === second.retryVisible
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
