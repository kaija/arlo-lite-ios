import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { NavigationChrome } from '../NavigationChrome';

// Mock expo-blur
jest.mock('expo-blur', () => {
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: ({ children, style, ...props }: any) => (
        <View style={style} {...props}>{children}</View>
      ),
    },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: (val: any) => val,
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Svg: ({ children, ...props }: any) => <View {...props}>{children}</View>,
    Path: (props: any) => <View {...props} />,
    Rect: (props: any) => <View {...props} />,
  };
});

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#1C1C1E',
      accent: '#5856D6',
      border: '#D1D1D6',
      background: '#FFFFFF',
    },
    borderRadii: { full: 9999 },
  }),
}));

describe('NavigationChrome', () => {
  const defaultProps = {
    title: 'Test Session',
    onSidebarToggle: jest.fn(),
    onSettingsOpen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the session title', () => {
    const { getByText } = render(<NavigationChrome {...defaultProps} />);
    expect(getByText('Test Session')).toBeTruthy();
  });

  it('renders the title as a header for accessibility', () => {
    const { getByRole } = render(<NavigationChrome {...defaultProps} />);
    expect(getByRole('header')).toBeTruthy();
  });

  it('renders sidebar toggle button with correct VoiceOver label', () => {
    const { getByLabelText } = render(<NavigationChrome {...defaultProps} />);
    const button = getByLabelText('Toggle sidebar');
    expect(button).toBeTruthy();
  });

  it('renders settings button with correct VoiceOver label', () => {
    const { getByLabelText } = render(<NavigationChrome {...defaultProps} />);
    const button = getByLabelText('Open settings');
    expect(button).toBeTruthy();
  });

  it('calls onSidebarToggle when sidebar button is pressed', () => {
    const { getByLabelText } = render(<NavigationChrome {...defaultProps} />);
    fireEvent.press(getByLabelText('Toggle sidebar'));
    expect(defaultProps.onSidebarToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsOpen when settings button is pressed', () => {
    const { getByLabelText } = render(<NavigationChrome {...defaultProps} />);
    fireEvent.press(getByLabelText('Open settings'));
    expect(defaultProps.onSettingsOpen).toHaveBeenCalledTimes(1);
  });

  it('truncates long titles to a single line', () => {
    const longTitle = 'This is a very long session title that should be truncated to a single line';
    const { getByText } = render(
      <NavigationChrome {...defaultProps} title={longTitle} />
    );
    const titleElement = getByText(longTitle);
    expect(titleElement.props.numberOfLines).toBe(1);
  });
});
