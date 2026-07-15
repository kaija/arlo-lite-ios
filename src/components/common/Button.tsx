import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

import { useTheme, Theme } from '@/theme';

export type ButtonVariant = 'primary' | 'secondary';

export interface ButtonProps {
  /** Button label text */
  title: string;
  /** Press handler */
  onPress: () => void;
  /** Visual variant */
  variant?: ButtonVariant;
  /** Disabled state */
  disabled?: boolean;
  /** Shows a spinner and disables interaction */
  loading?: boolean;
  /** Accessibility label (defaults to title) */
  accessibilityLabel?: string;
}

/**
 * Theme-aware button with primary and secondary variants.
 * Supports disabled state, loading spinner, and accessibility labels.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  accessibilityLabel,
}: ButtonProps) {
  const theme = useTheme();
  const styles = createStyles(theme, variant, disabled || loading);

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? theme.colors.accentText : theme.colors.accent}
        />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(
  theme: Theme,
  variant: ButtonVariant,
  isDisabled: boolean,
) {
  const isPrimary = variant === 'primary';

  const container: ViewStyle = {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: isDisabled ? 0.5 : 1,
    backgroundColor: isPrimary ? theme.colors.accent : 'transparent',
    borderWidth: isPrimary ? 0 : 1,
    borderColor: isPrimary ? undefined : theme.colors.border,
  };

  const label: TextStyle = {
    ...theme.typography.body,
    fontWeight: '600',
    color: isPrimary ? theme.colors.accentText : theme.colors.accent,
  };

  return StyleSheet.create({ container, label });
}
