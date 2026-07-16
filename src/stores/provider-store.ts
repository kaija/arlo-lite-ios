import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createProvider,
  getAllProviders,
  updateProvider as updateProviderInDb,
  deleteProvider as deleteProviderInDb,
} from '@/database/repositories/provider-repo';
import type {
  Provider,
  GenerationParams,
  CreateProviderData,
  UpdateProviderData,
} from '@/database/repositories/provider-repo';
import {
  storeApiKey,
  deleteApiKey,
} from '@/database/secure-store';
import { testConnection as testConnectionService } from '@/services/completion-service';
import { ProviderError } from '@/providers/errors';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export type { Provider, GenerationParams, CreateProviderData, UpdateProviderData };

/**
 * Connection status for a provider's API key / endpoint validation.
 */
export type ConnectionStatus = 'untested' | 'connected' | 'failed';

/**
 * State of a provider's connection test result.
 */
export interface ProviderConnectionState {
  status: ConnectionStatus;
  /** Short error message when status === 'failed' (max 80 chars). */
  error?: string;
  /** Unix timestamp (ms) of the last test attempt. */
  lastTestedAt?: number;
}

/**
 * Model configuration stored in the models table.
 */
export interface ModelConfig {
  id: string;
  providerId: string;
  modelId: string;
  displayName: string;
  contextWindow: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  cachedInputPrice: number | null;
  cachedOutputPrice: number | null;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
  supportsImageGeneration: boolean;
  supportsFileInput: boolean;
}

/**
 * Data required to create a new model (id is generated automatically).
 */
export type CreateModelData = Omit<ModelConfig, 'id'>;

/**
 * Row shape returned from the models SQLite table.
 */
interface ModelRow {
  id: string;
  provider_id: string;
  model_id: string;
  display_name: string;
  context_window: number | null;
  input_price: number | null;
  output_price: number | null;
  cached_input_price: number | null;
  cached_output_price: number | null;
  supports_reasoning: number;
  supports_image_input: number;
  supports_image_generation: number;
  supports_file_input: number;
}

function rowToModelConfig(row: ModelRow): ModelConfig {
  return {
    id: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
    displayName: row.display_name,
    contextWindow: row.context_window,
    inputPrice: row.input_price,
    outputPrice: row.output_price,
    cachedInputPrice: row.cached_input_price,
    cachedOutputPrice: row.cached_output_price,
    supportsReasoning: row.supports_reasoning === 1,
    supportsImageInput: row.supports_image_input === 1,
    supportsImageGeneration: row.supports_image_generation === 1,
    supportsFileInput: row.supports_file_input === 1,
  };
}

/**
 * Provider store state and actions.
 */
export interface ProviderStore {
  /** Database instance reference */
  db: SQLiteDatabase | null;

  /** All configured providers */
  providers: Provider[];

  /** All registered models across providers */
  models: ModelConfig[];

  /** Connection test results keyed by provider ID */
  connectionStatuses: Record<string, ProviderConnectionState>;

  /** Set the database instance for persistence */
  setDatabase: (db: SQLiteDatabase) => void;

  /** Load providers from the database */
  loadProviders: () => Promise<void>;

  /** Load all models from the database */
  loadModels: () => Promise<void>;

  /** Add a new provider, optionally storing its API key */
  addProvider: (data: CreateProviderData, apiKey?: string) => Promise<Provider>;

  /** Update a provider's configuration */
  updateProvider: (id: string, updates: UpdateProviderData) => Promise<void>;

  /** Delete a provider and its associated API key (models cascade in DB) */
  deleteProvider: (id: string) => Promise<void>;

  /** Add a model to a provider */
  addModel: (data: CreateModelData) => Promise<ModelConfig>;

  /** Delete a model */
  deleteModel: (id: string) => Promise<void>;

  /** Test connection for a provider by validating API key / endpoint reachability */
  testConnection: (providerId: string) => Promise<void>;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  db: null,
  providers: [],
  models: [],
  connectionStatuses: {},

  setDatabase: (db: SQLiteDatabase) => {
    set({ db });
  },

  loadProviders: async () => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    const providers = await getAllProviders(db);
    set({ providers });
  },

  loadModels: async () => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    const rows = await db.getAllAsync<ModelRow>('SELECT * FROM models');
    const models = rows.map(rowToModelConfig);
    set({ models });
  },

  addProvider: async (data: CreateProviderData, apiKey?: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const provider = await createProvider(db, data);

    if (apiKey) {
      await storeApiKey(provider.id, apiKey);
    }

    set((state) => ({
      providers: [...state.providers, provider],
    }));

    return provider;
  },

  updateProvider: async (id: string, updates: UpdateProviderData) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const updated = await updateProviderInDb(db, id, updates);
    if (!updated) return;

    set((state) => ({
      providers: state.providers.map((p) => (p.id === id ? updated : p)),
    }));
  },

  deleteProvider: async (id: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    await deleteProviderInDb(db, id);
    await deleteApiKey(id);

    set((state) => ({
      providers: state.providers.filter((p) => p.id !== id),
      models: state.models.filter((m) => m.providerId !== id),
    }));
  },

  addModel: async (data: CreateModelData) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const id = generateId();
    const now = getCurrentTimestamp();

    await db.runAsync(
      `INSERT INTO models (id, provider_id, model_id, display_name, context_window, input_price, output_price, cached_input_price, cached_output_price, supports_reasoning, supports_image_input, supports_image_generation, supports_file_input)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      data.providerId,
      data.modelId,
      data.displayName,
      data.contextWindow,
      data.inputPrice,
      data.outputPrice,
      data.cachedInputPrice,
      data.cachedOutputPrice,
      data.supportsReasoning ? 1 : 0,
      data.supportsImageInput ? 1 : 0,
      data.supportsImageGeneration ? 1 : 0,
      data.supportsFileInput ? 1 : 0
    );

    const model: ModelConfig = { id, ...data };

    set((state) => ({
      models: [...state.models, model],
    }));

    return model;
  },

  deleteModel: async (id: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    await db.runAsync('DELETE FROM models WHERE id = ?', id);

    set((state) => ({
      models: state.models.filter((m) => m.id !== id),
    }));
  },

  testConnection: async (providerId: string) => {
    const { providers } = get();
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [providerId]: {
            status: 'failed',
            error: 'Provider not found',
            lastTestedAt: Date.now(),
          },
        },
      }));
      return;
    }

    try {
      await testConnectionService(providerId, {
        id: provider.id,
        type: provider.type,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiMode: provider.apiMode ?? undefined,
        streamingEnabled: provider.streamingEnabled,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      });

      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [providerId]: {
            status: 'connected',
            error: undefined,
            lastTestedAt: Date.now(),
          },
        },
      }));
    } catch (error) {
      let errorMessage = 'Connection failed';

      if (error instanceof ProviderError) {
        errorMessage = error.message.length > 80
          ? error.message.slice(0, 77) + '...'
          : error.message;
      } else if (error instanceof Error) {
        errorMessage = error.message.length > 80
          ? error.message.slice(0, 77) + '...'
          : error.message;
      }

      set((state) => ({
        connectionStatuses: {
          ...state.connectionStatuses,
          [providerId]: {
            status: 'failed',
            error: errorMessage,
            lastTestedAt: Date.now(),
          },
        },
      }));
    }
  },
}));
