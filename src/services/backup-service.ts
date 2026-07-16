import type { SQLiteDatabase } from 'expo-sqlite';
import type { Provider } from '@/database/repositories/provider-repo';
import type { Session } from '@/database/repositories/session-repo';
import type { Message } from '@/database/repositories/message-repo';
import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';
import type { ModelConfig } from '@/stores/provider-store';
import type { ThemeMode } from '@/stores/settings-store';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * App settings included in backup payload.
 */
export interface AppSettings {
  theme: ThemeMode;
  locale: string;
  defaultSystemPromptId: string | null;
}

/**
 * The full backup payload exchanged between devices.
 * API keys are never included — they live exclusively in secure storage.
 * File attachments and generated images are excluded from sync.
 */
export interface BackupPayload {
  version: number;
  exportedAt: number;
  providers: Provider[];
  models: ModelConfig[];
  sessions: Session[];
  messages: Message[];
  systemPrompts: SystemPrompt[];
  settings: AppSettings;
}

/**
 * Current backup format version.
 */
export const BACKUP_VERSION = 1;

// ─── Row types for raw DB queries ────────────────────────────────────────────

interface ProviderRow {
  id: string;
  type: string;
  name: string;
  base_url: string;
  api_mode: string | null;
  streaming_enabled: number;
  generation_params: string;
  created_at: number;
  updated_at: number;
}

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

interface SessionRow {
  id: string;
  title: string;
  provider_id: string;
  model_id: string;
  system_prompt_id: string | null;
  thinking_level: string | null;
  total_cost: number;
  token_count: number;
  created_at: number;
  updated_at: number;
}

interface MessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  thinking_content: string | null;
  provider_id: string;
  model_id: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  cached_tokens: number | null;
  cost: number | null;
  created_at: number;
}

interface SystemPromptRow {
  id: string;
  name: string;
  content: string;
  is_default: number;
  created_at: number;
  updated_at: number;
}

interface SyncLogRow {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  synced: number;
  created_at: number;
}

// ─── Export ───────────────────────────────────────────────────────────────────

/**
 * Export all syncable data from the local database as a BackupPayload.
 * - Excludes API keys (they're only in secure storage)
 * - Excludes file attachment binary data (not synced)
 * - Includes providers, models, sessions, messages, system prompts, and settings
 */
export async function exportBackupPayload(
  db: SQLiteDatabase,
  settings: AppSettings
): Promise<BackupPayload> {
  const providerRows = await db.getAllAsync<ProviderRow>('SELECT * FROM providers');
  const modelRows = await db.getAllAsync<ModelRow>('SELECT * FROM models');
  const sessionRows = await db.getAllAsync<SessionRow>('SELECT * FROM sessions');
  const messageRows = await db.getAllAsync<MessageRow>('SELECT * FROM messages');
  const promptRows = await db.getAllAsync<SystemPromptRow>('SELECT * FROM system_prompts');

  const providers: Provider[] = providerRows.map((row) => ({
    id: row.id,
    type: row.type as Provider['type'],
    name: row.name,
    baseUrl: row.base_url,
    apiMode: row.api_mode as Provider['apiMode'],
    streamingEnabled: row.streaming_enabled === 1,
    generationParams: row.generation_params
      ? JSON.parse(row.generation_params)
      : { temperature: 0.7, maxTokens: 4096 },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const models: ModelConfig[] = modelRows.map((row) => ({
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
  }));

  const sessions: Session[] = sessionRows.map((row) => ({
    id: row.id,
    title: row.title,
    providerId: row.provider_id,
    modelId: row.model_id,
    systemPromptId: row.system_prompt_id,
    thinkingLevel: row.thinking_level ?? null,
    totalCost: row.total_cost,
    tokenCount: row.token_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const messages: Message[] = messageRows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    role: row.role as Message['role'],
    content: row.content,
    thinkingContent: row.thinking_content,
    providerId: row.provider_id,
    modelId: row.model_id,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    cachedTokens: row.cached_tokens,
    cost: row.cost,
    createdAt: row.created_at,
  }));

  const systemPrompts: SystemPrompt[] = promptRows.map((row) => ({
    id: row.id,
    name: row.name,
    content: row.content,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return {
    version: BACKUP_VERSION,
    exportedAt: getCurrentTimestamp(),
    providers,
    models,
    sessions,
    messages,
    systemPrompts,
    settings,
  };
}

// ─── Import with last-write-wins conflict resolution ──────────────────────────

/**
 * Import a backup payload into the local database using last-write-wins
 * conflict resolution. For each record:
 * - If local updatedAt > incoming updatedAt → keep local
 * - Otherwise → replace with incoming
 *
 * Session deletions logged in sync_log are propagated:
 * if a session was deleted locally (recorded in sync_log), it won't be
 * re-imported from the backup.
 */
export async function importBackupPayload(
  db: SQLiteDatabase,
  payload: BackupPayload
): Promise<void> {
  // Gather locally-deleted session IDs from sync_log
  const deletedRows = await db.getAllAsync<SyncLogRow>(
    "SELECT * FROM sync_log WHERE table_name = 'sessions' AND action = 'delete'"
  );
  const deletedSessionIds = new Set(deletedRows.map((r) => r.record_id));

  // Import providers (last-write-wins by updatedAt)
  for (const provider of payload.providers) {
    const existing = await db.getFirstAsync<ProviderRow>(
      'SELECT * FROM providers WHERE id = ?',
      provider.id
    );

    if (existing) {
      if (provider.updatedAt > existing.updated_at) {
        await db.runAsync(
          `UPDATE providers SET type = ?, name = ?, base_url = ?, api_mode = ?, streaming_enabled = ?, updated_at = ?
           WHERE id = ?`,
          provider.type,
          provider.name,
          provider.baseUrl,
          provider.apiMode ?? null,
          provider.streamingEnabled ? 1 : 0,
          provider.updatedAt,
          provider.id
        );
      }
    } else {
      await db.runAsync(
        `INSERT INTO providers (id, type, name, base_url, api_mode, streaming_enabled, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        provider.id,
        provider.type,
        provider.name,
        provider.baseUrl,
        provider.apiMode ?? null,
        provider.streamingEnabled ? 1 : 0,
        provider.createdAt,
        provider.updatedAt
      );
    }
  }

  // Import models (upsert; models don't have updatedAt — replace if exists)
  for (const model of payload.models) {
    const existing = await db.getFirstAsync<ModelRow>(
      'SELECT * FROM models WHERE id = ?',
      model.id
    );

    if (existing) {
      await db.runAsync(
        `UPDATE models SET provider_id = ?, model_id = ?, display_name = ?, context_window = ?,
         input_price = ?, output_price = ?, cached_input_price = ?, cached_output_price = ?,
         supports_reasoning = ?, supports_image_input = ?, supports_image_generation = ?, supports_file_input = ?
         WHERE id = ?`,
        model.providerId,
        model.modelId,
        model.displayName,
        model.contextWindow,
        model.inputPrice,
        model.outputPrice,
        model.cachedInputPrice,
        model.cachedOutputPrice,
        model.supportsReasoning ? 1 : 0,
        model.supportsImageInput ? 1 : 0,
        model.supportsImageGeneration ? 1 : 0,
        model.supportsFileInput ? 1 : 0,
        model.id
      );
    } else {
      await db.runAsync(
        `INSERT INTO models (id, provider_id, model_id, display_name, context_window, input_price, output_price,
         cached_input_price, cached_output_price, supports_reasoning, supports_image_input, supports_image_generation, supports_file_input)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        model.id,
        model.providerId,
        model.modelId,
        model.displayName,
        model.contextWindow,
        model.inputPrice,
        model.outputPrice,
        model.cachedInputPrice,
        model.cachedOutputPrice,
        model.supportsReasoning ? 1 : 0,
        model.supportsImageInput ? 1 : 0,
        model.supportsImageGeneration ? 1 : 0,
        model.supportsFileInput ? 1 : 0
      );
    }
  }

  // Import sessions (last-write-wins, skip if locally deleted)
  for (const session of payload.sessions) {
    // Skip sessions that were deleted locally — propagate deletion
    if (deletedSessionIds.has(session.id)) {
      continue;
    }

    const existing = await db.getFirstAsync<SessionRow>(
      'SELECT * FROM sessions WHERE id = ?',
      session.id
    );

    if (existing) {
      if (session.updatedAt > existing.updated_at) {
        await db.runAsync(
          `UPDATE sessions SET title = ?, provider_id = ?, model_id = ?, system_prompt_id = ?,
           total_cost = ?, token_count = ?, updated_at = ?
           WHERE id = ?`,
          session.title,
          session.providerId,
          session.modelId,
          session.systemPromptId ?? null,
          session.totalCost,
          session.tokenCount,
          session.updatedAt,
          session.id
        );
      }
    } else {
      await db.runAsync(
        `INSERT INTO sessions (id, title, provider_id, model_id, system_prompt_id, total_cost, token_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        session.title,
        session.providerId,
        session.modelId,
        session.systemPromptId ?? null,
        session.totalCost,
        session.tokenCount,
        session.createdAt,
        session.updatedAt
      );
    }
  }

  // Import messages (insert if not exists — messages are append-only)
  for (const message of payload.messages) {
    // Skip messages for locally-deleted sessions
    if (deletedSessionIds.has(message.sessionId)) {
      continue;
    }

    const existing = await db.getFirstAsync<MessageRow>(
      'SELECT * FROM messages WHERE id = ?',
      message.id
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO messages (id, session_id, role, content, thinking_content, provider_id, model_id,
         prompt_tokens, completion_tokens, total_tokens, cached_tokens, cost, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        message.id,
        message.sessionId,
        message.role,
        message.content,
        message.thinkingContent ?? null,
        message.providerId,
        message.modelId,
        message.promptTokens ?? null,
        message.completionTokens ?? null,
        message.totalTokens ?? null,
        message.cachedTokens ?? null,
        message.cost ?? null,
        message.createdAt
      );
    }
  }

  // Import system prompts (last-write-wins by updatedAt)
  for (const prompt of payload.systemPrompts) {
    const existing = await db.getFirstAsync<SystemPromptRow>(
      'SELECT * FROM system_prompts WHERE id = ?',
      prompt.id
    );

    if (existing) {
      if (prompt.updatedAt > existing.updated_at) {
        await db.runAsync(
          `UPDATE system_prompts SET name = ?, content = ?, is_default = ?, updated_at = ?
           WHERE id = ?`,
          prompt.name,
          prompt.content,
          prompt.isDefault ? 1 : 0,
          prompt.updatedAt,
          prompt.id
        );
      }
    } else {
      await db.runAsync(
        `INSERT INTO system_prompts (id, name, content, is_default, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        prompt.id,
        prompt.name,
        prompt.content,
        prompt.isDefault ? 1 : 0,
        prompt.createdAt,
        prompt.updatedAt
      );
    }
  }

  // Process session deletions from the incoming backup:
  // If the incoming payload doesn't include a session that exists locally,
  // and the incoming export is newer than the local session, the session
  // may have been deleted on the other device. However, we can't reliably
  // determine this from the payload alone — deletion propagation relies on
  // the sync_log entries that are exchanged separately or via the
  // deletedSessionIds field in the payload.
}

/**
 * Record a session deletion in the sync_log so it propagates to synced devices.
 */
export async function logSessionDeletion(
  db: SQLiteDatabase,
  sessionId: string
): Promise<void> {
  const id = generateId();
  const now = getCurrentTimestamp();

  await db.runAsync(
    `INSERT INTO sync_log (id, table_name, record_id, action, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    'sessions',
    sessionId,
    'delete',
    0,
    now
  );
}

/**
 * Get all unsynced deletion log entries for propagation to other devices.
 */
export async function getUnsyncedDeletions(
  db: SQLiteDatabase
): Promise<Array<{ tableName: string; recordId: string; createdAt: number }>> {
  const rows = await db.getAllAsync<SyncLogRow>(
    "SELECT * FROM sync_log WHERE action = 'delete' AND synced = 0"
  );

  return rows.map((row) => ({
    tableName: row.table_name,
    recordId: row.record_id,
    createdAt: row.created_at,
  }));
}

/**
 * Mark sync_log entries as synced after successful propagation.
 */
export async function markDeletionsSynced(
  db: SQLiteDatabase,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;

  const placeholders = ids.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE sync_log SET synced = 1 WHERE id IN (${placeholders})`,
    ...ids
  );
}
