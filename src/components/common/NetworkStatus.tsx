import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface NetworkStatusProps {
  /** Whether the device is currently offline */
  isOffline: boolean;
  /** Accessibility label (defaults to i18n offline text) */
  accessibilityLabel?: string;
}

/**
 * Displays a prominent "Offline" banner when the network is unavailable.
 * Renders nothing when online.
 */
export function NetworkStatus({ isOffline, accessibilityLabel }: NetworkStatusProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!isOffline) {
    return null;
  }

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel ?? t('common.offline')}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>{t('common.offline')}</Text>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    backgroundColor: theme.colors.warning,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  };

  const text: TextStyle = {
    ...theme.typography.caption1,
    color: theme.isDark ? '#000000' : '#1C1C1E',
    fontWeight: '600',
  };

  return StyleSheet.create({ container, text });
}
