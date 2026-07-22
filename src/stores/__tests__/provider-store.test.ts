import { useProviderStore } from '../provider-store';
import type { ProviderStore, CreateModelData } from '../provider-store';

// Mock provider-repo
jest.mock('@/database/repositories/provider-repo', () => ({
  createProvider: jest.fn(),
  getAllProviders: jest.fn(),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
}));

// Mock secure-store
jest.mock('@/database/secure-store', () => ({
  storeApiKey: jest.fn(() => Promise.resolve()),
  deleteApiKey: jest.fn(() => Promise.resolve()),
}));

// Mock completion-service
jest.mock('@/services/completion-service', () => ({
  testConnection: jest.fn(() => Promise.resolve(true)),
}));

// Mock providers/errors
jest.mock('@/providers/errors', () => {
  class ProviderError extends Error {
    readonly category: string;
    readonly retryAfterSeconds: number | null;
    constructor(message: string, category: string, retryAfterSeconds: number | null = null) {
      super(message);
      this.name = 'ProviderError';
      this.category = category;
      this.retryAfterSeconds = retryAfterSeconds;
    }
  }
  return { ProviderError };
});

// Mock uuid and date
jest.mock('@/utils/uuid', () => ({
  generateId: jest.fn(() => 'mock-model-id'),
}));

jest.mock('@/utils/date', () => ({
  getCurrentTimestamp: jest.fn(() => 1700000000000),
}));

import {
  createProvider as createProviderInDb,
  getAllProviders as getAllProvidersFromDb,
  updateProvider as updateProviderInDb,
  deleteProvider as deleteProviderInDb,
} from '@/database/repositories/provider-repo';
import { storeApiKey, deleteApiKey } from '@/database/secure-store';
import { testConnection as testConnectionService } from '@/services/completion-service';
import { ProviderError } from '@/providers/errors';
import { generateId } from '@/utils/uuid';

const mockCreateProvider = createProviderInDb as jest.MockedFunction<typeof createProviderInDb>;
const mockGetAllProviders = getAllProvidersFromDb as jest.MockedFunction<typeof getAllProvidersFromDb>;
const mockUpdateProvider = updateProviderInDb as jest.MockedFunction<typeof updateProviderInDb>;
const mockDeleteProvider = deleteProviderInDb as jest.MockedFunction<typeof deleteProviderInDb>;
const mockStoreApiKey = storeApiKey as jest.MockedFunction<typeof storeApiKey>;
const mockDeleteApiKey = deleteApiKey as jest.MockedFunction<typeof deleteApiKey>;
const mockGenerateId = generateId as jest.MockedFunction<typeof generateId>;
const mockTestConnection = testConnectionService as jest.MockedFunction<typeof testConnectionService>;

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

describe('provider-store', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    // Reset Zustand store state between tests
    useProviderStore.setState({
      db: null,
      providers: [],
      models: [],
      connectionStatuses: {},
    });
  });

  describe('setDatabase', () => {
    it('stores the database reference', () => {
      useProviderStore.getState().setDatabase(mockDb);
      expect(useProviderStore.getState().db).toBe(mockDb);
    });
  });

  describe('loadProviders', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().loadProviders()
      ).rejects.toThrow('Database not initialized');
    });

    it('loads providers from the database', async () => {
      const providers = [
        { id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiMode: 'responses' as const, generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100 },
        { id: 'p2', type: 'anthropic' as const, preset: 'anthropic' as const, name: 'Anthropic', baseUrl: 'https://api.anthropic.com', apiMode: null, generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 200, updatedAt: 200 },
      ];
      mockGetAllProviders.mockResolvedValue(providers);

      useProviderStore.getState().setDatabase(mockDb);
      await useProviderStore.getState().loadProviders();

      expect(mockGetAllProviders).toHaveBeenCalledWith(mockDb);
      expect(useProviderStore.getState().providers).toEqual(providers);
    });
  });

  describe('loadModels', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().loadModels()
      ).rejects.toThrow('Database not initialized');
    });

    it('loads models from the database and maps rows', async () => {
      const rows = [
        {
          id: 'm1', provider_id: 'p1', model_id: 'gpt-4o', display_name: 'GPT-4o',
          context_window: 128000, input_price: 2.5, output_price: 10.0,
          cached_input_price: 1.25, cached_output_price: null,
          supports_reasoning: 0, supports_image_input: 1,
          supports_image_generation: 0, supports_file_input: 1,
          supports_tool_use: 0,
        },
      ];
      mockDb.getAllAsync.mockResolvedValue(rows);

      useProviderStore.getState().setDatabase(mockDb);
      await useProviderStore.getState().loadModels();

      const models = useProviderStore.getState().models;
      expect(models).toHaveLength(1);
      expect(models[0]).toEqual({
        id: 'm1',
        providerId: 'p1',
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        inputPrice: 2.5,
        outputPrice: 10.0,
        cachedInputPrice: 1.25,
        cachedOutputPrice: null,
        supportsReasoning: false,
        supportsImageInput: true,
        supportsImageGeneration: false,
        supportsFileInput: true,
        supportsToolUse: false,
      });
    });
  });

  describe('addProvider', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().addProvider({
          type: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
        })
      ).rejects.toThrow('Database not initialized');
    });

    it('creates provider in DB and adds to state', async () => {
      const newProvider = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', apiMode: 'responses' as const,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 1700000000000, updatedAt: 1700000000000,
      };
      mockCreateProvider.mockResolvedValue(newProvider);

      useProviderStore.getState().setDatabase(mockDb);
      const result = await useProviderStore.getState().addProvider({
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiMode: 'responses',
      });

      expect(mockCreateProvider).toHaveBeenCalledWith(mockDb, {
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiMode: 'responses',
      });
      expect(result).toEqual(newProvider);
      expect(useProviderStore.getState().providers).toEqual([newProvider]);
    });

    it('stores API key in secure store when provided', async () => {
      const newProvider = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', apiMode: null,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 1700000000000, updatedAt: 1700000000000,
      };
      mockCreateProvider.mockResolvedValue(newProvider);

      useProviderStore.getState().setDatabase(mockDb);
      await useProviderStore.getState().addProvider(
        { type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
        'sk-test-key-123'
      );

      expect(mockStoreApiKey).toHaveBeenCalledWith('p1', 'sk-test-key-123');
    });

    it('does not store API key when not provided', async () => {
      const newProvider = {
        id: 'p1', type: 'anthropic' as const, preset: 'anthropic' as const, name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com', apiMode: null,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 1700000000000, updatedAt: 1700000000000,
      };
      mockCreateProvider.mockResolvedValue(newProvider);

      useProviderStore.getState().setDatabase(mockDb);
      await useProviderStore.getState().addProvider({
        type: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
      });

      expect(mockStoreApiKey).not.toHaveBeenCalled();
    });
  });

  describe('updateProvider', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().updateProvider('p1', { name: 'New' })
      ).rejects.toThrow('Database not initialized');
    });

    it('updates provider in DB and updates state', async () => {
      const existingProvider = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', apiMode: null,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100,
      };
      const updatedProvider = { ...existingProvider, name: 'OpenAI Updated', updatedAt: 200 };
      mockUpdateProvider.mockResolvedValue(updatedProvider);

      useProviderStore.setState({ db: mockDb, providers: [existingProvider] });
      await useProviderStore.getState().updateProvider('p1', { name: 'OpenAI Updated' });

      expect(mockUpdateProvider).toHaveBeenCalledWith(mockDb, 'p1', { name: 'OpenAI Updated' });
      expect(useProviderStore.getState().providers[0].name).toBe('OpenAI Updated');
    });

    it('does nothing when update returns null', async () => {
      const existingProvider = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', apiMode: null,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100,
      };
      mockUpdateProvider.mockResolvedValue(null);

      useProviderStore.setState({ db: mockDb, providers: [existingProvider] });
      await useProviderStore.getState().updateProvider('p1', { name: 'Test' });

      expect(useProviderStore.getState().providers[0].name).toBe('OpenAI');
    });
  });

  describe('deleteProvider', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().deleteProvider('p1')
      ).rejects.toThrow('Database not initialized');
    });

    it('deletes provider from DB, removes API key, and removes from state', async () => {
      const provider = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1', apiMode: null,
        generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100,
      };
      const model = {
        id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
        contextWindow: 128000, inputPrice: 2.5, outputPrice: 10.0,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };
      mockDeleteProvider.mockResolvedValue();

      useProviderStore.setState({ db: mockDb, providers: [provider], models: [model] });
      await useProviderStore.getState().deleteProvider('p1');

      expect(mockDeleteProvider).toHaveBeenCalledWith(mockDb, 'p1');
      expect(mockDeleteApiKey).toHaveBeenCalledWith('p1');
      expect(useProviderStore.getState().providers).toEqual([]);
      expect(useProviderStore.getState().models).toEqual([]);
    });

    it('only removes models belonging to the deleted provider', async () => {
      const provider1 = {
        id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
        baseUrl: 'url1', apiMode: null, generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100,
      };
      const provider2 = {
        id: 'p2', type: 'anthropic' as const, preset: 'anthropic' as const, name: 'Anthropic',
        baseUrl: 'url2', apiMode: null, generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 200, updatedAt: 200,
      };
      const model1 = {
        id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };
      const model2 = {
        id: 'm2', providerId: 'p2', modelId: 'claude-3', displayName: 'Claude 3',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };
      mockDeleteProvider.mockResolvedValue();

      useProviderStore.setState({
        db: mockDb,
        providers: [provider1, provider2],
        models: [model1, model2],
      });
      await useProviderStore.getState().deleteProvider('p1');

      expect(useProviderStore.getState().providers).toEqual([provider2]);
      expect(useProviderStore.getState().models).toEqual([model2]);
    });
  });

  describe('addModel', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().addModel({
          providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
          contextWindow: null, inputPrice: null, outputPrice: null,
          cachedInputPrice: null, cachedOutputPrice: null,
          supportsReasoning: false, supportsImageInput: false,
          supportsImageGeneration: false, supportsFileInput: false,
        })
      ).rejects.toThrow('Database not initialized');
    });

    it('inserts model into DB and adds to state', async () => {
      mockGenerateId.mockReturnValue('mock-model-id');

      useProviderStore.getState().setDatabase(mockDb);
      const result = await useProviderStore.getState().addModel({
        providerId: 'p1',
        modelId: 'gpt-4o',
        displayName: 'GPT-4o',
        contextWindow: 128000,
        inputPrice: 2.5,
        outputPrice: 10.0,
        cachedInputPrice: 1.25,
        cachedOutputPrice: null,
        supportsReasoning: true,
        supportsImageInput: true,
        supportsImageGeneration: false,
        supportsFileInput: true,
      });

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO models'),
        'mock-model-id',
        'p1',
        'gpt-4o',
        'GPT-4o',
        128000,
        2.5,
        10.0,
        1.25,
        null,
        1,  // supports_reasoning
        1,  // supports_image_input
        0,  // supports_image_generation
        1,  // supports_file_input
        0   // supports_tool_use
      );
      expect(result.id).toBe('mock-model-id');
      expect(result.providerId).toBe('p1');
      expect(useProviderStore.getState().models).toEqual([result]);
    });

    it('appends to existing models', async () => {
      const existingModel = {
        id: 'm1', providerId: 'p1', modelId: 'gpt-3.5', displayName: 'GPT-3.5',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };
      mockGenerateId.mockReturnValue('m2');

      useProviderStore.setState({ db: mockDb, models: [existingModel] });
      await useProviderStore.getState().addModel({
        providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
        contextWindow: 128000, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      });

      expect(useProviderStore.getState().models).toHaveLength(2);
    });
  });

  describe('deleteModel', () => {
    it('throws when database is not set', async () => {
      await expect(
        useProviderStore.getState().deleteModel('m1')
      ).rejects.toThrow('Database not initialized');
    });

    it('deletes model from DB and removes from state', async () => {
      const model = {
        id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };

      useProviderStore.setState({ db: mockDb, models: [model] });
      await useProviderStore.getState().deleteModel('m1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'DELETE FROM models WHERE id = ?',
        'm1'
      );
      expect(useProviderStore.getState().models).toEqual([]);
    });

    it('only removes the specified model', async () => {
      const model1 = {
        id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };
      const model2 = {
        id: 'm2', providerId: 'p1', modelId: 'gpt-3.5', displayName: 'GPT-3.5',
        contextWindow: null, inputPrice: null, outputPrice: null,
        cachedInputPrice: null, cachedOutputPrice: null,
        supportsReasoning: false, supportsImageInput: false,
        supportsImageGeneration: false, supportsFileInput: false,
      };

      useProviderStore.setState({ db: mockDb, models: [model1, model2] });
      await useProviderStore.getState().deleteModel('m1');

      expect(useProviderStore.getState().models).toEqual([model2]);
    });
  });

  describe('testConnection', () => {
    const provider = {
      id: 'p1', type: 'openai' as const, preset: 'openai' as const, name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1', apiMode: 'responses' as const,
      generationParams: { maxTokens: 4096 }, streamingEnabled: true, reasoningMode: null, thinkingKwargs: null, createdAt: 100, updatedAt: 100,
    };

    it('sets status to connected on success', async () => {
      mockTestConnection.mockResolvedValue(true);

      useProviderStore.setState({ db: mockDb, providers: [provider] });
      await useProviderStore.getState().testConnection('p1');

      const statuses = useProviderStore.getState().connectionStatuses;
      expect(statuses['p1'].status).toBe('connected');
      expect(statuses['p1'].error).toBeUndefined();
      expect(statuses['p1'].lastTestedAt).toBeDefined();
    });

    it('sets status to failed with error message on ProviderError', async () => {
      mockTestConnection.mockRejectedValue(new ProviderError('API key not found', 'authentication'));

      useProviderStore.setState({ db: mockDb, providers: [provider] });
      await useProviderStore.getState().testConnection('p1');

      const statuses = useProviderStore.getState().connectionStatuses;
      expect(statuses['p1'].status).toBe('failed');
      expect(statuses['p1'].error).toBe('API key not found');
      expect(statuses['p1'].lastTestedAt).toBeDefined();
    });

    it('sets status to failed with generic message on unknown error', async () => {
      mockTestConnection.mockRejectedValue(new Error('Something went wrong'));

      useProviderStore.setState({ db: mockDb, providers: [provider] });
      await useProviderStore.getState().testConnection('p1');

      const statuses = useProviderStore.getState().connectionStatuses;
      expect(statuses['p1'].status).toBe('failed');
      expect(statuses['p1'].error).toBe('Something went wrong');
      expect(statuses['p1'].lastTestedAt).toBeDefined();
    });

    it('sets status to failed when provider not found', async () => {
      useProviderStore.setState({ db: mockDb, providers: [] });
      await useProviderStore.getState().testConnection('non-existent');

      const statuses = useProviderStore.getState().connectionStatuses;
      expect(statuses['non-existent'].status).toBe('failed');
      expect(statuses['non-existent'].error).toBe('Provider not found');
    });

    it('truncates long error messages to 80 chars', async () => {
      const longMessage = 'A'.repeat(100);
      mockTestConnection.mockRejectedValue(new ProviderError(longMessage, 'server'));

      useProviderStore.setState({ db: mockDb, providers: [provider] });
      await useProviderStore.getState().testConnection('p1');

      const statuses = useProviderStore.getState().connectionStatuses;
      expect(statuses['p1'].error!.length).toBeLessThanOrEqual(80);
      expect(statuses['p1'].error).toBe('A'.repeat(77) + '...');
    });

    it('calls testConnection service with correct provider config', async () => {
      mockTestConnection.mockResolvedValue(true);

      useProviderStore.setState({ db: mockDb, providers: [provider] });
      await useProviderStore.getState().testConnection('p1');

      expect(mockTestConnection).toHaveBeenCalledWith('p1', {
        id: 'p1',
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiMode: 'responses',
        streamingEnabled: true,
        createdAt: 100,
        updatedAt: 100,
      });
    });
  });
});
