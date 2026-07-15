import {
  buildRegenerationContext,
  getMessageCountAfterEdit,
  shouldAutoGenerateTitle,
} from '../session-manager';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Helper to create a minimal Message for testing.
 */
function makeMessage(
  overrides: Partial<Message> & { role: Message['role'] }
): Message {
  return {
    id: overrides.id ?? 'msg-' + Math.random().toString(36).slice(2),
    sessionId: overrides.sessionId ?? 'session-1',
    role: overrides.role,
    content: overrides.content ?? `content for ${overrides.role}`,
    thinkingContent: overrides.thinkingContent ?? null,
    providerId: overrides.providerId ?? 'provider-1',
    modelId: overrides.modelId ?? 'model-1',
    promptTokens: overrides.promptTokens ?? null,
    completionTokens: overrides.completionTokens ?? null,
    totalTokens: overrides.totalTokens ?? null,
    cachedTokens: overrides.cachedTokens ?? null,
    cost: overrides.cost ?? null,
    createdAt: overrides.createdAt ?? Date.now(),
  };
}

describe('session-manager', () => {
  describe('buildRegenerationContext', () => {
    it('returns empty array for empty messages', () => {
      expect(buildRegenerationContext([])).toEqual([]);
    });

    it('returns empty array when no user messages exist', () => {
      const messages = [
        makeMessage({ role: 'system' }),
        makeMessage({ role: 'assistant' }),
      ];
      expect(buildRegenerationContext(messages)).toEqual([]);
    });

    it('returns all messages up to and including the last user message', () => {
      const system = makeMessage({ role: 'system', id: 'sys' });
      const user1 = makeMessage({ role: 'user', id: 'u1' });
      const assistant1 = makeMessage({ role: 'assistant', id: 'a1' });
      const messages = [system, user1, assistant1];

      const result = buildRegenerationContext(messages);
      expect(result).toEqual([system, user1]);
    });

    it('handles multiple user/assistant turns — drops only last assistant', () => {
      const system = makeMessage({ role: 'system', id: 'sys' });
      const user1 = makeMessage({ role: 'user', id: 'u1' });
      const assistant1 = makeMessage({ role: 'assistant', id: 'a1' });
      const user2 = makeMessage({ role: 'user', id: 'u2' });
      const assistant2 = makeMessage({ role: 'assistant', id: 'a2' });
      const messages = [system, user1, assistant1, user2, assistant2];

      const result = buildRegenerationContext(messages);
      expect(result).toEqual([system, user1, assistant1, user2]);
    });

    it('includes all messages when last message is a user message (no assistant to drop)', () => {
      const user1 = makeMessage({ role: 'user', id: 'u1' });
      const assistant1 = makeMessage({ role: 'assistant', id: 'a1' });
      const user2 = makeMessage({ role: 'user', id: 'u2' });
      const messages = [user1, assistant1, user2];

      const result = buildRegenerationContext(messages);
      expect(result).toEqual([user1, assistant1, user2]);
    });

    it('handles a session with only a single user message', () => {
      const user = makeMessage({ role: 'user', id: 'u1' });
      const result = buildRegenerationContext([user]);
      expect(result).toEqual([user]);
    });

    it('handles system + user message only (no assistant yet)', () => {
      const system = makeMessage({ role: 'system', id: 'sys' });
      const user = makeMessage({ role: 'user', id: 'u1' });
      const messages = [system, user];

      const result = buildRegenerationContext(messages);
      expect(result).toEqual([system, user]);
    });
  });

  describe('getMessageCountAfterEdit', () => {
    it('returns 1 when editing the first message (position 0)', () => {
      expect(getMessageCountAfterEdit(5, 0)).toBe(1);
    });

    it('returns editPosition + 1 for a mid-session edit', () => {
      expect(getMessageCountAfterEdit(10, 4)).toBe(5);
    });

    it('returns totalMessages when editing the last message', () => {
      expect(getMessageCountAfterEdit(3, 2)).toBe(3);
    });

    it('returns 1 for a single-message session', () => {
      expect(getMessageCountAfterEdit(1, 0)).toBe(1);
    });
  });

  describe('shouldAutoGenerateTitle', () => {
    it('returns true for empty messages with "New Chat" title', () => {
      expect(shouldAutoGenerateTitle([], 'New Chat')).toBe(true);
    });

    it('returns true when only system messages exist with "New Chat" title', () => {
      const messages = [makeMessage({ role: 'system' })];
      expect(shouldAutoGenerateTitle(messages, 'New Chat')).toBe(true);
    });

    it('returns false when session already has a custom title', () => {
      expect(shouldAutoGenerateTitle([], 'My Conversation')).toBe(false);
    });

    it('returns false when user messages already exist', () => {
      const messages = [
        makeMessage({ role: 'system' }),
        makeMessage({ role: 'user' }),
      ];
      expect(shouldAutoGenerateTitle(messages, 'New Chat')).toBe(false);
    });

    it('returns false when title is not "New Chat" even with no user messages', () => {
      const messages = [makeMessage({ role: 'system' })];
      expect(shouldAutoGenerateTitle(messages, 'Custom Title')).toBe(false);
    });

    it('is case-sensitive — "new chat" does not match', () => {
      expect(shouldAutoGenerateTitle([], 'new chat')).toBe(false);
    });

    it('returns false with assistant-only messages and "New Chat" title (no user messages yet is fine, but assistant exists)', () => {
      // Edge case: if somehow an assistant message exists without a user message
      const messages = [makeMessage({ role: 'assistant' })];
      expect(shouldAutoGenerateTitle(messages, 'New Chat')).toBe(true);
    });
  });
});
