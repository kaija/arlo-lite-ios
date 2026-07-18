/**
 * RenameDialog — Modal dialog for renaming chat sessions.
 *
 * Displays a centered card (280pt wide, 14pt radius) over a 32% black scrim
 * with a fade-up animation. Includes a text input pre-populated with the
 * current session title, keyboard auto-focused with cursor at end.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import { RENAME_DIALOG_DURATION, DIALOG_EASING } from '@/theme/animations';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RenameDialogProps {
  /** Whether the dialog is visible */
  visible: boolean;
  /** Current session title to pre-populate the input */
  currentTitle: string;
  /** Called with the trimmed new title when user taps Save */
  onSave: (newTitle: string) => void;
  /** Called when user taps Cancel or the scrim */
  onCancel: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum characters allowed in the rename input */
const MAX_TITLE_LENGTH = 100;

/** Card width in points */
const CARD_WIDTH = 280;

/** Card border radius in points */
const CARD_RADIUS = 14;

/** Input field border radius in points */
const INPUT_RADIUS = 8;

/** Vertical slide distance for fade-up animation */
const SLIDE_UP_DISTANCE = 12;

// ─── Component ────────────────────────────────────────────────────────────────

export function RenameDialog({
  visible,
  currentTitle,
  onSave,
  onCancel,
}: RenameDialogProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const [text, setText] = useState(currentTitle);

  // Animation shared values
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(SLIDE_UP_DISTANCE);

  // Sync text state when dialog opens with a new title
  useEffect(() => {
    if (visible) {
      setText(currentTitle);
      // Animate in with fade-up
      opacity.value = 0;
      translateY.value = SLIDE_UP_DISTANCE;
      opacity.value = withTiming(1, {
        duration: RENAME_DIALOG_DURATION,
        easing: Easing.bezier(
          DIALOG_EASING[0],
          DIALOG_EASING[1],
          DIALOG_EASING[2],
          DIALOG_EASING[3],
        ),
      });
      translateY.value = withTiming(0, {
        duration: RENAME_DIALOG_DURATION,
        easing: Easing.bezier(
          DIALOG_EASING[0],
          DIALOG_EASING[1],
          DIALOG_EASING[2],
          DIALOG_EASING[3],
        ),
      });
    }
  }, [visible, currentTitle, opacity, translateY]);

  const trimmedText = text.trim();
  const isSaveEnabled = trimmedText.length > 0;

  const handleSave = useCallback(() => {
    if (isSaveEnabled) {
      onSave(trimmedText);
    }
  }, [isSaveEnabled, trimmedText, onSave]);

  const handleCancel = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      {/* Scrim — tap to dismiss */}
      <Pressable
        style={[styles.scrim, { backgroundColor: 'rgba(0, 0, 0, 0.32)' }]}
        onPress={handleCancel}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.dismissRenameDialog')}
      >
        {/* Card — prevent scrim tap from propagating */}
        <Animated.View style={[animatedCardStyle, styles.cardWrapper]}>
          <Pressable
            style={[
              styles.card,
              { backgroundColor: colors.surface },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Title */}
            <Text
              style={[
                styles.title,
                { color: colors.text },
              ]}
              accessibilityRole="header"
            >
              {t('sessions.rename')}
            </Text>

            {/* Text Input */}
            <TextInput
              ref={inputRef}
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBackground,
                  color: colors.text,
                },
              ]}
              value={text}
              onChangeText={setText}
              maxLength={MAX_TITLE_LENGTH}
              autoFocus
              selectTextOnFocus={false}
              selection={undefined}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              accessibilityLabel={t('sessions.renameInputLabel')}
              accessibilityHint={t('sessions.renameInputHint')}
            />

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <Pressable
                style={[
                  styles.button,
                  styles.cancelButton,
                  { backgroundColor: colors.surfaceSecondary },
                ]}
                onPress={handleCancel}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: colors.accent },
                  ]}
                >
                  {t('common.cancel')}
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.button,
                  styles.saveButton,
                  {
                    backgroundColor: isSaveEnabled
                      ? colors.accent
                      : colors.surfaceSecondary,
                  },
                ]}
                onPress={handleSave}
                disabled={!isSaveEnabled}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
                accessibilityState={{ disabled: !isSaveEnabled }}
              >
                <Text
                  style={[
                    styles.buttonText,
                    {
                      color: isSaveEnabled
                        ? colors.accentText
                        : colors.textTertiary,
                    },
                  ]}
                >
                  {t('common.save')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    width: CARD_WIDTH,
  },
  card: {
    width: CARD_WIDTH,
    borderRadius: CARD_RADIUS,
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 16,
  },
  input: {
    width: '100%',
    borderRadius: INPUT_RADIUS,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: INPUT_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  saveButton: {},
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default RenameDialog;
