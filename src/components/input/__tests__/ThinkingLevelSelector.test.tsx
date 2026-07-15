import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ThinkingLevelSelector } from '../ThinkingLevelSelector';
import type { ThinkingLevel } from '@/stores/chat-store';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'thinkingLevel.title': 'Thinking Level',
        'thinkingLevel.off': 'Off',
        'thinkingLevel.minimal': 'Minimal',
        'thinkingLevel.low': 'Low',
        'thinkingLevel.medium': 'Medium',
        'thinkingLevel.high': 'High',
        'thinkingLevel.xhigh': 'Extra High',
        'thinkingLevel.cycleHint': 'Double tap to cycle thinking level',
      };
      return translations[key] ?? key;
    },
  }),
}));

// Mock theme
jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      textTertiary: '#8E8E93',
    },
    isDark: false,
  }),
}));

describe('ThinkingLevelSelector', () => {
  const mockOnCycle = jest.fn();

  beforeEach(() => {
    mockOnCycle.mockClear();
  });

  it('renders 5 bars', () => {
    const { toJSON } = render(
      <ThinkingLevelSelector level="off" onCycle={mockOnCycle} />,
    );
    const tree = toJSON();
    // The Pressable contains a View (barsRow) with 5 bar children
    const barsRow = tree!.children![0];
    expect(barsRow.children).toHaveLength(5);
  });

  it('fills 0 bars when level is off', () => {
    const { toJSON } = render(
      <ThinkingLevelSelector level="off" onCycle={mockOnCycle} />,
    );
    const tree = toJSON();
    const barsRow = tree!.children![0];
    const bars = barsRow.children as any[];
    bars.forEach((bar: any) => {
      expect(bar.props.style).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ backgroundColor: '#8E8E93' }),
        ]),
      );
    });
  });

  it('fills correct number of bars for each level', () => {
    const expectedFilled: Record<ThinkingLevel, number> = {
      off: 0,
      minimal: 1,
      low: 2,
      medium: 3,
      high: 4,
      xhigh: 5,
    };

    for (const [level, count] of Object.entries(expectedFilled)) {
      const { toJSON } = render(
        <ThinkingLevelSelector level={level as ThinkingLevel} onCycle={mockOnCycle} />,
      );
      const tree = toJSON();
      const barsRow = tree!.children![0];
      const bars = barsRow.children as any[];

      let filledCount = 0;
      bars.forEach((bar: any) => {
        const styles = bar.props.style;
        const bgColor = styles.find(
          (s: any) => s && s.backgroundColor,
        )?.backgroundColor;
        if (bgColor === '#5856D6') filledCount++;
      });

      expect(filledCount).toBe(count);
    }
  });

  it('bars have increasing heights', () => {
    const { toJSON } = render(
      <ThinkingLevelSelector level="medium" onCycle={mockOnCycle} />,
    );
    const tree = toJSON();
    const barsRow = tree!.children![0];
    const bars = barsRow.children as any[];

    const heights = bars.map((bar: any) => {
      const heightStyle = bar.props.style.find(
        (s: any) => s && s.height !== undefined,
      );
      return heightStyle?.height ?? 0;
    });

    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it('calls onCycle when pressed', () => {
    const { getByRole } = render(
      <ThinkingLevelSelector level="low" onCycle={mockOnCycle} />,
    );
    fireEvent.press(getByRole('button'));
    expect(mockOnCycle).toHaveBeenCalledTimes(1);
  });

  it('has accessibility label announcing current level', () => {
    const { getByLabelText } = render(
      <ThinkingLevelSelector level="high" onCycle={mockOnCycle} />,
    );
    expect(getByLabelText('Thinking Level: High')).toBeTruthy();
  });

  it('updates accessibility label when level changes', () => {
    const { getByLabelText, rerender } = render(
      <ThinkingLevelSelector level="off" onCycle={mockOnCycle} />,
    );
    expect(getByLabelText('Thinking Level: Off')).toBeTruthy();

    rerender(<ThinkingLevelSelector level="xhigh" onCycle={mockOnCycle} />);
    expect(getByLabelText('Thinking Level: Extra High')).toBeTruthy();
  });
});
