import { useSessionStore, generateSessionTitle } from '../session-store';
import type { SessionStore } from '../session-store';
import { SESSION_TITLE_MAX_LENGTH } from '@/constants/defaults';

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

import {
  createSession as createSessionInDb,
  getAllSessions as getAllSessionsFromDb,
  updateSession as updateSessionInDb,
  deleteSession as deleteSessionInDb,
} from '@/database/repositories/session-repo';
import {
  createMessage as createMessageInDb,
  getMessagesBySession as getMessagesBySessionFromDb,
  deleteMessagesAfter as deleteMessagesAfterInDb,
} from '@/database/repositories/message-repo';

const mockCreateSession = createSessionInDb as jest.MockedFunction<typeof createSessionInDb>;
const mockGetAllSessions = getAllSessionsFromDb as jest.MockedFunction<typeof getAllSessionsFromDb>;
const mockUpdateSession = updateSessionInDb as jest.MockedFunction<typeof updateSessionInDb>;
const mockDeleteSession = deleteSessionInDb as jest.MockedFunction<typeof deleteSessionInDb>;
const mockCreateMessage = createMessageInDb as jest.MockedFunction<typeof createMessageInDb>;
const mockGetMessagesBySession = getMessagesBySessionFromDb as jest.MockedFunction<typeof getMessagesBySessionFromDb>;
const mockDeleteMessagesAfter = deleteMessagesAfterInDb as jest.MockedFunction<typeof deleteMessagesAfterInDb>;

function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

describe('session-store', () => {
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

  describe('generateSessionTitle', () => {
    it('returns the message as-is when within max length', () => {
      const msg = 'Hello world';
      expect(generateSessionTitle(msg)).toBe('Hello world');
    });

    it('returns the message as-is when exactly at max length', () => {
      const msg = 'A'.repeat(SESSION_TITLE_MAX_LENGTH);
      expect(generateSessionTitle(msg)).toBe(msg);
      expect(generateSessionTitle(msg).length).toBe(SESSION_TITLE_MAX_LENGTH);
    });

    it('truncates and appends "..." when exceeding max length', () => {
      const msg = 'A'.repeat(SESSION_TITLE_MAX_LENGTH + 20);
      const title = generateSessionTitle(msg);
      expect(title.length).toBe(SESSION_TITLE_MAX_LENGTH + 3); // 50 + "..."
      expect(title).toBe('A'.repeat(SESSION_TITLE_MAX_LENGTH) + '...');
    });

    it('truncates long messages preserving the first 50 characters', () => {
      const msg = 'This is a very long message that exceeds the maximum title length for sessions';
      const title = generateSessionTitle(msg);
      expect(title).toBe(msg.slice(0, SESSION_TITLE_MAX_LENGTH) + '...');
    });
  });

  describe('setDatabase', () => {
    it('stores the database reference', () => {
      useSessionStore.getState().setDatabase(mockDb);
      expect(useSessionStore.getState().db).toBe(mockDb);
    });
  });

  describe('loadSessions', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().loadSessions()
      ).rejects.toThrow('Database not initialized');
    });

    it('loads sessions from the database', async () => {
      const sessions = [
        { id: 's1', title: 'Chat 1', providerId: 'p1', modelId: 'm1', systemPromptId: null, totalCost: 0, tokenCount: 0, createdAt: 100, updatedAt: 200 },
        { id: 's2', title: 'Chat 2', providerId: 'p1', modelId: 'm1', systemPromptId: null, totalCost: 0, tokenCount: 0, createdAt: 50, updatedAt: 150 },
      ];
      mockGetAllSessions.mockResolvedValue(sessions);

      useSessionStore.getState().setDatabase(mockDb);
      await useSessionStore.getState().loadSessions();

      expect(mockGetAllSessions).toHaveBeenCalledWith(mockDb);
      expect(useSessionStore.getState().sessions).toEqual(sessions);
    });
  });

  describe('createSession', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().createSession('p1', 'm1')
      ).rejects.toThrow('Database not initialized');
    });

    it('creates a session in DB and adds to state', async () => {
      const newSession = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 1700000000000, updatedAt: 1700000000000,
      };
      mockCreateSession.mockResolvedValue(newSession);

      useSessionStore.getState().setDatabase(mockDb);
      const id = await useSessionStore.getState().createSession('p1', 'm1');

      expect(mockCreateSession).toHaveBeenCalledWith(mockDb, {
        title: 'New Chat',
        providerId: 'p1',
        modelId: 'm1',
      });
      expect(id).toBe('s1');
      expect(useSessionStore.getState().sessions).toEqual([newSession]);
      expect(useSessionStore.getState().messages['s1']).toEqual([]);
    });

    it('prepends new session to the list', async () => {
      const existingSession = {
        id: 's0', title: 'Old Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 1000, updatedAt: 1000,
      };
      const newSession = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 2000, updatedAt: 2000,
      };
      mockCreateSession.mockResolvedValue(newSession);

      useSessionStore.setState({ db: mockDb, sessions: [existingSession] });
      await useSessionStore.getState().createSession('p1', 'm1');

      expect(useSessionStore.getState().sessions[0]).toEqual(newSession);
      expect(useSessionStore.getState().sessions[1]).toEqual(existingSession);
    });
  });

  describe('deleteSession', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().deleteSession('s1')
      ).rejects.toThrow('Database not initialized');
    });

    it('deletes session from DB and removes from state', async () => {
      const session = {
        id: 's1', title: 'Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      mockDeleteSession.mockResolvedValue();

      useSessionStore.setState({
        db: mockDb,
        sessions: [session],
        messages: { s1: [] },
        activeSessionId: 's1',
      });
      await useSessionStore.getState().deleteSession('s1');

      expect(mockDeleteSession).toHaveBeenCalledWith(mockDb, 's1');
      expect(useSessionStore.getState().sessions).toEqual([]);
      expect(useSessionStore.getState().messages).toEqual({});
      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });

    it('does not clear activeSessionId when deleting a different session', async () => {
      const session1 = {
        id: 's1', title: 'Chat 1', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const session2 = {
        id: 's2', title: 'Chat 2', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 200, updatedAt: 200,
      };
      mockDeleteSession.mockResolvedValue();

      useSessionStore.setState({
        db: mockDb,
        sessions: [session1, session2],
        messages: { s1: [], s2: [] },
        activeSessionId: 's2',
      });
      await useSessionStore.getState().deleteSession('s1');

      expect(useSessionStore.getState().activeSessionId).toBe('s2');
      expect(useSessionStore.getState().sessions).toEqual([session2]);
    });
  });

  describe('renameSession', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().renameSession('s1', 'New Title')
      ).rejects.toThrow('Database not initialized');
    });

    it('renames session in DB and updates state', async () => {
      const session = {
        id: 's1', title: 'Old Title', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const updatedSession = { ...session, title: 'New Title', updatedAt: 200 };
      mockUpdateSession.mockResolvedValue(updatedSession);

      useSessionStore.setState({ db: mockDb, sessions: [session] });
      await useSessionStore.getState().renameSession('s1', 'New Title');

      expect(mockUpdateSession).toHaveBeenCalledWith(mockDb, 's1', { title: 'New Title' });
      expect(useSessionStore.getState().sessions[0].title).toBe('New Title');
    });

    it('does nothing when update returns null', async () => {
      const session = {
        id: 's1', title: 'Old Title', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      mockUpdateSession.mockResolvedValue(null);

      useSessionStore.setState({ db: mockDb, sessions: [session] });
      await useSessionStore.getState().renameSession('s1', 'New Title');

      expect(useSessionStore.getState().sessions[0].title).toBe('Old Title');
    });
  });

  describe('addMessage', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().addMessage('s1', {
          sessionId: 's1',
          role: 'user',
          content: 'Hello',
          providerId: 'p1',
          modelId: 'm1',
        })
      ).rejects.toThrow('Database not initialized');
    });

    it('creates message in DB and adds to state', async () => {
      const session = {
        id: 's1', title: 'Existing Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const newMessage = {
        id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'Hello',
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 1000,
      };
      mockCreateMessage.mockResolvedValue(newMessage);
      mockUpdateSession.mockResolvedValue({ ...session, updatedAt: 1000 });

      useSessionStore.setState({ db: mockDb, sessions: [session], messages: { s1: [] } });
      const result = await useSessionStore.getState().addMessage('s1', {
        sessionId: 's1',
        role: 'user',
        content: 'Hello',
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(mockCreateMessage).toHaveBeenCalledWith(mockDb, {
        sessionId: 's1',
        role: 'user',
        content: 'Hello',
        providerId: 'p1',
        modelId: 'm1',
      });
      expect(result).toEqual(newMessage);
      expect(useSessionStore.getState().messages['s1']).toEqual([newMessage]);
    });

    it('auto-generates title from first user message when session is "New Chat"', async () => {
      const session = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const newMessage = {
        id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'What is TypeScript?',
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 1000,
      };
      mockCreateMessage.mockResolvedValue(newMessage);
      mockUpdateSession.mockResolvedValue({ ...session, title: 'What is TypeScript?', updatedAt: 1000 });

      useSessionStore.setState({ db: mockDb, sessions: [session], messages: { s1: [] } });
      await useSessionStore.getState().addMessage('s1', {
        sessionId: 's1',
        role: 'user',
        content: 'What is TypeScript?',
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(mockUpdateSession).toHaveBeenCalledWith(mockDb, 's1', { title: 'What is TypeScript?' });
      expect(useSessionStore.getState().sessions[0].title).toBe('What is TypeScript?');
    });

    it('auto-generates truncated title when first user message is long', async () => {
      const longContent = 'A'.repeat(80);
      const session = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const newMessage = {
        id: 'msg1', sessionId: 's1', role: 'user' as const, content: longContent,
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 1000,
      };
      mockCreateMessage.mockResolvedValue(newMessage);
      const expectedTitle = 'A'.repeat(50) + '...';
      mockUpdateSession.mockResolvedValue({ ...session, title: expectedTitle, updatedAt: 1000 });

      useSessionStore.setState({ db: mockDb, sessions: [session], messages: { s1: [] } });
      await useSessionStore.getState().addMessage('s1', {
        sessionId: 's1',
        role: 'user',
        content: longContent,
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(mockUpdateSession).toHaveBeenCalledWith(mockDb, 's1', { title: expectedTitle });
      expect(useSessionStore.getState().sessions[0].title).toBe(expectedTitle);
    });

    it('does not auto-generate title for assistant messages', async () => {
      const session = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const newMessage = {
        id: 'msg1', sessionId: 's1', role: 'assistant' as const, content: 'I can help!',
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 1000,
      };
      mockCreateMessage.mockResolvedValue(newMessage);
      mockUpdateSession.mockResolvedValue({ ...session, updatedAt: 1000 });

      useSessionStore.setState({ db: mockDb, sessions: [session], messages: { s1: [] } });
      await useSessionStore.getState().addMessage('s1', {
        sessionId: 's1',
        role: 'assistant',
        content: 'I can help!',
        providerId: 'p1',
        modelId: 'm1',
      });

      // updateSession is called only with empty updates (to bump updated_at), not with title
      expect(mockUpdateSession).toHaveBeenCalledWith(mockDb, 's1', {});
    });

    it('does not auto-generate title when there are existing user messages', async () => {
      const session = {
        id: 's1', title: 'New Chat', providerId: 'p1', modelId: 'm1',
        systemPromptId: null, totalCost: 0, tokenCount: 0,
        createdAt: 100, updatedAt: 100,
      };
      const existingMessage = {
        id: 'msg0', sessionId: 's1', role: 'user' as const, content: 'First message',
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 500,
      };
      const newMessage = {
        id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'Second message',
        thinkingContent: null, providerId: 'p1', modelId: 'm1',
        promptTokens: null, completionTokens: null, totalTokens: null,
        cachedTokens: null, cost: null, createdAt: 1000,
      };
      mockCreateMessage.mockResolvedValue(newMessage);
      mockUpdateSession.mockResolvedValue({ ...session, updatedAt: 1000 });

      useSessionStore.setState({
        db: mockDb,
        sessions: [session],
        messages: { s1: [existingMessage] },
      });
      await useSessionStore.getState().addMessage('s1', {
        sessionId: 's1',
        role: 'user',
        content: 'Second message',
        providerId: 'p1',
        modelId: 'm1',
      });

      // Should NOT rename — updateSession called with empty object (no title)
      expect(mockUpdateSession).toHaveBeenCalledWith(mockDb, 's1', {});
    });
  });

  describe('editMessage', () => {
    it('throws when database is not set', async () => {
      await expect(
        useSessionStore.getState().editMessage('s1', 'msg1', 'new content')
      ).rejects.toThrow('Database not initialized');
    });

    it('edits message content and discards subsequent messages', async () => {
      const messages = [
        {
          id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'Hello',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 100,
        },
        {
          id: 'msg2', sessionId: 's1', role: 'assistant' as const, content: 'Hi there!',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 200,
        },
        {
          id: 'msg3', sessionId: 's1', role: 'user' as const, content: 'Follow up',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 300,
        },
      ];
      mockDeleteMessagesAfter.mockResolvedValue();

      useSessionStore.setState({ db: mockDb, messages: { s1: messages } });
      await useSessionStore.getState().editMessage('s1', 'msg1', 'Hello updated');

      expect(mockDeleteMessagesAfter).toHaveBeenCalledWith(mockDb, 's1', 100);
      expect(mockDb.runAsync).toHaveBeenCalledWith(
        'UPDATE messages SET content = ? WHERE id = ?',
        'Hello updated',
        'msg1'
      );

      const remaining = useSessionStore.getState().messages['s1'];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('msg1');
      expect(remaining[0].content).toBe('Hello updated');
    });

    it('does nothing when message is not found', async () => {
      useSessionStore.setState({ db: mockDb, messages: { s1: [] } });
      await useSessionStore.getState().editMessage('s1', 'nonexistent', 'new content');

      expect(mockDeleteMessagesAfter).not.toHaveBeenCalled();
      expect(mockDb.runAsync).not.toHaveBeenCalled();
    });

    it('keeps only the edited message when it is the first', async () => {
      const messages = [
        {
          id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'First',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 100,
        },
        {
          id: 'msg2', sessionId: 's1', role: 'assistant' as const, content: 'Reply',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 200,
        },
      ];
      mockDeleteMessagesAfter.mockResolvedValue();

      useSessionStore.setState({ db: mockDb, messages: { s1: messages } });
      await useSessionStore.getState().editMessage('s1', 'msg1', 'First edited');

      const remaining = useSessionStore.getState().messages['s1'];
      expect(remaining).toHaveLength(1);
      expect(remaining[0].content).toBe('First edited');
    });
  });

  describe('setActiveSession', () => {
    it('sets activeSessionId to null', async () => {
      useSessionStore.setState({ activeSessionId: 's1' });
      await useSessionStore.getState().setActiveSession(null);
      expect(useSessionStore.getState().activeSessionId).toBeNull();
    });

    it('throws when database is not set and sessionId is provided', async () => {
      await expect(
        useSessionStore.getState().setActiveSession('s1')
      ).rejects.toThrow('Database not initialized');
    });

    it('sets activeSessionId and loads messages from DB', async () => {
      const messages = [
        {
          id: 'msg1', sessionId: 's1', role: 'user' as const, content: 'Hello',
          thinkingContent: null, providerId: 'p1', modelId: 'm1',
          promptTokens: null, completionTokens: null, totalTokens: null,
          cachedTokens: null, cost: null, createdAt: 100,
        },
      ];
      mockGetMessagesBySession.mockResolvedValue(messages);

      useSessionStore.setState({ db: mockDb });
      await useSessionStore.getState().setActiveSession('s1');

      expect(mockGetMessagesBySession).toHaveBeenCalledWith(mockDb, 's1');
      expect(useSessionStore.getState().activeSessionId).toBe('s1');
      expect(useSessionStore.getState().messages['s1']).toEqual(messages);
    });
  });
});
