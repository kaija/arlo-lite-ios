import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export interface SessionRow {
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

export interface CreateSessionData {
  title: string;
  providerId: string;
  modelId: string;
  systemPromptId?: string | null;
}

export interface UpdateSessionData {
  title?: string;
  providerId?: string;
  modelId?: string;
  systemPromptId?: string | null;
  thinkingLevel?: string | null;
  totalCost?: number;
  tokenCount?: number;
}

export interface Session {
  id: string;
  title: string;
  providerId: string;
  modelId: string;
  systemPromptId: string | null;
  thinkingLevel: string | null;
  totalCost: number;
  tokenCount: number;
  createdAt: number;
  updatedAt: number;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    title: row.title,
    providerId: row.provider_id,
    modelId: row.model_id,
    systemPromptId: row.system_prompt_id,
    thinkingLevel: row.thinking_level,
    totalCost: row.total_cost,
    tokenCount: row.token_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a new session record.
 */
export async function createSession(
  db: SQLiteDatabase,
  data: CreateSessionData
): Promise<Session> {
  const id = generateId();
  const now = getCurrentTimestamp();

  await db.runAsync(
    `INSERT INTO sessions (id, title, provider_id, model_id, system_prompt_id, total_cost, token_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.title,
    data.providerId,
    data.modelId,
    data.systemPromptId ?? null,
    0,
    0,
    now,
    now
  );

  return {
    id,
    title: data.title,
    providerId: data.providerId,
    modelId: data.modelId,
    systemPromptId: data.systemPromptId ?? null,
    thinkingLevel: null,
    totalCost: 0,
    tokenCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a single session by ID.
 */
export async function getSession(
  db: SQLiteDatabase,
  id: string
): Promise<Session | null> {
  const row = await db.getFirstAsync<SessionRow>(
    'SELECT * FROM sessions WHERE id = ?',
    id
  );
  return row ? rowToSession(row) : null;
}

/**
 * List all sessions ordered by updated_at DESC (most recently active first).
 */
export async function getAllSessions(
  db: SQLiteDatabase
): Promise<Session[]> {
  const rows = await db.getAllAsync<SessionRow>(
    'SELECT * FROM sessions ORDER BY updated_at DESC'
  );
  return rows.map(rowToSession);
}

/**
 * Partially update a session. Also updates the updated_at timestamp.
 */
export async function updateSession(
  db: SQLiteDatabase,
  id: string,
  updates: UpdateSessionData
): Promise<Session | null> {
  const setClauses: string[] = [];
  const params: (string | number | null)[] = [];

  if (updates.title !== undefined) {
    setClauses.push('title = ?');
    params.push(updates.title);
  }
  if (updates.providerId !== undefined) {
    setClauses.push('provider_id = ?');
    params.push(updates.providerId);
  }
  if (updates.modelId !== undefined) {
    setClauses.push('model_id = ?');
    params.push(updates.modelId);
  }
  if (updates.systemPromptId !== undefined) {
    setClauses.push('system_prompt_id = ?');
    params.push(updates.systemPromptId);
  }
  if (updates.thinkingLevel !== undefined) {
    setClauses.push('thinking_level = ?');
    params.push(updates.thinkingLevel);
  }
  if (updates.totalCost !== undefined) {
    setClauses.push('total_cost = ?');
    params.push(updates.totalCost);
  }
  if (updates.tokenCount !== undefined) {
    setClauses.push('token_count = ?');
    params.push(updates.tokenCount);
  }

  if (setClauses.length === 0) {
    return getSession(db, id);
  }

  const now = getCurrentTimestamp();
  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.runAsync(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = ?`,
    ...params
  );

  return getSession(db, id);
}

/**
 * Delete a session by ID. Cascade deletion of messages is handled by
 * the foreign key ON DELETE CASCADE constraint.
 */
export async function deleteSession(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM sessions WHERE id = ?', id);
}
