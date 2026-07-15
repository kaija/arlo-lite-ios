import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * V1 schema migration — creates the full initial database schema.
 *
 * Tables: providers, models, sessions, messages, system_prompts, model_metadata, sync_log
 */
export async function migrateV1(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('openai', 'anthropic', 'custom')),
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_mode TEXT CHECK(api_mode IN ('responses', 'chat-completions')),
      streaming_enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      context_window INTEGER,
      input_price REAL,
      output_price REAL,
      cached_input_price REAL,
      cached_output_price REAL,
      supports_reasoning INTEGER NOT NULL DEFAULT 0,
      supports_image_input INTEGER NOT NULL DEFAULT 0,
      supports_image_generation INTEGER NOT NULL DEFAULT 0,
      supports_file_input INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      provider_id TEXT NOT NULL REFERENCES providers(id),
      model_id TEXT NOT NULL REFERENCES models(id),
      system_prompt_id TEXT,
      total_cost REAL NOT NULL DEFAULT 0,
      token_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
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

    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_metadata (
      model_id TEXT PRIMARY KEY,
      context_window INTEGER,
      input_price REAL,
      output_price REAL,
      cached_input_price REAL,
      cached_output_price REAL,
      supports_reasoning INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('insert', 'update', 'delete')),
      synced INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);
}
