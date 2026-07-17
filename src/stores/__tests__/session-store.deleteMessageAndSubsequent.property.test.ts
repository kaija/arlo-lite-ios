import * as fc from 'fast-check';
import { useSessionStore } from '../session-store';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Property 5: In-Memory/Database Consistency After Truncation
 *
 * **Validates: Requirements 6.3**
 *
 * For any session, after deleteMessageAndSubsequent completes successfully,
 * the in-memory message list for that session is identical to the result of
 * querying the database for that session's messages.
 *
 * We verify this by:
 * 1. The SQL DELETE was called with the correct parameters (session_id and created_at of the target message)
 * 2. The in-memory state after the operation contains exactly the messages that would survive the DELETE query
 *    (messages with createdAt < target.createdAt)
 * 3. These are consistent — every message remaining in memory would NOT be deleted by the SQL query
 */

// Mock message-repo
jest.mock('@/database/repositories/message-repo', () => ({
  createMessage: jest.fn(),
  getMessagesBySession: jest.fn(),
  deleteMessage: jest.fn(),
  deleteMessagesAfter: jest.fn(),
}));

// Mock session-repo
jest.mock('@/database/repositories/session-repo', () => ({
  createSession: jest.fn(),
  getAllSessions: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}));

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-default',
    sessionId: 's1',
    role: 'user',
    content: 'Hello',
    thinkingContent: null,
    providerId: 'p1',
    modelId: 'm1',
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cachedTokens: null,
    cost: null,
    createdAt: 1000,
    ...overrides,
  };
}

/**
 * Arbitrary: generates a non-empty list of messages with unique, strictly increasing createdAt timestamps.
 */
const messagesArb = fc
  .array(
    fc.record({
      id: fc.uuid(),
      role: fc.constantFrom('user' as const, 'assistant' as const),
      content: fc.string({ minLength: 1, maxLength: 100 }),
    }),
    { minLength: 1, maxLength: 20 },
  )
  .map((items) =>
    items.map((item, index) =>
      createMessage({
        id: item.id,
        role: item.role,
        content: item.content,
        createdAt: (index + 1) * 100, // Strictly increasing: 100, 200, 300, ...
      }),
    ),
  );

describe('Property 5: In-Memory/Database Consistency After Truncation', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    jest.clearAllMocks();
    useSessionStore.setState({
      db: null,
      sessions: [],
      activeSessionId: null,
      messages: {},
    });
  });

  it('SQL DELETE is called with correct session_id and target createdAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        fc.nat(),
        async (messages, targetIndexRaw) => {
          const targetIndex = targetIndexRaw % messages.length;
          const targetMessage = messages[targetIndex];

          mockDb.runAsync.mockClear();
          useSessionStore.setState({
            db: mockDb,
            messages: { s1: [...messages] },
          });

          await useSessionStore.getState().deleteMessageAndSubsequent('s1', targetMessage.id);

          // Verify the SQL DELETE was called with the correct parameters
          expect(mockDb.runAsync).toHaveBeenCalledWith(
            'DELETE FROM messages WHERE session_id = ? AND created_at >= ?',
            's1',
            targetMessage.createdAt,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('in-memory state contains exactly messages with createdAt < target.createdAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        fc.nat(),
        async (messages, targetIndexRaw) => {
          const targetIndex = targetIndexRaw % messages.length;
          const targetMessage = messages[targetIndex];

          useSessionStore.setState({
            db: mockDb,
            messages: { s1: [...messages] },
          });

          await useSessionStore.getState().deleteMessageAndSubsequent('s1', targetMessage.id);

          const remaining = useSessionStore.getState().messages['s1'] ?? [];

          // The remaining messages should be exactly those with createdAt < target.createdAt
          const expectedSurvivors = messages.filter(
            (m) => m.createdAt < targetMessage.createdAt,
          );

          expect(remaining).toHaveLength(expectedSurvivors.length);
          expect(remaining).toEqual(expectedSurvivors);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every message remaining in memory would NOT be deleted by the SQL query', async () => {
    await fc.assert(
      fc.asyncProperty(
        messagesArb,
        fc.nat(),
        async (messages, targetIndexRaw) => {
          const targetIndex = targetIndexRaw % messages.length;
          const targetMessage = messages[targetIndex];

          mockDb.runAsync.mockClear();
          useSessionStore.setState({
            db: mockDb,
            messages: { s1: [...messages] },
          });

          await useSessionStore.getState().deleteMessageAndSubsequent('s1', targetMessage.id);

          const remaining = useSessionStore.getState().messages['s1'] ?? [];

          // The SQL query deletes WHERE created_at >= target.createdAt
          // So every remaining message must have createdAt < target.createdAt
          // This proves consistency: nothing in memory would be caught by the DELETE
          for (const msg of remaining) {
            expect(msg.createdAt).toBeLessThan(targetMessage.createdAt);
          }

          // And conversely: no message with createdAt >= target.createdAt should remain
          const shouldBeDeleted = remaining.filter(
            (m) => m.createdAt >= targetMessage.createdAt,
          );
          expect(shouldBeDeleted).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
