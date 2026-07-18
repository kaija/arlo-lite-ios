/**
 * Snapshot tests for InputChrome in three states: empty input, has text, and streaming.
 *
 * Requirements: 6.1, 6.9, 6.10, 6.11
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { fireEvent } from '@testing-library/react-native';

import { InputChrome } from '../InputChrome';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, style, ...props }: any) => (
      <View style={style} testID="blur-view" {...props}>{children}</View>
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

// ─── Default Props ────────────────────────────────────────────────────────────

const defaultProps = {
  activeModelName: 'GPT-4o',
  thinkingLevel: 'off' as const,
  supportsThinking: true,
  contextUsagePercent: 25,
  isStreaming: false,
  onModelPickerOpen: jest.fn(),
  onThinkingCycle: jest.fn(),
  onSend: jest.fn(),
  onStop: jest.fn(),
  onAttach: jest.fn(),
  onContextRingPress: jest.fn(),
};

// ─── Snapshot Tests ───────────────────────────────────────────────────────────

describe('InputChrome Snapshots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('matches snapshot in empty input state', () => {
    const { toJSON } = render(<InputChrome {...defaultProps} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot when text input has content', () => {
    const { toJSON, getByLabelText } = render(<InputChrome {...defaultProps} />);
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello, how are you?');
    const tree = toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('matches snapshot in streaming state', () => {
    const { toJSON } = render(
      <InputChrome {...defaultProps} isStreaming={true} />,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
