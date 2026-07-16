/**
 * Property 8: Model Selection Round-Trip Persistence
 *
 * For any session S and for any provider/model pair (P, M) selected via
 * the model picker, switching away from S and then switching back SHALL
 * restore activeProviderId === P and activeModelId === M in the ChatStore.
 *
 * Feature: provider-ui-integration, Property 8: Model Selection Round-Trip Persistence
 * Validates: Requirements 5.1, 5.2
 */

import * as fc from 'fast-check';
import { useChatStore } from '../chat-store';
import { useSessionStore } from '../session-store';

// Mock session-repo
jest.mock('@/database/repositories/session-repo', () => ({
  createSession: jest.fn(),
  getAllSessions: jest.fn(() => Promise.resolve([])),
  updateSession: jest.fn((_db, id, data) =>
    Promise.resolve({
      id,
      title: 'Test Session',
      providerId: data.providerId ?? null,
      modelId: data.modelId ?? null,
      thinkingLevel: data.thinkingLevel ?? null,
      createdAt: 1000,
      updatedAt: Date.now(),
    })
  ),
  deleteSession: jest.fn(),
}));

// Mock message-repo
jest.mock('@/database/repositories/message-repo', () => ({
  createMessage: jest.fn(),
  getMessagesBySession: jest.fn(() => Promise.resolve([])),
  deleteMessagesAfter: jest.fn(),
}));

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

describe('Property 8: Model Selection Round-Trip Persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset ChatStore to defaults
    useChatStore.setState({
      isStreaming: false,
      streamContent: '',
      thinkingContent: '',
      activeProviderId: null,
      activeModelId: null,
      thinkingLevel: 'off',
    });
    // Reset SessionStore
    useSessionStore.setState({
      db: null,
      sessions: [],
      activeSessionId: null,
      messages: {},
    });
  });

  it('switchModel sets activeProviderId and activeModelId to the exact values provided', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Arbitrary non-empty provider ID
        fc.string({ minLength: 1, maxLength: 100 }),
        // Arbitrary non-empty model ID
        fc.string({ minLength: 1, maxLength: 100 }),
        async (providerId, modelId) => {
          const mockDb = createMockDb();
          const sessionId = 'session-1';

          // Setup: have an active session so persistence doesn't throw
          useSessionStore.setState({
            db: mockDb,
            activeSessionId: sessionId,
            sessions: [
              {
                id: sessionId,
                title: 'Test',
                providerId: '',
                modelId: '',
                systemPromptId: null,
                thinkingLevel: null,
                totalCost: 0,
                tokenCount: 0,
                createdAt: 1000,
                updatedAt: 1000,
              },
            ],
            messages: { [sessionId]: [] },
          });

          // Act: switch model
          useChatStore.getState().switchModel(providerId, modelId);

          // Assert: store reflects the exact values
          const state = useChatStore.getState();
          expect(state.activeProviderId).toBe(providerId);
          expect(state.activeModelId).toBe(modelId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('round-trip: setting model then reading back yields the same values', async () => {
    await fc.assert(
      fc.asyncProperty(
        // First provider/model pair
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        // Second provider/model pair (to simulate "switching away")
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (providerId1, modelId1, providerId2, modelId2) => {
          const mockDb = createMockDb();
          const sessionId = 'session-1';

          useSessionStore.setState({
            db: mockDb,
            activeSessionId: sessionId,
            sessions: [
              {
                id: sessionId,
                title: 'Test',
                providerId: '',
                modelId: '',
                systemPromptId: null,
                thinkingLevel: null,
                totalCost: 0,
                tokenCount: 0,
                createdAt: 1000,
                updatedAt: 1000,
              },
            ],
            messages: { [sessionId]: [] },
          });

          // Act: set first model
          useChatStore.getState().switchModel(providerId1, modelId1);

          // Verify after first switch
          expect(useChatStore.getState().activeProviderId).toBe(providerId1);
          expect(useChatStore.getState().activeModelId).toBe(modelId1);

          // Act: switch to second model (simulates "switching away")
          useChatStore.getState().switchModel(providerId2, modelId2);

          // Verify second model is active
          expect(useChatStore.getState().activeProviderId).toBe(providerId2);
          expect(useChatStore.getState().activeModelId).toBe(modelId2);

          // Act: switch back to original model
          useChatStore.getState().switchModel(providerId1, modelId1);

          // Assert: original model is restored
          expect(useChatStore.getState().activeProviderId).toBe(providerId1);
          expect(useChatStore.getState().activeModelId).toBe(modelId1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('switchModel persists to the active session via updateSession', async () => {
    const { updateSession } = require('@/database/repositories/session-repo');

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (providerId, modelId) => {
          const mockDb = createMockDb();
          const sessionId = 'session-persist';

          updateSession.mockClear();

          useSessionStore.setState({
            db: mockDb,
            activeSessionId: sessionId,
            sessions: [
              {
                id: sessionId,
                title: 'Persist Test',
                providerId: '',
                modelId: '',
                systemPromptId: null,
                thinkingLevel: null,
                totalCost: 0,
                tokenCount: 0,
                createdAt: 1000,
                updatedAt: 1000,
              },
            ],
            messages: { [sessionId]: [] },
          });

          // Act
          useChatStore.getState().switchModel(providerId, modelId);

          // Allow async persistence to complete
          await new Promise((r) => setTimeout(r, 10));

          // Assert: updateSession was called with correct provider/model
          expect(updateSession).toHaveBeenCalledWith(
            mockDb,
            sessionId,
            expect.objectContaining({ providerId, modelId })
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});
