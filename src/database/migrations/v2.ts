import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V2 schema migration — extends providers with generation parameters
 * and sessions with thinking level persistence.
 *
 * Changes:
 * - providers: add `generation_params` TEXT column (JSON, defaults to temperature 0.7, maxTokens 4096)
 * - sessions: add `thinking_level` TEXT column (nullable, stores ThinkingLevel string)
 */
export async function migrateV2(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE providers
      ADD COLUMN generation_params TEXT DEFAULT '{"temperature":0.7,"maxTokens":4096}';

    ALTER TABLE sessions
      ADD COLUMN thinking_level TEXT DEFAULT NULL;
  `);
}
