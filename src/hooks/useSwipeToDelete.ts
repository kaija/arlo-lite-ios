/**
 * useSwipeToDelete — Manages swipe-to-reveal-delete gesture for session rows.
 *
 * Provides:
 * - Reanimated translateX shared value for row translation
 * - Pan gesture that reveals a 72px red delete button when swiped left > 40px
 * - Spring return on release below threshold
 * - `reset()` method to programmatically close the reveal
 *
 * The row translates leftward. If the drag exceeds 40px to the left,
 * the row snaps to -72px to reveal the delete button underneath.
 * Below the threshold, the row springs back to 0.
 */

import { useCallback, useMemo } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, type GestureType } from 'react-native-gesture-handler';

/** Width of the revealed delete button in points */
const DELETE_BUTTON_WIDTH = 72;

/** Minimum leftward drag (in points) to trigger the reveal snap */
const REVEAL_THRESHOLD = 40;

/** Spring config for snap animations */
const SPRING_CONFIG = {
  damping: 22,
  stiffness: 250,
  mass: 0.8,
};

export interface SwipeToDeleteResult {
  /** Current translateX value for the row content */
  translateX: SharedValue<number>;
  /** Pan gesture to attach to the row */
  panGesture: GestureType;
  /** Whether the delete button is currently revealed */
  isRevealed: boolean;
  /** Programmatically close the reveal (animate back to 0) */
  reset: () => void;
}

/**
 * Hook managing swipe-to-delete gesture for sidebar session rows.
 *
 * Attach `panGesture` to a GestureDetector wrapping the row.
 * Use `translateX` to drive the row's horizontal offset via useAnimatedStyle.
 * Call `reset()` to programmatically dismiss the revealed delete button.
 */
export function useSwipeToDelete(): SwipeToDeleteResult {
  const translateX = useSharedValue(0);
  const isRevealed = useSharedValue(false);

  /**
   * Reset the row back to its original position.
   */
  const reset = useCallback(() => {
    translateX.value = withSpring(0, SPRING_CONFIG);
    isRevealed.value = false;
  }, [translateX, isRevealed]);

  /**
   * Pan gesture: horizontal swipe detection.
   * - Activates on horizontal movement (activeOffsetX)
   * - Fails on significant vertical movement to avoid scroll conflicts
   * - On update: clamp translateX between -DELETE_BUTTON_WIDTH and 0
   * - On end: snap to -72px if dragged past threshold, else spring back to 0
   */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-15, 15])
        .onUpdate((event) => {
          'worklet';
          if (isRevealed.value) {
            // If already revealed, allow dragging back toward 0 or further left
            const newValue = -DELETE_BUTTON_WIDTH + event.translationX;
            translateX.value = Math.min(0, Math.max(-DELETE_BUTTON_WIDTH, newValue));
          } else {
            // Only allow leftward movement (negative translationX)
            const newValue = Math.min(0, event.translationX);
            translateX.value = Math.max(-DELETE_BUTTON_WIDTH, newValue);
          }
        })
        .onEnd((event) => {
          'worklet';
          const dragDistance = Math.abs(translateX.value);

          if (dragDistance >= REVEAL_THRESHOLD) {
            // Snap open to reveal delete button
            translateX.value = withSpring(-DELETE_BUTTON_WIDTH, SPRING_CONFIG);
            isRevealed.value = true;
          } else {
            // Spring back to closed
            translateX.value = withSpring(0, SPRING_CONFIG);
            isRevealed.value = false;
          }
        }),
    [translateX, isRevealed]
  );

  return {
    translateX,
    panGesture,
    get isRevealed() {
      return isRevealed.value;
    },
    reset,
  };
}
