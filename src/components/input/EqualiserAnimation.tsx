import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';

/** Number of bars in the equaliser. */
const BAR_COUNT = 4;

/** Width of each bar in points. */
const BAR_WIDTH = 3;

/** Gap between bars in points. */
const BAR_GAP = 2;

/** Height of each bar at rest (scaleY = 1). */
const BAR_HEIGHT = 12;

/** Minimum vertical scale (bar at its shortest). */
const SCALE_MIN = 0.3;

/** Maximum vertical scale (bar at its tallest). */
const SCALE_MAX = 1.0;

/** Duration of one half-cycle (min → max or max → min) in ms. */
const CYCLE_DURATION = 400;

/** Phase offset between each bar in ms for stagger effect. */
const PHASE_OFFSET = 100;

/** Duration to wind down animation on stop (ms). */
const WIND_DOWN_DURATION = 300;

export interface EqualiserAnimationProps {
  /** Whether the equaliser is actively animating (true during streaming). */
  isActive: boolean;
}

/**
 * Four accent-colored bars with staggered vertical scale animation.
 *
 * Active during streaming to signal ongoing generation. When streaming
 * stops (isActive becomes false), the animation winds down to rest
 * scale within 300ms.
 *
 * Uses react-native-reanimated worklets for 60fps UI-thread performance.
 */
export function EqualiserAnimation({ isActive }: EqualiserAnimationProps) {
  const { colors } = useTheme();

  const scales = [
    useSharedValue(SCALE_MIN),
    useSharedValue(SCALE_MIN),
    useSharedValue(SCALE_MIN),
    useSharedValue(SCALE_MIN),
  ];

  useEffect(() => {
    if (isActive) {
      // Start staggered repeating animation for each bar
      scales.forEach((scale, index) => {
        // Reset to min before starting to ensure clean animation start
        scale.value = SCALE_MIN;
        scale.value = withDelay(
          index * PHASE_OFFSET,
          withRepeat(
            withSequence(
              withTiming(SCALE_MAX, {
                duration: CYCLE_DURATION,
                easing: Easing.inOut(Easing.ease),
              }),
              withTiming(SCALE_MIN, {
                duration: CYCLE_DURATION,
                easing: Easing.inOut(Easing.ease),
              }),
            ),
            -1, // infinite repeat
            true, // reverse on each iteration for smooth bounce
          ),
        );
      });
    } else {
      // Wind down all bars to rest within 300ms
      scales.forEach((scale) => {
        cancelAnimation(scale);
        scale.value = withTiming(SCALE_MIN, {
          duration: WIND_DOWN_DURATION,
          easing: Easing.out(Easing.quad),
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <View
      style={styles.container}
      accessibilityLabel={isActive ? 'Generating response' : undefined}
      accessibilityRole="image"
    >
      {scales.map((scale, index) => (
        <AnimatedBar key={index} scale={scale} color={colors.accent} />
      ))}
    </View>
  );
}

interface AnimatedBarProps {
  scale: Animated.SharedValue<number>;
  color: string;
}

/**
 * A single animated bar whose height is controlled by scaleY.
 */
function AnimatedBar({ scale, color }: AnimatedBarProps) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: BAR_GAP,
    height: BAR_HEIGHT,
    justifyContent: 'center',
  },
  bar: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_WIDTH / 2,
  },
});
