import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export type ProviderType = 'openai' | 'anthropic' | 'custom';
export type OpenAIApiMode = 'responses' | 'chat-completions';

export interface ProviderRow {
  id: string;
  type: ProviderType;
  name: string;
  base_url: string;
  api_mode: OpenAIApiMode | null;
  streaming_enabled: number;
  created_at: number;
  updated_at: number;
}

export interface CreateProviderData {
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiMode?: OpenAIApiMode;
  streamingEnabled?: boolean;
}

export interface UpdateProviderData {
  name?: string;
  baseUrl?: string;
  apiMode?: OpenAIApiMode | null;
  streamingEnabled?: boolean;
}

export interface Provider {
  id: string;
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiMode: OpenAIApiMode | null;
  streamingEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

function rowToProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    baseUrl: row.base_url,
    apiMode: row.api_mode,
    streamingEnabled: row.streaming_enabled === 1,
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

  await db.runAsync(
    `INSERT INTO providers (id, type, name, base_url, api_mode, streaming_enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.type,
    data.name,
    data.baseUrl,
    data.apiMode ?? null,
    streamingEnabled,
    now,
    now
  );

  return {
    id,
    type: data.type,
    name: data.name,
    baseUrl: data.baseUrl,
    apiMode: data.apiMode ?? null,
    streamingEnabled: streamingEnabled === 1,
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
  const params: unknown[] = [];

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
