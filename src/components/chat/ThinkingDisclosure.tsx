import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface ThinkingDisclosureProps {
  /** The reasoning/thinking content to display when expanded. */
  content: string;
  /** Whether the disclosure block is currently expanded. */
  isExpanded: boolean;
  /** Callback fired when the user toggles the expanded/collapsed state. */
  onToggle: () => void;
}

/** Blink animation half-cycle duration in ms. */
const LABEL_BLINK_DURATION = 600;

/**
 * ThinkingDisclosure renders a collapsible thinking/reasoning block.
 *
 * Features:
 * - Blinking "Thinking" label with chevron toggle
 * - Collapsed/expanded state for reasoning content
 * - Left accent-colored border on expanded block
 * - Omitted entirely if no reasoning content (caller should not render)
 * - Toggle state retained for session duration (managed by parent)
 *
 * Requirements: 4.4, 4.5, 4.7
 */
export function ThinkingDisclosure({
  content,
  isExpanded,
  onToggle,
}: ThinkingDisclosureProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createThinkingDisclosureStyles(theme);

  // Blinking opacity for the "Thinking" label
  const labelOpacity = useSharedValue(1);

  useEffect(() => {
    labelOpacity.value = withRepeat(
      withSequence(
        withTiming(0.3, {
          duration: LABEL_BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: LABEL_BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(labelOpacity);
    };
  }, [labelOpacity]);

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  // Omit entirely if no reasoning content
  if (!content || content.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.toggleRow}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={
          isExpanded
            ? t('accessibility.collapseThinking', { defaultValue: 'Collapse thinking' })
            : t('accessibility.expandThinking', { defaultValue: 'Expand thinking' })
        }
        accessibilityState={{ expanded: isExpanded }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.chevron, isExpanded && styles.chevronExpanded]}>
          {'›'}
        </Text>
        <Animated.Text style={[styles.label, labelAnimatedStyle]}>
          {t('chat.thinking', { defaultValue: 'Thinking' })}
        </Animated.Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.contentBox}>
          <Text style={styles.contentText} selectable>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createThinkingDisclosureStyles(theme: Theme) {
  const container: ViewStyle = {
    marginBottom: 8,
  };

  const toggleRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  };

  const chevron: TextStyle = {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginRight: 6,
    width: 14,
    textAlign: 'center',
    transform: [{ rotate: '0deg' }],
  };

  const chevronExpanded: TextStyle = {
    transform: [{ rotate: '90deg' }],
  };

  const label: TextStyle = {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  };

  const contentBox: ViewStyle = {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.accent,
  };

  const contentText: TextStyle = {
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  };

  return StyleSheet.create({
    container,
    toggleRow,
    chevron,
    chevronExpanded,
    label,
    contentBox,
    contentText,
  });
}
