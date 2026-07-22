/**
 * InputChrome — Bottom input bar with translucent blurred background.
 *
 * Composes: ModelChip, ThinkingLevelSelector, ContextRing, SendStopButton,
 * attachment button, multiline TextInput, and EqualiserAnimation.
 *
 * Layout (top-to-bottom inside the bar):
 *   1. Metadata row: ModelChip + ThinkingLevelSelector (if model supports) + ContextRing
 *   2. Compose row: Attachment button | TextInput | SendStopButton
 *
 * Fixed above keyboard when visible via KeyboardAvoidingView integration.
 * Uses expo-blur BlurView for the translucent material background.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 14.7, 14.8
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { ThinkingLevel } from '@/stores/chat-store';
import { ModelChip } from '@/components/input/ModelChip';
import { ThinkingLevelSelector } from '@/components/input/ThinkingLevelSelector';
import { ContextRing } from '@/components/input/ContextRing';
import { SendStopButton } from '@/components/input/SendStopButton';
import { EqualiserAnimation } from '@/components/input/EqualiserAnimation';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum height of the text input before it scrolls internally */
const MAX_INPUT_HEIGHT = 120;

/** Minimum height of the text input */
const MIN_INPUT_HEIGHT = 36;

/** Size of the attachment button tap target */
const ATTACHMENT_TAP_TARGET = 44;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface InputChromeProps {
  /** Display name of the active model */
  activeModelName: string;
  /** Current thinking/reasoning effort level */
  thinkingLevel: ThinkingLevel;
  /** Whether the active model supports thinking/reasoning */
  supportsThinking: boolean;
  /** Context window usage as a percentage (0-100) */
  contextUsagePercent: number;
  /** Whether a response is currently streaming */
  isStreaming: boolean;
  /** Called when the model chip is tapped to open the model picker */
  onModelPickerOpen: () => void;
  /** Called when the thinking level selector is tapped */
  onThinkingCycle: () => void;
  /** Called with the message text when the user sends */
  onSend: (text: string) => void;
  /** Called when the stop button is tapped during streaming */
  onStop: () => void;
  /** Called when the attachment/paperclip button is tapped */
  onAttach: () => void;
  /** Called when the context ring is tapped to show usage breakdown */
  onContextRingPress: () => void;
  /** Number of images pending to be sent */
  pendingAttachmentCount?: number;
  /** Whether the active model supports image input */
  supportsImageInput?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Bottom chrome bar for the chat screen.
 *
 * Provides a translucent blur backdrop with a hairline top separator,
 * model/thinking metadata row, and a compose row with attachment button,
 * multiline text input, and send/stop button.
 */
export function InputChrome({
  activeModelName,
  thinkingLevel,
  supportsThinking,
  contextUsagePercent,
  isStreaming,
  onModelPickerOpen,
  onThinkingCycle,
  onSend,
  onStop,
  onAttach,
  onContextRingPress,
  pendingAttachmentCount,
  supportsImageInput,
}: InputChromeProps) {
  const { colors, borderRadii, isDark } = useTheme();
  const { t } = useTranslation();

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  const hasText = text.trim().length > 0;

  // ─── Handlers ─────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (trimmed.length > 0 && !isStreaming) {
      onSend(trimmed);
      setText('');
    }
  }, [text, isStreaming, onSend]);

  const handleStop = useCallback(() => {
    onStop();
  }, [onStop]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.blurContainer}
      >
        {/* Hairline top separator */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        {/* Metadata row: ModelChip + ThinkingLevelSelector + ContextRing */}
        <View style={styles.metadataRow}>
          <ModelChip modelName={activeModelName} onPress={onModelPickerOpen} />

          {supportsThinking && (
            <ThinkingLevelSelector
              level={thinkingLevel}
              onCycle={onThinkingCycle}
            />
          )}

          <Pressable
            onPress={onContextRingPress}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.contextUsageIndicator', { percentage: contextUsagePercent })}
          >
            <ContextRing percentage={contextUsagePercent} />
          </Pressable>

          {/* Equaliser animation shown during streaming */}
          {isStreaming && <EqualiserAnimation isActive={isStreaming} />}
        </View>

        {/* Compose row: attachment + text input + send/stop */}
        <View style={styles.composeRow}>
          {/* Attachment button - visible only when model supports image input */}
          {supportsImageInput && (
            <Pressable
              onPress={onAttach}
              accessibilityRole="button"
              accessibilityLabel={t('accessibility.attachFileButton')}
              accessibilityHint={t('accessibility.attachFileHint')}
              style={styles.attachButton}
            >
              <ImageIcon color={colors.textTertiary} />
              {(pendingAttachmentCount ?? 0) > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={styles.badgeText}>{pendingAttachmentCount}</Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Multiline text input */}
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textTertiary}
            multiline
            blurOnSubmit={false}
            returnKeyType="default"
            textAlignVertical="top"
            accessibilityLabel={t('accessibility.messageInput')}
            accessibilityHint={t('accessibility.messageInputHint')}
            style={[
              styles.textInput,
              {
                backgroundColor: colors.surfaceSecondary,
                color: colors.text,
                borderRadius: borderRadii.input,
              },
            ]}
          />

          {/* Send/Stop button */}
          <SendStopButton
            hasText={hasText}
            isStreaming={isStreaming}
            onSend={handleSend}
            onStop={handleStop}
          />
        </View>
      </BlurView>
    </KeyboardAvoidingView>
  );
}

// ─── Icons ──────────────────────────────────────────────────────────────────

/** Photo/image icon — rounded rectangle frame with mountain landscape and sun */
function ImageIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Rect
        x={3}
        y={3}
        width={18}
        height={18}
        rx={2}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M3 16l5-5 4 4 3-3 6 6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
        stroke={color}
        strokeWidth={2}
      />
    </Svg>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  blurContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 34 : 12, // account for home indicator
  },
  separator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  metadataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  composeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    width: ATTACHMENT_TAP_TARGET,
    height: ATTACHMENT_TAP_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: MIN_INPUT_HEIGHT,
    maxHeight: MAX_INPUT_HEIGHT,
  },
});
