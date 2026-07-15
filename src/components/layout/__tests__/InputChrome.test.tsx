import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { InputChrome } from '../InputChrome';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style }: any) => (
      <View style={style} testID="blur-view">{children}</View>
    ),
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light' },
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Svg: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Circle: (props: any) => <View {...props} />,
    Path: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
  };
});

jest.mock('@/components/overlays/ToastProvider', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      accentText: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      border: '#D1D1D6',
      surfaceSecondary: '#F2F2F7',
      contextWarning: '#FF9500',
      contextCritical: '#D32F2F',
    },
    borderRadii: {
      full: 9999,
      input: 17,
    },
    isDark: false,
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// ─── Test Suite ───────────────────────────────────────────────────────────────

const defaultProps = {
  activeModelName: 'GPT-4o',
  thinkingLevel: 'off' as const,
  supportsThinking: true,
  contextUsagePercent: 30,
  isStreaming: false,
  onModelPickerOpen: jest.fn(),
  onThinkingCycle: jest.fn(),
  onSend: jest.fn(),
  onStop: jest.fn(),
  onAttach: jest.fn(),
};

describe('InputChrome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the model chip with the active model name', () => {
    const { getByText } = render(<InputChrome {...defaultProps} />);
    expect(getByText('GPT-4o')).toBeTruthy();
  });

  it('renders the attachment button', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    expect(getByLabelText('Attach file')).toBeTruthy();
  });

  it('calls onAttach when the attachment button is pressed', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    fireEvent.press(getByLabelText('Attach file'));
    expect(defaultProps.onAttach).toHaveBeenCalledTimes(1);
  });

  it('renders the message input field', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    expect(getByLabelText('Message input')).toBeTruthy();
  });

  it('renders ThinkingLevelSelector when supportsThinking is true', () => {
    const { getByLabelText } = render(
      <InputChrome {...defaultProps} supportsThinking={true} />,
    );
    // The selector announces the level via accessibility
    expect(getByLabelText(/thinkingLevel/)).toBeTruthy();
  });

  it('hides ThinkingLevelSelector when supportsThinking is false', () => {
    const { queryByLabelText } = render(
      <InputChrome {...defaultProps} supportsThinking={false} />,
    );
    expect(queryByLabelText(/thinkingLevel/)).toBeNull();
  });

  it('renders the context ring', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    expect(getByLabelText(/Context usage/)).toBeTruthy();
  });

  it('renders send button in disabled state when input is empty', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    expect(getByLabelText('Send message, disabled')).toBeTruthy();
  });

  it('calls onModelPickerOpen when the model chip is pressed', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    fireEvent.press(getByLabelText(/Active model/));
    expect(defaultProps.onModelPickerOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onSend with trimmed text when send is triggered', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, '  Hello world  ');
    // The send button should now be enabled — find it by label
    const sendButton = getByLabelText('Send message');
    fireEvent.press(sendButton);
    expect(defaultProps.onSend).toHaveBeenCalledWith('Hello world');
  });

  it('clears the input after sending', () => {
    const { getByLabelText } = render(<InputChrome {...defaultProps} />);
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Test message');
    const sendButton = getByLabelText('Send message');
    fireEvent.press(sendButton);
    // After send, the input should be cleared (value back to empty)
    expect(input.props.value).toBe('');
  });

  it('shows stop button when streaming', () => {
    const { getByLabelText } = render(
      <InputChrome {...defaultProps} isStreaming={true} />,
    );
    expect(getByLabelText('Stop generation')).toBeTruthy();
  });

  it('calls onStop when stop button is pressed during streaming', () => {
    const { getByLabelText } = render(
      <InputChrome {...defaultProps} isStreaming={true} />,
    );
    fireEvent.press(getByLabelText('Stop generation'));
    expect(defaultProps.onStop).toHaveBeenCalledTimes(1);
  });
});
