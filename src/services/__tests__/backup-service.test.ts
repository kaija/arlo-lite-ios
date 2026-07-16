import {
  exportBackupPayload,
  importBackupPayload,
  logSessionDeletion,
  getUnsyncedDeletions,
  markDeletionsSynced,
  BACKUP_VERSION,
} from '../backup-service';
import type { BackupPayload, AppSettings } from '../backup-service';

// ─── Mock DB ──────────────────────────────────────────────────────────────────

interface MockRow {
  [key: string]: unknown;
}

function createMockDb() {
  const tables: Record<string, MockRow[]> = {
    providers: [],
    models: [],
    sessions: [],
    messages: [],
    system_prompts: [],
    sync_log: [],
  };

  const db = {
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM providers')) return tables.providers;
      if (sql.includes('FROM models')) return tables.models;
      if (sql.includes('FROM sessions')) return tables.sessions;
      if (sql.includes('FROM messages')) return tables.messages;
      if (sql.includes('FROM system_prompts')) return tables.system_prompts;
      if (sql.includes('FROM sync_log')) return tables.sync_log;
      return [];
    }),
    getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      const id = params[0] as string;
      if (sql.includes('FROM providers')) {
        return tables.providers.find((r) => r.id === id) ?? null;
      }
      if (sql.includes('FROM models')) {
        return tables.models.find((r) => r.id === id) ?? null;
      }
      if (sql.includes('FROM sessions')) {
        return tables.sessions.find((r) => r.id === id) ?? null;
      }
      if (sql.includes('FROM messages')) {
        return tables.messages.find((r) => r.id === id) ?? null;
      }
      if (sql.includes('FROM system_prompts')) {
        return tables.system_prompts.find((r) => r.id === id) ?? null;
      }
      return null;
    }),
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      // Track inserts/updates for assertions
      if (sql.includes('INSERT INTO providers')) {
        tables.providers.push({
          id: params[0],
          type: params[1],
          name: params[2],
          base_url: params[3],
          api_mode: params[4],
          streaming_enabled: params[5],
          created_at: params[6],
          updated_at: params[7],
        });
      }
      if (sql.includes('INSERT INTO models')) {
        tables.models.push({
          id: params[0],
          provider_id: params[1],
          model_id: params[2],
          display_name: params[3],
          context_window: params[4],
          input_price: params[5],
          output_price: params[6],
          cached_input_price: params[7],
          cached_output_price: params[8],
          supports_reasoning: params[9],
          supports_image_input: params[10],
          supports_image_generation: params[11],
          supports_file_input: params[12],
        });
      }
      if (sql.includes('INSERT INTO sessions')) {
        tables.sessions.push({
          id: params[0],
          title: params[1],
          provider_id: params[2],
          model_id: params[3],
          system_prompt_id: params[4],
          total_cost: params[5],
          token_count: params[6],
          created_at: params[7],
          updated_at: params[8],
        });
      }
      if (sql.includes('INSERT INTO messages')) {
        tables.messages.push({
          id: params[0],
          session_id: params[1],
          role: params[2],
          content: params[3],
          thinking_content: params[4],
          provider_id: params[5],
          model_id: params[6],
          prompt_tokens: params[7],
          completion_tokens: params[8],
          total_tokens: params[9],
          cached_tokens: params[10],
          cost: params[11],
          created_at: params[12],
        });
      }
      if (sql.includes('INSERT INTO system_prompts')) {
        tables.system_prompts.push({
          id: params[0],
          name: params[1],
          content: params[2],
          is_default: params[3],
          created_at: params[4],
          updated_at: params[5],
        });
      }
      if (sql.includes('INSERT INTO sync_log')) {
        tables.sync_log.push({
          id: params[0],
          table_name: params[1],
          record_id: params[2],
          action: params[3],
          synced: params[4],
          created_at: params[5],
        });
      }
      if (sql.includes('UPDATE providers')) {
        const id = params[params.length - 1] as string;
        const row = tables.providers.find((r) => r.id === id);
        if (row) {
          row.type = params[0];
          row.name = params[1];
          row.base_url = params[2];
          row.api_mode = params[3];
          row.streaming_enabled = params[4];
          row.updated_at = params[5];
        }
      }
      if (sql.includes('UPDATE sessions') && !sql.includes('sync_log')) {
        const id = params[params.length - 1] as string;
        const row = tables.sessions.find((r) => r.id === id);
        if (row) {
          row.title = params[0];
          row.provider_id = params[1];
          row.model_id = params[2];
          row.system_prompt_id = params[3];
          row.total_cost = params[4];
          row.token_count = params[5];
          row.updated_at = params[6];
        }
      }
      if (sql.includes('UPDATE system_prompts')) {
        const id = params[params.length - 1] as string;
        const row = tables.system_prompts.find((r) => r.id === id);
        if (row) {
          row.name = params[0];
          row.content = params[1];
          row.is_default = params[2];
          row.updated_at = params[3];
        }
      }
      if (sql.includes('UPDATE sync_log SET synced = 1')) {
        // Mark specified IDs as synced
        for (const row of tables.sync_log) {
          if (params.includes(row.id)) {
            row.synced = 1;
          }
        }
      }
    }),
    __tables: tables,
  };

  return db;
}

// ─── Test data helpers ────────────────────────────────────────────────────────

function makeProvider(overrides: Partial<MockRow> = {}) {
  return {
    id: 'provider-1',
    type: 'openai',
    name: 'My OpenAI',
    base_url: 'https://api.openai.com/v1',
    api_mode: 'responses',
    streaming_enabled: 1,
    created_at: 1000,
    updated_at: 2000,
    ...overrides,
  };
}

function makeModel(overrides: Partial<MockRow> = {}) {
  return {
    id: 'model-1',
    provider_id: 'provider-1',
    model_id: 'gpt-4o',
    display_name: 'GPT-4o',
    context_window: 128000,
    input_price: 2.5,
    output_price: 10.0,
    cached_input_price: 1.25,
    cached_output_price: null,
    supports_reasoning: 0,
    supports_image_input: 1,
    supports_image_generation: 0,
    supports_file_input: 0,
    ...overrides,
  };
}

function makeSession(overrides: Partial<MockRow> = {}) {
  return {
    id: 'session-1',
    title: 'Test Chat',
    provider_id: 'provider-1',
    model_id: 'model-1',
    system_prompt_id: null,
    total_cost: 0.05,
    token_count: 500,
    created_at: 1000,
    updated_at: 3000,
    ...overrides,
  };
}

function makeMessage(overrides: Partial<MockRow> = {}) {
  return {
    id: 'msg-1',
    session_id: 'session-1',
    role: 'user',
    content: 'Hello world',
    thinking_content: null,
    provider_id: 'provider-1',
    model_id: 'model-1',
    prompt_tokens: 10,
    completion_tokens: null,
    total_tokens: 10,
    cached_tokens: null,
    cost: null,
    created_at: 2000,
    ...overrides,
  };
}

function makeSystemPrompt(overrides: Partial<MockRow> = {}) {
  return {
    id: 'prompt-1',
    name: 'Default',
    content: 'You are a helpful assistant.',
    is_default: 1,
    created_at: 1000,
    updated_at: 2000,
    ...overrides,
  };
}

const defaultSettings: AppSettings = {
  theme: 'system',
  locale: 'en',
  defaultSystemPromptId: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('backup-service', () => {
  describe('exportBackupPayload', () => {
    it('exports all data from the database', async () => {
      const db = createMockDb();
      db.__tables.providers.push(makeProvider());
      db.__tables.models.push(makeModel());
      db.__tables.sessions.push(makeSession());
      db.__tables.messages.push(makeMessage());
      db.__tables.system_prompts.push(makeSystemPrompt());

      const payload = await exportBackupPayload(db as any, defaultSettings);

      expect(payload.version).toBe(BACKUP_VERSION);
      expect(payload.exportedAt).toBeGreaterThan(0);
      expect(payload.providers).toHaveLength(1);
      expect(payload.models).toHaveLength(1);
      expect(payload.sessions).toHaveLength(1);
      expect(payload.messages).toHaveLength(1);
      expect(payload.systemPrompts).toHaveLength(1);
      expect(payload.settings).toEqual(defaultSettings);
    });

    it('excludes API keys from export (keys not in providers table)', async () => {
      const db = createMockDb();
      db.__tables.providers.push(makeProvider());

      const payload = await exportBackupPayload(db as any, defaultSettings);

      // Provider object should not have any apiKey field
      const provider = payload.providers[0];
      expect(provider).not.toHaveProperty('apiKey');
      expect(provider).not.toHaveProperty('api_key');
      expect(JSON.stringify(provider)).not.toContain('apiKey');
    });

    it('maps database rows to camelCase domain objects', async () => {
      const db = createMockDb();
      db.__tables.providers.push(makeProvider());
      db.__tables.models.push(makeModel());
      db.__tables.sessions.push(makeSession());
      db.__tables.messages.push(makeMessage());

      const payload = await exportBackupPayload(db as any, defaultSettings);

      expect(payload.providers[0].baseUrl).toBe('https://api.openai.com/v1');
      expect(payload.providers[0].streamingEnabled).toBe(true);
      expect(payload.models[0].providerId).toBe('provider-1');
      expect(payload.models[0].supportsImageInput).toBe(true);
      expect(payload.sessions[0].providerId).toBe('provider-1');
      expect(payload.messages[0].sessionId).toBe('session-1');
    });

    it('exports empty arrays when database is empty', async () => {
      const db = createMockDb();

      const payload = await exportBackupPayload(db as any, defaultSettings);

      expect(payload.providers).toEqual([]);
      expect(payload.models).toEqual([]);
      expect(payload.sessions).toEqual([]);
      expect(payload.messages).toEqual([]);
      expect(payload.systemPrompts).toEqual([]);
    });
  });

  describe('importBackupPayload', () => {
    it('imports new records when database is empty', async () => {
      const db = createMockDb();
      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [{
          id: 'p1',
          type: 'openai',
          name: 'OpenAI',
          baseUrl: 'https://api.openai.com/v1',
          apiMode: 'responses',
          streamingEnabled: true,
          generationParams: { temperature: 0.7, maxTokens: 4096 },
          createdAt: 1000,
          updatedAt: 2000,
        }],
        models: [{
          id: 'm1',
          providerId: 'p1',
          modelId: 'gpt-4o',
          displayName: 'GPT-4o',
          contextWindow: 128000,
          inputPrice: 2.5,
          outputPrice: 10.0,
          cachedInputPrice: 1.25,
          cachedOutputPrice: null,
          supportsReasoning: false,
          supportsImageInput: true,
          supportsImageGeneration: false,
          supportsFileInput: false,
        }],
        sessions: [{
          id: 's1',
          title: 'Chat 1',
          providerId: 'p1',
          modelId: 'm1',
          systemPromptId: null,
          thinkingLevel: null,
          totalCost: 0,
          tokenCount: 0,
          createdAt: 1000,
          updatedAt: 2000,
        }],
        messages: [{
          id: 'msg1',
          sessionId: 's1',
          role: 'user',
          content: 'Hello',
          thinkingContent: null,
          providerId: 'p1',
          modelId: 'm1',
          promptTokens: 5,
          completionTokens: null,
          totalTokens: 5,
          cachedTokens: null,
          cost: null,
          createdAt: 1500,
        }],
        systemPrompts: [{
          id: 'sp1',
          name: 'Default',
          content: 'Be helpful.',
          isDefault: true,
          createdAt: 1000,
          updatedAt: 2000,
        }],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      expect(db.__tables.providers).toHaveLength(1);
      expect(db.__tables.providers[0].id).toBe('p1');
      expect(db.__tables.models).toHaveLength(1);
      expect(db.__tables.sessions).toHaveLength(1);
      expect(db.__tables.messages).toHaveLength(1);
      expect(db.__tables.system_prompts).toHaveLength(1);
    });

    it('uses last-write-wins: incoming newer overwrites local', async () => {
      const db = createMockDb();
      // Existing provider with updatedAt = 1000
      db.__tables.providers.push(makeProvider({ id: 'p1', name: 'Old Name', updated_at: 1000 }));

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [{
          id: 'p1',
          type: 'openai',
          name: 'New Name',
          baseUrl: 'https://api.openai.com/v1',
          apiMode: 'responses',
          streamingEnabled: true,
          generationParams: { temperature: 0.7, maxTokens: 4096 },
          createdAt: 500,
          updatedAt: 2000, // newer than local 1000
        }],
        models: [],
        sessions: [],
        messages: [],
        systemPrompts: [],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      // Provider name should be updated to 'New Name'
      expect(db.__tables.providers[0].name).toBe('New Name');
      expect(db.__tables.providers[0].updated_at).toBe(2000);
    });

    it('uses last-write-wins: local newer keeps local', async () => {
      const db = createMockDb();
      // Existing provider with updatedAt = 5000
      db.__tables.providers.push(makeProvider({ id: 'p1', name: 'Local Name', updated_at: 5000 }));

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [{
          id: 'p1',
          type: 'openai',
          name: 'Remote Name',
          baseUrl: 'https://api.openai.com/v1',
          apiMode: 'responses',
          streamingEnabled: true,
          generationParams: { temperature: 0.7, maxTokens: 4096 },
          createdAt: 500,
          updatedAt: 3000, // older than local 5000
        }],
        models: [],
        sessions: [],
        messages: [],
        systemPrompts: [],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      // Provider name should remain 'Local Name'
      expect(db.__tables.providers[0].name).toBe('Local Name');
      expect(db.__tables.providers[0].updated_at).toBe(5000);
    });

    it('skips sessions that were deleted locally (sync_log propagation)', async () => {
      const db = createMockDb();
      // Record that session 's-deleted' was deleted locally
      db.__tables.sync_log.push({
        id: 'log-1',
        table_name: 'sessions',
        record_id: 's-deleted',
        action: 'delete',
        synced: 0,
        created_at: 4000,
      });

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [],
        models: [],
        sessions: [{
          id: 's-deleted',
          title: 'Deleted on other device',
          providerId: 'p1',
          modelId: 'm1',
          systemPromptId: null,
          thinkingLevel: null,
          totalCost: 0,
          tokenCount: 0,
          createdAt: 1000,
          updatedAt: 2000,
        }],
        messages: [{
          id: 'msg-deleted',
          sessionId: 's-deleted',
          role: 'user',
          content: 'This should not import',
          thinkingContent: null,
          providerId: 'p1',
          modelId: 'm1',
          promptTokens: 5,
          completionTokens: null,
          totalTokens: 5,
          cachedTokens: null,
          cost: null,
          createdAt: 1500,
        }],
        systemPrompts: [],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      // Session and its messages should NOT be imported
      expect(db.__tables.sessions).toHaveLength(0);
      expect(db.__tables.messages).toHaveLength(0);
    });

    it('does not duplicate existing messages (append-only)', async () => {
      const db = createMockDb();
      db.__tables.messages.push(makeMessage({ id: 'msg-existing' }));

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [],
        models: [],
        sessions: [],
        messages: [{
          id: 'msg-existing',
          sessionId: 'session-1',
          role: 'user',
          content: 'Duplicate attempt',
          thinkingContent: null,
          providerId: 'p1',
          modelId: 'm1',
          promptTokens: 5,
          completionTokens: null,
          totalTokens: 5,
          cachedTokens: null,
          cost: null,
          createdAt: 1500,
        }],
        systemPrompts: [],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      // Should still only have 1 message (no duplicate)
      expect(db.__tables.messages).toHaveLength(1);
      // Content should remain the original
      expect(db.__tables.messages[0].content).toBe('Hello world');
    });

    it('applies last-write-wins to system prompts', async () => {
      const db = createMockDb();
      db.__tables.system_prompts.push(makeSystemPrompt({ id: 'sp1', name: 'Old', updated_at: 1000 }));

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [],
        models: [],
        sessions: [],
        messages: [],
        systemPrompts: [{
          id: 'sp1',
          name: 'Updated',
          content: 'New content.',
          isDefault: false,
          createdAt: 500,
          updatedAt: 3000,
        }],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      expect(db.__tables.system_prompts[0].name).toBe('Updated');
      expect(db.__tables.system_prompts[0].updated_at).toBe(3000);
    });

    it('applies last-write-wins to sessions', async () => {
      const db = createMockDb();
      db.__tables.sessions.push(makeSession({ id: 's1', title: 'Local Title', updated_at: 5000 }));

      const payload: BackupPayload = {
        version: 1,
        exportedAt: Date.now(),
        providers: [],
        models: [],
        sessions: [{
          id: 's1',
          title: 'Remote Title',
          providerId: 'p1',
          modelId: 'm1',
          systemPromptId: null,
          thinkingLevel: null,
          totalCost: 0.1,
          tokenCount: 100,
          createdAt: 1000,
          updatedAt: 3000, // older than local
        }],
        messages: [],
        systemPrompts: [],
        settings: defaultSettings,
      };

      await importBackupPayload(db as any, payload);

      // Local should win — title stays 'Local Title'
      expect(db.__tables.sessions[0].title).toBe('Local Title');
    });
  });

  describe('logSessionDeletion', () => {
    it('inserts a delete record into sync_log', async () => {
      const db = createMockDb();

      await logSessionDeletion(db as any, 'session-xyz');

      expect(db.__tables.sync_log).toHaveLength(1);
      expect(db.__tables.sync_log[0].table_name).toBe('sessions');
      expect(db.__tables.sync_log[0].record_id).toBe('session-xyz');
      expect(db.__tables.sync_log[0].action).toBe('delete');
      expect(db.__tables.sync_log[0].synced).toBe(0);
    });
  });

  describe('getUnsyncedDeletions', () => {
    it('returns unsynced delete entries', async () => {
      const db = createMockDb();
      db.__tables.sync_log.push({
        id: 'log-1',
        table_name: 'sessions',
        record_id: 's1',
        action: 'delete',
        synced: 0,
        created_at: 1000,
      });
      db.__tables.sync_log.push({
        id: 'log-2',
        table_name: 'sessions',
        record_id: 's2',
        action: 'delete',
        synced: 1, // already synced
        created_at: 2000,
      });

      // Override getAllAsync to filter properly
      db.getAllAsync = jest.fn(async (sql: string) => {
        if (sql.includes('sync_log') && sql.includes("action = 'delete'") && sql.includes('synced = 0')) {
          return db.__tables.sync_log.filter((r) => r.action === 'delete' && r.synced === 0);
        }
        if (sql.includes('FROM sync_log')) return db.__tables.sync_log;
        return [];
      });

      const results = await getUnsyncedDeletions(db as any);

      expect(results).toHaveLength(1);
      expect(results[0].recordId).toBe('s1');
    });
  });

  describe('markDeletionsSynced', () => {
    it('marks specified sync_log entries as synced', async () => {
      const db = createMockDb();

      await markDeletionsSynced(db as any, ['log-1', 'log-2']);

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_log SET synced = 1'),
        'log-1',
        'log-2'
      );
    });

    it('does nothing when ids array is empty', async () => {
      const db = createMockDb();

      await markDeletionsSynced(db as any, []);

      expect(db.runAsync).not.toHaveBeenCalled();
    });
  });
});
