import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createSession as createSessionInDb,
  getAllSessions,
  updateSession as updateSessionInDb,
  deleteSession as deleteSessionInDb,
} from '@/database/repositories/session-repo';
import type { Session } from '@/database/repositories/session-repo';
import {
  createMessage as createMessageInDb,
  getMessagesBySession,
  deleteMessage as deleteMessageFromDb,
  deleteMessagesAfter,
} from '@/database/repositories/message-repo';
import type { Message, CreateMessageData } from '@/database/repositories/message-repo';
import { SESSION_TITLE_MAX_LENGTH } from '@/constants/defaults';

/**
 * Generate an auto-title from the first user message.
 * Truncates to SESSION_TITLE_MAX_LENGTH (50) chars with "..." if longer.
 */
export function generateSessionTitle(messageContent: string): string {
  if (messageContent.length <= SESSION_TITLE_MAX_LENGTH) {
    return messageContent;
  }
  return messageContent.slice(0, SESSION_TITLE_MAX_LENGTH) + '...';
}

/**
 * Session store state and actions.
 */
export interface SessionStore {
  /** Database instance reference */
  db: SQLiteDatabase | null;

  /** All chat sessions */
  sessions: Session[];

  /** Currently active session ID */
  activeSessionId: string | null;

  /** Messages keyed by session ID */
  messages: Record<string, Message[]>;

  /** Set the database instance for persistence */
  setDatabase: (db: SQLiteDatabase) => void;

  /** Load all sessions from the database */
  loadSessions: () => Promise<void>;

  /** Create a new session with a given provider and model */
  createSession: (providerId: string, modelId: string) => Promise<string>;

  /** Delete a session and all its messages */
  deleteSession: (id: string) => Promise<void>;

  /** Rename a session */
  renameSession: (id: string, title: string) => Promise<void>;

  /** Add a message to a session */
  addMessage: (sessionId: string, data: CreateMessageData) => Promise<Message>;

  /** Delete a single message from a session */
  deleteMessage: (sessionId: string, messageId: string) => Promise<void>;

  /** Edit a message at a given ID and discard all subsequent messages */
  editMessage: (sessionId: string, messageId: string, newContent: string) => Promise<void>;

  /** Delete a message and all subsequent messages in the session (used by RegenerateFlow) */
  deleteMessageAndSubsequent: (sessionId: string, messageId: string) => Promise<void>;

  /** Update a session with partial data */
  updateSession: (id: string, data: { providerId?: string; modelId?: string; thinkingLevel?: string | null }) => Promise<void>;

  /** Set the active session and load its messages */
  setActiveSession: (sessionId: string | null) => Promise<void>;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  db: null,
  sessions: [],
  activeSessionId: null,
  messages: {},

  setDatabase: (db: SQLiteDatabase) => {
    set({ db });
  },

  loadSessions: async () => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    const sessions = await getAllSessions(db);
    set({ sessions });
  },

  createSession: async (providerId: string, modelId: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const session = await createSessionInDb(db, {
      title: 'New Chat',
      providerId,
      modelId,
    });

    set((state) => ({
      sessions: [session, ...state.sessions],
      messages: { ...state.messages, [session.id]: [] },
    }));

    return session.id;
  },

  deleteSession: async (id: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    await deleteSessionInDb(db, id);

    set((state) => {
      const { [id]: _, ...remainingMessages } = state.messages;
      return {
        sessions: state.sessions.filter((s) => s.id !== id),
        messages: remainingMessages,
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      };
    });
  },

  renameSession: async (id: string, title: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const updated = await updateSessionInDb(db, id, { title });
    if (!updated) return;

    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
    }));
  },

  addMessage: async (sessionId: string, data: CreateMessageData) => {
    const { db, sessions, messages } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const message = await createMessageInDb(db, data);

    // Auto-generate title from first user message
    const sessionMessages = messages[sessionId] ?? [];
    const session = sessions.find((s) => s.id === sessionId);
    if (
      data.role === 'user' &&
      sessionMessages.filter((m) => m.role === 'user').length === 0 &&
      session?.title === 'New Chat'
    ) {
      const autoTitle = generateSessionTitle(data.content);
      await updateSessionInDb(db, sessionId, { title: autoTitle });

      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, title: autoTitle, updatedAt: message.createdAt } : s
        ),
        messages: {
          ...state.messages,
          [sessionId]: [...(state.messages[sessionId] ?? []), message],
        },
      }));
    } else {
      // Update session's updated_at timestamp
      await updateSessionInDb(db, sessionId, {});

      set((state) => ({
        sessions: state.sessions.map((s) =>
          s.id === sessionId ? { ...s, updatedAt: message.createdAt } : s
        ),
        messages: {
          ...state.messages,
          [sessionId]: [...(state.messages[sessionId] ?? []), message],
        },
      }));
    }

    return message;
  },

  deleteMessage: async (sessionId: string, messageId: string) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    await deleteMessageFromDb(db, messageId);

    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: (state.messages[sessionId] ?? []).filter(
          (m) => m.id !== messageId
        ),
      },
    }));
  },

  editMessage: async (sessionId: string, messageId: string, newContent: string) => {
    const { db, messages } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const sessionMessages = messages[sessionId] ?? [];
    const messageIndex = sessionMessages.findIndex((m) => m.id === messageId);
    if (messageIndex === -1) return;

    const targetMessage = sessionMessages[messageIndex];

    // Delete all messages after this one in the database
    await deleteMessagesAfter(db, sessionId, targetMessage.createdAt);

    // Update the content of the target message in-place in the DB
    await db.runAsync(
      'UPDATE messages SET content = ? WHERE id = ?',
      newContent,
      messageId
    );

    // Update state: keep messages up to and including the edited one,
    // with updated content
    set((state) => {
      const current = state.messages[sessionId] ?? [];
      const kept = current.slice(0, messageIndex + 1);
      kept[messageIndex] = { ...kept[messageIndex], content: newContent };
      return {
        messages: {
          ...state.messages,
          [sessionId]: kept,
        },
      };
    });
  },

  deleteMessageAndSubsequent: async (sessionId: string, messageId: string) => {
    const { db, messages } = get();
    if (!db) {
      throw new Error('Database not initialized.');
    }

    const sessionMessages = messages[sessionId] ?? [];
    const target = sessionMessages.find((m) => m.id === messageId);
    if (!target) return;

    // Delete target and all messages after it from DB
    await db.runAsync(
      'DELETE FROM messages WHERE session_id = ? AND created_at >= ?',
      sessionId,
      target.createdAt
    );

    // Update in-memory state
    set((state) => ({
      messages: {
        ...state.messages,
        [sessionId]: (state.messages[sessionId] ?? []).filter(
          (m) => m.createdAt < target.createdAt
        ),
      },
    }));
  },

  updateSession: async (id: string, data: { providerId?: string; modelId?: string; thinkingLevel?: string | null }) => {
    const { db } = get();
    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const updated = await updateSessionInDb(db, id, data);
    if (!updated) return;

    set((state) => ({
      sessions: state.sessions.map((s) => (s.id === id ? updated : s)),
    }));
  },

  setActiveSession: async (sessionId: string | null) => {
    const { db } = get();

    if (sessionId === null) {
      set({ activeSessionId: null });
      return;
    }

    if (!db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }

    const msgs = await getMessagesBySession(db, sessionId);

    set((state) => ({
      activeSessionId: sessionId,
      messages: { ...state.messages, [sessionId]: msgs },
    }));
  },
}));
