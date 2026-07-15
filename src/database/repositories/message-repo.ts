import type { SQLiteDatabase } from 'expo-sqlite';
import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

export type MessageRole = 'user' | 'assistant' | 'system';

export interface MessageRow {
  id: string;
  session_id: string;
  role: MessageRole;
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

export interface CreateMessageData {
  sessionId: string;
  role: MessageRole;
  content: string;
  thinkingContent?: string | null;
  providerId: string;
  modelId: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  cachedTokens?: number | null;
  cost?: number | null;
}

export interface Message {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  thinkingContent: string | null;
  providerId: string;
  modelId: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  cost: number | null;
  createdAt: number;
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
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
  };
}

/**
 * Insert a new message record.
 */
export async function createMessage(
  db: SQLiteDatabase,
  data: CreateMessageData
): Promise<Message> {
  const id = generateId();
  const now = getCurrentTimestamp();

  await db.runAsync(
    `INSERT INTO messages (id, session_id, role, content, thinking_content, provider_id, model_id, prompt_tokens, completion_tokens, total_tokens, cached_tokens, cost, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    data.sessionId,
    data.role,
    data.content,
    data.thinkingContent ?? null,
    data.providerId,
    data.modelId,
    data.promptTokens ?? null,
    data.completionTokens ?? null,
    data.totalTokens ?? null,
    data.cachedTokens ?? null,
    data.cost ?? null,
    now
  );

  return {
    id,
    sessionId: data.sessionId,
    role: data.role,
    content: data.content,
    thinkingContent: data.thinkingContent ?? null,
    providerId: data.providerId,
    modelId: data.modelId,
    promptTokens: data.promptTokens ?? null,
    completionTokens: data.completionTokens ?? null,
    totalTokens: data.totalTokens ?? null,
    cachedTokens: data.cachedTokens ?? null,
    cost: data.cost ?? null,
    createdAt: now,
  };
}

/**
 * Get all messages for a session ordered by created_at ASC.
 */
export async function getMessagesBySession(
  db: SQLiteDatabase,
  sessionId: string
): Promise<Message[]> {
  const rows = await db.getAllAsync<MessageRow>(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
    sessionId
  );
  return rows.map(rowToMessage);
}

/**
 * Delete a single message by ID.
 */
export async function deleteMessage(
  db: SQLiteDatabase,
  id: string
): Promise<void> {
  await db.runAsync('DELETE FROM messages WHERE id = ?', id);
}

/**
 * Delete all messages in a session that were created after the given timestamp.
 * Used for edit/discard operations — removes everything after the edit point.
 */
export async function deleteMessagesAfter(
  db: SQLiteDatabase,
  sessionId: string,
  createdAt: number
): Promise<void> {
  await db.runAsync(
    'DELETE FROM messages WHERE session_id = ? AND created_at > ?',
    sessionId,
    createdAt
  );
}
