import React from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { useSettingsStore, ThemeMode } from '@/stores/settings-store';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];

/**
 * Segmented control for selecting the app appearance theme.
 * Provides Light, Dark, and System options with the current selection highlighted.
 */
export function ThemeSelector() {
  const { t } = useTranslation();
  const theme = useTheme();
  const currentTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const styles = createStyles(theme);

  const labels: Record<ThemeMode, string> = {
    light: t('settings.themeLight'),
    dark: t('settings.themeDark'),
    system: t('settings.themeSystem'),
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('accessibility.themeSelector')}
    >
      {THEME_OPTIONS.map((option) => {
        const isSelected = option === currentTheme;
        return (
          <Pressable
            key={option}
            style={[styles.option, isSelected && styles.optionSelected]}
            onPress={() => setTheme(option)}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={labels[option]}
          >
            <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.xxs,
  };

  const option: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadii.sm,
  };

  const optionSelected: ViewStyle = {
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  };

  const optionText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  };

  const optionTextSelected: TextStyle = {
    color: theme.colors.text,
    fontWeight: '600',
  };

  return StyleSheet.create({
    container,
    option,
    optionSelected,
    optionText,
    optionTextSelected,
  });
}
