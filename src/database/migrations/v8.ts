import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V8 schema migration — adds 'tool' to the messages.role CHECK constraint.
 *
 * SQLite doesn't support ALTER CONSTRAINT, so we recreate the table.
 */
export async function migrateV8(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS messages_new (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      thinking_content TEXT,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      cached_tokens INTEGER,
      cost REAL,
      created_at INTEGER NOT NULL
    );

    INSERT INTO messages_new SELECT * FROM messages;

    DROP TABLE messages;

    ALTER TABLE messages_new RENAME TO messages;

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);
  `);
}
