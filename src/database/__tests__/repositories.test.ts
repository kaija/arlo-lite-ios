import {
  createProvider,
  getProvider,
  getAllProviders,
  updateProvider,
  deleteProvider,
} from '../repositories/provider-repo';
import {
  createSession,
  getSession,
  getAllSessions,
  updateSession,
  deleteSession,
} from '../repositories/session-repo';
import {
  createMessage,
  getMessagesBySession,
  deleteMessage,
  deleteMessagesAfter,
} from '../repositories/message-repo';
import {
  createSystemPrompt,
  getSystemPrompt,
  getAllSystemPrompts,
  updateSystemPrompt,
  deleteSystemPrompt,
  setDefaultPrompt,
} from '../repositories/system-prompt-repo';

// Mock uuid and date utilities
jest.mock('@/utils/uuid', () => ({
  generateId: jest.fn(() => 'mock-uuid-1'),
}));

jest.mock('@/utils/date', () => ({
  getCurrentTimestamp: jest.fn(() => 1700000000000),
}));

import { generateId } from '@/utils/uuid';
import { getCurrentTimestamp } from '@/utils/date';

const mockGenerateId = generateId as jest.MockedFunction<typeof generateId>;
const mockGetCurrentTimestamp = getCurrentTimestamp as jest.MockedFunction<typeof getCurrentTimestamp>;

// Create a mock SQLiteDatabase
function createMockDb() {
  return {
    runAsync: jest.fn(() => Promise.resolve()),
    getFirstAsync: jest.fn(() => Promise.resolve(null)),
    getAllAsync: jest.fn(() => Promise.resolve([])),
  } as any;
}

describe('provider-repo', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    jest.clearAllMocks();
    mockGenerateId.mockReturnValue('mock-uuid-1');
    mockGetCurrentTimestamp.mockReturnValue(1700000000000);
  });

  describe('createProvider', () => {
    it('inserts a provider with correct values', async () => {
      const result = await createProvider(db, {
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiMode: 'responses',
        streamingEnabled: true,
      });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO providers'),
        'mock-uuid-1',
        'openai',
        'OpenAI',
        'https://api.openai.com/v1',
        'responses',
        1,
        1700000000000,
        1700000000000
      );
      expect(result.id).toBe('mock-uuid-1');
      expect(result.type).toBe('openai');
      expect(result.name).toBe('OpenAI');
      expect(result.baseUrl).toBe('https://api.openai.com/v1');
      expect(result.apiMode).toBe('responses');
      expect(result.streamingEnabled).toBe(true);
    });

    it('defaults streamingEnabled to true', async () => {
      const result = await createProvider(db, {
        type: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
      });

      expect(result.streamingEnabled).toBe(true);
      expect(db.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'anthropic',
        'Anthropic',
        'https://api.anthropic.com',
        null,
        1, // streaming_enabled = 1
        expect.any(Number),
        expect.any(Number)
      );
    });

    it('sets streamingEnabled to false when specified', async () => {
      const result = await createProvider(db, {
        type: 'custom',
        name: 'Custom',
        baseUrl: 'http://localhost:8080',
        streamingEnabled: false,
      });

      expect(result.streamingEnabled).toBe(false);
    });

    it('sets apiMode to null when not provided', async () => {
      const result = await createProvider(db, {
        type: 'anthropic',
        name: 'Anthropic',
        baseUrl: 'https://api.anthropic.com',
      });

      expect(result.apiMode).toBeNull();
    });
  });

  describe('getProvider', () => {
    it('returns null when provider not found', async () => {
      db.getFirstAsync.mockResolvedValue(null);
      const result = await getProvider(db, 'nonexistent');
      expect(result).toBeNull();
    });

    it('returns mapped provider when found', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'p1',
        type: 'openai',
        name: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        api_mode: 'responses',
        streaming_enabled: 1,
        created_at: 1700000000000,
        updated_at: 1700000000000,
      });

      const result = await getProvider(db, 'p1');

      expect(result).toEqual({
        id: 'p1',
        type: 'openai',
        name: 'OpenAI',
        baseUrl: 'https://api.openai.com/v1',
        apiMode: 'responses',
        streamingEnabled: true,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      });
    });
  });

  describe('getAllProviders', () => {
    it('returns empty array when no providers', async () => {
      db.getAllAsync.mockResolvedValue([]);
      const result = await getAllProviders(db);
      expect(result).toEqual([]);
    });

    it('maps all rows to provider objects', async () => {
      db.getAllAsync.mockResolvedValue([
        { id: 'p1', type: 'openai', name: 'OAI', base_url: 'url1', api_mode: null, streaming_enabled: 1, created_at: 100, updated_at: 100 },
        { id: 'p2', type: 'anthropic', name: 'ANT', base_url: 'url2', api_mode: null, streaming_enabled: 0, created_at: 200, updated_at: 200 },
      ]);

      const result = await getAllProviders(db);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('p1');
      expect(result[1].streamingEnabled).toBe(false);
    });
  });

  describe('updateProvider', () => {
    it('updates only specified fields', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'p1', type: 'openai', name: 'Updated', base_url: 'url', api_mode: null, streaming_enabled: 1, created_at: 100, updated_at: 1700000000000,
      });

      await updateProvider(db, 'p1', { name: 'Updated' });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE providers SET name = ?'),
        'Updated',
        1700000000000,
        'p1'
      );
    });

    it('returns current provider when no updates provided', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'p1', type: 'openai', name: 'Test', base_url: 'url', api_mode: null, streaming_enabled: 1, created_at: 100, updated_at: 100,
      });

      const result = await updateProvider(db, 'p1', {});

      expect(db.runAsync).not.toHaveBeenCalled();
      expect(result?.name).toBe('Test');
    });
  });

  describe('deleteProvider', () => {
    it('deletes provider by ID', async () => {
      await deleteProvider(db, 'p1');

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM providers WHERE id = ?',
        'p1'
      );
    });
  });
});

describe('session-repo', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    jest.clearAllMocks();
    mockGenerateId.mockReturnValue('mock-session-1');
    mockGetCurrentTimestamp.mockReturnValue(1700000000000);
  });

  describe('createSession', () => {
    it('inserts a session with correct values', async () => {
      const result = await createSession(db, {
        title: 'Test Chat',
        providerId: 'p1',
        modelId: 'm1',
        systemPromptId: 'sp1',
      });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions'),
        'mock-session-1',
        'Test Chat',
        'p1',
        'm1',
        'sp1',
        0,
        0,
        1700000000000,
        1700000000000
      );
      expect(result.id).toBe('mock-session-1');
      expect(result.totalCost).toBe(0);
      expect(result.tokenCount).toBe(0);
    });

    it('defaults systemPromptId to null', async () => {
      const result = await createSession(db, {
        title: 'No Prompt',
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(result.systemPromptId).toBeNull();
    });
  });

  describe('getAllSessions', () => {
    it('queries with ORDER BY updated_at DESC', async () => {
      db.getAllAsync.mockResolvedValue([]);
      await getAllSessions(db);

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM sessions ORDER BY updated_at DESC'
      );
    });

    it('maps rows correctly', async () => {
      db.getAllAsync.mockResolvedValue([
        { id: 's1', title: 'Chat 1', provider_id: 'p1', model_id: 'm1', system_prompt_id: null, total_cost: 0.5, token_count: 1000, created_at: 100, updated_at: 300 },
        { id: 's2', title: 'Chat 2', provider_id: 'p1', model_id: 'm1', system_prompt_id: 'sp1', total_cost: 0, token_count: 0, created_at: 200, updated_at: 200 },
      ]);

      const result = await getAllSessions(db);

      expect(result[0].id).toBe('s1');
      expect(result[0].totalCost).toBe(0.5);
      expect(result[1].systemPromptId).toBe('sp1');
    });
  });

  describe('updateSession', () => {
    it('always updates updated_at timestamp', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 's1', title: 'Updated', provider_id: 'p1', model_id: 'm1', system_prompt_id: null, total_cost: 0, token_count: 0, created_at: 100, updated_at: 1700000000000,
      });

      await updateSession(db, 's1', { title: 'Updated' });

      const sql = db.runAsync.mock.calls[0][0];
      expect(sql).toContain('updated_at = ?');
    });

    it('updates totalCost and tokenCount', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 's1', title: 'Chat', provider_id: 'p1', model_id: 'm1', system_prompt_id: null, total_cost: 1.5, token_count: 5000, created_at: 100, updated_at: 1700000000000,
      });

      await updateSession(db, 's1', { totalCost: 1.5, tokenCount: 5000 });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('total_cost = ?'),
        1.5,
        5000,
        1700000000000,
        's1'
      );
    });
  });

  describe('deleteSession', () => {
    it('deletes session by ID', async () => {
      await deleteSession(db, 's1');

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM sessions WHERE id = ?',
        's1'
      );
    });
  });
});

describe('message-repo', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    jest.clearAllMocks();
    mockGenerateId.mockReturnValue('mock-msg-1');
    mockGetCurrentTimestamp.mockReturnValue(1700000000000);
  });

  describe('createMessage', () => {
    it('inserts a message with all fields', async () => {
      const result = await createMessage(db, {
        sessionId: 's1',
        role: 'user',
        content: 'Hello!',
        providerId: 'p1',
        modelId: 'm1',
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        cachedTokens: 5,
        cost: 0.001,
      });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO messages'),
        'mock-msg-1',
        's1',
        'user',
        'Hello!',
        null,
        'p1',
        'm1',
        10,
        20,
        30,
        5,
        0.001,
        1700000000000
      );
      expect(result.id).toBe('mock-msg-1');
      expect(result.role).toBe('user');
      expect(result.promptTokens).toBe(10);
    });

    it('defaults optional fields to null', async () => {
      const result = await createMessage(db, {
        sessionId: 's1',
        role: 'assistant',
        content: 'Hi there',
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(result.thinkingContent).toBeNull();
      expect(result.promptTokens).toBeNull();
      expect(result.completionTokens).toBeNull();
      expect(result.totalTokens).toBeNull();
      expect(result.cachedTokens).toBeNull();
      expect(result.cost).toBeNull();
    });

    it('stores thinking content when provided', async () => {
      const result = await createMessage(db, {
        sessionId: 's1',
        role: 'assistant',
        content: 'Answer',
        thinkingContent: 'Let me think...',
        providerId: 'p1',
        modelId: 'm1',
      });

      expect(result.thinkingContent).toBe('Let me think...');
    });
  });

  describe('getMessagesBySession', () => {
    it('queries with ORDER BY created_at ASC', async () => {
      db.getAllAsync.mockResolvedValue([]);
      await getMessagesBySession(db, 's1');

      expect(db.getAllAsync).toHaveBeenCalledWith(
        'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC',
        's1'
      );
    });

    it('maps rows correctly', async () => {
      db.getAllAsync.mockResolvedValue([
        { id: 'm1', session_id: 's1', role: 'user', content: 'Hi', thinking_content: null, provider_id: 'p1', model_id: 'mod1', prompt_tokens: null, completion_tokens: null, total_tokens: null, cached_tokens: null, cost: null, created_at: 100 },
        { id: 'm2', session_id: 's1', role: 'assistant', content: 'Hello', thinking_content: 'hmm', provider_id: 'p1', model_id: 'mod1', prompt_tokens: 5, completion_tokens: 10, total_tokens: 15, cached_tokens: 0, cost: 0.0001, created_at: 200 },
      ]);

      const result = await getMessagesBySession(db, 's1');

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('Hi');
      expect(result[1].thinkingContent).toBe('hmm');
      expect(result[1].cost).toBe(0.0001);
    });
  });

  describe('deleteMessage', () => {
    it('deletes a single message by ID', async () => {
      await deleteMessage(db, 'm1');

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM messages WHERE id = ?',
        'm1'
      );
    });
  });

  describe('deleteMessagesAfter', () => {
    it('deletes messages after a timestamp for a session', async () => {
      await deleteMessagesAfter(db, 's1', 1700000000000);

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM messages WHERE session_id = ? AND created_at > ?',
        's1',
        1700000000000
      );
    });
  });
});

describe('system-prompt-repo', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
    jest.clearAllMocks();
    mockGenerateId.mockReturnValue('mock-sp-1');
    mockGetCurrentTimestamp.mockReturnValue(1700000000000);
  });

  describe('createSystemPrompt', () => {
    it('inserts a non-default prompt', async () => {
      const result = await createSystemPrompt(db, {
        name: 'General',
        content: 'You are a helpful assistant.',
      });

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO system_prompts'),
        'mock-sp-1',
        'General',
        'You are a helpful assistant.',
        0,
        1700000000000,
        1700000000000
      );
      expect(result.isDefault).toBe(false);
    });

    it('unsets existing defaults when creating a default prompt', async () => {
      await createSystemPrompt(db, {
        name: 'Default',
        content: 'Default prompt',
        isDefault: true,
      });

      // First call: unset all defaults
      expect(db.runAsync).toHaveBeenCalledWith(
        'UPDATE system_prompts SET is_default = 0'
      );
      // Second call: insert new prompt
      expect(db.runAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe('getSystemPrompt', () => {
    it('returns null when not found', async () => {
      db.getFirstAsync.mockResolvedValue(null);
      const result = await getSystemPrompt(db, 'nonexistent');
      expect(result).toBeNull();
    });

    it('maps row to SystemPrompt', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'sp1',
        name: 'Test',
        content: 'content',
        is_default: 1,
        created_at: 100,
        updated_at: 200,
      });

      const result = await getSystemPrompt(db, 'sp1');

      expect(result).toEqual({
        id: 'sp1',
        name: 'Test',
        content: 'content',
        isDefault: true,
        createdAt: 100,
        updatedAt: 200,
      });
    });
  });

  describe('getAllSystemPrompts', () => {
    it('returns all prompts mapped', async () => {
      db.getAllAsync.mockResolvedValue([
        { id: 'sp1', name: 'A', content: 'a', is_default: 0, created_at: 100, updated_at: 100 },
        { id: 'sp2', name: 'B', content: 'b', is_default: 1, created_at: 200, updated_at: 200 },
      ]);

      const result = await getAllSystemPrompts(db);

      expect(result).toHaveLength(2);
      expect(result[0].isDefault).toBe(false);
      expect(result[1].isDefault).toBe(true);
    });
  });

  describe('updateSystemPrompt', () => {
    it('updates name and content', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'sp1', name: 'New Name', content: 'new content', is_default: 0, created_at: 100, updated_at: 1700000000000,
      });

      await updateSystemPrompt(db, 'sp1', { name: 'New Name', content: 'new content' });

      const sql = db.runAsync.mock.calls[0][0];
      expect(sql).toContain('name = ?');
      expect(sql).toContain('content = ?');
    });

    it('unsets other defaults when setting isDefault to true', async () => {
      db.getFirstAsync.mockResolvedValue({
        id: 'sp1', name: 'Test', content: 'c', is_default: 1, created_at: 100, updated_at: 1700000000000,
      });

      await updateSystemPrompt(db, 'sp1', { isDefault: true });

      // First call: unset all defaults
      expect(db.runAsync).toHaveBeenCalledWith('UPDATE system_prompts SET is_default = 0');
    });
  });

  describe('deleteSystemPrompt', () => {
    it('deletes prompt by ID', async () => {
      await deleteSystemPrompt(db, 'sp1');

      expect(db.runAsync).toHaveBeenCalledWith(
        'DELETE FROM system_prompts WHERE id = ?',
        'sp1'
      );
    });
  });

  describe('setDefaultPrompt', () => {
    it('unsets all defaults then sets the specified one', async () => {
      await setDefaultPrompt(db, 'sp2');

      expect(db.runAsync).toHaveBeenCalledWith('UPDATE system_prompts SET is_default = 0');
      expect(db.runAsync).toHaveBeenCalledWith(
        'UPDATE system_prompts SET is_default = 1, updated_at = ? WHERE id = ?',
        1700000000000,
        'sp2'
      );
    });
  });
});
