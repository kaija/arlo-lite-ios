/**
 * useMaskedKey — Async hook for loading and masking an API key suffix.
 *
 * Loads the API key from SecureStore for a given provider and returns
 * the last 4 characters in a masked format. Shows a loading placeholder
 * while the key is being retrieved, and "No key" when no key is stored.
 *
 * Requirements: 3.1, 3.2, 3.3
 */

import { useEffect, useState } from 'react';
import { getApiKey } from '@/database/secure-store';

export interface UseMaskedKeyResult {
  /** The masked key display string */
  suffix: string;
  /** Whether the key is still being loaded */
  loading: boolean;
}

/**
 * Async-loads an API key from SecureStore and returns a masked suffix.
 *
 * @param providerId - The provider whose API key to load.
 * @returns Object with `suffix` (display string) and `loading` state.
 *
 * Display states:
 * - While loading: "••••"
 * - When key exists (length >= 4): "•••• XXXX" (last 4 chars)
 * - When no key stored: "No key"
 */
export function useMaskedKey(providerId: string): UseMaskedKeyResult {
  const [suffix, setSuffix] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    getApiKey(providerId).then((key) => {
      if (cancelled) return;
      setSuffix(key ? key.slice(-4) : null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return {
    suffix: loading ? '••••' : suffix ? `•••• ${suffix}` : 'No key',
    loading,
  };
}
