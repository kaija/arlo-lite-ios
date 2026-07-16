import {
  buildSecureKey,
  storeApiKey,
  getApiKey,
  deleteApiKey,
} from '../secure-store';

// Mock expo-secure-store
const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>();
const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null);
const mockDeleteItemAsync = jest.fn<Promise<void>, [string]>();

jest.mock('expo-secure-store', () => ({
  setItemAsync: (...args: [string, string]) => mockSetItemAsync(...args),
  getItemAsync: (...args: [string]) => mockGetItemAsync(...args),
  deleteItemAsync: (...args: [string]) => mockDeleteItemAsync(...args),
}));

describe('secure-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildSecureKey', () => {
    it('builds the correct key pattern for a provider', () => {
      expect(buildSecureKey('provider-123')).toBe(
        'arlo.provider.provider-123.apiKey'
      );
    });

    it('handles provider IDs with special characters', () => {
      expect(buildSecureKey('my-custom_provider.v2')).toBe(
        'arlo.provider.my-custom_provider.v2.apiKey'
      );
    });
  });

  describe('storeApiKey', () => {
    it('stores the API key using the correct secure key', async () => {
      await storeApiKey('provider-1', 'sk-test-key-123');

      expect(mockSetItemAsync).toHaveBeenCalledWith(
        'arlo.provider.provider-1.apiKey',
        'sk-test-key-123'
      );
    });

    it('throws when providerId is empty', async () => {
      await expect(storeApiKey('', 'sk-key')).rejects.toThrow(
        'providerId must not be empty'
      );
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('throws when apiKey is empty', async () => {
      await expect(storeApiKey('provider-1', '')).rejects.toThrow(
        'apiKey must not be empty'
      );
      expect(mockSetItemAsync).not.toHaveBeenCalled();
    });

    it('propagates errors from secure store', async () => {
      mockSetItemAsync.mockRejectedValueOnce(new Error('Storage full'));

      await expect(storeApiKey('provider-1', 'sk-key')).rejects.toThrow(
        'Storage full'
      );
    });
  });

  describe('getApiKey', () => {
    it('retrieves the API key using the correct secure key', async () => {
      mockGetItemAsync.mockResolvedValueOnce('sk-retrieved-key');

      const result = await getApiKey('provider-1');

      expect(mockGetItemAsync).toHaveBeenCalledWith(
        'arlo.provider.provider-1.apiKey'
      );
      expect(result).toBe('sk-retrieved-key');
    });

    it('returns null when no key is stored', async () => {
      mockGetItemAsync.mockResolvedValueOnce(null);

      const result = await getApiKey('provider-1');

      expect(result).toBeNull();
    });

    it('throws when providerId is empty', async () => {
      await expect(getApiKey('')).rejects.toThrow(
        'providerId must not be empty'
      );
      expect(mockGetItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('deleteApiKey', () => {
    it('deletes the key using the correct secure key', async () => {
      await deleteApiKey('provider-1');

      expect(mockDeleteItemAsync).toHaveBeenCalledWith(
        'arlo.provider.provider-1.apiKey'
      );
    });

    it('throws when providerId is empty', async () => {
      await expect(deleteApiKey('')).rejects.toThrow(
        'providerId must not be empty'
      );
      expect(mockDeleteItemAsync).not.toHaveBeenCalled();
    });

    it('does not throw when key does not exist', async () => {
      mockDeleteItemAsync.mockResolvedValueOnce(undefined);

      await expect(deleteApiKey('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('security invariants', () => {
    it('never logs the API key value', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await storeApiKey('provider-1', 'sk-secret-key');
      mockGetItemAsync.mockResolvedValueOnce('sk-secret-key');
      await getApiKey('provider-1');
      await deleteApiKey('provider-1');

      const allLogCalls = [
        ...consoleSpy.mock.calls,
        ...consoleWarnSpy.mock.calls,
        ...consoleErrorSpy.mock.calls,
      ];

      for (const call of allLogCalls) {
        const serialized = JSON.stringify(call);
        expect(serialized).not.toContain('sk-secret-key');
      }

      consoleSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });
});
