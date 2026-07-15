import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { ThinkingLevel } from '@/stores/chat-store';

/**
 * Ordered thinking levels for cycling.
 * Tap advances through this sequence, wrapping back to 'off'.
 */
export const THINKING_LEVELS: ThinkingLevel[] = [
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
];

/**
 * Cycles to the next thinking level in a closed rotation:
 * Off → Minimal → Low → Medium → High → XHigh → Off.
 */
export function cycleThinkingLevel(level: ThinkingLevel): ThinkingLevel {
  const currentIndex = THINKING_LEVELS.indexOf(level);
  const nextIndex = (currentIndex + 1) % THINKING_LEVELS.length;
  return THINKING_LEVELS[nextIndex];
}

/**
 * Number of filled bars for each thinking level.
 * Off = 0 bars, minimal = 1, ..., xhigh = 5.
 */
const LEVEL_TO_BARS: Record<ThinkingLevel, number> = {
  off: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
};

/** Total number of bars in the selector. */
const BAR_COUNT = 5;

/** Base bar width. */
const BAR_WIDTH = 4;

/** Gap between bars. */
const BAR_GAP = 2;

/** Minimum bar height (shortest bar). */
const BAR_MIN_HEIGHT = 6;

/** Height increment per bar. */
const BAR_HEIGHT_STEP = 3;

export interface ThinkingLevelSelectorProps {
  /** Current thinking level. */
  level: ThinkingLevel;
  /** Called when the selector is tapped, should cycle to the next level. */
  onCycle: () => void;
}

/**
 * A 5-bar equalizer-style selector for thinking/reasoning level.
 *
 * Bars increase in height from left to right. Filled bars (accent color)
 * represent the active level; unfilled bars use a muted/tertiary color.
 * Tapping anywhere cycles through the levels.
 *
 * VoiceOver announces the current level name for accessibility.
 */
export function ThinkingLevelSelector({ level, onCycle }: ThinkingLevelSelectorProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const filledCount = LEVEL_TO_BARS[level];
  const levelLabel = t(`thinkingLevel.${level}`);

  const accentColor = theme.colors.accent;
  const mutedColor = theme.colors.textTertiary;

  return (
    <Pressable
      onPress={onCycle}
      accessibilityLabel={t('thinkingLevel.title') + ': ' + levelLabel}
      accessibilityRole="button"
      accessibilityHint={t('thinkingLevel.cycleHint')}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={styles.container}
    >
      <View style={styles.barsRow}>
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const isFilled = index < filledCount;
          const height = BAR_MIN_HEIGHT + index * BAR_HEIGHT_STEP;

          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height,
                  backgroundColor: isFilled ? accentColor : mutedColor,
                },
              ]}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: {
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
  },
});
