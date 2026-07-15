/**
 * Property 8: Message edit discards subsequent messages
 *
 * For any session with N messages (N ≥ 2) and an edit at position K
 * (where 1 ≤ K < N), after the edit operation the session should contain
 * exactly K messages, preserving all messages at positions 1..K-1 and
 * the new edited message at position K.
 *
 * Feature: arlo-lite-app, Property 8: Message edit discards subsequent messages
 * Validates: Requirements 9.2
 */

import * as fc from 'fast-check';
import { useSessionStore } from '../session-store';

// Mock session-repo
jest.mock('@/database/repositories/session-repo', () => ({
  createSession: jest.fn(),
  getAllSessions: jest.fn(),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}));

// Mock message-repo
jest.mock('@/database/repositories/message-repo', () => ({
  createMessage: jest.fn(),
  getMessagesBySession: jest.fn(),
  deleteMessagesAfter: jest.fn(),
}));

import { deleteMessagesAfter } from '@/database/repositories/message-repo';
import type { Message } from '@/database/repositories/message-repo';

const mockDeleteMessagesAfter = deleteMessagesAfter as jest.MockedFunction<typeof deleteMessagesAfter>;

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

/**
 * Generate a list of N messages with increasing createdAt timestamps.
 */
function generateMessages(n: number, sessionId: string): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < n; i++) {
    messages.push({
      id: `msg-${i}`,
      sessionId,
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Message content ${i}`,
      thinkingContent: null,
      providerId: 'p1',
      modelId: 'm1',
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cachedTokens: null,
      cost: null,
      createdAt: 1000 + i * 100, // Increasing timestamps
    });
  }
  return messages;
}

describe('Property 8: Message edit discards subsequent messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      db: null,
      sessions: [],
      activeSessionId: null,
      messages: {},
    });
  });

  it('editing a message at position K results in exactly K+1 messages, preserving 0..K-1 and the edited message at K', async () => {
    await fc.assert(
      fc.asyncProperty(
        // N: number of messages (2-50)
        fc.integer({ min: 2, max: 50 }),
        // K: edit position (0 to N-2, 0-indexed)
        fc.integer({ min: 0, max: 48 }),
        // New content for the edited message
        fc.string({ minLength: 1, maxLength: 200 }),
        async (n, kRaw, newContent) => {
          // Constrain K to be valid: 0 <= K < N (0-indexed), so K <= N-2
          const k = kRaw % (n - 1); // Ensure K is in range [0, N-2]
          fc.pre(k >= 0 && k < n);

          const sessionId = 'test-session';
          const mockDb = createMockDb();
          mockDeleteMessagesAfter.mockResolvedValue();

          // Setup: populate store with N messages
          const messages = generateMessages(n, sessionId);
          useSessionStore.setState({
            db: mockDb,
            messages: { [sessionId]: messages },
          });

          // Act: call editMessage with the K-th message's ID and new content
          await useSessionStore.getState().editMessage(sessionId, messages[k].id, newContent);

          // Assert
          const remaining = useSessionStore.getState().messages[sessionId]!;

          // 1. Remaining messages count === K + 1 (edited message is kept)
          expect(remaining).toHaveLength(k + 1);

          // 2. All messages at positions 0..K-1 are unchanged (same IDs and content)
          for (let i = 0; i < k; i++) {
            expect(remaining[i].id).toBe(messages[i].id);
            expect(remaining[i].content).toBe(messages[i].content);
          }

          // 3. Message at position K has the new content
          expect(remaining[k].id).toBe(messages[k].id);
          expect(remaining[k].content).toBe(newContent);
        }
      ),
      { numRuns: 100 }
    );
  });
});
