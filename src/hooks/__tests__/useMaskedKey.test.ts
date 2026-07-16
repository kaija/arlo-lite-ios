/**
 * Tests for the useMaskedKey hook.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 */

jest.mock('@/database/secure-store', () => ({
  getApiKey: jest.fn(),
}));

import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useMaskedKey } from '../useMaskedKey';
import { getApiKey } from '@/database/secure-store';

const mockGetApiKey = getApiKey as jest.MockedFunction<typeof getApiKey>;

describe('useMaskedKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows "••••" while loading', () => {
    mockGetApiKey.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useMaskedKey('provider-1'));

    expect(result.current.suffix).toBe('••••');
    expect(result.current.loading).toBe(true);
  });

  it('shows "•••• XXXX" when key exists', async () => {
    mockGetApiKey.mockResolvedValue('sk-abc123xyz7890');

    const { result } = renderHook(() => useMaskedKey('provider-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.suffix).toBe('•••• 7890');
  });

  it('shows "No key" when no key is stored', async () => {
    mockGetApiKey.mockResolvedValue(null);

    const { result } = renderHook(() => useMaskedKey('provider-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.suffix).toBe('No key');
  });

  it('extracts the last 4 characters of short keys', async () => {
    mockGetApiKey.mockResolvedValue('abcd');

    const { result } = renderHook(() => useMaskedKey('provider-1'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.suffix).toBe('•••• abcd');
  });

  it('calls getApiKey with the correct providerId', () => {
    mockGetApiKey.mockResolvedValue(null);

    renderHook(() => useMaskedKey('my-provider-id'));

    expect(mockGetApiKey).toHaveBeenCalledWith('my-provider-id');
  });

  it('cancels async operation on unmount', async () => {
    let resolveKey: (value: string | null) => void;
    mockGetApiKey.mockReturnValue(
      new Promise((resolve) => {
        resolveKey = resolve;
      })
    );

    const { result, unmount } = renderHook(() => useMaskedKey('provider-1'));

    // Unmount before the promise resolves
    unmount();

    // Resolve after unmount — should not cause state update
    await act(async () => {
      resolveKey!('sk-late-key-9999');
    });

    // Since unmounted, we just verify no errors were thrown
    // (React would warn about setState on unmounted component if cancellation didn't work)
    expect(result.current.loading).toBe(true);
  });
});
