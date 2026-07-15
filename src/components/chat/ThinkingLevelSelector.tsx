import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { useChatStore, ThinkingLevel } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';

const THINKING_LEVELS: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

/**
 * Horizontal segmented control for selecting thinking/reasoning effort level.
 * Only rendered when the active model supports reasoning.
 * Uses a compact pill design with the active level highlighted in accent color.
 */
export function ThinkingLevelSelector() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const { activeModelId, thinkingLevel, setThinkingLevel } = useChatStore();
  const { models } = useProviderStore();

  // Find the active model to check reasoning support
  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId || m.modelId === activeModelId),
    [models, activeModelId],
  );

  // Hide if no model selected or model doesn't support reasoning (Req 7.2)
  if (!activeModel || !activeModel.supportsReasoning) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityLabel={t('thinkingLevel.title')}
      accessibilityRole="radiogroup"
    >
      {THINKING_LEVELS.map((level) => {
        const isActive = thinkingLevel === level;
        const label = t(`thinkingLevel.${level}`);

        return (
          <TouchableOpacity
            key={level}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => setThinkingLevel(level)}
            activeOpacity={0.7}
            accessibilityLabel={label}
            accessibilityRole="radio"
            accessibilityState={{ checked: isActive }}
          >
            <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    gap: theme.spacing.xs,
  };

  const pill: ViewStyle = {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadii.full,
    backgroundColor: 'transparent',
  };

  const pillActive: ViewStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(88, 86, 214, 0.25)'
      : 'rgba(88, 86, 214, 0.12)',
  };

  const pillText: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  };

  const pillTextActive: TextStyle = {
    color: theme.colors.accent,
    fontWeight: '700',
  };

  return StyleSheet.create({
    container,
    pill,
    pillActive,
    pillText,
    pillTextActive,
  });
}
