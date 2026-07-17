import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V4 schema migration — adds reasoning mode columns to providers table.
 *
 * Supports Custom provider thinking effort control by storing:
 * - reasoning_mode: which wire-format mechanism to use (auto, openai-reasoning-effort,
 *   chat-template-kwargs, none)
 * - thinking_kwargs: JSON-serialized custom chat_template_kwargs override
 *
 * Both columns are nullable — null means use default behavior ('auto' mode
 * with standard {"enable_thinking": true/false} kwargs).
 */
export async function migrateV4(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    'ALTER TABLE providers ADD COLUMN reasoning_mode TEXT DEFAULT NULL'
  );
  await db.execAsync(
    'ALTER TABLE providers ADD COLUMN thinking_kwargs TEXT DEFAULT NULL'
  );
}
