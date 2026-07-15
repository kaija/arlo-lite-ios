/**
 * Returns the current timestamp as epoch milliseconds.
 */
export function getCurrentTimestamp(): number {
  return Date.now();
}

/**
 * Formats an epoch-millisecond timestamp into a locale-aware date/time string.
 * Uses the device locale by default.
 */
export function formatDate(
  timestamp: number,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  return new Date(timestamp).toLocaleString(undefined, options ?? defaultOptions);
}

/**
 * Formats an epoch-millisecond timestamp as a relative time string
 * (e.g., "2 minutes ago", "Yesterday").
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return formatDate(timestamp, { year: 'numeric', month: 'short', day: 'numeric' });
}
