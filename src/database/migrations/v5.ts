import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V5 schema migration — adds preset column to providers table.
 *
 * Records which Provider Preset the user selected (e.g. 'ollama', 'openrouter').
 * NULL for legacy providers; application code infers preset from wire type.
 */
export async function migrateV5(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    'ALTER TABLE providers ADD COLUMN preset TEXT DEFAULT NULL'
  );
}
