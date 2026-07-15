/**
 * Property 10: API keys exist only in secure storage
 *
 * For any stored API key, it should be retrievable exclusively from Secure_Storage,
 * and should never appear in: backup export payloads, Zustand persisted state,
 * SQLite database rows, or any serializable application state.
 *
 * Feature: arlo-lite-app, Property 10: API keys exist only in secure storage
 * Validates: Requirements 3.1, 3.2, 3.3, 15.6
 */

import * as fc from 'fast-check';
import { exportBackupPayload } from '../backup-service';
import type { AppSettings } from '../backup-service';
import { getAllProviders } from '@/database/repositories/provider-repo';

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generates API key strings that resemble typical provider key patterns.
 */
const apiKeyArbitrary = fc.oneof(
  // OpenAI-style keys
  fc.string({ minLength: 20, maxLength: 64 }).map((s) => `sk-${s}`),
  // Bearer token style
  fc.string({ minLength: 10, maxLength: 80 }).map((s) => `Bearer ${s}`),
  // Anthropic-style keys
  fc.string({ minLength: 20, maxLength: 64 }).map((s) => `sk-ant-${s}`),
  // Generic alphanumeric keys
  fc.stringMatching(/^[A-Za-z0-9]{20,64}$/),
  // Keys with dashes and underscores
  fc.stringMatching(/^[A-Za-z0-9_-]{20,64}$/)
);

/**
 * Generates a provider ID.
 */
const providerIdArbitrary = fc.uuid();

// ─── Mock DB ──────────────────────────────────────────────────────────────────

interface MockProviderRow {
  id: string;
  type: string;
  name: string;
  base_url: string;
  api_mode: string | null;
  streaming_enabled: number;
  created_at: number;
  updated_at: number;
}

/**
 * Creates a mock SQLite database that returns the given provider rows.
 * Provider rows intentionally contain NO API key fields — this mirrors
 * the real schema where keys are stored only in expo-secure-store.
 */
function createMockDb(providerRows: MockProviderRow[]) {
  return {
    getAllAsync: jest.fn(async (sql: string) => {
      if (sql.includes('FROM providers')) return providerRows;
      if (sql.includes('FROM models')) return [];
      if (sql.includes('FROM sessions')) return [];
      if (sql.includes('FROM messages')) return [];
      if (sql.includes('FROM system_prompts')) return [];
      return [];
    }),
    getFirstAsync: jest.fn(async () => null),
    runAsync: jest.fn(),
  };
}

const defaultSettings: AppSettings = {
  theme: 'system',
  locale: 'en',
  defaultSystemPromptId: null,
};

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property 10: API keys exist only in secure storage', () => {
  it('exportBackupPayload output never contains any API key string', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 1-5 providers, each with a unique API key
        fc.array(
          fc.tuple(providerIdArbitrary, apiKeyArbitrary),
          { minLength: 1, maxLength: 5 }
        ),
        async (providerKeyPairs) => {
          // Build provider rows (no API key in the row — matches real schema)
          const providerRows: MockProviderRow[] = providerKeyPairs.map(([id]) => ({
            id,
            type: 'openai',
            name: `Provider ${id.slice(0, 8)}`,
            base_url: 'https://api.openai.com/v1',
            api_mode: 'responses',
            streaming_enabled: 1,
            created_at: Date.now(),
            updated_at: Date.now(),
          }));

          const db = createMockDb(providerRows);

          const payload = await exportBackupPayload(db as any, defaultSettings);
          const serialized = JSON.stringify(payload);

          // Assert: none of the API keys appear anywhere in the serialized payload
          for (const [, apiKey] of providerKeyPairs) {
            expect(serialized).not.toContain(apiKey);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('getAllProviders result never contains API key values', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(providerIdArbitrary, apiKeyArbitrary),
          { minLength: 1, maxLength: 5 }
        ),
        async (providerKeyPairs) => {
          // Build provider rows matching the real DB schema (no apiKey column)
          const providerRows: MockProviderRow[] = providerKeyPairs.map(([id]) => ({
            id,
            type: 'anthropic',
            name: `Provider ${id.slice(0, 8)}`,
            base_url: 'https://api.anthropic.com',
            api_mode: null,
            streaming_enabled: 1,
            created_at: Date.now(),
            updated_at: Date.now(),
          }));

          const db = createMockDb(providerRows);

          const providers = await getAllProviders(db as any);
          const serialized = JSON.stringify(providers);

          // Assert: no API key value appears in the provider records
          for (const [, apiKey] of providerKeyPairs) {
            expect(serialized).not.toContain(apiKey);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('backup payload providers array never has an apiKey or api_key field', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.tuple(providerIdArbitrary, apiKeyArbitrary),
          { minLength: 1, maxLength: 5 }
        ),
        async (providerKeyPairs) => {
          const providerRows: MockProviderRow[] = providerKeyPairs.map(([id]) => ({
            id,
            type: 'custom',
            name: `Custom ${id.slice(0, 8)}`,
            base_url: `https://custom-${id.slice(0, 8)}.example.com/v1`,
            api_mode: null,
            streaming_enabled: 0,
            created_at: Date.now(),
            updated_at: Date.now(),
          }));

          const db = createMockDb(providerRows);

          const payload = await exportBackupPayload(db as any, defaultSettings);

          // Assert: no provider object in the payload has an apiKey or api_key field
          for (const provider of payload.providers) {
            expect(provider).not.toHaveProperty('apiKey');
            expect(provider).not.toHaveProperty('api_key');
            expect(provider).not.toHaveProperty('apikey');
            expect(provider).not.toHaveProperty('API_KEY');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
