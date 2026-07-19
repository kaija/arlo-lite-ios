import React from 'react';
import { render } from '@testing-library/react-native';

import { ContextRing, getRingColor, getThresholdBand } from '../ContextRing';

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
    withSequence: (...args: any[]) => args[args.length - 1],
    withTiming: (value: number) => value,
  };
});

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) =>
      React.createElement(View, { ...props, testID: 'svg' }, children),
    Circle: (props: any) =>
      React.createElement(View, { ...props, testID: 'svg-circle' }),
  };
});

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
  },
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      contextWarning: '#FF9500',
      contextCritical: '#D32F2F',
      border: '#D1D1D6',
    },
  }),
}));

// Mock ToastProvider
const mockShowToast = jest.fn();
jest.mock('@/components/overlays/ToastProvider', () => ({
  useToast: () => ({ show: mockShowToast }),
}));

describe('ContextRing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the SVG ring', () => {
    const { getAllByTestId } = render(<ContextRing percentage={30} />);
    expect(getAllByTestId('svg')).toHaveLength(1);
    // Background track + progress arc = 2 circles
    expect(getAllByTestId('svg-circle')).toHaveLength(2);
  });

});

describe('getRingColor', () => {
  const accent = '#5856D6';
  const warning = '#FF9500';
  const critical = '#D32F2F';

  it('returns accent color below 50%', () => {
    expect(getRingColor(0, accent, warning, critical)).toBe(accent);
    expect(getRingColor(25, accent, warning, critical)).toBe(accent);
    expect(getRingColor(49, accent, warning, critical)).toBe(accent);
  });

  it('returns warning color at 50-74%', () => {
    expect(getRingColor(50, accent, warning, critical)).toBe(warning);
    expect(getRingColor(60, accent, warning, critical)).toBe(warning);
    expect(getRingColor(74, accent, warning, critical)).toBe(warning);
  });

  it('returns critical color at 75%+', () => {
    expect(getRingColor(75, accent, warning, critical)).toBe(critical);
    expect(getRingColor(90, accent, warning, critical)).toBe(critical);
    expect(getRingColor(100, accent, warning, critical)).toBe(critical);
  });
});

describe('getThresholdBand', () => {
  it('returns 0 for < 50', () => {
    expect(getThresholdBand(0)).toBe(0);
    expect(getThresholdBand(49)).toBe(0);
  });

  it('returns 1 for 50-74', () => {
    expect(getThresholdBand(50)).toBe(1);
    expect(getThresholdBand(74)).toBe(1);
  });

  it('returns 2 for >= 75', () => {
    expect(getThresholdBand(75)).toBe(2);
    expect(getThresholdBand(100)).toBe(2);
  });
});
