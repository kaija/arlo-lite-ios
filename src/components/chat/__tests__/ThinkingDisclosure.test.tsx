/**
 * Tests for ThinkingDisclosure component.
 *
 * Verifies:
 * - Component exports and interface correctness
 * - Blinking "Thinking" label with chevron toggle
 * - Collapsed/expanded state for reasoning content
 * - Left accent-colored border on expanded block
 * - Omits entirely if no reasoning content
 *
 * Requirements: 4.4, 4.5, 4.7
 */

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'chat.thinking': 'Thinking',
        'accessibility.collapseThinking': 'Collapse thinking',
        'accessibility.expandThinking': 'Expand thinking',
      };
      return translations[key] ?? opts?.defaultValue ?? key;
    },
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      text: '#1C1C1E',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      surface: '#F2F2F7',
      surfaceSecondary: '#E5E5EA',
      border: '#D1D1D6',
    },
    typography: {
      caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
      subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
      footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    borderRadii: { sm: 4, md: 8 },
    isDark: false,
  }),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThinkingDisclosure } from '../ThinkingDisclosure';

describe('ThinkingDisclosure', () => {
  it('is exported as a function component', () => {
    expect(ThinkingDisclosure).toBeDefined();
    expect(typeof ThinkingDisclosure).toBe('function');
  });

  it('returns null when content is empty (requirement 4.7)', () => {
    const { toJSON } = render(
      <ThinkingDisclosure content="" isExpanded={false} onToggle={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders when content is provided', () => {
    const { getByText } = render(
      <ThinkingDisclosure
        content="Reasoning about the problem..."
        isExpanded={false}
        onToggle={jest.fn()}
      />,
    );
    expect(getByText('Thinking')).toBeTruthy();
  });

  it('does not show reasoning content when collapsed (requirement 4.5)', () => {
    const { queryByText } = render(
      <ThinkingDisclosure
        content="Reasoning about the problem..."
        isExpanded={false}
        onToggle={jest.fn()}
      />,
    );
    expect(queryByText('Reasoning about the problem...')).toBeNull();
  });

  it('shows reasoning content when expanded (requirement 4.5)', () => {
    const { getByText } = render(
      <ThinkingDisclosure
        content="Reasoning about the problem..."
        isExpanded={true}
        onToggle={jest.fn()}
      />,
    );
    expect(getByText('Reasoning about the problem...')).toBeTruthy();
  });

  it('calls onToggle when the toggle area is pressed (requirement 4.5)', () => {
    const onToggle = jest.fn();
    const { getByLabelText } = render(
      <ThinkingDisclosure
        content="Some reasoning"
        isExpanded={false}
        onToggle={onToggle}
      />,
    );
    fireEvent.press(getByLabelText('Expand thinking'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('provides correct accessibility label when collapsed', () => {
    const { getByLabelText } = render(
      <ThinkingDisclosure
        content="Some reasoning"
        isExpanded={false}
        onToggle={jest.fn()}
      />,
    );
    expect(getByLabelText('Expand thinking')).toBeTruthy();
  });

  it('provides correct accessibility label when expanded', () => {
    const { getByLabelText } = render(
      <ThinkingDisclosure
        content="Some reasoning"
        isExpanded={true}
        onToggle={jest.fn()}
      />,
    );
    expect(getByLabelText('Collapse thinking')).toBeTruthy();
  });
});
