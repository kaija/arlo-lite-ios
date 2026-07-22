/**
 * Property tests for auto-create session on send with no active session.
 *
 * **Validates: Requirements 2.3, 2.4**
 *
 * Property 3: Auto-create session on send with no active session
 *
 * For any non-empty message text and valid provider/model configuration,
 * when activeSessionId is null, calling sendMessage(text) SHALL result in
 * a new session being created, set as active, and the user message appearing
 * in that session's messages.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockCreateSession = jest.fn<Promise<string>, [string, string]>();
const mockSetActiveSession = jest.fn<Promise<void>, [string | null]>();
const mockAddMessage = jest.fn();
let mockSessionStoreGetState: jest.Mock;

jest.mock('@/stores/session-store', () => {
  mockSessionStoreGetState = jest.fn();
  const useSessionStore = Object.assign(
    jest.fn((selector: any) => {
      const state = {
        activeSessionId: null as string | null,
        addMessage: mockAddMessage,
        messages: {} as Record<string, any[]>,
      };
      return selector(state);
    }),
    {
      getState: mockSessionStoreGetState,
    }
  );
  return { useSessionStore };
});

const mockChatStoreState = {
  isStreaming: false,
  streamContent: '',
  thinkingContent: '',
  activeProviderId: null as string | null,
  activeModelId: null as string | null,
  thinkingLevel: 'off' as const,
  setStreaming: jest.fn(),
  appendStreamContent: jest.fn(),
  appendThinkingContent: jest.fn(),
  clearStream: jest.fn(),
};

jest.mock('@/stores/chat-store', () => ({
  useChatStore: jest.fn((selector?: any) => {
    if (selector) return selector(mockChatStoreState);
    return mockChatStoreState;
  }),
}));

jest.mock('@/stores/provider-store', () => ({
  useProviderStore: jest.fn((selector: any) => {
    const state = {
      providers: [] as any[],
      models: [] as any[],
    };
    return selector(state);
  }),
}));

jest.mock('@/stores/settings-store', () => ({
  useSettingsStore: Object.assign(jest.fn(), {
    getState: jest.fn(() => ({
      defaultSystemPromptId: null,
      systemPrompts: [],
    })),
  }),
}));

jest.mock('@/services/completion-service', () => ({
  streamCompletion: jest.fn(),
  complete: jest.fn(),
}));

jest.mock('@/services/agent-loop', () => ({
  runAgentLoop: jest.fn(),
}));

jest.mock('@/domain/cost-calculator', () => ({
  calculateMessageCost: jest.fn(() => 0.001),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import fc from 'fast-check';
import { renderHook, act } from '@testing-library/react-native';
import { useChat } from '../useChat';
import { useSessionStore } from '@/stores/session-store';
import { useProviderStore } from '@/stores/provider-store';
import { streamCompletion } from '@/services/completion-service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupMocks(options: {
  activeSessionId?: string | null;
  activeProviderId?: string | null;
  activeModelId?: string | null;
  providers?: any[];
  models?: any[];
}) {
  const {
    activeSessionId = null,
    activeProviderId = null,
    activeModelId = null,
    providers = [],
    models = [],
  } = options;

  // Configure session store selector
  (useSessionStore as unknown as jest.Mock).mockImplementation((selector: any) => {
    const state = {
      activeSessionId,
      addMessage: mockAddMessage,
      messages: {},
    };
    return selector(state);
  });
  // Keep getState on the mock
  (useSessionStore as any).getState = mockSessionStoreGetState;

  // Configure chat store state
  mockChatStoreState.activeProviderId = activeProviderId;
  mockChatStoreState.activeModelId = activeModelId;

  // Configure provider store selector
  (useProviderStore as unknown as jest.Mock).mockImplementation((selector: any) => {
    const state = { providers, models };
    return selector(state);
  });
}

function createProviderConfig(id: string) {
  return {
    id,
    name: 'Test Provider',
    type: 'openai',
    baseUrl: 'https://api.test.com',
    apiMode: 'chat',
    streamingEnabled: true,
    generationParams: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  };
}

function createModelConfig(providerId: string, modelId: string) {
  return {
    id: `${providerId}-${modelId}`,
    providerId,
    modelId,
    displayName: `Model ${modelId}`,
    contextWindow: 128000,
    inputPrice: 0.01,
    outputPrice: 0.03,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Property 3: Auto-create session on send with no active session', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSession.mockResolvedValue('new-session-id');
    mockSetActiveSession.mockResolvedValue(undefined);
    mockAddMessage.mockResolvedValue({
      id: 'msg-1',
      sessionId: 'new-session-id',
      role: 'user',
      content: 'test',
      createdAt: Date.now(),
    });
  });

  it('creates a session and sets it active when activeSessionId is null and provider/model available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        async (messageText, providerId, modelId) => {
          jest.clearAllMocks();

          const newSessionId = `session-${providerId.slice(0, 8)}`;
          mockCreateSession.mockResolvedValue(newSessionId);
          mockSetActiveSession.mockResolvedValue(undefined);
          mockAddMessage.mockResolvedValue({
            id: 'msg-1',
            sessionId: newSessionId,
            role: 'user',
            content: messageText.trim(),
            createdAt: Date.now(),
          });

          // Mock streaming to resolve immediately
          (streamCompletion as jest.Mock).mockReturnValue(
            (async function* () {
              yield { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
            })()
          );

          // Configure: no active session, but provider and model are available
          setupMocks({
            activeSessionId: null,
            activeProviderId: providerId,
            activeModelId: modelId,
            providers: [createProviderConfig(providerId)],
            models: [createModelConfig(providerId, modelId)],
          });

          mockSessionStoreGetState.mockReturnValue({
            createSession: mockCreateSession,
            setActiveSession: mockSetActiveSession,
            messages: { [newSessionId]: [{ id: 'msg-1', sessionId: newSessionId, role: 'user', content: messageText.trim(), createdAt: Date.now() }] },
          });

          const { result } = renderHook(() => useChat());

          await act(async () => {
            await result.current.sendMessage(messageText);
          });

          // createSession must be called with the active provider and model
          expect(mockCreateSession).toHaveBeenCalledWith(providerId, modelId);
          // setActiveSession must be called with the new session ID
          expect(mockSetActiveSession).toHaveBeenCalledWith(newSessionId);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('does NOT create session and does NOT send message when no provider/model configured', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        async (messageText) => {
          jest.clearAllMocks();

          // Configure: no active session AND no provider/model configured
          setupMocks({
            activeSessionId: null,
            activeProviderId: null,
            activeModelId: null,
            providers: [],
            models: [],
          });

          mockSessionStoreGetState.mockReturnValue({
            createSession: mockCreateSession,
            setActiveSession: mockSetActiveSession,
            messages: {},
          });

          const { result } = renderHook(() => useChat());

          await act(async () => {
            await result.current.sendMessage(messageText);
          });

          // createSession must NOT be called — no provider available
          expect(mockCreateSession).not.toHaveBeenCalled();
          // addMessage must NOT be called — send should abort with error
          expect(mockAddMessage).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 20 },
    );
  });

  it('sends the message in the newly created session after auto-creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        async (messageText) => {
          jest.clearAllMocks();

          const newSessionId = 'auto-created-session';
          const providerId = 'provider-1';
          const modelId = 'model-1';

          mockCreateSession.mockResolvedValue(newSessionId);
          mockSetActiveSession.mockResolvedValue(undefined);
          mockAddMessage.mockResolvedValue({
            id: 'msg-auto',
            sessionId: newSessionId,
            role: 'user',
            content: messageText.trim(),
            createdAt: Date.now(),
          });

          // Mock streaming to resolve immediately
          (streamCompletion as jest.Mock).mockReturnValue(
            (async function* () {
              yield { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
            })()
          );

          // Configure: no active session, but provider and model are available
          setupMocks({
            activeSessionId: null,
            activeProviderId: providerId,
            activeModelId: modelId,
            providers: [createProviderConfig(providerId)],
            models: [createModelConfig(providerId, modelId)],
          });

          mockSessionStoreGetState.mockReturnValue({
            createSession: mockCreateSession,
            setActiveSession: mockSetActiveSession,
            messages: { [newSessionId]: [{ id: 'msg-auto', sessionId: newSessionId, role: 'user', content: messageText.trim(), createdAt: Date.now() }] },
          });

          const { result } = renderHook(() => useChat());

          await act(async () => {
            await result.current.sendMessage(messageText);
          });

          // The message should be sent in the newly created session (not null)
          expect(mockAddMessage).toHaveBeenCalledWith(
            newSessionId,
            expect.objectContaining({
              sessionId: newSessionId,
              role: 'user',
              content: messageText.trim(),
            })
          );
        },
      ),
      { numRuns: 20 },
    );
  });
});
