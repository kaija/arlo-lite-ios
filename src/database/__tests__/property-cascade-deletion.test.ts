/**
 * Property 9: Cascade deletion integrity
 *
 * For any provider with M associated models (M ≥ 0), deleting the provider
 * should result in zero models with that provider's ID remaining in the database.
 * Similarly, for any session with N messages, deleting the session should result
 * in zero messages with that session's ID remaining.
 *
 * Feature: arlo-lite-app, Property 9: Cascade deletion integrity
 * Validates: Requirements 1.9, 5.5
 */

import * as fc from 'fast-check';
import { deleteProvider } from '../repositories/provider-repo';
import { deleteSession } from '../repositories/session-repo';

// Simulate an in-memory database with FK cascade behavior
interface InMemoryDb {
  providers: Map<string, { id: string; type: string; name: string }>;
  models: Map<string, { id: string; provider_id: string; model_id: string }>;
  sessions: Map<string, { id: string; title: string; provider_id: string; model_id: string }>;
  messages: Map<string, { id: string; session_id: string; role: string; content: string }>;
}

function createInMemoryDb(): InMemoryDb {
  return {
    providers: new Map(),
    models: new Map(),
    sessions: new Map(),
    messages: new Map(),
  };
}

/**
 * Creates a mock SQLiteDatabase that simulates ON DELETE CASCADE behavior.
 * When a DELETE FROM providers is executed, it also removes all models
 * with matching provider_id. When DELETE FROM sessions is executed, it also
 * removes all messages with matching session_id.
 */
function createCascadeMockDb(memDb: InMemoryDb) {
  return {
    runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('DELETE FROM providers WHERE id = ?')) {
        const providerId = params[0] as string;
        memDb.providers.delete(providerId);
        // Simulate ON DELETE CASCADE for models
        for (const [modelId, model] of memDb.models) {
          if (model.provider_id === providerId) {
            memDb.models.delete(modelId);
          }
        }
      } else if (sql.includes('DELETE FROM sessions WHERE id = ?')) {
        const sessionId = params[0] as string;
        memDb.sessions.delete(sessionId);
        // Simulate ON DELETE CASCADE for messages
        for (const [messageId, message] of memDb.messages) {
          if (message.session_id === sessionId) {
            memDb.messages.delete(messageId);
          }
        }
      }
    }),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
  } as any;
}

describe('Property 9: Cascade deletion integrity', () => {
  it('deleting a provider removes all associated models', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        async (providerId, modelIds) => {
          // Setup: create in-memory db with a provider and M models
          const memDb = createInMemoryDb();
          memDb.providers.set(providerId, {
            id: providerId,
            type: 'openai',
            name: 'Test Provider',
          });

          for (const modelId of modelIds) {
            memDb.models.set(modelId, {
              id: modelId,
              provider_id: providerId,
              model_id: `model-${modelId}`,
            });
          }

          const db = createCascadeMockDb(memDb);

          // Act: delete the provider
          await deleteProvider(db, providerId);

          // Assert: no models reference the deleted provider
          const remainingModelsForProvider = [...memDb.models.values()].filter(
            (m) => m.provider_id === providerId
          );
          expect(remainingModelsForProvider).toHaveLength(0);

          // Also verify the provider itself is gone
          expect(memDb.providers.has(providerId)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deleting a provider preserves models belonging to other providers', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        async (providerIdToDelete, otherProviderId, modelsToDelete, otherModels) => {
          // Ensure provider IDs are distinct
          fc.pre(providerIdToDelete !== otherProviderId);

          const memDb = createInMemoryDb();
          memDb.providers.set(providerIdToDelete, {
            id: providerIdToDelete,
            type: 'openai',
            name: 'Provider to delete',
          });
          memDb.providers.set(otherProviderId, {
            id: otherProviderId,
            type: 'anthropic',
            name: 'Other provider',
          });

          for (const modelId of modelsToDelete) {
            memDb.models.set(modelId, {
              id: modelId,
              provider_id: providerIdToDelete,
              model_id: `model-${modelId}`,
            });
          }

          for (const modelId of otherModels) {
            // Avoid key collision with modelsToDelete
            const uniqueKey = `other-${modelId}`;
            memDb.models.set(uniqueKey, {
              id: uniqueKey,
              provider_id: otherProviderId,
              model_id: `model-${modelId}`,
            });
          }

          const db = createCascadeMockDb(memDb);

          // Act: delete only the first provider
          await deleteProvider(db, providerIdToDelete);

          // Assert: other provider's models still exist
          const remainingOtherModels = [...memDb.models.values()].filter(
            (m) => m.provider_id === otherProviderId
          );
          expect(remainingOtherModels.length).toBe(otherModels.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deleting a session removes all associated messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 100 }),
        async (sessionId, messageIds) => {
          // Setup: create in-memory db with a session and N messages
          const memDb = createInMemoryDb();
          memDb.sessions.set(sessionId, {
            id: sessionId,
            title: 'Test Session',
            provider_id: 'p1',
            model_id: 'm1',
          });

          for (const messageId of messageIds) {
            memDb.messages.set(messageId, {
              id: messageId,
              session_id: sessionId,
              role: 'user',
              content: `Message ${messageId}`,
            });
          }

          const db = createCascadeMockDb(memDb);

          // Act: delete the session
          await deleteSession(db, sessionId);

          // Assert: no messages reference the deleted session
          const remainingMessagesForSession = [...memDb.messages.values()].filter(
            (m) => m.session_id === sessionId
          );
          expect(remainingMessagesForSession).toHaveLength(0);

          // Also verify the session itself is gone
          expect(memDb.sessions.has(sessionId)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('deleting a session preserves messages belonging to other sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 50 }),
        async (sessionIdToDelete, otherSessionId, messagesToDelete, otherMessages) => {
          // Ensure session IDs are distinct
          fc.pre(sessionIdToDelete !== otherSessionId);

          const memDb = createInMemoryDb();
          memDb.sessions.set(sessionIdToDelete, {
            id: sessionIdToDelete,
            title: 'Session to delete',
            provider_id: 'p1',
            model_id: 'm1',
          });
          memDb.sessions.set(otherSessionId, {
            id: otherSessionId,
            title: 'Other session',
            provider_id: 'p1',
            model_id: 'm1',
          });

          for (const msgId of messagesToDelete) {
            memDb.messages.set(msgId, {
              id: msgId,
              session_id: sessionIdToDelete,
              role: 'user',
              content: `Msg ${msgId}`,
            });
          }

          for (const msgId of otherMessages) {
            // Avoid key collision
            const uniqueKey = `other-${msgId}`;
            memDb.messages.set(uniqueKey, {
              id: uniqueKey,
              session_id: otherSessionId,
              role: 'assistant',
              content: `Other msg ${msgId}`,
            });
          }

          const db = createCascadeMockDb(memDb);

          // Act: delete only the first session
          await deleteSession(db, sessionIdToDelete);

          // Assert: other session's messages still exist
          const remainingOtherMessages = [...memDb.messages.values()].filter(
            (m) => m.session_id === otherSessionId
          );
          expect(remainingOtherMessages.length).toBe(otherMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
