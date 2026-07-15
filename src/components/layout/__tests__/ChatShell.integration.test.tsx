/**
 * Integration test: Send message flow → streaming state → cursor visibility.
 *
 * Validates the end-to-end flow:
 * 1. User types text in InputChrome
 * 2. User presses the send button
 * 3. The streaming state begins (SendStopButton switches to stop icon)
 * 4. A blinking cursor appears (StreamingMessage rendered)
 * 5. When streaming completes, the cursor disappears
 *
 * Requirements: 4.1, 4.6, 15.4
 */

import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { View, Text } from 'react-native';

import { InputChrome, InputChromeProps } from '../InputChrome';
import { StreamingMessage, StreamingMessageProps } from '../../chat/StreamingMessage';
import { deriveButtonState } from '../../input/SendStopButton';

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
      background: '#FFFFFF',
      contextWarning: '#FF9500',
      contextCritical: '#D32F2F',
    },
    borderRadii: {
      full: 9999,
      input: 17,
    },
    isDark: false,
    typography: {
      caption2: { fontSize: 11 },
      code: { fontFamily: 'monospace' },
    },
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: any) => {
      if (typeof defaultValue === 'string') return defaultValue;
      if (typeof defaultValue === 'object' && defaultValue?.defaultValue) {
        return defaultValue.defaultValue;
      }
      return key;
    },
  }),
}));

// ─── Helper: Composite Test Component ─────────────────────────────────────────

/**
 * A composite component that simulates the integration between InputChrome
 * and StreamingMessage. Manages the isStreaming state internally so we can
 * exercise the full send → stream → complete flow.
 */
interface IntegrationHarnessProps {
  onSend?: (text: string) => void;
  onStop?: () => void;
}

function IntegrationHarness({ onSend, onStop }: IntegrationHarnessProps) {
  const [isStreaming, setIsStreaming] = React.useState(false);
  const [streamContent, setStreamContent] = React.useState('');

  const handleSend = (text: string) => {
    onSend?.(text);
    // Simulate streaming start
    setIsStreaming(true);
    setStreamContent('');
  };

  const handleStop = () => {
    onStop?.();
    setIsStreaming(false);
    setStreamContent('');
  };

  // Expose stream simulation to tests via testID buttons
  const simulateStreamChunk = () => {
    setStreamContent((prev) => prev + 'Hello ');
  };

  const simulateStreamComplete = () => {
    setIsStreaming(false);
  };

  return (
    <View testID="integration-harness">
      <InputChrome
        activeModelName="GPT-4o"
        thinkingLevel="off"
        supportsThinking={false}
        contextUsagePercent={25}
        isStreaming={isStreaming}
        onModelPickerOpen={() => {}}
        onThinkingCycle={() => {}}
        onSend={handleSend}
        onStop={handleStop}
        onAttach={() => {}}
      />

      {isStreaming && (
        <StreamingMessage
          content={streamContent}
          thinkingContent=""
          isThinking={false}
          modelName="GPT-4o"
          tokenRate={12.5}
          showAvatars={true}
        />
      )}

      {/* Control buttons for test simulation */}
      <View testID="test-controls">
        <Text testID="simulate-chunk" onPress={simulateStreamChunk}>
          chunk
        </Text>
        <Text testID="simulate-complete" onPress={simulateStreamComplete}>
          complete
        </Text>
      </View>
    </View>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChatShell Integration: Send → Stream → Cursor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('send button is disabled when input is empty', () => {
    const { getByLabelText } = render(<IntegrationHarness />);
    expect(getByLabelText('Send message, disabled')).toBeTruthy();
  });

  it('send button becomes active when user types text', () => {
    const { getByLabelText } = render(<IntegrationHarness />);
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello world');
    expect(getByLabelText('Send message')).toBeTruthy();
  });

  it('sends message and transitions to streaming state with stop button', () => {
    const onSend = jest.fn();
    const { getByLabelText } = render(<IntegrationHarness onSend={onSend} />);

    // Type text
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Tell me a joke');

    // Press send
    const sendButton = getByLabelText('Send message');
    fireEvent.press(sendButton);

    // Verify send was called with trimmed text
    expect(onSend).toHaveBeenCalledWith('Tell me a joke');

    // Verify button switched to stop mode
    expect(getByLabelText('Stop generation')).toBeTruthy();
  });

  it('streaming message with blinking cursor appears after send', () => {
    const { getByLabelText, getAllByLabelText } = render(<IntegrationHarness />);

    // Type and send
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Hello');
    fireEvent.press(getByLabelText('Send message'));

    // StreamingMessage should now be rendered (contains the cursor)
    // Multiple elements may carry this label (EqualiserAnimation + cursor),
    // so we verify at least one exists
    const cursorElements = getAllByLabelText('Generating response');
    expect(cursorElements.length).toBeGreaterThan(0);
  });

  it('streaming message displays the model name and token rate', () => {
    const { getByLabelText, getAllByText, getByText } = render(<IntegrationHarness />);

    // Trigger streaming
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Hi');
    fireEvent.press(getByLabelText('Send message'));

    // Model name should appear in StreamingMessage (also present in ModelChip)
    const modelLabels = getAllByText('GPT-4o');
    expect(modelLabels.length).toBeGreaterThanOrEqual(2); // ModelChip + StreamingMessage
    // Token rate should be visible
    expect(getByText('12.5 tok/s')).toBeTruthy();
  });

  it('cursor disappears when streaming completes', () => {
    const { getByLabelText, queryAllByLabelText, getAllByLabelText, getByTestId } = render(
      <IntegrationHarness />,
    );

    // Start streaming
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Test');
    fireEvent.press(getByLabelText('Send message'));

    // Verify cursor is present (StreamingMessage rendered)
    const cursorElements = getAllByLabelText('Generating response');
    expect(cursorElements.length).toBeGreaterThan(0);

    // Simulate stream completion
    act(() => {
      fireEvent.press(getByTestId('simulate-complete'));
    });

    // Cursor should be gone (StreamingMessage unmounted)
    // The EqualiserAnimation in InputChrome also stops when isStreaming becomes false
    const remainingCursors = queryAllByLabelText('Generating response');
    expect(remainingCursors.length).toBe(0);
  });

  it('stop button reverts to send state after streaming completes', () => {
    const { getByLabelText, getByTestId } = render(<IntegrationHarness />);

    // Start streaming
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'A question');
    fireEvent.press(getByLabelText('Send message'));

    // Verify stop button is shown
    expect(getByLabelText('Stop generation')).toBeTruthy();

    // Complete streaming
    act(() => {
      fireEvent.press(getByTestId('simulate-complete'));
    });

    // Button should return to disabled state (input was cleared on send)
    expect(getByLabelText('Send message, disabled')).toBeTruthy();
  });

  it('stop button calls onStop and removes streaming cursor', () => {
    const onStop = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <IntegrationHarness onStop={onStop} />,
    );

    // Start streaming
    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'Something');
    fireEvent.press(getByLabelText('Send message'));

    // Press stop
    fireEvent.press(getByLabelText('Stop generation'));

    // onStop should be called
    expect(onStop).toHaveBeenCalledTimes(1);

    // Streaming cursor should be removed
    expect(queryByLabelText('Generating response')).toBeNull();
  });

  it('input field is cleared after sending', () => {
    const { getByLabelText } = render(<IntegrationHarness />);

    const input = getByLabelText('Message input');
    fireEvent.changeText(input, 'My message');
    fireEvent.press(getByLabelText('Send message'));

    // Input should be cleared
    expect(input.props.value).toBe('');
  });
});

// ─── Unit-Level State Derivation (validates Property 4) ────────────────────────

describe('SendStopButton state derivation in integration context', () => {
  it('returns disabled when no text and not streaming', () => {
    expect(deriveButtonState(false, false)).toBe('disabled');
  });

  it('returns send when text is present and not streaming', () => {
    expect(deriveButtonState(true, false)).toBe('send');
  });

  it('returns stop when streaming regardless of text', () => {
    expect(deriveButtonState(false, true)).toBe('stop');
    expect(deriveButtonState(true, true)).toBe('stop');
  });

  it('transitions correctly through the full send flow lifecycle', () => {
    // Initial: no text, not streaming → disabled
    expect(deriveButtonState(false, false)).toBe('disabled');

    // User types → send-ready
    expect(deriveButtonState(true, false)).toBe('send');

    // User sends, streaming begins → stop (text cleared)
    expect(deriveButtonState(false, true)).toBe('stop');

    // Streaming completes → disabled (input still empty)
    expect(deriveButtonState(false, false)).toBe('disabled');
  });
});
