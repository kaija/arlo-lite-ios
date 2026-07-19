import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { SendStopButton, deriveButtonState } from '../SendStopButton';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const View = require('react-native').View;
  return {
    __esModule: true,
    default: {
      View,
      createAnimatedComponent: (component: any) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (value: number) => value,
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: View,
    Svg: View,
    Path: View,
    Rect: View,
  };
});

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      accentText: '#FFFFFF',
      surfaceSecondary: '#E5E5EA',
      textTertiary: '#8E8E93',
    },
  }),
}));

describe('SendStopButton', () => {
  const mockOnSend = jest.fn();
  const mockOnStop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deriveButtonState', () => {
    it('returns "disabled" when no text and not streaming', () => {
      expect(deriveButtonState(false, false)).toBe('disabled');
    });

    it('returns "send" when has text and not streaming', () => {
      expect(deriveButtonState(true, false)).toBe('send');
    });

    it('returns "stop" when streaming, regardless of text', () => {
      expect(deriveButtonState(false, true)).toBe('stop');
      expect(deriveButtonState(true, true)).toBe('stop');
    });
  });

  describe('disabled state', () => {
    it('renders with disabled accessibility state', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={false}
          isStreaming={false}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual({ disabled: true });
    });

    it('does not call onSend or onStop when pressed in disabled state', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={false}
          isStreaming={false}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      fireEvent.press(getByRole('button'));
      expect(mockOnSend).not.toHaveBeenCalled();
      expect(mockOnStop).not.toHaveBeenCalled();
    });

  });

  describe('send-ready state', () => {
    it('calls onSend when pressed', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={true}
          isStreaming={false}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      fireEvent.press(getByRole('button'));
      expect(mockOnSend).toHaveBeenCalledTimes(1);
      expect(mockOnStop).not.toHaveBeenCalled();
    });

    it('is not disabled', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={true}
          isStreaming={false}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual({ disabled: false });
    });
  });

  describe('streaming state', () => {
    it('calls onStop when pressed', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={false}
          isStreaming={true}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      fireEvent.press(getByRole('button'));
      expect(mockOnStop).toHaveBeenCalledTimes(1);
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('calls onStop even when text is present', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={true}
          isStreaming={true}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      fireEvent.press(getByRole('button'));
      expect(mockOnStop).toHaveBeenCalledTimes(1);
      expect(mockOnSend).not.toHaveBeenCalled();
    });

    it('is not disabled', () => {
      const { getByRole } = render(
        <SendStopButton
          hasText={false}
          isStreaming={true}
          onSend={mockOnSend}
          onStop={mockOnStop}
        />,
      );
      const button = getByRole('button');
      expect(button.props.accessibilityState).toEqual({ disabled: false });
    });
  });
});
