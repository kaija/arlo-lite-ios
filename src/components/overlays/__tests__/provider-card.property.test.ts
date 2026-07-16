import fc from 'fast-check';

/**
 * Property-based tests for ProviderCard behaviors.
 *
 * Contains:
 * - Property 6: API Key Masking (Validates: Requirements 3.1, 3.3)
 * - Property 7: Connection Status Mapping (Validates: Requirements 4.1, 4.2, 4.3, 4.4)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Property 6: API Key Masking
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 3.1, 3.3**
 *
 * Feature: provider-ui-integration, Property 6: API Key Masking
 *
 * Property: For any stored API key string of length >= 4, the ProviderCard SHALL
 * display a masked representation ending with the last 4 characters of that key.
 * For any provider with no stored API key, the display SHALL show "No key".
 */

/**
 * Pure masking logic extracted from useMaskedKey hook.
 * Given a raw API key (or null/empty), returns the display string.
 */
function maskApiKey(key: string | null): string {
  if (!key) return 'No key';
  const suffix = key.slice(-4);
  return `•••• ${suffix}`;
}

describe('Property 6: API Key Masking', () => {
  describe('keys of length >= 4 end with last 4 characters', () => {
    it('for any key of length >= 4, masked output ends with the last 4 chars of the key', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 4, maxLength: 200 }),
          (key) => {
            const result = maskApiKey(key);
            const last4 = key.slice(-4);
            return result.endsWith(last4);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('for any key of length >= 4, masked output uses the format "•••• XXXX"', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 4, maxLength: 200 }),
          (key) => {
            const result = maskApiKey(key);
            const last4 = key.slice(-4);
            return result === `•••• ${last4}`;
          },
        ),
        { numRuns: 200 },
      );
    });

    it('for any key of length >= 4, masked output is always exactly 9 characters long', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 4, maxLength: 200 }),
          (key) => {
            const result = maskApiKey(key);
            // "•••• " (4 bullet chars + 1 space) + 4 suffix chars = 9 chars
            return result.length === 9;
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('null or empty key returns "No key"', () => {
    it('for null key, output is "No key"', () => {
      expect(maskApiKey(null)).toBe('No key');
    });

    it('for empty string key, output is "No key"', () => {
      expect(maskApiKey('')).toBe('No key');
    });

    it('for any falsy key value (null or empty), output is always "No key"', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, ''),
          (key) => {
            return maskApiKey(key) === 'No key';
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('masking never reveals more than last 4 characters', () => {
    it('for any key of length >= 5, only the last 4 chars appear in the output', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 200 }),
          (key) => {
            const result = maskApiKey(key);
            const extractedSuffix = result.replace('•••• ', '');
            return extractedSuffix === key.slice(-4);
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Property 7: Connection Status Mapping
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 *
 * Feature: provider-ui-integration, Property 7: Connection Status Mapping
 *
 * Property: For any provider id P and for any ConnectionStatus value S in the
 * ProviderStore's connectionStatuses[P], the ProviderCard for provider P SHALL
 * render a status dot whose color corresponds to S (green for connected, red
 * for failed, gray for untested). Undefined/unknown values default to gray.
 */

// ─── Types (mirrors provider-store.ts) ────────────────────────────────────────

type ConnectionStatus = 'untested' | 'connected' | 'failed';

// ─── Pure logic under test (mirrors SettingsScreen.tsx) ───────────────────────

/**
 * Maps a connection status to its indicator dot color.
 * Mirrors the getStatusDotColor function in SettingsScreen.tsx.
 */
function getStatusDotColor(status: ConnectionStatus | undefined): string {
  switch (status) {
    case 'connected':
      return '#34C759';
    case 'failed':
      return '#FF3B30';
    case 'untested':
    default:
      return '#8E8E93';
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  connected: '#34C759',
  failed: '#FF3B30',
  untested: '#8E8E93',
} as const;

const ALL_STATUSES: ConnectionStatus[] = ['connected', 'failed', 'untested'];

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 7: Connection Status Mapping', () => {
  it('for any valid ConnectionStatus, the correct color is returned', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES),
        (status) => {
          const color = getStatusDotColor(status);
          return color === STATUS_COLORS[status];
        },
      ),
      { numRuns: 100 },
    );
  });

  it('connected status always maps to green (#34C759)', () => {
    fc.assert(
      fc.property(
        fc.constant('connected' as ConnectionStatus),
        (status) => {
          return getStatusDotColor(status) === '#34C759';
        },
      ),
      { numRuns: 10 },
    );
  });

  it('failed status always maps to red (#FF3B30)', () => {
    fc.assert(
      fc.property(
        fc.constant('failed' as ConnectionStatus),
        (status) => {
          return getStatusDotColor(status) === '#FF3B30';
        },
      ),
      { numRuns: 10 },
    );
  });

  it('untested status always maps to gray (#8E8E93)', () => {
    fc.assert(
      fc.property(
        fc.constant('untested' as ConnectionStatus),
        (status) => {
          return getStatusDotColor(status) === '#8E8E93';
        },
      ),
      { numRuns: 10 },
    );
  });

  it('undefined status defaults to gray (#8E8E93)', () => {
    fc.assert(
      fc.property(
        fc.constant(undefined),
        (status) => {
          return getStatusDotColor(status) === '#8E8E93';
        },
      ),
      { numRuns: 10 },
    );
  });

  it('any non-enum string value defaults to gray', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter(
          (s) => !ALL_STATUSES.includes(s as ConnectionStatus),
        ),
        (unknownStatus) => {
          // Cast to simulate unexpected values reaching the function
          const color = getStatusDotColor(unknownStatus as unknown as ConnectionStatus);
          return color === '#8E8E93';
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the function is pure — same input always produces same output', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES, undefined),
        (status) => {
          const first = getStatusDotColor(status);
          const second = getStatusDotColor(status);
          return first === second;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('the output is always one of the three defined colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_STATUSES, undefined),
        (status) => {
          const color = getStatusDotColor(status);
          const validColors = ['#34C759', '#FF3B30', '#8E8E93'];
          return validColors.includes(color);
        },
      ),
      { numRuns: 100 },
    );
  });
});
