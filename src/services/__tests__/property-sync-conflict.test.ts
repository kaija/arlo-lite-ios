/**
 * Property 13: Sync conflict resolution (last-write-wins)
 *
 * For any two conflicting records with different updatedAt timestamps,
 * the conflict resolver should always select the record with the later
 * timestamp, regardless of other field values.
 *
 * Feature: arlo-lite-app, Property 13: Sync conflict resolution (last-write-wins)
 * Validates: Requirements 15.5
 */

import * as fc from 'fast-check';
import { importBackupPayload } from '../backup-service';
import type { BackupPayload } from '../backup-service';
import type { Provider } from '@/database/repositories/provider-repo';
import type { Session } from '@/database/repositories/session-repo';

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

/**
 * Creates a mock SQLite database backed by in-memory maps for providers and
 * sessions. Supports getFirstAsync (SELECT), runAsync (INSERT/UPDATE), and
 * getAllAsync (SELECT * for sync_log).
 */
function createMockDb(options: {
  providers?: Record<string, { id: string; type: string; name: string; base_url: string; api_mode: string | null; streaming_enabled: number; created_at: number; updated_at: number }>;
  sessions?: Record<string, { id: string; title: string; provider_id: string; model_id: string; system_prompt_id: string | null; total_cost: number; token_count: number; created_at: number; updated_at: number }>;
}) {
  const providers = new Map(Object.entries(options.providers ?? {}));
  const sessions = new Map(Object.entries(options.sessions ?? {}));

  return {
    providers,
    sessions,
    getFirstAsync: jest.fn(async (sql: string, ...args: any[]) => {
      // Flatten params — could be passed as spread or as array
      const params = Array.isArray(args[0]) ? args[0] : args;
      const id = params[0] as string;

      if (sql.includes('FROM providers')) {
        return providers.get(id) ?? null;
      }
      if (sql.includes('FROM sessions')) {
        return sessions.get(id) ?? null;
      }
      if (sql.includes('FROM messages')) {
        return null;
      }
      if (sql.includes('FROM system_prompts')) {
        return null;
      }
      if (sql.includes('FROM models')) {
        return null;
      }
      return null;
    }),
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('sync_log')) {
        return []; // No deleted sessions
      }
      return [];
    }),
    runAsync: jest.fn(async (sql: string, ...args: any[]) => {
      // Flatten params
      const params = Array.isArray(args[0]) ? args[0] : args;

      if (sql.includes('UPDATE providers')) {
        // Last param is the id (WHERE id = ?)
        const id = params[params.length - 1] as string;
        const existing = providers.get(id);
        if (existing) {
          providers.set(id, {
            ...existing,
            type: params[0] as string,
            name: params[1] as string,
            base_url: params[2] as string,
            api_mode: params[3] as string | null,
            streaming_enabled: params[4] as number,
            updated_at: params[5] as number,
          });
        }
      } else if (sql.includes('INSERT INTO providers')) {
        const id = params[0] as string;
        providers.set(id, {
          id,
          type: params[1] as string,
          name: params[2] as string,
          base_url: params[3] as string,
          api_mode: params[4] as string | null,
          streaming_enabled: params[5] as number,
          created_at: params[6] as number,
          updated_at: params[7] as number,
        });
      } else if (sql.includes('UPDATE sessions')) {
        const id = params[params.length - 1] as string;
        const existing = sessions.get(id);
        if (existing) {
          sessions.set(id, {
            ...existing,
            title: params[0] as string,
            provider_id: params[1] as string,
            model_id: params[2] as string,
            system_prompt_id: params[3] as string | null,
            total_cost: params[4] as number,
            token_count: params[5] as number,
            updated_at: params[6] as number,
          });
        }
      } else if (sql.includes('INSERT INTO sessions')) {
        const id = params[0] as string;
        sessions.set(id, {
          id,
          title: params[1] as string,
          provider_id: params[2] as string,
          model_id: params[3] as string,
          system_prompt_id: params[4] as string | null,
          total_cost: params[5] as number,
          token_count: params[6] as number,
          created_at: params[7] as number,
          updated_at: params[8] as number,
        });
      }
    }),
  };
}

// ─── Generators ───────────────────────────────────────────────────────────────

const providerTypeArb = fc.constantFrom('openai' as const, 'anthropic' as const, 'custom' as const);
const apiModeArb = fc.oneof(
  fc.constant('responses' as const),
  fc.constant('chat-completions' as const),
  fc.constant(null)
);

/** Generate a Provider with a specified updatedAt timestamp. */
function providerArb(idArb: fc.Arbitrary<string>, updatedAtArb: fc.Arbitrary<number>): fc.Arbitrary<Provider> {
  return fc.record({
    id: idArb,
    type: providerTypeArb,
    name: fc.string({ minLength: 1, maxLength: 50 }),
    baseUrl: fc.webUrl(),
    apiMode: apiModeArb,
    streamingEnabled: fc.boolean(),
    createdAt: fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
    updatedAt: updatedAtArb,
  });
}

/** Generate a Session with a specified updatedAt timestamp. */
function sessionArb(idArb: fc.Arbitrary<string>, updatedAtArb: fc.Arbitrary<number>): fc.Arbitrary<Session> {
  return fc.record({
    id: idArb,
    title: fc.string({ minLength: 1, maxLength: 80 }),
    providerId: fc.uuid(),
    modelId: fc.string({ minLength: 1, maxLength: 60 }),
    systemPromptId: fc.oneof(fc.uuid(), fc.constant(null)),
    totalCost: fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
    tokenCount: fc.integer({ min: 0, max: 1_000_000 }),
    createdAt: fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
    updatedAt: updatedAtArb,
  });
}

/** Create a minimal backup payload containing only the specified providers/sessions. */
function makePayload(overrides: Partial<BackupPayload>): BackupPayload {
  return {
    version: 1,
    exportedAt: Date.now(),
    providers: [],
    models: [],
    sessions: [],
    messages: [],
    systemPrompts: [],
    settings: { theme: 'system', locale: 'en', defaultSystemPromptId: null },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 13: Sync conflict resolution (last-write-wins)', () => {
  describe('Providers', () => {
    it('when remote updatedAt > local updatedAt: remote record wins', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          // Two distinct timestamps where T2 > T1 (remote is newer)
          fc.integer({ min: 1_000_000_000, max: 1_999_999_999 }).chain((t1) =>
            fc.integer({ min: t1 + 1, max: 2_000_000_000 }).map((t2) => ({ localTs: t1, remoteTs: t2 }))
          ),
          // Generate different field values for local and remote
          providerArb(fc.constant('dummy'), fc.constant(0)),
          providerArb(fc.constant('dummy'), fc.constant(0)),
          async (id, { localTs, remoteTs }, localFields, remoteFields) => {
            const localRow = {
              id,
              type: localFields.type,
              name: localFields.name,
              base_url: localFields.baseUrl,
              api_mode: localFields.apiMode,
              streaming_enabled: localFields.streamingEnabled ? 1 : 0,
              created_at: localFields.createdAt,
              updated_at: localTs,
            };

            const remoteProvider: Provider = {
              ...remoteFields,
              id,
              updatedAt: remoteTs,
            };

            const db = createMockDb({ providers: { [id]: localRow } });
            const payload = makePayload({ providers: [remoteProvider] });

            await importBackupPayload(db as any, payload);

            // Remote should have won — local record should be updated
            const result = db.providers.get(id)!;
            expect(result.updated_at).toBe(remoteTs);
            expect(result.name).toBe(remoteProvider.name);
            expect(result.type).toBe(remoteProvider.type);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when local updatedAt > remote updatedAt: local record preserved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          // Two distinct timestamps where T1 > T2 (local is newer)
          fc.integer({ min: 1_000_000_001, max: 2_000_000_000 }).chain((t1) =>
            fc.integer({ min: 1_000_000_000, max: t1 - 1 }).map((t2) => ({ localTs: t1, remoteTs: t2 }))
          ),
          providerArb(fc.constant('dummy'), fc.constant(0)),
          providerArb(fc.constant('dummy'), fc.constant(0)),
          async (id, { localTs, remoteTs }, localFields, remoteFields) => {
            const localRow = {
              id,
              type: localFields.type,
              name: localFields.name,
              base_url: localFields.baseUrl,
              api_mode: localFields.apiMode,
              streaming_enabled: localFields.streamingEnabled ? 1 : 0,
              created_at: localFields.createdAt,
              updated_at: localTs,
            };

            const remoteProvider: Provider = {
              ...remoteFields,
              id,
              updatedAt: remoteTs,
            };

            const db = createMockDb({ providers: { [id]: localRow } });
            const payload = makePayload({ providers: [remoteProvider] });

            await importBackupPayload(db as any, payload);

            // Local should be preserved — no update applied
            const result = db.providers.get(id)!;
            expect(result.updated_at).toBe(localTs);
            expect(result.name).toBe(localFields.name);
            expect(result.type).toBe(localFields.type);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Sessions', () => {
    it('when remote updatedAt > local updatedAt: remote record wins', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1_000_000_000, max: 1_999_999_999 }).chain((t1) =>
            fc.integer({ min: t1 + 1, max: 2_000_000_000 }).map((t2) => ({ localTs: t1, remoteTs: t2 }))
          ),
          sessionArb(fc.constant('dummy'), fc.constant(0)),
          sessionArb(fc.constant('dummy'), fc.constant(0)),
          async (id, { localTs, remoteTs }, localFields, remoteFields) => {
            const localRow = {
              id,
              title: localFields.title,
              provider_id: localFields.providerId,
              model_id: localFields.modelId,
              system_prompt_id: localFields.systemPromptId,
              total_cost: localFields.totalCost,
              token_count: localFields.tokenCount,
              created_at: localFields.createdAt,
              updated_at: localTs,
            };

            const remoteSession: Session = {
              ...remoteFields,
              id,
              updatedAt: remoteTs,
            };

            const db = createMockDb({ sessions: { [id]: localRow } });
            const payload = makePayload({ sessions: [remoteSession] });

            await importBackupPayload(db as any, payload);

            // Remote should have won
            const result = db.sessions.get(id)!;
            expect(result.updated_at).toBe(remoteTs);
            expect(result.title).toBe(remoteSession.title);
            expect(result.provider_id).toBe(remoteSession.providerId);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when local updatedAt > remote updatedAt: local record preserved', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          fc.integer({ min: 1_000_000_001, max: 2_000_000_000 }).chain((t1) =>
            fc.integer({ min: 1_000_000_000, max: t1 - 1 }).map((t2) => ({ localTs: t1, remoteTs: t2 }))
          ),
          sessionArb(fc.constant('dummy'), fc.constant(0)),
          sessionArb(fc.constant('dummy'), fc.constant(0)),
          async (id, { localTs, remoteTs }, localFields, remoteFields) => {
            const localRow = {
              id,
              title: localFields.title,
              provider_id: localFields.providerId,
              model_id: localFields.modelId,
              system_prompt_id: localFields.systemPromptId,
              total_cost: localFields.totalCost,
              token_count: localFields.tokenCount,
              created_at: localFields.createdAt,
              updated_at: localTs,
            };

            const remoteSession: Session = {
              ...remoteFields,
              id,
              updatedAt: remoteTs,
            };

            const db = createMockDb({ sessions: { [id]: localRow } });
            const payload = makePayload({ sessions: [remoteSession] });

            await importBackupPayload(db as any, payload);

            // Local should be preserved
            const result = db.sessions.get(id)!;
            expect(result.updated_at).toBe(localTs);
            expect(result.title).toBe(localFields.title);
            expect(result.provider_id).toBe(localFields.providerId);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('General last-write-wins invariant', () => {
    it('the winner is always the record with the later timestamp regardless of field values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(),
          // Generate two distinct timestamps
          fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }),
          fc.integer({ min: 1_000_000_000, max: 2_000_000_000 }).filter((_, index) => true),
          providerArb(fc.constant('dummy'), fc.constant(0)),
          providerArb(fc.constant('dummy'), fc.constant(0)),
          async (id, ts1, ts2, fieldsA, fieldsB) => {
            // Ensure timestamps are distinct
            if (ts1 === ts2) return;

            const localTs = ts1;
            const remoteTs = ts2;

            const localRow = {
              id,
              type: fieldsA.type,
              name: fieldsA.name,
              base_url: fieldsA.baseUrl,
              api_mode: fieldsA.apiMode,
              streaming_enabled: fieldsA.streamingEnabled ? 1 : 0,
              created_at: fieldsA.createdAt,
              updated_at: localTs,
            };

            const remoteProvider: Provider = {
              ...fieldsB,
              id,
              updatedAt: remoteTs,
            };

            const db = createMockDb({ providers: { [id]: localRow } });
            const payload = makePayload({ providers: [remoteProvider] });

            await importBackupPayload(db as any, payload);

            const result = db.providers.get(id)!;
            const expectedWinnerTs = Math.max(localTs, remoteTs);

            // The surviving record always has the later timestamp
            expect(result.updated_at).toBe(expectedWinnerTs);

            // Verify the correct record's fields are present
            if (remoteTs > localTs) {
              expect(result.name).toBe(remoteProvider.name);
            } else {
              expect(result.name).toBe(fieldsA.name);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
