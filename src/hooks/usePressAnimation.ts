/**
 * usePressAnimation — Shared press-state micro-interaction hook.
 *
 * Provides a consistent press feedback animation for all tappable elements
 * (buttons, cards, rows). On press-in, scales down to 0.97 and reduces opacity
 * to 0.82. On press-out, reverts to identity with spring timing.
 *
 * Usage:
 * ```tsx
 * const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();
 *
 * <Animated.View style={animatedStyle}>
 *   <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
 *     {children}
 *   </Pressable>
 * </Animated.View>
 * ```
 */

import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

/** Scale value when pressed */
const PRESS_SCALE = 0.97;

/** Opacity value when pressed */
const PRESS_OPACITY = 0.82;

/** Spring config for press-out revert animation */
const PRESS_OUT_SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.5,
};

export interface PressAnimationResult {
  /** Animated style to apply to the Animated.View wrapping the pressable */
  animatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Handler to call on press-in (scale down + fade) */
  onPressIn: () => void;
  /** Handler to call on press-out (revert with spring) */
  onPressOut: () => void;
}

/**
 * Hook providing press-state micro-interaction for tappable elements.
 *
 * Animates to scale 0.97 + opacity 0.82 on press-in.
 * Reverts to scale 1.0 + opacity 1.0 on press-out with spring timing.
 */
export function usePressAnimation(): PressAnimationResult {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const onPressIn = useCallback(() => {
    scale.value = withSpring(PRESS_SCALE, PRESS_OUT_SPRING_CONFIG);
    opacity.value = withSpring(PRESS_OPACITY, PRESS_OUT_SPRING_CONFIG);
  }, [scale, opacity]);

  const onPressOut = useCallback(() => {
    scale.value = withSpring(1, PRESS_OUT_SPRING_CONFIG);
    opacity.value = withSpring(1, PRESS_OUT_SPRING_CONFIG);
  }, [scale, opacity]);

  return {
    animatedStyle,
    onPressIn,
    onPressOut,
  };
}
