import type { SQLiteDatabase } from 'expo-sqlite';
import { MODEL_METADATA_URL, METADATA_MAX_AGE_MS } from '../constants/defaults';

/**
 * Shape of a single model entry in the remote metadata JSON.
 */
export interface RemoteModelMetadata {
  model_id: string;
  context_window?: number | null;
  input_price?: number | null;
  output_price?: number | null;
  cached_input_price?: number | null;
  cached_output_price?: number | null;
  supports_reasoning?: boolean | number;
}

/**
 * Application-level model metadata returned by the lookup function.
 */
export interface ModelMetadata {
  modelId: string;
  contextWindow: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  cachedInputPrice: number | null;
  cachedOutputPrice: number | null;
  supportsReasoning: boolean;
  updatedAt: number;
}

/**
 * Fetches the remote metadata JSON and upserts all entries into
 * the model_metadata SQLite table.
 *
 * On fetch failure, silently returns without modifying the cache —
 * consumers will continue using whatever data was previously cached.
 */
export async function fetchAndCacheMetadata(db: SQLiteDatabase): Promise<void> {
  let data: RemoteModelMetadata[];

  try {
    const response = await fetch(MODEL_METADATA_URL);
    if (!response.ok) {
      return; // Graceful failure — keep existing cache
    }
    data = await response.json();
  } catch {
    return; // Network error — keep existing cache
  }

  if (!Array.isArray(data)) {
    return; // Unexpected format — keep existing cache
  }

  const now = Date.now();

  for (const entry of data) {
    if (!entry.model_id || typeof entry.model_id !== 'string') {
      continue; // Skip invalid entries
    }

    const supportsReasoning = entry.supports_reasoning ? 1 : 0;

    await db.runAsync(
      `INSERT OR REPLACE INTO model_metadata
        (model_id, context_window, input_price, output_price, cached_input_price, cached_output_price, supports_reasoning, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.model_id,
        entry.context_window ?? null,
        entry.input_price ?? null,
        entry.output_price ?? null,
        entry.cached_input_price ?? null,
        entry.cached_output_price ?? null,
        supportsReasoning,
        now,
      ]
    );
  }
}

/**
 * Looks up cached metadata for a specific model by its ID.
 *
 * @returns The cached ModelMetadata if found, or null if the model ID
 *          does not exist in the cache.
 */
export async function getModelMetadata(
  db: SQLiteDatabase,
  modelId: string
): Promise<ModelMetadata | null> {
  const row = await db.getFirstAsync<{
    model_id: string;
    context_window: number | null;
    input_price: number | null;
    output_price: number | null;
    cached_input_price: number | null;
    cached_output_price: number | null;
    supports_reasoning: number;
    updated_at: number;
  }>('SELECT * FROM model_metadata WHERE model_id = ?', [modelId]);

  if (!row) {
    return null;
  }

  return {
    modelId: row.model_id,
    contextWindow: row.context_window,
    inputPrice: row.input_price,
    outputPrice: row.output_price,
    cachedInputPrice: row.cached_input_price,
    cachedOutputPrice: row.cached_output_price,
    supportsReasoning: row.supports_reasoning === 1,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches remote metadata only if the local cache is older than maxAgeMs.
 * If no cached data exists at all, fetches unconditionally.
 *
 * @param db - The SQLite database instance
 * @param maxAgeMs - Maximum cache age in milliseconds (default: 24 hours)
 */
export async function refreshMetadataIfStale(
  db: SQLiteDatabase,
  maxAgeMs: number = METADATA_MAX_AGE_MS
): Promise<void> {
  const row = await db.getFirstAsync<{ updated_at: number }>(
    'SELECT MAX(updated_at) as updated_at FROM model_metadata'
  );

  const lastUpdated = row?.updated_at ?? 0;
  const age = Date.now() - lastUpdated;

  if (age >= maxAgeMs || lastUpdated === 0) {
    await fetchAndCacheMetadata(db);
  }
}
