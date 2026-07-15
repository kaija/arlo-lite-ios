import {
  fetchAndCacheMetadata,
  getModelMetadata,
  refreshMetadataIfStale,
} from '../metadata-service';
import type { RemoteModelMetadata } from '../metadata-service';

// Mock the database
function createMockDb() {
  const store: Record<string, any> = {};
  const maxUpdatedAt = { value: 0 };

  return {
    runAsync: jest.fn(async (sql: string, params: any[]) => {
      if (sql.includes('INSERT OR REPLACE INTO model_metadata')) {
        const [modelId, contextWindow, inputPrice, outputPrice, cachedInputPrice, cachedOutputPrice, supportsReasoning, updatedAt] = params;
        store[modelId] = {
          model_id: modelId,
          context_window: contextWindow,
          input_price: inputPrice,
          output_price: outputPrice,
          cached_input_price: cachedInputPrice,
          cached_output_price: cachedOutputPrice,
          supports_reasoning: supportsReasoning,
          updated_at: updatedAt,
        };
        if (updatedAt > maxUpdatedAt.value) {
          maxUpdatedAt.value = updatedAt;
        }
      }
    }),
    getFirstAsync: jest.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('SELECT * FROM model_metadata WHERE model_id')) {
        const modelId = params?.[0];
        return store[modelId] ?? null;
      }
      if (sql.includes('SELECT MAX(updated_at)')) {
        return maxUpdatedAt.value > 0 ? { updated_at: maxUpdatedAt.value } : { updated_at: null };
      }
      return null;
    }),
    // Expose internal store for test assertions
    __store: store,
    __maxUpdatedAt: maxUpdatedAt,
  };
}

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('MetadataService', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    jest.clearAllMocks();
    db = createMockDb();
  });

  describe('fetchAndCacheMetadata', () => {
    it('should fetch remote JSON and upsert entries into the database', async () => {
      const remoteData: RemoteModelMetadata[] = [
        {
          model_id: 'gpt-4o',
          context_window: 128000,
          input_price: 2.5,
          output_price: 10.0,
          cached_input_price: 1.25,
          cached_output_price: 10.0,
          supports_reasoning: false,
        },
        {
          model_id: 'claude-3-5-sonnet-20241022',
          context_window: 200000,
          input_price: 3.0,
          output_price: 15.0,
          cached_input_price: 1.5,
          cached_output_price: 15.0,
          supports_reasoning: true,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      await fetchAndCacheMetadata(db as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(db.runAsync).toHaveBeenCalledTimes(2);
      expect(db.__store['gpt-4o']).toBeDefined();
      expect(db.__store['gpt-4o'].context_window).toBe(128000);
      expect(db.__store['gpt-4o'].input_price).toBe(2.5);
      expect(db.__store['gpt-4o'].supports_reasoning).toBe(0);
      expect(db.__store['claude-3-5-sonnet-20241022']).toBeDefined();
      expect(db.__store['claude-3-5-sonnet-20241022'].supports_reasoning).toBe(1);
    });

    it('should gracefully handle fetch network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await fetchAndCacheMetadata(db as any);

      expect(db.runAsync).not.toHaveBeenCalled();
    });

    it('should gracefully handle non-ok HTTP responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await fetchAndCacheMetadata(db as any);

      expect(db.runAsync).not.toHaveBeenCalled();
    });

    it('should gracefully handle non-array response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'not an array' }),
      });

      await fetchAndCacheMetadata(db as any);

      expect(db.runAsync).not.toHaveBeenCalled();
    });

    it('should skip entries without a valid model_id', async () => {
      const remoteData = [
        { model_id: '', context_window: 100 },
        { context_window: 200 },
        { model_id: 'valid-model', context_window: 300 },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      await fetchAndCacheMetadata(db as any);

      expect(db.runAsync).toHaveBeenCalledTimes(1);
      expect(db.__store['valid-model']).toBeDefined();
    });

    it('should handle null/undefined fields by storing null', async () => {
      const remoteData: RemoteModelMetadata[] = [
        { model_id: 'minimal-model' },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      await fetchAndCacheMetadata(db as any);

      expect(db.__store['minimal-model'].context_window).toBeNull();
      expect(db.__store['minimal-model'].input_price).toBeNull();
      expect(db.__store['minimal-model'].output_price).toBeNull();
      expect(db.__store['minimal-model'].cached_input_price).toBeNull();
      expect(db.__store['minimal-model'].cached_output_price).toBeNull();
      expect(db.__store['minimal-model'].supports_reasoning).toBe(0);
    });
  });

  describe('getModelMetadata', () => {
    it('should return metadata for a cached model', async () => {
      // Pre-populate the store
      db.__store['gpt-4o'] = {
        model_id: 'gpt-4o',
        context_window: 128000,
        input_price: 2.5,
        output_price: 10.0,
        cached_input_price: 1.25,
        cached_output_price: 10.0,
        supports_reasoning: 0,
        updated_at: 1700000000000,
      };

      const result = await getModelMetadata(db as any, 'gpt-4o');

      expect(result).not.toBeNull();
      expect(result!.modelId).toBe('gpt-4o');
      expect(result!.contextWindow).toBe(128000);
      expect(result!.inputPrice).toBe(2.5);
      expect(result!.outputPrice).toBe(10.0);
      expect(result!.cachedInputPrice).toBe(1.25);
      expect(result!.cachedOutputPrice).toBe(10.0);
      expect(result!.supportsReasoning).toBe(false);
      expect(result!.updatedAt).toBe(1700000000000);
    });

    it('should return null for an unknown model ID', async () => {
      const result = await getModelMetadata(db as any, 'nonexistent-model');

      expect(result).toBeNull();
    });

    it('should correctly map supports_reasoning=1 to true', async () => {
      db.__store['o1-pro'] = {
        model_id: 'o1-pro',
        context_window: 200000,
        input_price: 150.0,
        output_price: 600.0,
        cached_input_price: null,
        cached_output_price: null,
        supports_reasoning: 1,
        updated_at: 1700000000000,
      };

      const result = await getModelMetadata(db as any, 'o1-pro');

      expect(result!.supportsReasoning).toBe(true);
    });
  });

  describe('refreshMetadataIfStale', () => {
    it('should fetch when no cached data exists', async () => {
      db.__maxUpdatedAt.value = 0;
      db.getFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT MAX(updated_at)')) {
          return { updated_at: null };
        }
        return null;
      });

      const remoteData: RemoteModelMetadata[] = [
        { model_id: 'gpt-4o', context_window: 128000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      await refreshMetadataIfStale(db as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should fetch when cache is older than maxAgeMs', async () => {
      const oldTimestamp = Date.now() - 48 * 60 * 60 * 1000; // 48 hours ago
      db.getFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT MAX(updated_at)')) {
          return { updated_at: oldTimestamp };
        }
        return null;
      });

      const remoteData: RemoteModelMetadata[] = [
        { model_id: 'gpt-4o', context_window: 128000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      await refreshMetadataIfStale(db as any);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT fetch when cache is fresh', async () => {
      const recentTimestamp = Date.now() - 1000; // 1 second ago
      db.getFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT MAX(updated_at)')) {
          return { updated_at: recentTimestamp };
        }
        return null;
      });

      await refreshMetadataIfStale(db as any);

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should respect custom maxAgeMs parameter', async () => {
      const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
      db.getFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT MAX(updated_at)')) {
          return { updated_at: threeMinutesAgo };
        }
        return null;
      });

      const remoteData: RemoteModelMetadata[] = [
        { model_id: 'gpt-4o', context_window: 128000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => remoteData,
      });

      // Custom maxAge of 2 minutes — cache is 3 min old, should refresh
      await refreshMetadataIfStale(db as any, 2 * 60 * 1000);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT fetch when cache is within custom maxAgeMs', async () => {
      const oneMinuteAgo = Date.now() - 60 * 1000;
      db.getFirstAsync.mockImplementation(async (sql: string) => {
        if (sql.includes('SELECT MAX(updated_at)')) {
          return { updated_at: oneMinuteAgo };
        }
        return null;
      });

      // Custom maxAge of 5 minutes — cache is 1 min old, should NOT refresh
      await refreshMetadataIfStale(db as any, 5 * 60 * 1000);

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
