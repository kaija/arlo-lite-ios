import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V6 schema migration — adds composite index on messages(session_id, role)
 * to speed up queries filtering by role within a session (e.g. tool messages).
 */
export async function migrateV6(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    'CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role)'
  );
}
