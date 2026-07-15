import React from 'react';
import { render } from '@testing-library/react-native';

import { NavigationChrome } from '../NavigationChrome';

// Mock expo-blur
jest.mock('expo-blur', () => {
  const RN = require('react-native');
  const RCT = require('react');
  return {
    BlurView: ({ children, style, intensity, tint }: any) =>
      RCT.createElement(
        RN.View,
        { style, testID: 'blur-view', accessibilityHint: `intensity=${intensity},tint=${tint}` },
        children,
      ),
  };
});

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
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

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const RN = require('react-native');
  const RCT = require('react');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      RCT.createElement(RN.View, { ...props, testID: 'svg' }, children),
    Svg: ({ children, ...props }: any) =>
      RCT.createElement(RN.View, { ...props, testID: 'svg' }, children),
    Path: (props: any) =>
      RCT.createElement(RN.Text, { testID: 'svg-path' }, props.d),
  };
});

// Light theme mock
const mockLightTheme = {
  colors: {
    accent: '#5856D6',
    text: '#000000',
    background: '#FFFFFF',
    border: 'rgba(60, 60, 67, 0.29)',
  },
  isDark: false,
};

// Dark theme mock
const mockDarkTheme = {
  colors: {
    accent: '#5E5CE6',
    text: '#FFFFFF',
    background: '#000000',
    border: 'rgba(84, 84, 88, 0.65)',
  },
  isDark: true,
};

let mockThemeValue = mockLightTheme;

jest.mock('@/theme', () => ({
  useTheme: () => mockThemeValue,
}));

describe('NavigationChrome Snapshot Tests', () => {
  const defaultProps = {
    title: 'New Chat',
    onSidebarToggle: jest.fn(),
    onSettingsOpen: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Light mode', () => {
    beforeAll(() => {
      mockThemeValue = mockLightTheme;
    });

    it('renders correctly in light mode', () => {
      const { toJSON } = render(<NavigationChrome {...defaultProps} />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders with a long title in light mode', () => {
      const { toJSON } = render(
        <NavigationChrome
          {...defaultProps}
          title="This is a very long session title that should be truncated with an ellipsis"
        />,
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('Dark mode', () => {
    beforeAll(() => {
      mockThemeValue = mockDarkTheme;
    });

    it('renders correctly in dark mode', () => {
      const { toJSON } = render(<NavigationChrome {...defaultProps} />);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders with a long title in dark mode', () => {
      const { toJSON } = render(
        <NavigationChrome
          {...defaultProps}
          title="This is a very long session title that should be truncated with an ellipsis"
        />,
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
