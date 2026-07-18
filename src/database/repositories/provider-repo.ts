import type { SQLiteDatabase } from 'expo-sqlite';
import type { CustomReasoningMode } from '@/domain/thinking-mapper';
import { type PresetId, inferPresetFromType } from '@/constants/provider-presets';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export type ProviderType = 'openai' | 'anthropic' | 'custom';
export type OpenAIApiMode = 'responses' | 'chat-completions';

/** Per-provider generation settings sent with completion requests. */
export interface GenerationParams {
  /** Maximum tokens to generate, default 4096 */
  maxTokens: number;
}

const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  maxTokens: 4096,
};

export interface ProviderRow {
  id: string;
  type: ProviderType;
  name: string;
  base_url: string;
  api_mode: OpenAIApiMode | null;
  streaming_enabled: number;
  generation_params: string;
  reasoning_mode: string | null;
  thinking_kwargs: string | null;
  preset: string | null;
  created_at: number;
  updated_at: number;
}

export interface CreateProviderData {
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiMode?: OpenAIApiMode;
  streamingEnabled?: boolean;
  generationParams?: GenerationParams;
  reasoningMode?: CustomReasoningMode | null;
  thinkingKwargs?: Record<string, unknown> | null;
  preset?: PresetId;
}

export interface UpdateProviderData {
  name?: string;
  baseUrl?: string;
  apiMode?: OpenAIApiMode | null;
  streamingEnabled?: boolean;
  generationParams?: GenerationParams;
  reasoningMode?: CustomReasoningMode | null;
  thinkingKwargs?: Record<string, unknown> | null;
  preset?: PresetId;
}

export interface Provider {
  id: string;
  type: ProviderType;
  preset: PresetId;
  name: string;
  baseUrl: string;
  apiMode: OpenAIApiMode | null;
  streamingEnabled: boolean;
  generationParams: GenerationParams;
  reasoningMode: CustomReasoningMode | null;
  thinkingKwargs: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

function rowToProvider(row: ProviderRow): Provider {
  let generationParams: GenerationParams;
  try {
    generationParams = JSON.parse(row.generation_params) as GenerationParams;
  } catch {
    generationParams = { ...DEFAULT_GENERATION_PARAMS };
  }

  return {
    id: row.id,
    type: row.type,
    preset: (row.preset as PresetId) ?? inferPresetFromType(row.type),
    name: row.name,
    baseUrl: row.base_url,
    apiMode: row.api_mode,
    streamingEnabled: row.streaming_enabled === 1,
    generationParams,
    reasoningMode: (row.reasoning_mode as CustomReasoningMode | null) ?? null,
    thinkingKwargs: (() => {
      if (!row.thinking_kwargs) return null;
      try { return JSON.parse(row.thinking_kwargs); }
      catch { return null; }
    })(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a new provider record.
 */
export async function createProvider(
  db: SQLiteDatabase,
  data: CreateProviderData
): Promise<Provider> {
  const id = generateId();
  const now = getCurrentTimestamp();
  const streamingEnabled = data.streamingEnabled !== false ? 1 : 0;
  const generationParams = data.generationParams ?? { ...DEFAULT_GENERATION_PARAMS };
  const generationParamsJson = JSON.stringify(generationParams);
  const reasoningMode = data.reasoningMode ?? null;
  const thinkingKwargsJson = data.thinkingKwargs ? JSON.stringify(data.thinkingKwargs) : null;
  const preset = data.preset ?? null;

  await db.runAsync(
    `INSERT INTO providers (id, type, name, base_url, api_mode, streaming_enabled, generation_params, reasoning_mode, thinking_kwargs, preset, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.type,
    data.name,
    data.baseUrl,
    data.apiMode ?? null,
    streamingEnabled,
    generationParamsJson,
    reasoningMode,
    thinkingKwargsJson,
    preset,
    now,
    now
  );

  return {
    id,
    type: data.type,
    preset: data.preset ?? inferPresetFromType(data.type),
    name: data.name,
    baseUrl: data.baseUrl,
    apiMode: data.apiMode ?? null,
    streamingEnabled: streamingEnabled === 1,
    generationParams,
    reasoningMode: data.reasoningMode ?? null,
    thinkingKwargs: data.thinkingKwargs ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a single provider by ID.
 */
export async function getProvider(
  db: SQLiteDatabase,
  id: string
): Promise<Provider | null> {
  const row = await db.getFirstAsync<ProviderRow>(
    'SELECT * FROM providers WHERE id = ?',
    id
  );
  return row ? rowToProvider(row) : null;
}

/**
 * List all providers.
 */
export async function getAllProviders(
  db: SQLiteDatabase
): Promise<Provider[]> {
  const rows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers');
  return rows.map(rowToProvider);
}

/**
 * Partially update a provider.
 */
export async function updateProvider(
  db: SQLiteDatabase,
  id: string,
  updates: UpdateProviderData
): Promise<Provider | null> {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.baseUrl !== undefined) {
    setClauses.push('base_url = ?');
    params.push(updates.baseUrl);
  }
  if (updates.apiMode !== undefined) {
    setClauses.push('api_mode = ?');
    params.push(updates.apiMode);
  }
  if (updates.streamingEnabled !== undefined) {
    setClauses.push('streaming_enabled = ?');
    params.push(updates.streamingEnabled ? 1 : 0);
  }
  if (updates.generationParams !== undefined) {
    setClauses.push('generation_params = ?');
    params.push(JSON.stringify(updates.generationParams));
  }
  if (updates.reasoningMode !== undefined) {
    setClauses.push('reasoning_mode = ?');
    params.push(updates.reasoningMode);
  }
  if (updates.thinkingKwargs !== undefined) {
    setClauses.push('thinking_kwargs = ?');
    params.push(updates.thinkingKwargs ? JSON.stringify(updates.thinkingKwargs) : null);
  }
  if (updates.preset !== undefined) {
    setClauses.push('preset = ?');
    params.push(updates.preset);
  }

  if (setClauses.length === 0) {
    return getProvider(db, id);
  }

  const now = getCurrentTimestamp();
  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.runAsync(
    `UPDATE providers SET ${setClauses.join(', ')} WHERE id = ?`,
    ...params
  );

  return getProvider(db, id);
}

/**
 * Delete a provider by ID. Cascade deletion of models is handled by
 * the foreign key ON DELETE CASCADE constraint.
 */
export async function deleteProvider(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM providers WHERE id = ?', id);
}
