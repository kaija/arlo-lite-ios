import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ModelChip } from '../ModelChip';

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

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      accentText: '#FFFFFF',
      text: '#1C1C1E',
      textSecondary: '#636366',
    },
    borderRadii: {
      full: 9999,
    },
  }),
}));

describe('ModelChip', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the model name', () => {
    const { getByText } = render(
      <ModelChip modelName="GPT-4o" onPress={mockOnPress} />,
    );
    expect(getByText('GPT-4o')).toBeTruthy();
  });

  it('renders the disclosure chevron', () => {
    const { getByText } = render(
      <ModelChip modelName="Claude Sonnet" onPress={mockOnPress} />,
    );
    // The chevron character
    expect(getByText('\u203A')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const { getByRole } = render(
      <ModelChip modelName="GPT-4o" onPress={mockOnPress} />,
    );
    fireEvent.press(getByRole('button'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('has VoiceOver accessibility label announcing the model name', () => {
    const { getByLabelText } = render(
      <ModelChip modelName="Claude Sonnet 4" onPress={mockOnPress} />,
    );
    expect(getByLabelText('Active model: Claude Sonnet 4')).toBeTruthy();
  });

  it('provides an accessibility hint', () => {
    const { getByRole } = render(
      <ModelChip modelName="GPT-4o" onPress={mockOnPress} />,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityHint).toBe(
      'Double tap to open model picker',
    );
  });

  it('truncates long model names to a single line', () => {
    const { getByText } = render(
      <ModelChip
        modelName="Very Long Model Name That Should Be Truncated"
        onPress={mockOnPress}
      />,
    );
    const label = getByText('Very Long Model Name That Should Be Truncated');
    expect(label.props.numberOfLines).toBe(1);
  });
});
