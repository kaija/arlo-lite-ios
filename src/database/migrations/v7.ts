import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V7 schema migration — adds supports_tool_use column to models table.
 */
export async function migrateV7(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    'ALTER TABLE models ADD COLUMN supports_tool_use INTEGER NOT NULL DEFAULT 0'
  );
}
