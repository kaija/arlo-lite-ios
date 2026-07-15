import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

import { useTheme, Theme } from '@/theme';

export interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Accessibility label for the card container */
  accessibilityLabel?: string;
}

/**
 * Card wrapper for list items and grouped content.
 * Uses the theme surface color, border radius, and standard padding.
 */
export function Card({ children, accessibilityLabel }: CardProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="summary"
    >
      {children}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.lg,
  };

  return StyleSheet.create({ container });
}
