/**
 * useSidebarTransition — Manages the 3D page-turn sidebar reveal animation.
 *
 * Provides:
 * - Reanimated shared values tracking open/close progress (0→1)
 * - Derived animated styles for both the chat layer and sidebar layer
 * - An edge-pan gesture (left 24px zone) mapped to progress over 240px drag
 * - open(), close(), toggle() methods with appropriate timing curves
 *
 * The chat layer rotates on Y axis with perspective, creating a page-turn effect.
 * The sidebar slides in from the left with scale and opacity transitions.
 *
 * Snap thresholds:
 * - Button-triggered: open if progress >= 0.4
 * - Gesture-triggered: open if progress >= 0.22
 */

import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, type GestureType } from 'react-native-gesture-handler';
import { Dimensions } from 'react-native';

import { SIDEBAR_EASING, SIDEBAR_TRANSITION_DURATION } from '@/theme/animations';

/** Gesture snap threshold — opens if drag progress >= this value */
export const GESTURE_SNAP_THRESHOLD = 0.22;

/** Button snap threshold — opens if progress >= this value */
export const BUTTON_SNAP_THRESHOLD = 0.4;

/**
 * Pure function determining whether the sidebar should snap open given a drag
 * release progress value and whether the trigger was gesture-based.
 *
 * @param progress - Current drag progress between 0.0 and 1.0
 * @param isGesture - true if the release was gesture-triggered, false if button-triggered
 * @returns true if the sidebar should snap open, false otherwise
 */
export function shouldSnapOpen(progress: number, isGesture: boolean): boolean {
  const threshold = isGesture ? GESTURE_SNAP_THRESHOLD : BUTTON_SNAP_THRESHOLD;
  return progress >= threshold;
}

/** Edge zone width in points where the pan gesture activates */
const EDGE_ZONE_WIDTH = 24;

/** Drag distance in points for a full 0→1 progress transition */
const FULL_DRAG_DISTANCE = 240;

/** Chat layer rotation at full open (degrees) */
const CHAT_ROTATE_Y_DEG = -76;

/** Chat layer translateX at full open (percentage of screen width encoded as fraction) */
const CHAT_TRANSLATE_X_PERCENT = 0.88;

/** Chat layer border radius at full open */
const CHAT_BORDER_RADIUS = 20;

/** Sidebar initial translateX offset */
const SIDEBAR_INITIAL_TRANSLATE_X = -42;

/** Sidebar initial scale */
const SIDEBAR_INITIAL_SCALE = 0.94;

/** Sidebar initial opacity */
const SIDEBAR_INITIAL_OPACITY = 0.3;

/** Spring config for gesture-triggered snap animations */
const SNAP_SPRING_CONFIG = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

/**
 * Custom cubic-bezier easing from SIDEBAR_EASING for button-triggered transitions.
 * Approximated using Reanimated's bezier easing.
 */
const BUTTON_EASING = Easing.bezier(
  SIDEBAR_EASING[0],
  SIDEBAR_EASING[1],
  SIDEBAR_EASING[2],
  SIDEBAR_EASING[3]
);

export interface SidebarTransitionResult {
  /** Animated progress value: 0 = closed, 1 = fully open */
  progress: SharedValue<number>;
  /** Whether the sidebar is currently open */
  isOpen: SharedValue<boolean>;
  /** Animated style to apply to the chat layer (rotateY, translateX, shadow, borderRadius) */
  chatAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Animated style to apply to the sidebar layer (translateX, scale, opacity) */
  sidebarAnimatedStyle: ReturnType<typeof useAnimatedStyle>;
  /** Edge pan gesture to attach to the root gesture handler */
  panGesture: GestureType;
  /** Open the sidebar with button-triggered timing */
  open: () => void;
  /** Close the sidebar with button-triggered timing */
  close: () => void;
  /** Toggle the sidebar open/close state with button-triggered timing */
  toggle: () => void;
}

/**
 * Hook managing the sidebar page-turn transition.
 *
 * Attach `panGesture` to a GestureDetector covering the screen.
 * Apply `chatAnimatedStyle` to an Animated.View wrapping the chat content.
 * Apply `sidebarAnimatedStyle` to an Animated.View wrapping the sidebar.
 * Call `open()`, `close()`, or `toggle()` from button handlers.
 */
export function useSidebarTransition(): SidebarTransitionResult {
  const screenWidth = Dimensions.get('window').width;

  const progress = useSharedValue(0);
  const isOpen = useSharedValue(false);

  /**
   * Animated style for the chat layer.
   * At progress = 1:
   * - perspective(1000) for 3D depth
   * - rotateY(-76deg)
   * - translateX(88% of screen width)
   * - borderRadius: 20
   * - shadow: -38px 0 70px rgba(0,0,0,0.35)
   */
  const chatAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    const rotateY = interpolate(p, [0, 1], [0, CHAT_ROTATE_Y_DEG]);
    const translateX = interpolate(p, [0, 1], [0, screenWidth * CHAT_TRANSLATE_X_PERCENT]);
    const borderRadius = interpolate(p, [0, 1], [0, CHAT_BORDER_RADIUS]);
    const shadowOpacity = interpolate(p, [0, 1], [0, 0.35]);

    return {
      transform: [
        { perspective: 1000 },
        { translateX },
        { rotateY: `${rotateY}deg` },
      ],
      borderRadius,
      shadowColor: '#000000',
      shadowOffset: { width: -38, height: 0 },
      shadowOpacity,
      shadowRadius: 70,
      elevation: interpolate(p, [0, 1], [0, 24]),
    };
  });

  /**
   * Animated style for the sidebar layer.
   * At progress = 0: translateX(-42), scale(0.94), opacity(0.3)
   * At progress = 1: translateX(0), scale(1), opacity(1)
   */
  const sidebarAnimatedStyle = useAnimatedStyle(() => {
    const p = progress.value;

    const translateX = interpolate(p, [0, 1], [SIDEBAR_INITIAL_TRANSLATE_X, 0]);
    const scale = interpolate(p, [0, 1], [SIDEBAR_INITIAL_SCALE, 1]);
    const opacity = interpolate(p, [0, 1], [SIDEBAR_INITIAL_OPACITY, 1]);

    return {
      transform: [{ translateX }, { scale }],
      opacity,
    };
  });

  /**
   * Sync the isOpen shared value from the JS thread after animation completes.
   */
  const syncIsOpen = useCallback((open: boolean) => {
    'worklet';
    isOpen.value = open;
  }, [isOpen]);

  /**
   * Open the sidebar with button-triggered cubic-bezier timing.
   */
  const open = useCallback(() => {
    progress.value = withTiming(1, {
      duration: SIDEBAR_TRANSITION_DURATION,
      easing: BUTTON_EASING,
    });
    isOpen.value = true;
  }, [progress, isOpen]);

  /**
   * Close the sidebar with button-triggered cubic-bezier timing.
   */
  const close = useCallback(() => {
    progress.value = withTiming(0, {
      duration: SIDEBAR_TRANSITION_DURATION,
      easing: BUTTON_EASING,
    });
    isOpen.value = false;
  }, [progress, isOpen]);

  /**
   * Toggle the sidebar open/close state.
   */
  const toggle = useCallback(() => {
    if (isOpen.value) {
      close();
    } else {
      open();
    }
  }, [isOpen, open, close]);

  /**
   * Edge pan gesture: activates in the left 24px zone.
   * Maps horizontal drag distance to progress over 240px.
   * On release, snaps open (>= 0.22 threshold) or closed with spring animation.
   */
  const panGesture = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetY([-20, 20])
    .hitSlop({ left: 0, width: EDGE_ZONE_WIDTH })
    .onStart(() => {
      // Gesture captured — nothing to initialize beyond current progress
    })
    .onUpdate((event) => {
      // Map translationX to progress [0, 1]
      const dragProgress = Math.min(
        Math.max(event.translationX / FULL_DRAG_DISTANCE, 0),
        1
      );

      // If sidebar was open and user drags left, allow closing
      if (isOpen.value) {
        progress.value = Math.max(1 + event.translationX / FULL_DRAG_DISTANCE, 0);
      } else {
        progress.value = dragProgress;
      }
    })
    .onEnd((event) => {
      const currentProgress = progress.value;
      const shouldOpen = currentProgress >= GESTURE_SNAP_THRESHOLD;

      if (shouldOpen) {
        progress.value = withSpring(1, SNAP_SPRING_CONFIG);
        isOpen.value = true;
      } else {
        progress.value = withSpring(0, SNAP_SPRING_CONFIG);
        isOpen.value = false;
      }
    });

  return {
    progress,
    isOpen,
    chatAnimatedStyle,
    sidebarAnimatedStyle,
    panGesture,
    open,
    close,
    toggle,
  };
}
