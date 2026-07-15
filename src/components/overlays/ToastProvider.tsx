/**
 * ToastProvider — Global toast notification system for Arlo Lite.
 *
 * Provides a React context with a `show(message)` method that displays
 * a non-blocking floating pill at the bottom of the screen. The toast
 * slides up + fades in, auto-dismisses after 1.8s, and fades out.
 *
 * Integrates with the UI store's `showToast` action and replaces any
 * existing toast if one is already visible (restarting the timer).
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';
import {
  AccessibilityInfo,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  TOAST_DISPLAY_DURATION,
  TOAST_ENTER_DURATION,
  TOAST_EXIT_DURATION,
} from '@/theme/animations';
import { useTheme } from '@/theme';
import { useUIStore } from '@/stores/ui-store';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface ToastContextValue {
  show: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

/**
 * Hook to access the toast context. Call `show(message)` to trigger a toast.
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters before truncation with ellipsis */
const MAX_MESSAGE_LENGTH = 50;

/** Distance the toast slides up on enter (points) */
const SLIDE_UP_DISTANCE = 10;

/** Bottom offset from safe area edge */
const BOTTOM_OFFSET = 170;

// ─── Provider ─────────────────────────────────────────────────────────────────

export interface ToastProviderProps {
  children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const { colors, typography } = useTheme();
  const showToast = useUIStore((s) => s.showToast);

  // Animation shared values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(SLIDE_UP_DISTANCE);

  // Current message state
  const messageRef = useRef<string | null>(null);
  const [displayMessage, setDisplayMessage] = React.useState<string | null>(
    null,
  );
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Truncates message to MAX_MESSAGE_LENGTH with ellipsis if needed.
   */
  const truncateMessage = useCallback((msg: string): string => {
    if (msg.length <= MAX_MESSAGE_LENGTH) return msg;
    return msg.slice(0, MAX_MESSAGE_LENGTH - 1) + '…';
  }, []);

  /**
   * Hides the toast by fading out. Called after the display duration elapses.
   */
  const hideToast = useCallback(() => {
    'worklet';
    opacity.value = withTiming(0, { duration: TOAST_EXIT_DURATION });
    translateY.value = withTiming(SLIDE_UP_DISTANCE, {
      duration: TOAST_EXIT_DURATION,
    });
  }, [opacity, translateY]);

  /**
   * Callback invoked on the JS thread after fade-out completes to clear state.
   */
  const onDismissComplete = useCallback(() => {
    messageRef.current = null;
    setDisplayMessage(null);
  }, []);

  /**
   * Shows a toast message. Replaces the current toast and restarts the timer.
   */
  const show = useCallback(
    (message: string) => {
      const truncated = truncateMessage(message);

      // Update stores
      showToast(truncated);

      // Clear any pending dismiss timer
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      // Set message for display
      messageRef.current = truncated;
      setDisplayMessage(truncated);

      // Announce to VoiceOver as a non-interrupting notification
      if (Platform.OS === 'ios') {
        AccessibilityInfo.announceForAccessibility(truncated);
      } else {
        AccessibilityInfo.announceForAccessibility(truncated);
      }

      // Animate in: slide up + fade in
      translateY.value = SLIDE_UP_DISTANCE;
      opacity.value = withTiming(1, { duration: TOAST_ENTER_DURATION });
      translateY.value = withTiming(0, { duration: TOAST_ENTER_DURATION });

      // Schedule auto-dismiss
      dismissTimerRef.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: TOAST_EXIT_DURATION });
        translateY.value = withTiming(SLIDE_UP_DISTANCE, {
          duration: TOAST_EXIT_DURATION,
        });

        // Clear state after fade-out completes
        setTimeout(() => {
          onDismissComplete();
        }, TOAST_EXIT_DURATION);
      }, TOAST_DISPLAY_DURATION);
    },
    [
      truncateMessage,
      showToast,
      opacity,
      translateY,
      onDismissComplete,
    ],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  // Animated styles for the toast pill
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({ show }),
    [show],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {displayMessage !== null && (
        <View style={styles.container} pointerEvents="none">
          <Animated.View
            style={[
              styles.pill,
              { backgroundColor: 'rgba(30, 30, 30, 0.88)' },
              animatedStyle,
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text
              style={[
                styles.text,
                {
                  fontSize: typography.caption2.fontSize,
                  lineHeight: typography.caption2.lineHeight,
                  letterSpacing: typography.caption2.letterSpacing,
                },
              ]}
              numberOfLines={1}
            >
              {displayMessage}
            </Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: BOTTOM_OFFSET,
    zIndex: 10,
    elevation: 10,
  },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 9999,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
});

export default ToastProvider;
