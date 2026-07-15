/**
 * Tests for ToastProvider component.
 *
 * Validates:
 * - Context provides `show` method
 * - Messages are truncated at 50 characters
 * - Toast content renders correctly
 * - pointerEvents="none" on container
 */

import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { Text, Pressable } from 'react-native';

import { ToastProvider, useToast } from '../ToastProvider';
import { ThemeProvider } from '@/theme';

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return {
    ...Reanimated,
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withTiming: (toValue: number) => toValue,
  };
});

// Mock AccessibilityInfo
const mockAnnounce = jest.fn();
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  actual.AccessibilityInfo.announceForAccessibility = jest.fn();
  return actual;
});

// Mock the UI store
const mockShowToast = jest.fn();
jest.mock('@/stores/ui-store', () => ({
  useUIStore: (selector: (state: any) => any) =>
    selector({ showToast: mockShowToast }),
}));

/**
 * Test consumer component that exposes the toast `show` method via a button.
 */
function TestConsumer({ message }: { message: string }) {
  const { show } = useToast();
  return (
    <Pressable testID="trigger" onPress={() => show(message)}>
      <Text>Trigger</Text>
    </Pressable>
  );
}

function renderWithProviders(message: string) {
  return render(
    <ThemeProvider mode="light">
      <ToastProvider>
        <TestConsumer message={message} />
      </ToastProvider>
    </ThemeProvider>,
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockShowToast.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('provides a show method via context', () => {
    const { getByTestId } = renderWithProviders('Hello');
    expect(getByTestId('trigger')).toBeTruthy();
  });

  it('displays the toast message when show is called', () => {
    const { getByTestId, getByText } = renderWithProviders('Copied!');

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });

    expect(getByText('Copied!')).toBeTruthy();
  });

  it('truncates messages longer than 50 characters with ellipsis', () => {
    const longMessage =
      'This is a very long message that definitely exceeds fifty characters limit';
    const { getByTestId, getByText } = renderWithProviders(longMessage);

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });

    // 49 chars + ellipsis = 50
    const expected = longMessage.slice(0, 49) + '\u2026';
    expect(getByText(expected)).toBeTruthy();
  });

  it('calls the UI store showToast action', () => {
    const { getByTestId } = renderWithProviders('Session deleted');

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });

    expect(mockShowToast).toHaveBeenCalledWith('Session deleted');
  });

  it('renders the container with pointerEvents none', () => {
    const { getByTestId, UNSAFE_root } = renderWithProviders('Test');

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });

    // Find the container View with pointerEvents="none"
    const views = UNSAFE_root.findAll(
      (node: { props: { pointerEvents?: string } }) =>
        node.props.pointerEvents === 'none',
    );
    expect(views.length).toBeGreaterThan(0);
  });

  it('replaces existing toast when show is called again', () => {
    const { getByTestId, queryByText, rerender } = render(
      <ThemeProvider mode="light">
        <ToastProvider>
          <TestConsumer message="First" />
        </ToastProvider>
      </ThemeProvider>,
    );

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });
    expect(queryByText('First')).toBeTruthy();

    // Re-render with a new message and trigger again
    rerender(
      <ThemeProvider mode="light">
        <ToastProvider>
          <TestConsumer message="Second" />
        </ToastProvider>
      </ThemeProvider>,
    );

    act(() => {
      fireEvent.press(getByTestId('trigger'));
    });

    expect(queryByText('Second')).toBeTruthy();
  });
});
