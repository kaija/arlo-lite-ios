import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { SessionSidebar } from '../SessionSidebar';
import type { Session } from '@/database/repositories/session-repo';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (component: any) => component,
    },
    useSharedValue: (initial: number | boolean) => ({ value: initial }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (value: number) => value,
    FadeOut: { duration: () => ({}) },
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: () => ({
        activeOffsetX: () => ({
          failOffsetY: () => ({
            onUpdate: () => ({
              onEnd: () => ({}),
            }),
          }),
        }),
      }),
    },
  };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Path: View,
  };
});

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      background: '#FFFFFF',
      surface: '#F2F2F7',
      surfaceSecondary: '#E5E5EA',
      text: '#1C1C1E',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      accent: '#5856D6',
      accentText: '#FFFFFF',
      border: '#D1D1D6',
      error: '#D32F2F',
    },
    spacing: {
      sm: 8,
      md: 12,
      lg: 16,
      xl: 20,
    },
    borderRadii: {
      md: 8,
      lg: 12,
    },
  }),
}));

// Mock useSwipeToDelete
jest.mock('@/hooks/useSwipeToDelete', () => ({
  useSwipeToDelete: () => ({
    translateX: { value: 0 },
    panGesture: {},
    isRevealed: false,
    reset: jest.fn(),
  }),
}));

// Mock usePressAnimation
jest.mock('@/hooks/usePressAnimation', () => ({
  usePressAnimation: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}));

function createSession(overrides: Partial<Session> = {}): Session {
  const now = Date.now();
  return {
    id: `session-${Math.random().toString(36).slice(2)}`,
    title: 'Test Session',
    providerId: 'provider-1',
    modelId: 'model-1',
    systemPromptId: null,
    thinkingLevel: null,
    totalCost: 0,
    tokenCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SessionSidebar', () => {
  const mockOnSessionSelect = jest.fn();
  const mockOnSessionDelete = jest.fn();
  const mockOnSessionRename = jest.fn();
  const mockOnNewChat = jest.fn();

  const defaultProps = {
    sessions: [] as Session[],
    activeSessionId: null,
    onSessionSelect: mockOnSessionSelect,
    onSessionDelete: mockOnSessionDelete,
    onSessionRename: mockOnSessionRename,
    onNewChat: mockOnNewChat,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders session titles in the list', () => {
    const sessions = [
      createSession({ id: '1', title: 'Hello World', updatedAt: Date.now() }),
      createSession({ id: '2', title: 'Another Chat', updatedAt: Date.now() - 1000 }),
    ];
    const { getByText } = render(
      <SessionSidebar {...defaultProps} sessions={sessions} />,
    );
    expect(getByText('Hello World')).toBeTruthy();
    expect(getByText('Another Chat')).toBeTruthy();
  });

  it('renders date group section headers in uppercase', () => {
    const sessions = [
      createSession({ id: '1', title: 'Today Session', updatedAt: Date.now() }),
    ];
    const { getByText } = render(
      <SessionSidebar {...defaultProps} sessions={sessions} />,
    );
    expect(getByText('TODAY')).toBeTruthy();
  });

  it('does not render footer hint when no sessions exist', () => {
    const { queryByText } = render(<SessionSidebar {...defaultProps} />);
    expect(queryByText('Swipe left to delete · hold to rename')).toBeNull();
  });

  it('calls onSessionSelect with correct id when a row is tapped', () => {
    const sessions = [
      createSession({ id: 'abc-123', title: 'My Chat', updatedAt: Date.now() }),
    ];
    const { getByText } = render(
      <SessionSidebar {...defaultProps} sessions={sessions} />,
    );
    fireEvent.press(getByText('My Chat'));
    expect(mockOnSessionSelect).toHaveBeenCalledWith('abc-123');
  });

  it('groups sessions from different dates into separate sections', () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000 - 1000; // 1 day + 1s ago
    const sessions = [
      createSession({ id: '1', title: 'Today Chat', updatedAt: now }),
      createSession({ id: '2', title: 'Yesterday Chat', updatedAt: yesterday }),
    ];
    const { getByText } = render(
      <SessionSidebar {...defaultProps} sessions={sessions} />,
    );
    expect(getByText('TODAY')).toBeTruthy();
    expect(getByText('YESTERDAY')).toBeTruthy();
  });
});
