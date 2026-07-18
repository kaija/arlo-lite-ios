/**
 * ContextUsagePopup — Overlay card showing context window usage breakdown.
 *
 * Displayed when the user taps the ContextRing. Shows a bar chart style
 * breakdown of token usage:
 * - Context window (total usage vs capacity)
 * - System prompt tokens
 * - User prompt tokens
 * - Assistant output tokens
 *
 * Each row has a label, a horizontal progress bar, and a token count + percentage.
 * Styled similarly to the model picker — card surface, scrim, fade-up animation.
 *
 * Requirements: 6.7, 6.8
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { MODEL_PICKER_FADE_DURATION, DIALOG_EASING } from '@/theme/animations';
import type { TokenUsageBreakdown } from '@/domain/context-tracker';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSLATE_Y_DISTANCE = 8;

const PICKER_EASING = Easing.bezier(
  DIALOG_EASING[0],
  DIALOG_EASING[1],
  DIALOG_EASING[2],
  DIALOG_EASING[3]
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContextUsagePopupProps {
  /** Whether the popup is visible */
  visible: boolean;
  /** Token usage breakdown for the current session */
  breakdown: TokenUsageBreakdown;
  /** Context window capacity in tokens */
  contextWindow: number;
  /** Called when the popup is dismissed */
  onDismiss: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format token count into human-readable string.
 * e.g. 1500 → "1.5K", 256000 → "256K", 1200000 → "1.2M"
 */
function formatTokens(count: number): string {
  if (count >= 1_000_000) {
    const m = count / 1_000_000;
    return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
  }
  if (count >= 1_000) {
    const k = count / 1_000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  return `${count}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContextUsagePopup({
  visible,
  breakdown,
  contextWindow,
  onDismiss,
}: ContextUsagePopupProps) {
  const { colors } = useTheme();

  // Animation
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(visible ? 0 : TRANSLATE_Y_DISTANCE);
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
      opacity.value = withTiming(1, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      translateY.value = withTiming(0, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
    } else {
      opacity.value = withTiming(0, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      translateY.value = withTiming(TRANSLATE_Y_DISTANCE, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, MODEL_PICKER_FADE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [visible, opacity, translateY]);

  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.32,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!shouldRender) return null;

  // Compute percentages
  const totalPercent = contextWindow > 0
    ? Math.min(Math.round((breakdown.totalTokens / contextWindow) * 100), 100)
    : 0;

  const rows = [
    {
      label: 'Context window',
      tokens: breakdown.totalTokens,
      capacity: contextWindow,
      percent: totalPercent,
      color: colors.accent,
      isTotal: true,
    },
    {
      label: 'System prompt',
      tokens: breakdown.systemPromptTokens,
      capacity: contextWindow,
      percent: contextWindow > 0
        ? Math.round((breakdown.systemPromptTokens / contextWindow) * 100)
        : 0,
      color: colors.warning,
      isTotal: false,
    },
    {
      label: 'User messages',
      tokens: breakdown.userPromptTokens,
      capacity: contextWindow,
      percent: contextWindow > 0
        ? Math.round((breakdown.userPromptTokens / contextWindow) * 100)
        : 0,
      color: colors.success,
      isTotal: false,
    },
    {
      label: 'Assistant output',
      tokens: breakdown.assistantOutputTokens,
      capacity: contextWindow,
      percent: contextWindow > 0
        ? Math.round((breakdown.assistantOutputTokens / contextWindow) * 100)
        : 0,
      color: colors.accent,
      isTotal: false,
    },
  ];

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss context usage"
      >
        <Animated.View style={[styles.scrim, scrimAnimatedStyle]} />
      </Pressable>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          { backgroundColor: colors.surface },
          cardAnimatedStyle,
        ]}
        accessibilityRole="summary"
        accessibilityLabel="Context window usage breakdown"
      >
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[
              styles.row,
              index < rows.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {/* Label + stats on one line */}
            <View style={styles.rowHeader}>
              <Text style={[styles.label, { color: colors.text }]}>
                {row.label}
              </Text>
              <Text style={[styles.stats, { color: colors.textSecondary }]}>
                {row.isTotal
                  ? `${formatTokens(row.tokens)} / ${formatTokens(row.capacity)} (${row.percent}%)`
                  : `${formatTokens(row.tokens)}  ${row.percent}%`}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={[styles.barTrack, { backgroundColor: colors.surfaceSecondary }]}>
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: row.color,
                    width: `${Math.max(row.percent, 1)}%`,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    elevation: 6,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 120,
    paddingHorizontal: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  row: {
    paddingVertical: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  stats: {
    fontSize: 12,
    fontWeight: '400',
  },
  barTrack: {
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2.5,
  },
});

export default ContextUsagePopup;
