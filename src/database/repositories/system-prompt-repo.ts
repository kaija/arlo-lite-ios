import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export interface SystemPromptRow {
  id: string;
  name: string;
  content: string;
  is_default: number;
  created_at: number;
  updated_at: number;
}

export interface CreateSystemPromptData {
  name: string;
  content: string;
  isDefault?: boolean;
}

export interface UpdateSystemPromptData {
  name?: string;
  content?: string;
  isDefault?: boolean;
}

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

function rowToSystemPrompt(row: SystemPromptRow): SystemPrompt {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Insert a new system prompt.
 */
export async function createSystemPrompt(
  db: SQLiteDatabase,
  data: CreateSystemPromptData
): Promise<SystemPrompt> {
  const id = generateId();
  const now = getCurrentTimestamp();
  const isDefault = data.isDefault ? 1 : 0;

  // If this prompt is being set as default, unset all others first
  if (isDefault) {
    await db.runAsync('UPDATE system_prompts SET is_default = 0');
  }

  await db.runAsync(
    `INSERT INTO system_prompts (id, name, content, is_default, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    data.name,
    data.content,
    isDefault,
    now,
    now
  );

  return {
    id,
    name: data.name,
    content: data.content,
    isDefault: isDefault === 1,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get a single system prompt by ID.
 */
export async function getSystemPrompt(
  db: SQLiteDatabase,
  id: string
): Promise<SystemPrompt | null> {
  const row = await db.getFirstAsync<SystemPromptRow>(
    'SELECT * FROM system_prompts WHERE id = ?',
    id
  );
  return row ? rowToSystemPrompt(row) : null;
}

/**
 * List all system prompts.
 */
export async function getAllSystemPrompts(
  db: SQLiteDatabase
): Promise<SystemPrompt[]> {
  const rows = await db.getAllAsync<SystemPromptRow>(
    'SELECT * FROM system_prompts'
  );
  return rows.map(rowToSystemPrompt);
}

/**
 * Partially update a system prompt.
 */
export async function updateSystemPrompt(
  db: SQLiteDatabase,
  id: string,
  updates: UpdateSystemPromptData
): Promise<SystemPrompt | null> {
  const setClauses: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    params.push(updates.name);
  }
  if (updates.content !== undefined) {
    setClauses.push('content = ?');
    params.push(updates.content);
  }
  if (updates.isDefault !== undefined) {
    // If setting as default, unset all others first
    if (updates.isDefault) {
      await db.runAsync('UPDATE system_prompts SET is_default = 0');
    }
    setClauses.push('is_default = ?');
    params.push(updates.isDefault ? 1 : 0);
  }

  if (setClauses.length === 0) {
    return getSystemPrompt(db, id);
  }

  const now = getCurrentTimestamp();
  setClauses.push('updated_at = ?');
  params.push(now);
  params.push(id);

  await db.runAsync(
    `UPDATE system_prompts SET ${setClauses.join(', ')} WHERE id = ?`,
    ...params
  );

  return getSystemPrompt(db, id);
}

/**
 * Delete a system prompt by ID.
 */
export async function deleteSystemPrompt(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM system_prompts WHERE id = ?', id);
}

/**
 * Set a specific prompt as the default, unsetting all others.
 */
export async function setDefaultPrompt(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('UPDATE system_prompts SET is_default = 0');
  await db.runAsync(
    'UPDATE system_prompts SET is_default = 1, updated_at = ? WHERE id = ?',
    getCurrentTimestamp(),
    id
  );
}
