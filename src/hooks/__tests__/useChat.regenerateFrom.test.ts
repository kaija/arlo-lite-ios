/**
 * Unit tests for the regenerateFrom flow in useChat.
 *
 * Validates:
 * - deleteMessageAndSubsequent is called before resendContext
 * - Error handling for ProviderError and generic errors
 * - No-op when activeSessionId is null
 *
 * **Validates: Requirements 5.1–5.5, 6.4**
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockDeleteMessageAndSubsequent = jest.fn<Promise<void>, [string, string]>();
const mockAddMessage = jest.fn();

let mockSessionStoreGetState: jest.Mock;

jest.mock('@/stores/session-store', () => {
  mockSessionStoreGetState = jest.fn();
  const useSessionStore = Object.assign(
    jest.fn((selector: any) => {
      const state = {
        activeSessionId: 'session-1',
        addMessage: mockAddMessage,
        messages: {
          'session-1': [
            { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
            { id: 'msg-2', role: 'assistant', content: 'Hi!', createdAt: 2000 },
          ],
        },
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
  activeProviderId: 'provider-1',
  activeModelId: 'model-1',
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
      providers: [
        {
          id: 'provider-1',
          name: 'Test Provider',
          type: 'openai',
          baseUrl: 'https://api.test.com',
          apiMode: 'chat',
          streamingEnabled: true,
          generationParams: { temperature: 0.7, maxTokens: 4096 },
        },
      ],
      models: [
        {
          id: 'provider-1-model-1',
          providerId: 'provider-1',
          modelId: 'model-1',
          displayName: 'Test Model',
          contextWindow: 128000,
          inputPrice: 0.01,
          outputPrice: 0.03,
        },
      ],
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

const mockStreamCompletion = jest.fn();

jest.mock('@/services/completion-service', () => ({
  streamCompletion: (...args: any[]) => mockStreamCompletion(...args),
  complete: jest.fn(),
}));

jest.mock('@/services/agent-loop', () => ({
  runAgentLoop: jest.fn().mockResolvedValue({
    content: 'Agent response',
    totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    terminationReason: 'final_response',
    iterationCount: 1,
  }),
}));

jest.mock('@/domain/cost-calculator', () => ({
  calculateMessageCost: jest.fn(() => 0.001),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { renderHook, act } from '@testing-library/react-native';
import { useChat } from '../useChat';
import { useSessionStore } from '@/stores/session-store';
import { ProviderError } from '@/providers/errors';
import { runAgentLoop } from '@/services/agent-loop';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setupActiveSession(sessionId: string | null = 'session-1') {
  (useSessionStore as unknown as jest.Mock).mockImplementation((selector: any) => {
    const state = {
      activeSessionId: sessionId,
      addMessage: mockAddMessage,
      messages: {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
          { id: 'msg-2', role: 'assistant', content: 'Hi!', createdAt: 2000 },
        ],
      },
    };
    return selector(state);
  });
  (useSessionStore as any).getState = mockSessionStoreGetState;
}

function setupDefaultGetState() {
  mockSessionStoreGetState.mockReturnValue({
    deleteMessageAndSubsequent: mockDeleteMessageAndSubsequent,
    messages: {
      'session-1': [
        { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
      ],
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useChat - regenerateFrom', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupActiveSession('session-1');
    setupDefaultGetState();
    mockDeleteMessageAndSubsequent.mockResolvedValue(undefined);
    mockAddMessage.mockResolvedValue({
      id: 'msg-new',
      sessionId: 'session-1',
      role: 'assistant',
      content: 'New response',
      createdAt: 3000,
    });
    mockStreamCompletion.mockReturnValue(
      (async function* () {
        yield { type: 'text', content: 'New response' };
        yield { type: 'done', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
      })()
    );
  });

  it('calls deleteMessageAndSubsequent then resendContext (happy path)', async () => {
    const callOrder: string[] = [];

    mockDeleteMessageAndSubsequent.mockImplementation(async () => {
      callOrder.push('deleteMessageAndSubsequent');
    });
    (runAgentLoop as jest.Mock).mockImplementation(async () => {
      callOrder.push('resendContext');
      return {
        content: 'Agent response',
        totalUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        terminationReason: 'final_response',
        iterationCount: 1,
      };
    });

    // After deletion, getState returns truncated messages for resendContext
    mockSessionStoreGetState.mockReturnValue({
      deleteMessageAndSubsequent: mockDeleteMessageAndSubsequent,
      messages: {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
        ],
      },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateFrom('msg-2');
    });

    // Verify deleteMessageAndSubsequent was called with correct args
    expect(mockDeleteMessageAndSubsequent).toHaveBeenCalledWith('session-1', 'msg-2');

    // Verify order: delete happens before streaming (resend)
    expect(callOrder[0]).toBe('deleteMessageAndSubsequent');
    expect(callOrder[1]).toBe('resendContext');
  });

  it('surfaces error and does NOT call resendContext when deleteMessageAndSubsequent throws', async () => {
    const deleteError = new Error('Database write failed');
    mockDeleteMessageAndSubsequent.mockRejectedValue(deleteError);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateFrom('msg-2');
    });

    // Error should be surfaced
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toBe('Database write failed');
    expect(result.current.error!.isRetryable).toBe(true);

    // streamCompletion should NOT have been called (resendContext not reached)
    expect(mockStreamCompletion).not.toHaveBeenCalled();
  });

  it('maps ProviderError to ChatError when resendContext throws a ProviderError', async () => {
    const providerError = new ProviderError(
      'Rate limit exceeded',
      'rate_limit',
      30
    );

    (runAgentLoop as jest.Mock).mockRejectedValue(providerError);

    // After deletion, getState returns messages for resendContext
    mockSessionStoreGetState.mockReturnValue({
      deleteMessageAndSubsequent: mockDeleteMessageAndSubsequent,
      messages: {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
        ],
      },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateFrom('msg-2');
    });

    // Error should be mapped from ProviderError
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toBe('Rate limit exceeded');
    expect(result.current.error!.isRetryable).toBe(true);
  });

  it('creates ChatError with isRetryable: true when resendContext throws a generic error', async () => {
    const genericError = new Error('Network timeout');

    (runAgentLoop as jest.Mock).mockRejectedValue(genericError);

    // After deletion, getState returns messages for resendContext
    mockSessionStoreGetState.mockReturnValue({
      deleteMessageAndSubsequent: mockDeleteMessageAndSubsequent,
      messages: {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
        ],
      },
    });

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateFrom('msg-2');
    });

    // Generic error should have isRetryable: true
    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toBe('Network timeout');
    expect(result.current.error!.isRetryable).toBe(true);
  });

  it('returns early (no-op) when activeSessionId is null', async () => {
    setupActiveSession(null);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.regenerateFrom('msg-2');
    });

    // No calls to deleteMessageAndSubsequent or streamCompletion
    expect(mockDeleteMessageAndSubsequent).not.toHaveBeenCalled();
    expect(mockStreamCompletion).not.toHaveBeenCalled();
    // No error should be set
    expect(result.current.error).toBeNull();
  });
});
