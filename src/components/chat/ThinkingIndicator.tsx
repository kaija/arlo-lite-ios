import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
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

/**
 * Thinking indicator component shown while an LLM is in its reasoning/thinking phase.
 *
 * Behavior:
 * - While streaming + thinking content is arriving: shows animated "Thinking..." label
 * - After streaming completes: shows a collapsed section the user can tap to expand
 *   and read the accumulated thinking content.
 */
export function ThinkingIndicator() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const isStreaming = useChatStore((s) => s.isStreaming);
  const thinkingContent = useChatStore((s) => s.thinkingContent);
  const [expanded, setExpanded] = useState(false);

  // Pulsing opacity animation for the "Thinking..." label
  const pulseOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (isStreaming && thinkingContent.length > 0) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isStreaming, thinkingContent.length > 0, pulseOpacity]);

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // No thinking content at all — nothing to render
  if (!thinkingContent) {
    return null;
  }

  // Currently streaming thinking content — show animated indicator
  if (isStreaming) {
    return (
      <View
        style={styles.container}
        accessibilityLabel={t('chat.thinking')}
        accessibilityRole="text"
      >
        <Animated.Text style={[styles.thinkingLabel, pulseAnimatedStyle]}>
          {t('chat.thinking')}
        </Animated.Text>
      </View>
    );
  }

  // Streaming complete — show collapsible thinking section
  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.expandButton}
        accessibilityLabel={
          expanded
            ? t('accessibility.collapseThinking')
            : t('accessibility.expandThinking')
        }
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
        <Text style={styles.expandLabel}>
          {expanded ? t('chat.thinkingCollapse') : t('chat.thinkingExpand')}
        </Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.thinkingContentBox}>
          <Text style={styles.thinkingContentText} selectable>
            {thinkingContent}
          </Text>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  };

  const thinkingLabel: TextStyle = {
    ...theme.typography.subheadline,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  };

  const expandButton: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  };

  const expandIcon: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginRight: theme.spacing.xs,
    width: 14,
  };

  const expandLabel: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
  };

  const thinkingContentBox: ViewStyle = {
    marginTop: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  };

  const thinkingContentText: TextStyle = {
    ...theme.typography.footnote,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  };

  return StyleSheet.create({
    container,
    thinkingLabel,
    expandButton,
    expandIcon,
    expandLabel,
    thinkingContentBox,
    thinkingContentText,
  });
}
