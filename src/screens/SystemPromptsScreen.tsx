import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { useSettingsStore } from '@/stores/settings-store';
import { useProviderStore } from '@/stores/provider-store';
import { DEFAULT_SYSTEM_PROMPT } from '@/constants/defaults';
import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';

/** Sentinel ID for the built-in default prompt (not stored in DB). */
const BUILT_IN_PROMPT_ID = '__built_in__';

/** Maximum characters shown in the content preview. */
const PREVIEW_MAX_LENGTH = 80;

/**
 * SystemPromptsScreen — manages the user's system prompt library.
 *
 * Features:
 * - Lists all prompts with the built-in default at the top
 * - Create / edit / delete custom prompts via a modal
 * - Designate any prompt as the default for new sessions
 */
export function SystemPromptsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Database reference from provider store (initialized at app startup)
  const db = useProviderStore((s) => s.db);

  // Settings store state and actions
  const systemPrompts = useSettingsStore((s) => s.systemPrompts);
  const defaultSystemPromptId = useSettingsStore((s) => s.defaultSystemPromptId);
  const setDefaultSystemPromptId = useSettingsStore((s) => s.setDefaultSystemPromptId);
  const addSystemPrompt = useSettingsStore((s) => s.addSystemPrompt);
  const updateSystemPrompt = useSettingsStore((s) => s.updateSystemPrompt);
  const deleteSystemPrompt = useSettingsStore((s) => s.deleteSystemPrompt);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptContent, setPromptContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Build the display list: built-in prompt first, then user prompts
  const builtInPrompt: SystemPrompt = useMemo(
    () => ({
      id: BUILT_IN_PROMPT_ID,
      name: t('systemPrompts.builtIn'),
      content: DEFAULT_SYSTEM_PROMPT,
      isDefault: defaultSystemPromptId === null,
      createdAt: 0,
      updatedAt: 0,
    }),
    [defaultSystemPromptId, t],
  );

  const displayPrompts = useMemo(
    () => [builtInPrompt, ...systemPrompts],
    [builtInPrompt, systemPrompts],
  );

  /** Determine if a prompt is currently the designated default. */
  const isDefault = useCallback(
    (promptId: string): boolean => {
      if (promptId === BUILT_IN_PROMPT_ID) {
        return defaultSystemPromptId === null;
      }
      return defaultSystemPromptId === promptId;
    },
    [defaultSystemPromptId],
  );

  /** Open the modal to create a new prompt. */
  const handleAdd = useCallback(() => {
    setEditingPrompt(null);
    setPromptName('');
    setPromptContent('');
    setModalVisible(true);
  }, []);

  /** Open the modal to edit an existing prompt. */
  const handleEdit = useCallback((prompt: SystemPrompt) => {
    setEditingPrompt(prompt);
    setPromptName(prompt.name);
    setPromptContent(prompt.content);
    setModalVisible(true);
  }, []);

  /** Set a prompt as the default for new sessions. */
  const handleSetDefault = useCallback(
    (promptId: string) => {
      if (promptId === BUILT_IN_PROMPT_ID) {
        setDefaultSystemPromptId(null);
      } else {
        setDefaultSystemPromptId(promptId);
      }
    },
    [setDefaultSystemPromptId],
  );

  /** Delete a prompt with confirmation. */
  const handleDelete = useCallback(
    (prompt: SystemPrompt) => {
      Alert.alert(
        t('systemPrompts.deleteTitle'),
        t('systemPrompts.deleteConfirm'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              if (!db) return;
              await deleteSystemPrompt(db, prompt.id);
            },
          },
        ],
      );
    },
    [db, deleteSystemPrompt, t],
  );

  /** Save create or update from the modal form. */
  const handleSave = useCallback(async () => {
    if (!db || isSaving) return;
    const trimmedName = promptName.trim();
    const trimmedContent = promptContent.trim();
    if (!trimmedName || !trimmedContent) return;

    setIsSaving(true);
    try {
      if (editingPrompt) {
        await updateSystemPrompt(db, editingPrompt.id, {
          name: trimmedName,
          content: trimmedContent,
        });
      } else {
        await addSystemPrompt(db, {
          name: trimmedName,
          content: trimmedContent,
        });
      }
      setModalVisible(false);
    } catch (error) {
      Alert.alert(
        t('errors.unknown'),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    db,
    isSaving,
    promptName,
    promptContent,
    editingPrompt,
    addSystemPrompt,
    updateSystemPrompt,
    t,
  ]);

  /** Close the modal without saving. */
  const handleCancel = useCallback(() => {
    setModalVisible(false);
  }, []);

  /** Whether the form has valid content to save. */
  const isFormValid = useMemo(
    () => promptName.trim().length > 0 && promptContent.trim().length > 0,
    [promptName, promptContent],
  );

  /** Truncate content for the list preview. */
  function truncateContent(content: string): string {
    if (content.length <= PREVIEW_MAX_LENGTH) return content;
    return content.slice(0, PREVIEW_MAX_LENGTH) + '…';
  }

  function renderItem({ item }: { item: SystemPrompt }) {
    const isBuiltIn = item.id === BUILT_IN_PROMPT_ID;
    const promptIsDefault = isDefault(item.id);

    return (
      <View style={styles.promptCard}>
        <TouchableOpacity
          style={styles.promptContent}
          onPress={() => {
            if (!isBuiltIn) handleEdit(item);
          }}
          disabled={isBuiltIn}
          accessibilityLabel={`${item.name}${promptIsDefault ? `, ${t('systemPrompts.isDefault')}` : ''}`}
          accessibilityRole="button"
          accessibilityHint={isBuiltIn ? undefined : t('systemPrompts.edit')}
        >
          <View style={styles.promptHeader}>
            <Text style={styles.promptName} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.badges}>
              {promptIsDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>
                    {t('systemPrompts.isDefault')}
                  </Text>
                </View>
              )}
              {isBuiltIn && (
                <View style={styles.builtInBadge}>
                  <Text style={styles.builtInBadgeText}>
                    {t('systemPrompts.builtIn')}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={styles.promptPreview} numberOfLines={2}>
            {truncateContent(item.content)}
          </Text>
        </TouchableOpacity>

        <View style={styles.promptActions}>
          {!promptIsDefault && (
            <TouchableOpacity
              onPress={() => handleSetDefault(item.id)}
              style={styles.actionButton}
              accessibilityLabel={t('systemPrompts.setDefault')}
              accessibilityRole="button"
            >
              <Text style={styles.actionText}>
                {t('systemPrompts.setDefault')}
              </Text>
            </TouchableOpacity>
          )}
          {!isBuiltIn && (
            <TouchableOpacity
              onPress={() => handleDelete(item)}
              style={styles.actionButton}
              accessibilityLabel={t('accessibility.deleteButton')}
              accessibilityRole="button"
            >
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={displayPrompts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />

      {/* Add button footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAdd}
          accessibilityLabel={t('systemPrompts.add')}
          accessibilityRole="button"
        >
          <Text style={styles.addButtonText}>{t('systemPrompts.add')}</Text>
        </TouchableOpacity>
      </View>

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCancel}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingPrompt ? t('systemPrompts.edit') : t('systemPrompts.add')}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isFormValid || isSaving}
              accessibilityLabel={t('systemPrompts.save')}
              accessibilityRole="button"
              accessibilityState={{ disabled: !isFormValid || isSaving }}
            >
              <Text
                style={[
                  styles.modalSaveText,
                  (!isFormValid || isSaving) && styles.modalSaveTextDisabled,
                ]}
              >
                {t('systemPrompts.save')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            {/* Name Input */}
            <View style={styles.formSection}>
              <Text style={styles.label}>{t('systemPrompts.name')}</Text>
              <TextInput
                style={styles.input}
                value={promptName}
                onChangeText={setPromptName}
                placeholder={t('systemPrompts.namePlaceholder')}
                placeholderTextColor={theme.colors.textTertiary}
                accessibilityLabel={t('systemPrompts.name')}
                autoCapitalize="sentences"
                autoCorrect={false}
              />
            </View>

            {/* Content Input */}
            <View style={styles.formSectionFlex}>
              <Text style={styles.label}>{t('systemPrompts.content')}</Text>
              <TextInput
                style={styles.textArea}
                value={promptContent}
                onChangeText={setPromptContent}
                placeholder={t('systemPrompts.contentPlaceholder')}
                placeholderTextColor={theme.colors.textTertiary}
                accessibilityLabel={t('systemPrompts.content')}
                multiline
                textAlignVertical="top"
                autoCapitalize="sentences"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.huge,
    },
    promptCard: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.md,
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
    },
    promptContent: {
      padding: theme.spacing.lg,
    },
    promptHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xs,
    },
    promptName: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
      flex: 1,
    },
    badges: {
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    defaultBadge: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    defaultBadgeText: {
      ...theme.typography.caption1,
      color: theme.colors.accentText,
      fontWeight: '600',
    },
    builtInBadge: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    builtInBadgeText: {
      ...theme.typography.caption1,
      color: theme.colors.textSecondary,
      fontWeight: '500',
    },
    promptPreview: {
      ...theme.typography.caption1,
      color: theme.colors.textSecondary,
      lineHeight: 18,
    },
    promptActions: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    actionButton: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionText: {
      ...theme.typography.caption1,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    deleteText: {
      ...theme.typography.caption1,
      color: theme.colors.error,
      fontWeight: '500',
    },
    footer: {
      padding: theme.spacing.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    addButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
    },
    addButtonText: {
      ...theme.typography.body,
      color: theme.colors.accentText,
      fontWeight: '600',
    },
    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    modalTitle: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontWeight: '600',
    },
    modalCancelText: {
      ...theme.typography.body,
      color: theme.colors.accent,
    },
    modalSaveText: {
      ...theme.typography.body,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    modalSaveTextDisabled: {
      opacity: 0.4,
    },
    modalBody: {
      flex: 1,
      padding: theme.spacing.lg,
    },
    formSection: {
      marginBottom: theme.spacing.xl,
    },
    formSectionFlex: {
      flex: 1,
      marginBottom: theme.spacing.xl,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      fontWeight: '500',
    },
    input: {
      ...theme.typography.body,
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    textArea: {
      ...theme.typography.body,
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flex: 1,
      minHeight: 150,
    },
  });
}
