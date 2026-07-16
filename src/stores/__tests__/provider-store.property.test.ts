import * as fc from 'fast-check';
import { useProviderStore } from '../provider-store';
import type { Provider, GenerationParams } from '../provider-store';

/**
 * Property 3: Generation Params Schema Invariant
 *
 * **Validates: Requirements 2.1**
 *
 * For any provider in the ProviderStore, its generationParams.temperature
 * SHALL be a number in the range [0.0, 2.0] and its generationParams.maxTokens
 * SHALL be a positive integer. A newly created provider SHALL have
 * temperature 0.7 and maxTokens 4096 when generationParams are not provided.
 */

// Mock provider-repo
jest.mock('@/database/repositories/provider-repo', () => {
  const DEFAULT_GENERATION_PARAMS = { temperature: 0.7, maxTokens: 4096 };

  return {
    createProvider: jest.fn((_db, data) => {
      const generationParams = data.generationParams ?? { ...DEFAULT_GENERATION_PARAMS };
      return Promise.resolve({
        id: `provider-${Date.now()}-${Math.random()}`,
        type: data.type,
        name: data.name,
        baseUrl: data.baseUrl,
        apiMode: data.apiMode ?? null,
        streamingEnabled: data.streamingEnabled !== false,
        generationParams,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }),
    getAllProviders: jest.fn(() => Promise.resolve([])),
    updateProvider: jest.fn(),
    deleteProvider: jest.fn(),
  };
});

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
jest.mock('@/providers/errors', () => ({
  ProviderError: class ProviderError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ProviderError';
    }
  },
}));

// Mock uuid and date
jest.mock('@/utils/uuid', () => ({
  generateId: jest.fn(() => `id-${Math.random()}`),
}));

jest.mock('@/utils/date', () => ({
  getCurrentTimestamp: jest.fn(() => Date.now()),
}));

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

describe('Property 3: Generation Params Schema Invariant', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    useProviderStore.setState({
      db: null,
      providers: [],
      models: [],
      connectionStatuses: {},
    });
  });

  it('temperature is always in [0.0, 2.0] for any provider created with valid params', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 2, noNaN: true }),
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('openai', 'anthropic', 'custom'),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (temperature, maxTokens, type, name) => {
          useProviderStore.setState({ db: mockDb, providers: [], models: [], connectionStatuses: {} });

          const provider = await useProviderStore.getState().addProvider({
            type: type as 'openai' | 'anthropic' | 'custom',
            name,
            baseUrl: 'https://api.example.com',
            generationParams: { temperature, maxTokens },
          });

          expect(provider.generationParams.temperature).toBeGreaterThanOrEqual(0.0);
          expect(provider.generationParams.temperature).toBeLessThanOrEqual(2.0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('maxTokens is always a positive integer for any provider created with valid params', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 2, noNaN: true }),
        fc.integer({ min: 1, max: 100000 }),
        fc.constantFrom('openai', 'anthropic', 'custom'),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (temperature, maxTokens, type, name) => {
          useProviderStore.setState({ db: mockDb, providers: [], models: [], connectionStatuses: {} });

          const provider = await useProviderStore.getState().addProvider({
            type: type as 'openai' | 'anthropic' | 'custom',
            name,
            baseUrl: 'https://api.example.com',
            generationParams: { temperature, maxTokens },
          });

          expect(provider.generationParams.maxTokens).toBeGreaterThan(0);
          expect(Number.isInteger(provider.generationParams.maxTokens)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('defaults to temperature 0.7 and maxTokens 4096 when generationParams not provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('openai', 'anthropic', 'custom'),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (type, name) => {
          useProviderStore.setState({ db: mockDb, providers: [], models: [], connectionStatuses: {} });

          const provider = await useProviderStore.getState().addProvider({
            type: type as 'openai' | 'anthropic' | 'custom',
            name,
            baseUrl: 'https://api.example.com',
            // No generationParams provided — should use defaults
          });

          expect(provider.generationParams.temperature).toBe(0.7);
          expect(provider.generationParams.maxTokens).toBe(4096);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('provider in store state always has valid generationParams after addProvider', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 2, noNaN: true }),
        fc.integer({ min: 1, max: 100000 }),
        async (temperature, maxTokens) => {
          useProviderStore.setState({ db: mockDb, providers: [], models: [], connectionStatuses: {} });

          await useProviderStore.getState().addProvider({
            type: 'openai',
            name: 'Test Provider',
            baseUrl: 'https://api.example.com',
            generationParams: { temperature, maxTokens },
          });

          const providers = useProviderStore.getState().providers;
          const stored = providers[providers.length - 1];
          expect(stored.generationParams.temperature).toBeGreaterThanOrEqual(0.0);
          expect(stored.generationParams.temperature).toBeLessThanOrEqual(2.0);
          expect(stored.generationParams.maxTokens).toBeGreaterThan(0);
          expect(Number.isInteger(stored.generationParams.maxTokens)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
