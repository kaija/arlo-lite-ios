/**
 * MessageActions — a row of action buttons shown beneath each message.
 *
 * Actions available per message type:
 * - Copy: available on all messages (copies full text to clipboard)
 * - Regenerate: available on all assistant messages
 * - Delete: available on all messages
 */

import React, { useState, useCallback } from 'react';
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
import type { Message } from '@/database/repositories/message-repo';

export interface MessageActionsProps {
  /** The message this action row belongs to */
  message: Message;
  /** Handler to copy the message content */
  onCopy: (message: Message) => Promise<void>;
  /** Handler to regenerate the assistant response */
  onRegenerate: () => Promise<void>;
  /** Handler to delete the message (and subsequent messages if applicable) */
  onDelete: () => Promise<void>;
}

/**
 * Row of contextual action buttons for a message.
 * Displays copy and delete on all messages, and regenerate on assistant messages.
 */
export function MessageActions({
  message,
  onCopy,
  onRegenerate,
  onDelete,
}: MessageActionsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await onCopy(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message, onCopy]);

  const handleRegenerate = useCallback(async () => {
    await onRegenerate();
  }, [onRegenerate]);

  const handleDelete = useCallback(async () => {
    await onDelete();
  }, [onDelete]);

  return (
    <View style={styles.container}>
      {/* Copy action — always available */}
      <TouchableOpacity
        onPress={handleCopy}
        style={styles.actionButton}
        accessibilityLabel={t('accessibility.copyButton')}
        accessibilityRole="button"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.actionText}>
          {copied ? t('chat.copied') : t('chat.copy')}
        </Text>
      </TouchableOpacity>

      {/* Regenerate action — assistant messages only */}
      {message.role === 'assistant' && (
        <TouchableOpacity
          onPress={handleRegenerate}
          style={styles.actionButton}
          accessibilityLabel={t('accessibility.regenerateButton')}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.actionText}>{t('chat.regenerate')}</Text>
        </TouchableOpacity>
      )}

      {/* Delete action — always available */}
      <TouchableOpacity
        onPress={handleDelete}
        style={styles.actionButton}
        accessibilityLabel={t('accessibility.deleteButton')}
        accessibilityRole="button"
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.actionText}>{t('chat.delete')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    gap: theme.spacing.md,
  };

  const actionButton: ViewStyle = {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  };

  const actionText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
  };

  return StyleSheet.create({
    container,
    actionButton,
    actionText,
  });
}
