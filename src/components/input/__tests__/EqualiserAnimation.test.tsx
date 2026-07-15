import React from 'react';
import { render } from '@testing-library/react-native';

import { EqualiserAnimation } from '../EqualiserAnimation';

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
    withTiming: (value: number) => value,
    withDelay: (_delay: number, animation: any) => animation,
    withRepeat: (animation: any) => animation,
    withSequence: (...animations: any[]) => animations[0],
    cancelAnimation: jest.fn(),
    Easing: {
      inOut: (fn: any) => fn,
      out: (fn: any) => fn,
      sin: (t: number) => t,
      quad: (t: number) => t,
    },
  };
});

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
    },
  }),
}));

describe('EqualiserAnimation', () => {
  it('renders 4 bars', () => {
    const { toJSON } = render(<EqualiserAnimation isActive={false} />);
    const tree = toJSON() as any;

    // The container is the root View, its children are the 4 bar Views
    expect(tree.children).toHaveLength(4);
  });

  it('bars use accent color from theme', () => {
    const { toJSON } = render(<EqualiserAnimation isActive={true} />);
    const tree = toJSON() as any;

    tree.children.forEach((bar: any) => {
      const styles = Array.isArray(bar.props.style)
        ? bar.props.style
        : [bar.props.style];
      const hasBg = styles.some(
        (s: any) => s && s.backgroundColor === '#5856D6',
      );
      expect(hasBg).toBe(true);
    });
  });

  it('provides accessibility label when active', () => {
    const { getByLabelText } = render(<EqualiserAnimation isActive={true} />);
    expect(getByLabelText('Generating response')).toBeTruthy();
  });

  it('has no accessibility label when inactive', () => {
    const { queryByLabelText } = render(
      <EqualiserAnimation isActive={false} />,
    );
    expect(queryByLabelText('Generating response')).toBeNull();
  });

  it('has image accessibility role on the container', () => {
    const { toJSON } = render(<EqualiserAnimation isActive={true} />);
    const tree = toJSON() as any;
    expect(tree.props.accessibilityRole).toBe('image');
  });
});
