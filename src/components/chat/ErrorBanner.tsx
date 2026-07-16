/**
 * ErrorBanner — Inline error display rendered within the message stream.
 *
 * Shows a warning icon, error message, expandable detail section,
 * and a retry button when the error is retryable. Styled to blend
 * with the message flow (no modal/overlay).
 *
 * Requirements: 8.1, 8.2, 8.3
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  AccessibilityInfo,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface ErrorBannerProps {
  /** Short error message */
  message: string;
  /** Full error detail shown on expand */
  detail?: string;
  /** Whether to show the retry button */
  isRetryable: boolean;
  /** Called when retry is tapped */
  onRetry: () => void;
  /** Called when the error is dismissed */
  onDismiss: () => void;
}

/**
 * Inline error banner component for the chat message stream.
 *
 * Renders a warning icon with the error message text. Tapping the message
 * expands to show optional detail text. When retryable, a "Retry" button
 * is displayed using the theme accent color.
 */
export function ErrorBanner({
  message,
  detail,
  isRetryable,
  onRetry,
  onDismiss,
}: ErrorBannerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [expanded, setExpanded] = useState(false);

  // Announce error to VoiceOver on mount
  React.useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
  }, [message]);

  const handleToggleDetail = () => {
    if (detail) {
      setExpanded((prev) => !prev);
    }
  };

  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      {/* Error message row: icon + message + expand tap target */}
      <Pressable
        style={styles.messageRow}
        onPress={handleToggleDetail}
        accessibilityRole={detail ? 'button' : 'text'}
        accessibilityLabel={
          detail
            ? t('accessibility.expandError', 'Tap to show error details')
            : message
        }
        accessibilityHint={detail ? t('accessibility.expandHint', 'Shows full error details') : undefined}
      >
        <Text style={styles.warningIcon} accessibilityElementsHidden>
          ⚠
        </Text>
        <Text style={styles.messageText} numberOfLines={expanded ? undefined : 1}>
          {message}
        </Text>
      </Pressable>

      {/* Expandable detail section */}
      {expanded && detail && (
        <View style={styles.detailContainer}>
          <Text style={styles.detailText}>{detail}</Text>
        </View>
      )}

      {/* Action row: retry button */}
      {isRetryable && (
        <View style={styles.actionRow}>
          <Pressable
            onPress={onRetry}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.retryButton', 'Retry sending message')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.retryText}>{t('chat.retry', 'Retry')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    paddingHorizontal: 18,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  };

  const messageRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const warningIcon: TextStyle = {
    fontSize: 16,
    marginRight: theme.spacing.sm,
    color: theme.colors.error,
  };

  const messageText: TextStyle = {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  };

  const detailContainer: ViewStyle = {
    marginTop: theme.spacing.sm,
    marginLeft: 24 + theme.spacing.sm, // align with message text (icon width + spacing)
    paddingLeft: theme.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border,
  };

  const detailText: TextStyle = {
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.textTertiary,
    ...(Platform.OS === 'ios'
      ? { fontFamily: 'Menlo' }
      : { fontFamily: 'monospace' }),
  };

  const actionRow: ViewStyle = {
    flexDirection: 'row',
    marginTop: theme.spacing.sm,
    marginLeft: 24 + theme.spacing.sm, // align with message text
  };

  const retryButton: ViewStyle = {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: `${theme.colors.accent}14`, // 8% accent opacity for subtle background
  };

  const retryText: TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accent,
  };

  return StyleSheet.create({
    container,
    messageRow,
    warningIcon,
    messageText,
    detailContainer,
    detailText,
    actionRow,
    retryButton,
    retryText,
  });
}
