import { useSessionStore } from '../session-store';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Unit tests for the deleteMessage store action.
 *
 * **Validates: Requirements 1.1, 1.3**
 *
 * Property 1: Message deletion removes exactly one message.
 * For any session with N messages (N > 0) and any valid message ID within that
 * session, calling deleteMessage(sessionId, messageId) SHALL result in the
 * messages array having length N-1 and NOT containing any message with the
 * deleted ID, while all other messages remain unchanged.
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

import { deleteMessage as deleteMessageFromDb } from '@/database/repositories/message-repo';

const mockDeleteMessageFromDb = deleteMessageFromDb as jest.MockedFunction<
  typeof deleteMessageFromDb
>;

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

describe('session-store deleteMessage', () => {
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

  it('throws when database is not initialized', async () => {
    await expect(
      useSessionStore.getState().deleteMessage('s1', 'msg1')
    ).rejects.toThrow('Database not initialized');
  });

  it('removes exactly one message from a session with multiple messages', async () => {
    const msg1 = createMessage({ id: 'msg1', content: 'First', createdAt: 100 });
    const msg2 = createMessage({ id: 'msg2', content: 'Second', createdAt: 200 });
    const msg3 = createMessage({ id: 'msg3', content: 'Third', createdAt: 300 });

    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: { s1: [msg1, msg2, msg3] },
    });

    await useSessionStore.getState().deleteMessage('s1', 'msg2');

    const remaining = useSessionStore.getState().messages['s1'];
    expect(remaining).toHaveLength(2);
    expect(remaining.find((m) => m.id === 'msg2')).toBeUndefined();
  });

  it('calls deleteMessageFromDb with the correct arguments', async () => {
    const msg1 = createMessage({ id: 'msg1', content: 'Only message' });

    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: { s1: [msg1] },
    });

    await useSessionStore.getState().deleteMessage('s1', 'msg1');

    expect(mockDeleteMessageFromDb).toHaveBeenCalledWith(mockDb, 'msg1');
  });

  it('preserves all other messages unchanged and in order', async () => {
    const msg1 = createMessage({ id: 'msg1', content: 'First', createdAt: 100 });
    const msg2 = createMessage({ id: 'msg2', content: 'Second', createdAt: 200 });
    const msg3 = createMessage({ id: 'msg3', content: 'Third', createdAt: 300 });
    const msg4 = createMessage({ id: 'msg4', content: 'Fourth', createdAt: 400 });

    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: { s1: [msg1, msg2, msg3, msg4] },
    });

    await useSessionStore.getState().deleteMessage('s1', 'msg2');

    const remaining = useSessionStore.getState().messages['s1'];
    expect(remaining).toEqual([msg1, msg3, msg4]);
    // Verify each message is deeply equal (content, order, all fields)
    expect(remaining[0]).toEqual(msg1);
    expect(remaining[1]).toEqual(msg3);
    expect(remaining[2]).toEqual(msg4);
  });

  it('results in an empty array when deleting the only message', async () => {
    const msg1 = createMessage({ id: 'msg1', content: 'Only one' });

    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: { s1: [msg1] },
    });

    await useSessionStore.getState().deleteMessage('s1', 'msg1');

    const remaining = useSessionStore.getState().messages['s1'];
    expect(remaining).toEqual([]);
  });

  it('does not affect messages in other sessions', async () => {
    const msg1 = createMessage({ id: 'msg1', sessionId: 's1', content: 'Session 1 msg' });
    const msg2 = createMessage({ id: 'msg2', sessionId: 's2', content: 'Session 2 msg' });

    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: { s1: [msg1], s2: [msg2] },
    });

    await useSessionStore.getState().deleteMessage('s1', 'msg1');

    expect(useSessionStore.getState().messages['s2']).toEqual([msg2]);
  });

  it('handles deletion from a session with no messages gracefully', async () => {
    mockDeleteMessageFromDb.mockResolvedValue();

    useSessionStore.setState({
      db: mockDb,
      messages: {},
    });

    await useSessionStore.getState().deleteMessage('s1', 'nonexistent');

    // Should result in empty array for that session (filter on empty returns [])
    expect(useSessionStore.getState().messages['s1']).toEqual([]);
  });
});
