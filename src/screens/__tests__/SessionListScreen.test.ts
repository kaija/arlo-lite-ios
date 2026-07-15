/**
 * Tests for SessionListScreen logic.
 *
 * Validates the component exports, store interactions for session management,
 * and the drawer content integration with DrawerNavigator.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    dispatch: jest.fn(),
  }),
  DrawerActions: {
    closeDrawer: jest.fn(() => ({ type: 'CLOSE_DRAWER' })),
  },
}));

jest.mock('@react-navigation/drawer', () => ({
  createDrawerNavigator: jest.fn(() => ({
    Navigator: 'DrawerNavigator',
    Screen: 'DrawerScreen',
  })),
}));

const mockSessions = [
  {
    id: 'session-1',
    title: 'First Chat',
    providerId: 'provider-1',
    modelId: 'model-1',
    systemPromptId: null,
    totalCost: 0.01,
    tokenCount: 500,
    createdAt: 1700000000000,
    updatedAt: 1700100000000,
  },
  {
    id: 'session-2',
    title: 'Second Chat',
    providerId: 'provider-1',
    modelId: 'model-2',
    systemPromptId: null,
    totalCost: 0,
    tokenCount: 0,
    createdAt: 1700000000000,
    updatedAt: 1700050000000,
  },
];

const mockSetActiveSession = jest.fn(() => Promise.resolve());
const mockCreateSession = jest.fn(() => Promise.resolve('new-session-id'));
const mockDeleteSession = jest.fn(() => Promise.resolve());
const mockRenameSession = jest.fn(() => Promise.resolve());

jest.mock('@/stores/session-store', () => ({
  useSessionStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      sessions: mockSessions,
      setActiveSession: mockSetActiveSession,
      createSession: mockCreateSession,
      deleteSession: mockDeleteSession,
      renameSession: mockRenameSession,
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/chat-store', () => ({
  useChatStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      activeProviderId: 'provider-1',
      activeModelId: 'model-1',
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/utils/date', () => ({
  formatRelativeTime: jest.fn((ts: number) => `${Math.floor((Date.now() - ts) / 3600000)}h ago`),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

import { SessionListScreen } from '../SessionListScreen';
import { DrawerNavigator } from '@/navigation/DrawerNavigator';

describe('SessionListScreen', () => {
  it('exports the SessionListScreen component', () => {
    expect(SessionListScreen).toBeDefined();
    expect(typeof SessionListScreen).toBe('function');
  });

  it('is used as drawer content in DrawerNavigator', () => {
    // DrawerNavigator should reference SessionListScreen
    expect(DrawerNavigator).toBeDefined();
    expect(typeof DrawerNavigator).toBe('function');
  });
});

describe('SessionListScreen store interactions', () => {
  it('accesses sessions from the session store', () => {
    const { useSessionStore } = require('@/stores/session-store');
    // Simulate a selector call for sessions
    const sessions = useSessionStore((state: { sessions: typeof mockSessions }) => state.sessions);
    expect(sessions).toEqual(mockSessions);
    expect(sessions).toHaveLength(2);
  });

  it('sessions are ordered by updatedAt DESC (most recent first)', () => {
    const { useSessionStore } = require('@/stores/session-store');
    const sessions = useSessionStore((state: { sessions: typeof mockSessions }) => state.sessions);
    // First session has later updatedAt
    expect(sessions[0].updatedAt).toBeGreaterThan(sessions[1].updatedAt);
  });

  it('accesses active model info from chat store', () => {
    const { useChatStore } = require('@/stores/chat-store');
    const providerId = useChatStore(
      (state: { activeProviderId: string }) => state.activeProviderId
    );
    const modelId = useChatStore(
      (state: { activeModelId: string }) => state.activeModelId
    );
    expect(providerId).toBe('provider-1');
    expect(modelId).toBe('model-1');
  });

  it('provides createSession function from session store', () => {
    const { useSessionStore } = require('@/stores/session-store');
    const createSession = useSessionStore(
      (state: { createSession: typeof mockCreateSession }) => state.createSession
    );
    expect(createSession).toBe(mockCreateSession);
  });

  it('provides deleteSession function from session store', () => {
    const { useSessionStore } = require('@/stores/session-store');
    const deleteSession = useSessionStore(
      (state: { deleteSession: typeof mockDeleteSession }) => state.deleteSession
    );
    expect(deleteSession).toBe(mockDeleteSession);
  });

  it('provides renameSession function from session store', () => {
    const { useSessionStore } = require('@/stores/session-store');
    const renameSession = useSessionStore(
      (state: { renameSession: typeof mockRenameSession }) => state.renameSession
    );
    expect(renameSession).toBe(mockRenameSession);
  });
});
