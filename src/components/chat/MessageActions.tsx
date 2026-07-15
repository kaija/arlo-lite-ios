/**
 * MessageActions — a row of action buttons shown beneath each message.
 *
 * Actions available per message type:
 * - Copy: available on all messages (copies full text to clipboard)
 * - Regenerate: available only on the last assistant message
 * - Edit: available on user messages
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
  /** Whether this is the last assistant message (enables regenerate) */
  isLastAssistant: boolean;
  /** Handler to copy the message content */
  onCopy: (message: Message) => Promise<void>;
  /** Handler to regenerate the last assistant response */
  onRegenerate: () => Promise<void>;
  /** Handler to edit a user message */
  onEdit: (message: Message) => void;
}

/**
 * Row of contextual action buttons for a message.
 * Displays copy on all messages, edit on user messages, and regenerate on the last assistant.
 */
export function MessageActions({
  message,
  isLastAssistant,
  onCopy,
  onRegenerate,
  onEdit,
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

  const handleEdit = useCallback(() => {
    onEdit(message);
  }, [message, onEdit]);

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

      {/* Edit action — user messages only */}
      {message.role === 'user' && (
        <TouchableOpacity
          onPress={handleEdit}
          style={styles.actionButton}
          accessibilityLabel={t('accessibility.editButton')}
          accessibilityRole="button"
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={styles.actionText}>{t('chat.edit')}</Text>
        </TouchableOpacity>
      )}

      {/* Regenerate action — last assistant message only */}
      {isLastAssistant && (
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
