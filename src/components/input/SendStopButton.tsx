import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Button size (diameter of the circular button). */
const BUTTON_SIZE = 32;

/** Icon size for the arrow and stop square. */
const ICON_SIZE = 16;

export interface SendStopButtonProps {
  /** Whether the text input has non-whitespace content. */
  hasText: boolean;
  /** Whether a response is currently being generated. */
  isStreaming: boolean;
  /** Called when the send button is tapped (hasText && !isStreaming). */
  onSend: () => void;
  /** Called when the stop button is tapped (isStreaming). */
  onStop: () => void;
}

/**
 * Derives the button state from props.
 *
 * - Disabled: no text and not streaming → non-interactive
 * - Send-ready: has text and not streaming → send action
 * - Streaming: generation active → stop action
 */
export function deriveButtonState(
  hasText: boolean,
  isStreaming: boolean
): 'disabled' | 'send' | 'stop' {
  if (isStreaming) return 'stop';
  if (hasText) return 'send';
  return 'disabled';
}

/**
 * Circular send/stop button for the input chrome.
 *
 * Displays an up-arrow icon (send) or a square icon (stop) depending on state.
 * Uses accent background when active, fill-secondary when disabled.
 * Applies usePressAnimation pattern (scale 0.97) on press.
 */
export function SendStopButton({
  hasText,
  isStreaming,
  onSend,
  onStop,
}: SendStopButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const state = deriveButtonState(hasText, isStreaming);
  const isDisabled = state === 'disabled';

  const backgroundColor = isDisabled ? colors.surfaceSecondary : colors.accent;
  const iconColor = isDisabled ? colors.textTertiary : colors.accentText;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (isDisabled) return;
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    opacity.value = withSpring(0.82, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (isDisabled) return;
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (state === 'send') {
      onSend();
    } else if (state === 'stop') {
      onStop();
    }
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={
          state === 'stop'
            ? 'Stop generation'
            : state === 'send'
              ? 'Send message'
              : 'Send message, disabled'
        }
        accessibilityState={{ disabled: isDisabled }}
        style={[
          styles.button,
          { backgroundColor },
        ]}
      >
        {state === 'stop' ? (
          <StopIcon color={iconColor} />
        ) : (
          <ArrowUpIcon color={iconColor} />
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Up-arrow icon for the send state. */
function ArrowUpIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <Path
        d="M8 2.5L8 13.5M8 2.5L3.5 7M8 2.5L12.5 7"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Square stop icon for the streaming state. */
function StopIcon({ color }: { color: string }) {
  return (
    <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 16 16" fill="none">
      <Rect
        x={3}
        y={3}
        width={10}
        height={10}
        rx={2}
        fill={color}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
