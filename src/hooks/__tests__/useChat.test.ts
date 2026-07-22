/**
 * Tests for the useChat hook — sendMessage gate behavior.
 *
 * Validates:
 * - Rejects send with supportsImageInput: false and surfaces non-retryable error (Req 4.4)
 * - No API call made when gate rejects
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
  flushStreamBuffer: jest.fn(),
};

jest.mock('@/stores/chat-store', () => ({
  useChatStore: Object.assign(
    jest.fn((selector?: any) => {
      if (selector) return selector(mockChatStoreState);
      return mockChatStoreState;
    }),
    {
      getState: jest.fn(() => mockChatStoreState),
    }
  ),
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
          generationParams: { temperature: 0.7, maxTokensEnabled: false },
        },
      ],
      models: [
        {
          id: 'provider-1-model-1',
          providerId: 'provider-1',
          modelId: 'model-1',
          displayName: 'Test Model (no images)',
          contextWindow: 128000,
          inputPrice: 0.01,
          outputPrice: 0.03,
          supportsImageInput: false,
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

jest.mock('@/services/completion-service', () => ({
  streamCompletion: jest.fn(),
  complete: jest.fn(),
}));

const mockRunAgentLoop = jest.fn();

jest.mock('@/services/agent-loop', () => ({
  runAgentLoop: (...args: any[]) => mockRunAgentLoop(...args),
}));

jest.mock('@/domain/cost-calculator', () => ({
  calculateMessageCost: jest.fn(() => 0.001),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { renderHook, act } from '@testing-library/react-native';
import { useChat } from '../useChat';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useChat - supportsImageInput gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionStoreGetState.mockReturnValue({
      messages: {
        'session-1': [
          { id: 'msg-1', role: 'user', content: 'Hello', createdAt: 1000 },
        ],
      },
      createSession: jest.fn(),
      setActiveSession: jest.fn(),
    });
    mockAddMessage.mockResolvedValue({
      id: 'msg-new',
      sessionId: 'session-1',
      role: 'user',
      content: 'test',
      createdAt: 2000,
    });
  });

  it('rejects send with attachments when supportsImageInput is false and surfaces non-retryable error', async () => {
    const { result } = renderHook(() => useChat());

    const imageAttachment = {
      type: 'image_url' as const,
      image_url: { url: 'data:image/jpeg;base64,abc123' },
    };

    await act(async () => {
      await result.current.sendMessage('Look at this', [imageAttachment]);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toBe('Active model does not support image input');
    expect(result.current.error!.isRetryable).toBe(false);
  });

  it('does not call agent loop or add user message when gate rejects', async () => {
    const { result } = renderHook(() => useChat());

    const imageAttachment = {
      type: 'image_url' as const,
      image_url: { url: 'data:image/png;base64,xyz' },
    };

    await act(async () => {
      await result.current.sendMessage('test', [imageAttachment]);
    });

    // No API call made
    expect(mockRunAgentLoop).not.toHaveBeenCalled();
    // No user message persisted (addMessage not called)
    expect(mockAddMessage).not.toHaveBeenCalled();
  });
});
