/**
 * ContextRing — SVG circular progress gauge for context window usage.
 *
 * Displays current token usage as a percentage of the model's context window.
 * Color changes at threshold boundaries:
 * - Accent color: < 50% usage
 * - Orange (contextWarning): 50–74% usage
 * - Red (contextCritical): ≥ 75% usage
 *
 * On threshold crossings (50% and 75%), fires expo-haptics impactAsync(Light)
 * alongside a scale pop animation (1 → 1.3 → 1), and shows a toast the first
 * time each threshold is crossed per session.
 *
 * Requirements: 6.7, 6.8, 6.12
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme';
import { useToast } from '@/components/overlays/ToastProvider';
import { useTranslation } from 'react-i18next';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Outer diameter of the ring component */
const RING_SIZE = 26;

/** Stroke width of the progress arc */
const STROKE_WIDTH = 3;

/** Radius of the circle (accounting for stroke) */
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;

/** Circumference of the circle */
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Scale pop animation duration (ms per phase) */
const POP_DURATION = 150;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Determines the ring color based on usage percentage.
 * - < 50%: accent
 * - 50–74%: contextWarning (orange)
 * - ≥ 75%: contextCritical (red)
 */
export function getRingColor(
  percentage: number,
  accent: string,
  contextWarning: string,
  contextCritical: string,
): string {
  if (percentage >= 75) return contextCritical;
  if (percentage >= 50) return contextWarning;
  return accent;
}

/**
 * Determines which threshold band a percentage falls into.
 * Returns 0 for < 50, 1 for 50-74, 2 for >= 75.
 */
export function getThresholdBand(percentage: number): number {
  if (percentage >= 75) return 2;
  if (percentage >= 50) return 1;
  return 0;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ContextRingProps {
  /** Usage percentage (0-100) */
  percentage: number;
  /** Whether to trigger scale pop animation on threshold crossings */
  animated?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Circular progress indicator showing context window usage.
 *
 * VoiceOver announces the current usage percentage.
 * On threshold crossings, fires haptic feedback and shows a toast notification.
 */
export function ContextRing({ percentage, animated = true }: ContextRingProps) {
  const { colors } = useTheme();
  const { show: showToast } = useToast();
  const { t } = useTranslation();

  // Clamp percentage to 0-100
  const clampedPercentage = Math.max(0, Math.min(100, percentage));

  // Track threshold crossings per session
  const previousBandRef = useRef<number>(getThresholdBand(clampedPercentage));
  const hasToasted50Ref = useRef(false);
  const hasToasted75Ref = useRef(false);

  // Scale animation shared value
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Detect threshold crossings
  useEffect(() => {
    const currentBand = getThresholdBand(clampedPercentage);
    const previousBand = previousBandRef.current;

    if (currentBand !== previousBand) {
      previousBandRef.current = currentBand;

      if (animated) {
        // Fire haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        // Scale pop animation: 1 → 1.3 → 1
        scale.value = withSequence(
          withTiming(1.3, { duration: POP_DURATION }),
          withTiming(1, { duration: POP_DURATION }),
        );
      }

      // Show toast on first 50% and 75% crossing per session
      if (currentBand >= 1 && !hasToasted50Ref.current) {
        hasToasted50Ref.current = true;
        showToast(t('chat.contextUsage', { percentage: clampedPercentage }));
      } else if (currentBand >= 2 && !hasToasted75Ref.current) {
        hasToasted75Ref.current = true;
        showToast(t('chat.contextUsage', { percentage: clampedPercentage }));
      }
    }
  }, [clampedPercentage, animated, scale, showToast, t]);

  // Calculate SVG arc parameters
  const ringColor = getRingColor(
    clampedPercentage,
    colors.accent,
    colors.contextWarning,
    colors.contextCritical,
  );
  const strokeDashoffset =
    CIRCUMFERENCE - (clampedPercentage / 100) * CIRCUMFERENCE;

  return (
    <View
      style={styles.container}
      accessibilityLabel={t('accessibility.contextUsageIndicator', { percentage: Math.round(clampedPercentage) })}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: 100,
        now: Math.round(clampedPercentage),
      }}
    >
      <Animated.View style={animatedStyle}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          {/* Background track */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={colors.border}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            opacity={0.3}
          />
          {/* Progress arc */}
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
