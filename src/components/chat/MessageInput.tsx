/**
 * MessageInput component for the chat screen.
 *
 * Features:
 * - Multiline text input with dynamic height
 * - Send button (disabled when empty or offline)
 * - Attachment picker (image + file) shown when model supports them
 * - Voice dictation with on-device speech-to-text (expo-speech-recognition)
 * - Stop generation button while streaming
 * - Pending attachment preview thumbnails
 * - Full accessibility labels on all interactive elements
 * - i18n for all user-facing strings
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { useNetwork } from '@/hooks/useNetwork';
import { AttachmentPicker } from './AttachmentPicker';
import { VoiceDictation } from './VoiceDictation';
import type { ContentPart } from '@/providers/types';

export interface MessageInputProps {
  /** Called when the user taps send with the current text and any pending attachments */
  onSend: (text: string, attachments?: ContentPart[]) => void;
  /** Called when the user taps stop generation */
  onStop?: () => void;
  /** Whether a streaming response is in progress */
  isStreaming?: boolean;
  /** Whether input should be disabled (e.g. no session selected) */
  disabled?: boolean;
  /** Whether the active model supports image input */
  supportsImageInput?: boolean;
  /** Whether the active model supports file input */
  supportsFileInput?: boolean;
}

/**
 * Chat message input bar with send, stop, attachment picker, and voice controls.
 * Disables the send button and input when offline per requirement 19.2.
 */
export function MessageInput({
  onSend,
  onStop,
  isStreaming = false,
  disabled = false,
  supportsImageInput = false,
  supportsFileInput = false,
}: MessageInputProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { isConnected } = useNetwork();
  const styles = createStyles(theme);

  const [text, setText] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<ContentPart[]>([]);

  const isOffline = !isConnected;
  const hasContent = text.trim().length > 0 || pendingAttachments.length > 0;
  const canSend = hasContent && !isOffline && !isStreaming && !disabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const message = text.trim();
    const attachments = pendingAttachments.length > 0 ? [...pendingAttachments] : undefined;
    setText('');
    setPendingAttachments([]);
    onSend(message, attachments);
  }, [canSend, text, pendingAttachments, onSend]);

  const handleStop = useCallback(() => {
    onStop?.();
  }, [onStop]);

  const handleAttachmentsSelected = useCallback((parts: ContentPart[]) => {
    setPendingAttachments((prev) => [...prev, ...parts]);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <View style={styles.container}>
      {/* Pending attachment thumbnails */}
      {pendingAttachments.length > 0 && (
        <ScrollView
          horizontal
          style={styles.thumbnailRow}
          contentContainerStyle={styles.thumbnailContent}
          showsHorizontalScrollIndicator={false}
        >
          {pendingAttachments.map((part, index) => (
            <View key={index} style={styles.thumbnailWrapper}>
              {part.type === 'image_url' ? (
                <Image
                  source={{ uri: part.image_url.url }}
                  style={styles.thumbnail}
                  accessibilityLabel={t('attachments.attachedImage', { index: index + 1 })}
                />
              ) : (
                <View style={styles.fileThumbnail}>
                  <Text style={styles.fileThumbnailText}>F</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeAttachment(index)}
                accessibilityLabel={t('attachments.removeAttachment')}
                accessibilityRole="button"
                hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
              >
                <Text style={styles.removeButtonText}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Attachment buttons row */}
      <View style={styles.attachmentRow}>
        <AttachmentPicker
          supportsImageInput={supportsImageInput}
          supportsFileInput={supportsFileInput}
          onAttachmentsSelected={handleAttachmentsSelected}
          disabled={isOffline || isStreaming || disabled}
        />

        {/* Voice dictation (task 19.2) */}
        <VoiceDictation
          onTranscript={(transcript) => setText(transcript)}
          onFinalTranscript={(transcript) => setText(transcript)}
          disabled={isOffline || isStreaming || disabled}
        />
      </View>

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.textInput, (isOffline || disabled) && styles.disabledInput]}
          value={text}
          onChangeText={setText}
          placeholder={
            isOffline
              ? t('common.offline')
              : t('chat.placeholder')
          }
          placeholderTextColor={theme.colors.textTertiary}
          multiline
          maxLength={100000}
          editable={!isOffline && !isStreaming && !disabled}
          accessibilityLabel={t('chat.placeholder')}
          accessibilityHint={isOffline ? t('errors.network') : undefined}
          returnKeyType="default"
          blurOnSubmit={false}
          textAlignVertical="top"
        />

        {isStreaming ? (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={handleStop}
            accessibilityLabel={t('accessibility.stopButton')}
            accessibilityRole="button"
            activeOpacity={0.7}
          >
            <View style={styles.stopIcon} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!canSend}
            accessibilityLabel={t('accessibility.sendButton')}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSend }}
            activeOpacity={0.7}
          >
            <Text style={[styles.sendIcon, !canSend && styles.sendIconDisabled]}>
              {'\u2191'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  };

  const thumbnailRow: ViewStyle = {
    marginBottom: theme.spacing.sm,
    maxHeight: 72,
  };

  const thumbnailContent: ViewStyle = {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  };

  const thumbnailWrapper: ViewStyle = {
    position: 'relative',
  };

  const thumbnail: ImageStyle = {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.surfaceSecondary,
  };

  const fileThumbnail: ViewStyle = {
    width: 56,
    height: 56,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  };

  const fileThumbnailText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  };

  const removeButton: ViewStyle = {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const removeButtonText: TextStyle = {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  };

  const attachmentRow: ViewStyle = {
    flexDirection: 'row',
    marginBottom: theme.spacing.xs,
    gap: theme.spacing.sm,
    alignItems: 'center',
  };

  const attachmentButton: ViewStyle = {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const attachmentIcon: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  };

  const inputRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  };

  const textInput: TextStyle = {
    flex: 1,
    ...theme.typography.body,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 120,
    minHeight: 40,
  };

  const disabledInput: TextStyle = {
    opacity: 0.5,
  };

  const sendButton: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const sendButtonDisabled: ViewStyle = {
    backgroundColor: theme.colors.surfaceSecondary,
  };

  const sendIcon: TextStyle = {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  };

  const sendIconDisabled: TextStyle = {
    color: theme.colors.textTertiary,
  };

  const stopButton: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const stopIcon: ViewStyle = {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  };

  return StyleSheet.create({
    container,
    thumbnailRow,
    thumbnailContent,
    thumbnailWrapper,
    thumbnail,
    fileThumbnail,
    fileThumbnailText,
    removeButton,
    removeButtonText,
    attachmentRow,
    inputRow,
    textInput,
    disabledInput,
    sendButton,
    sendButtonDisabled,
    sendIcon,
    sendIconDisabled,
    stopButton,
    stopIcon,
  });
}
