import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface LoadingSpinnerProps {
  /** Optional message displayed below the spinner */
  message?: string;
  /** Accessibility label (defaults to i18n loading text or message) */
  accessibilityLabel?: string;
}

/**
 * Centered loading indicator with optional descriptive message.
 */
export function LoadingSpinner({ message, accessibilityLabel }: LoadingSpinnerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const displayMessage = message ?? t('common.loading');
  const label = accessibilityLabel ?? displayMessage;

  return (
    <View
      style={styles.container}
      accessibilityLabel={label}
      accessibilityRole="progressbar"
    >
      <ActivityIndicator size="large" color={theme.colors.accent} />
      {displayMessage && (
        <Text style={styles.message}>{displayMessage}</Text>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  };

  const message: TextStyle = {
    ...theme.typography.callout,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  };

  return StyleSheet.create({ container, message });
}
