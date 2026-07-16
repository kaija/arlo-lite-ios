import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { SessionRow } from '../SessionRow';
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
    withTiming: (value: number) => value,
    runOnJS: (fn: Function) => fn,
    FadeOut: { duration: () => ({}) },
  };
});

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  const mockGesture = {
    activeOffsetX: jest.fn().mockReturnThis(),
    failOffsetY: jest.fn().mockReturnThis(),
    hitSlop: jest.fn().mockReturnThis(),
    onStart: jest.fn().mockReturnThis(),
    onUpdate: jest.fn().mockReturnThis(),
    onEnd: jest.fn().mockReturnThis(),
  };
  return {
    Gesture: {
      Pan: () => mockGesture,
    },
    GestureDetector: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      text: '#1C1C1E',
      error: '#D32F2F',
      textSecondary: '#636366',
    },
    borderRadii: {
      full: 9999,
    },
  }),
}));

// Mock hooks
jest.mock('@/hooks/useSwipeToDelete', () => ({
  useSwipeToDelete: () => ({
    translateX: { value: 0 },
    panGesture: {},
    isRevealed: false,
    reset: jest.fn(),
  }),
}));

jest.mock('@/hooks/usePressAnimation', () => ({
  usePressAnimation: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}));

const mockSession: Session = {
  id: 'session-1',
  title: 'Test Session',
  providerId: 'openai',
  modelId: 'gpt-4o',
  systemPromptId: null,
  thinkingLevel: null,
  totalCost: 0,
  tokenCount: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

describe('SessionRow', () => {
  const mockOnSelect = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnRename = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the session title', () => {
    const { getByText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    expect(getByText('Test Session')).toBeTruthy();
  });

  it('calls onSelect when tapped', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    fireEvent.press(getByLabelText('Test Session'));
    expect(mockOnSelect).toHaveBeenCalledTimes(1);
  });

  it('calls onRename on long press', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    fireEvent(getByLabelText('Test Session'), 'onLongPress');
    expect(mockOnRename).toHaveBeenCalledTimes(1);
  });

  it('fires haptic feedback on long press', () => {
    const Haptics = require('expo-haptics');
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    fireEvent(getByLabelText('Test Session'), 'onLongPress');
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });

  it('calls onDelete when delete button is pressed', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    fireEvent.press(getByLabelText('Delete session'));
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('marks active session in accessibility label and state', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={true}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    const row = getByLabelText('Test Session, active session');
    expect(row.props.accessibilityState).toEqual({ selected: true });
  });

  it('provides VoiceOver custom actions for delete and rename', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    const pressable = getByLabelText('Test Session');
    expect(pressable.props.accessibilityActions).toEqual([
      { name: 'delete', label: 'Delete session' },
      { name: 'rename', label: 'Rename session' },
    ]);
  });

  it('handles delete accessibility action', () => {
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    const pressable = getByLabelText('Test Session');
    fireEvent(pressable, 'onAccessibilityAction', {
      nativeEvent: { actionName: 'delete' },
    });
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('handles rename accessibility action with haptic feedback', () => {
    const Haptics = require('expo-haptics');
    const { getByLabelText } = render(
      <SessionRow
        session={mockSession}
        isActive={false}
        onSelect={mockOnSelect}
        onDelete={mockOnDelete}
        onRename={mockOnRename}
      />,
    );
    const pressable = getByLabelText('Test Session');
    fireEvent(pressable, 'onAccessibilityAction', {
      nativeEvent: { actionName: 'rename' },
    });
    expect(mockOnRename).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith(
      Haptics.ImpactFeedbackStyle.Light,
    );
  });
});
