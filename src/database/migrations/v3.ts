import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V3 schema migration — removes FOREIGN KEY constraint on sessions.model_id.
 *
 * The sessions table previously had `model_id REFERENCES models(id)`, but the
 * application stores the API model identifier (e.g. "gpt-4o") rather than the
 * models table UUID. This mismatch causes FK constraint violations on insert.
 *
 * SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we recreate the table.
 * The provider_id FK is also removed since sessions should survive provider
 * deletion (orphaned sessions just become unlinked).
 *
 * Changes:
 * - sessions: remove FK constraints on provider_id and model_id
 * - sessions.model_id now stores the API model identifier directly
 */
export async function migrateV3(db: SQLiteDatabase): Promise<void> {
  // Temporarily disable FK enforcement for the migration
  await db.execAsync('PRAGMA foreign_keys = OFF');

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sessions_new (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      system_prompt_id TEXT,
      thinking_level TEXT DEFAULT NULL,
      total_cost REAL NOT NULL DEFAULT 0,
      token_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    INSERT INTO sessions_new
      SELECT id, title, provider_id, model_id, system_prompt_id, thinking_level, total_cost, token_count, created_at, updated_at
      FROM sessions;

    DROP TABLE sessions;

    ALTER TABLE sessions_new RENAME TO sessions;

    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
  `);

  // Re-enable FK enforcement
  await db.execAsync('PRAGMA foreign_keys = ON');
}
