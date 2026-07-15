import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { useChatStore } from '@/stores/chat-store';

export interface StreamingIndicatorProps {
  /** Callback invoked when the user presses Stop Generation */
  onStop: () => void;
}

/**
 * Streaming indicator shown while an assistant response is being received.
 *
 * Displays a blinking caret to signal active streaming and a "Stop generation"
 * button allowing the user to abort the SSE connection.
 */
export function StreamingIndicator({ onStop }: StreamingIndicatorProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const isStreaming = useChatStore((s) => s.isStreaming);

  // Blinking caret animation
  const caretOpacity = useSharedValue(1);

  React.useEffect(() => {
    caretOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // infinite repetition
      false
    );
  }, [caretOpacity]);

  const caretAnimatedStyle = useAnimatedStyle(() => ({
    opacity: caretOpacity.value,
  }));

  if (!isStreaming) {
    return null;
  }

  return (
    <View style={styles.container} accessibilityLabel={t('chat.thinking')}>
      <Animated.View style={[styles.caret, caretAnimatedStyle]} />
      <TouchableOpacity
        onPress={onStop}
        style={styles.stopButton}
        accessibilityLabel={t('accessibility.stopButton')}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <View style={styles.stopIcon} />
        <Text style={styles.stopText}>{t('chat.stopGeneration')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  };

  const caret: ViewStyle = {
    width: 2,
    height: 18,
    backgroundColor: theme.colors.accent,
    borderRadius: 1,
    marginRight: theme.spacing.md,
  };

  const stopButton: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadii.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  };

  const stopIcon: ViewStyle = {
    width: 10,
    height: 10,
    backgroundColor: theme.colors.error,
    borderRadius: 2,
    marginRight: theme.spacing.xs,
  };

  const stopText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.text,
    fontWeight: '500',
  };

  return StyleSheet.create({
    container,
    caret,
    stopButton,
    stopIcon,
    stopText,
  });
}
