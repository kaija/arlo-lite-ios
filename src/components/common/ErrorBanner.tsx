import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface ErrorBannerProps {
  /** Short error summary displayed in collapsed state */
  message: string;
  /** Optional detailed error information shown when expanded */
  detail?: string;
  /** Optional retry callback; shows a retry button when provided */
  onRetry?: () => void;
  /** Accessibility label (defaults to message) */
  accessibilityLabel?: string;
}

/**
 * Compact one-line error banner that expands on tap to reveal full details.
 * Optionally shows a retry button.
 */
export function ErrorBanner({
  message,
  detail,
  onRetry,
  accessibilityLabel,
}: ErrorBannerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [expanded, setExpanded] = useState(false);

  const hasDetail = Boolean(detail);

  return (
    <View
      style={styles.container}
      accessibilityLabel={accessibilityLabel ?? message}
      accessibilityRole="alert"
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => hasDetail && setExpanded((prev) => !prev)}
        disabled={!hasDetail}
        accessibilityLabel={
          hasDetail
            ? expanded
              ? t('accessibility.collapseThinking')
              : t('accessibility.expandError')
            : undefined
        }
        accessibilityRole={hasDetail ? 'button' : undefined}
        activeOpacity={hasDetail ? 0.7 : 1}
      >
        <Text style={styles.message} numberOfLines={expanded ? undefined : 1}>
          {message}
        </Text>
        {hasDetail && !expanded && (
          <Text style={styles.hint}>{t('errors.tapForDetails')}</Text>
        )}
      </TouchableOpacity>

      {expanded && detail && (
        <Text style={styles.detail}>{detail}</Text>
      )}

      {onRetry && (
        <TouchableOpacity
          style={styles.retryButton}
          onPress={onRetry}
          accessibilityLabel={t('errors.retry')}
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <Text style={styles.retryText}>{t('errors.retry')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(239, 83, 80, 0.12)'
      : 'rgba(211, 47, 47, 0.08)',
    borderRadius: theme.borderRadii.md,
    padding: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error,
  };

  const header: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const message: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.errorText,
    flex: 1,
  };

  const hint: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginLeft: theme.spacing.sm,
  };

  const detail: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  };

  const retryButton: ViewStyle = {
    marginTop: theme.spacing.sm,
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.error,
  };

  const retryText: TextStyle = {
    ...theme.typography.caption1,
    color: '#FFFFFF',
    fontWeight: '600',
  };

  return StyleSheet.create({
    container,
    header,
    message,
    hint,
    detail,
    retryButton,
    retryText,
  });
}
