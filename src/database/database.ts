import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';
import { migrateV1 } from './migrations/v1';
import { migrateV2 } from './migrations/v2';
import { migrateV3 } from './migrations/v3';
import { migrateV4 } from './migrations/v4';
import { migrateV5 } from './migrations/v5';
import { migrateV6 } from './migrations/v6';
import { migrateV7 } from './migrations/v7';
import { migrateV8 } from './migrations/v8';

const DATABASE_NAME = 'arlo-lite.db';

/**
 * Current schema version. Increment when adding new migrations.
 */
const CURRENT_VERSION = 8;

/**
 * Migration registry — maps schema version to its migration function.
 * Each migration brings the database from version N-1 to version N.
 */
const migrations: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  1: migrateV1,
  2: migrateV2,
  3: migrateV3,
  4: migrateV4,
  5: migrateV5,
  6: migrateV6,
  7: migrateV7,
  8: migrateV8,
};

/**
 * Opens the database, enables WAL mode and foreign keys,
 * and runs any pending migrations based on PRAGMA user_version.
 *
 * @returns The initialized SQLiteDatabase instance.
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  // Enable WAL mode for better concurrent read/write performance
  await db.execAsync('PRAGMA journal_mode = WAL');

  // Enable foreign key constraint enforcement
  await db.execAsync('PRAGMA foreign_keys = ON');

  // Run pending migrations
  await runMigrations(db);

  return db;
}

/**
 * Runs all pending migrations sequentially based on the current user_version.
 */
async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  let currentVersion = result?.user_version ?? 0;

  if (currentVersion >= CURRENT_VERSION) {
    return;
  }

  while (currentVersion < CURRENT_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrate = migrations[nextVersion];

    if (!migrate) {
      throw new Error(
        `Missing migration for version ${nextVersion}. ` +
          `Current: ${currentVersion}, target: ${CURRENT_VERSION}.`
      );
    }

    await migrate(db);
    currentVersion = nextVersion;
  }

  await db.execAsync(`PRAGMA user_version = ${CURRENT_VERSION}`);
}

/**
 * Closes the database connection.
 */
export async function closeDatabase(db: SQLiteDatabase): Promise<void> {
  await db.closeAsync();
}
