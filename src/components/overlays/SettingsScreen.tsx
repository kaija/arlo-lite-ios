/**
 * SettingsScreen — Full-screen overlay for app configuration.
 *
 * Slides in from the right (0.4s ease-out), overlaying the chat screen.
 * Contains provider cards, system prompts management, and generation parameters.
 *
 * Features:
 * - Slide from right with translateX animation (400ms ease-out)
 * - Back button "Chat" with left chevron in accent color
 * - Centered "Settings" title
 * - Provider cards: 34×34pt icon, name, model count, API type, masked key
 * - System prompts section with name, preview, edit, default checkmark
 * - Generation params: Max Tokens
 * - Empty state when no providers configured
 * - Grouped inset list, system-grouped background
 * - Translucent blur header pinned on scroll
 * - Dismiss via back button or swipe gesture
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import { SETTINGS_SLIDE_DURATION } from '@/theme/animations';
import { useProviderStore } from '@/stores/provider-store';
import { useSettingsStore } from '@/stores/settings-store';
import { useChatStore } from '@/stores/chat-store';
import { useUIStore } from '@/stores/ui-store';
import { useMaskedKey } from '@/hooks/useMaskedKey';
import { SUPPORTED_LOCALES, LOCALE_DISPLAY_NAMES } from '@/i18n/index';
import type { SupportedLocale } from '@/i18n/index';
import type { Provider, GenerationParams } from '@/database/repositories/provider-repo';
import type { ModelConfig, ConnectionStatus } from '@/stores/provider-store';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SettingsScreenProps {
  /** Whether the settings overlay is visible */
  visible: boolean;
  /** Called when the user dismisses the screen */
  onClose: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

// SystemPrompt type comes from SettingsStore / system-prompt-repo

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Easing for the slide-in animation */
const SLIDE_EASING = Easing.out(Easing.ease);

/** Provider icon size in points */
const PROVIDER_ICON_SIZE = 34;

/** Provider icon corner radius */
const PROVIDER_ICON_RADIUS = 8;

/** Snippet preview max characters */
const SNIPPET_MAX_CHARS = 60;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the first letter of a provider name as the initial icon.
 */
function getProviderInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

/**
 * Formats the API type for display.
 */
function formatApiType(provider: Provider): string {
  if (provider.type === 'openai') {
    return provider.apiMode === 'chat-completions'
      ? 'Chat Completions API'
      : 'Responses API';
  }
  if (provider.type === 'anthropic') {
    return 'Messages API';
  }
  return 'OpenAI-compatible';
}

/**
 * Truncates text to a max length with ellipsis.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SettingsScreen({ visible, onClose }: SettingsScreenProps) {
  const { colors, borderRadii, isDark } = useTheme();
  const { t } = useTranslation();

  // Provider store data
  const providers = useProviderStore((state) => state.providers);
  const models = useProviderStore((state) => state.models);
  const updateProvider = useProviderStore((state) => state.updateProvider);

  // Chat store — active provider selection
  const activeProviderId = useChatStore((state) => state.activeProviderId);

  // Settings store — locale
  const currentLocale = useSettingsStore((s) => s.locale);
  const setLocale = useSettingsStore((s) => s.setLocale);

  // Determine the active provider: use ChatStore's activeProviderId, fallback to first provider
  const activeProvider = useMemo(() => {
    if (activeProviderId) {
      const found = providers.find((p) => p.id === activeProviderId);
      if (found) return found;
    }
    return providers.length > 0 ? providers[0] : null;
  }, [providers, activeProviderId]);

  // Generation params from the active provider
  const generationParams: GenerationParams = useMemo(() => {
    if (activeProvider) {
      return activeProvider.generationParams;
    }
    return { maxTokens: 12000, maxTokensEnabled: false };
  }, [activeProvider]);

  // Edit modal state for generation params
  const [editParamModalVisible, setEditParamModalVisible] = useState(false);
  const [editParamValue, setEditParamValue] = useState('');

  // Animation
  const translateX = useSharedValue(SCREEN_WIDTH);
  const [shouldRender, setShouldRender] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      translateX.value = SCREEN_WIDTH;
      translateX.value = withTiming(0, {
        duration: SETTINGS_SLIDE_DURATION,
        easing: SLIDE_EASING,
      });
    } else if (shouldRender) {
      translateX.value = withTiming(SCREEN_WIDTH, {
        duration: SETTINGS_SLIDE_DURATION,
        easing: SLIDE_EASING,
      }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible, translateX, shouldRender]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  // Group models by provider
  const modelCountByProvider = useMemo(() => {
    const counts = new Map<string, number>();
    for (const model of models) {
      const current = counts.get(model.providerId) ?? 0;
      counts.set(model.providerId, current + 1);
    }
    return counts;
  }, [models]);

  // Database reference from provider store
  const db = useProviderStore((state) => state.db);

  // Settings store — system prompts
  const storeSystemPrompts = useSettingsStore((s) => s.systemPrompts);
  const defaultSystemPromptId = useSettingsStore((s) => s.defaultSystemPromptId);
  const setDefaultSystemPromptId = useSettingsStore((s) => s.setDefaultSystemPromptId);
  const addSystemPromptAction = useSettingsStore((s) => s.addSystemPrompt);

  // Settings store — thinking expanded
  const thinkingExpandedByDefault = useSettingsStore((s) => s.thinkingExpandedByDefault);
  const setThinkingExpandedByDefault = useSettingsStore((s) => s.setThinkingExpandedByDefault);

  // Map store prompts to display format with isDefault flag
  const systemPrompts = useMemo(() => {
    return storeSystemPrompts.map((prompt) => ({
      ...prompt,
      isDefault: prompt.id === defaultSystemPromptId,
    }));
  }, [storeSystemPrompts, defaultSystemPromptId]);

  // Add prompt modal state
  const [addPromptModalVisible, setAddPromptModalVisible] = useState(false);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleProviderPress = useCallback((providerId: string) => {
    useUIStore.getState().openProviderDetail(providerId);
  }, []);

  const handleAddPrompt = useCallback(() => {
    setNewPromptName('');
    setNewPromptContent('');
    setAddPromptModalVisible(true);
  }, []);

  /** Save the new system prompt via the settings store. */
  const handleSavePrompt = useCallback(async () => {
    if (!db || isSavingPrompt) return;
    const trimmedName = newPromptName.trim();
    const trimmedContent = newPromptContent.trim();
    if (!trimmedName || !trimmedContent) return;

    setIsSavingPrompt(true);
    try {
      await addSystemPromptAction(db, { name: trimmedName, content: trimmedContent });
      setAddPromptModalVisible(false);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to add system prompt.',
      );
    } finally {
      setIsSavingPrompt(false);
    }
  }, [db, isSavingPrompt, newPromptName, newPromptContent, addSystemPromptAction]);

  /** Cancel the add prompt modal. */
  const handleCancelAddPrompt = useCallback(() => {
    setAddPromptModalVisible(false);
  }, []);

  /** Set a prompt as the default. */
  const handleToggleDefault = useCallback((promptId: string) => {
    if (defaultSystemPromptId === promptId) {
      // Tapping the already-default prompt clears the default
      setDefaultSystemPromptId(null);
    } else {
      setDefaultSystemPromptId(promptId);
    }
  }, [defaultSystemPromptId, setDefaultSystemPromptId]);

  const handleAddProvider = useCallback(() => {
    useUIStore.getState().openProviderDetail('');
  }, []);

  /** Open the edit modal for max tokens. */
  const handleParamPress = useCallback(() => {
    setEditParamValue(String(generationParams.maxTokens ?? 12000));
    setEditParamModalVisible(true);
  }, [generationParams]);

  /** Toggle max tokens enabled/disabled. */
  const handleMaxTokensToggle = useCallback((enabled: boolean) => {
    if (!activeProvider) return;
    updateProvider(activeProvider.id, {
      generationParams: { ...generationParams, maxTokensEnabled: enabled },
    });
  }, [activeProvider, generationParams, updateProvider]);

  /** Save the edited generation parameter value. */
  const handleParamSave = useCallback(() => {
    if (!activeProvider) return;

    const parsed = parseInt(editParamValue, 10);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid Value', 'Max Tokens must be a positive integer.');
      return;
    }
    updateProvider(activeProvider.id, {
      generationParams: { ...generationParams, maxTokens: parsed },
    });

    setEditParamModalVisible(false);
  }, [activeProvider, editParamValue, generationParams, updateProvider]);

  /** Cancel the edit modal. */
  const handleParamCancel = useCallback(() => {
    setEditParamModalVisible(false);
  }, []);

  /** Cycle to the next supported locale. */
  const handleLanguagePress = useCallback(() => {
    const currentIndex = SUPPORTED_LOCALES.indexOf(currentLocale as SupportedLocale);
    const nextIndex = (currentIndex + 1) % SUPPORTED_LOCALES.length;
    setLocale(SUPPORTED_LOCALES[nextIndex]);
  }, [currentLocale, setLocale]);

  /** Get the display name for the current locale. */
  const currentLocaleDisplay = useMemo(() => {
    return LOCALE_DISPLAY_NAMES[currentLocale as SupportedLocale] ?? currentLocale;
  }, [currentLocale]);

  if (!shouldRender) return null;

  const hasProviders = providers.length > 0;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.surfaceSecondary },
        animatedStyle,
      ]}
      accessibilityViewIsModal
      accessibilityLabel={t('settings.title')}
    >
      {/* Header with blur */}
      <BlurView
        intensity={80}
        tint={isDark ? 'dark' : 'light'}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          {/* Back button */}
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={t('accessibility.backButton')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.backChevron, { color: colors.accent }]}>
              {'\u2039'}
            </Text>
            <Text style={[styles.backLabel, { color: colors.accent }]}>
              {t('navigation.chat')}
            </Text>
          </Pressable>

          {/* Centered title */}
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            {t('settings.title')}
          </Text>

          {/* Spacer for balance */}
          <View style={styles.headerSpacer} />
        </View>

        {/* Bottom separator */}
        <View style={[styles.separator, { backgroundColor: colors.border }]} />
      </BlurView>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasProviders ? (
          // Empty state
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>
              {t('providers.empty')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {t('settings.emptySubtitle')}
            </Text>
            <Pressable
              style={[styles.addProviderButton, { backgroundColor: colors.accent }]}
              onPress={handleAddProvider}
              accessibilityRole="button"
              accessibilityLabel={t('providers.add')}
            >
              <Text style={[styles.addProviderText, { color: colors.accentText }]}>
                {t('providers.add')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Providers Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                {t('providers.title').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.groupedList,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadii.groupedList,
                  },
                ]}
              >
                {providers.map((provider, index) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    modelCount={modelCountByProvider.get(provider.id) ?? 0}
                    onPress={() => handleProviderPress(provider.id)}
                    isLast={index === providers.length - 1}
                  />
                ))}

                {/* Add Provider action */}
                <Pressable
                  style={styles.addActionRow}
                  onPress={handleAddProvider}
                  accessibilityRole="button"
                  accessibilityLabel={t('providers.add')}
                >
                  <Text style={[styles.addActionText, { color: colors.accent }]}>
                    {t('providers.add')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* System Prompts Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                {t('systemPrompts.title').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.groupedList,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadii.groupedList,
                  },
                ]}
              >
                {systemPrompts.length === 0 ? (
                  <View style={styles.emptyPrompts}>
                    <Text style={[styles.emptyPromptsText, { color: colors.textTertiary }]}>
                      {t('systemPrompts.empty')}
                    </Text>
                  </View>
                ) : (
                  systemPrompts.map((prompt, index) => (
                    <SystemPromptRow
                      key={prompt.id}
                      prompt={prompt}
                      onToggleDefault={() => handleToggleDefault(prompt.id)}
                      isLast={index === systemPrompts.length - 1}
                    />
                  ))
                )}

                {/* Add Prompt action */}
                <Pressable
                  style={styles.addActionRow}
                  onPress={handleAddPrompt}
                  accessibilityRole="button"
                  accessibilityLabel={t('systemPrompts.add')}
                >
                  <Text style={[styles.addActionText, { color: colors.accent }]}>
                    {t('systemPrompts.add')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Generation Parameters Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                {t('settings.generationParameters').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.groupedList,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadii.groupedList,
                  },
                ]}
              >
                <View style={styles.settingToggleRow}>
                  <Text style={[styles.paramLabel, { color: colors.text }]}>
                    {t('settings.maxTokens')}
                  </Text>
                  <Switch
                    value={generationParams.maxTokensEnabled ?? false}
                    onValueChange={handleMaxTokensToggle}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    accessibilityLabel={t('settings.maxTokens')}
                  />
                </View>
                {generationParams.maxTokensEnabled && (
                  <GenerationParamRow
                    label={t('settings.maxTokensValue')}
                    value={String(generationParams.maxTokens ?? 12000)}
                    onPress={handleParamPress}
                    isLast
                  />
                )}
              </View>
            </View>

            {/* Chat Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                {t('navigation.chat').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.groupedList,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadii.groupedList,
                  },
                ]}
              >
                <View style={styles.settingToggleRow}>
                  <Text style={[styles.paramLabel, { color: colors.text }]}>
                    {t('settings.thinkingExpandedByDefault')}
                  </Text>
                  <Switch
                    value={thinkingExpandedByDefault}
                    onValueChange={setThinkingExpandedByDefault}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    accessibilityLabel={t('settings.thinkingExpandedByDefault')}
                  />
                </View>
              </View>
            </View>

            {/* Appearance Section — Language */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                {t('settings.appearance').toUpperCase()}
              </Text>
              <View
                style={[
                  styles.groupedList,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: borderRadii.groupedList,
                  },
                ]}
              >
                <Pressable
                  style={styles.paramRow}
                  onPress={handleLanguagePress}
                  accessibilityRole="button"
                  accessibilityLabel={`${t('settings.language')}: ${currentLocaleDisplay}`}
                  accessibilityHint={t('settings.languageHint')}
                >
                  <Text style={[styles.paramLabel, { color: colors.text }]}>
                    {t('settings.language')}
                  </Text>
                  <View style={styles.paramValueRow}>
                    <Text style={[styles.paramValue, { color: colors.textSecondary }]}>
                      {currentLocaleDisplay}
                    </Text>
                    <Text style={[styles.chevronRight, { color: colors.textTertiary }]}>
                      {'\u203A'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Edit Generation Parameter Modal */}
      <Modal
        visible={editParamModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleParamCancel}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleParamCancel}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: colors.surface }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t('settings.maxTokens')}
            </Text>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              {t('settings.maxTokensDescription')}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  color: colors.text,
                  backgroundColor: colors.surfaceSecondary,
                  borderColor: colors.border,
                },
              ]}
              value={editParamValue}
              onChangeText={setEditParamValue}
              keyboardType="number-pad"
              autoFocus
              selectTextOnFocus
              accessibilityLabel={t('settings.maxTokens')}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleParamCancel}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                  {t('common.cancel')}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.modalSaveButton, { backgroundColor: colors.accent }]}
                onPress={handleParamSave}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
              >
                <Text style={[styles.modalButtonText, { color: colors.accentText }]}>
                  {t('common.save')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add System Prompt Modal */}
      <Modal
        visible={addPromptModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelAddPrompt}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={handleCancelAddPrompt}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.addPromptModalWrapper}
          >
            <Pressable
              style={[styles.modalContent, { backgroundColor: colors.surface }]}
              onPress={() => {}}
            >
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('systemPrompts.add')}
              </Text>
              <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
                {t('settings.addPromptDescription')}
              </Text>
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
                value={newPromptName}
                onChangeText={setNewPromptName}
                placeholder={t('systemPrompts.namePlaceholder')}
                placeholderTextColor={colors.textTertiary}
                autoFocus
                accessibilityLabel={t('systemPrompts.name')}
              />
              <TextInput
                style={[
                  styles.modalInput,
                  styles.modalTextArea,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
                value={newPromptContent}
                onChangeText={setNewPromptContent}
                placeholder={t('systemPrompts.contentPlaceholder')}
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
                accessibilityLabel={t('systemPrompts.content')}
              />
              <View style={styles.modalButtons}>
                <Pressable
                  style={[styles.modalButton, styles.modalCancelButton]}
                  onPress={handleCancelAddPrompt}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.cancel')}
                >
                  <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>
                    {t('common.cancel')}
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.modalButton,
                    styles.modalSaveButton,
                    { backgroundColor: colors.accent },
                    (!newPromptName.trim() || !newPromptContent.trim()) && { opacity: 0.5 },
                  ]}
                  onPress={handleSavePrompt}
                  disabled={!newPromptName.trim() || !newPromptContent.trim() || isSavingPrompt}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.save')}
                >
                  <Text style={[styles.modalButtonText, { color: colors.accentText }]}>
                    {t('common.save')}
                  </Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: Provider;
  modelCount: number;
  onPress: () => void;
  isLast: boolean;
}

/** Maps a connection status to its indicator color. */
function getStatusDotColor(status: ConnectionStatus | undefined): string {
  switch (status) {
    case 'connected':
      return '#34C759';
    case 'failed':
      return '#FF3B30';
    case 'untested':
    default:
      return '#8E8E93';
  }
}

function ProviderCard({ provider, modelCount, onPress, isLast }: ProviderCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { suffix: maskedKeyDisplay } = useMaskedKey(provider.id);
  const connectionState = useProviderStore((s) => s.connectionStatuses[provider.id]);
  const statusDotColor = getStatusDotColor(connectionState?.status);
  const apiTypeLabel = formatApiType(provider);
  const modelCountLabel = t('providers.modelCount', { count: modelCount });

  return (
    <Pressable
      style={({ pressed }) => [
        styles.providerCard,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, ${modelCountLabel}, ${apiTypeLabel}`}
      accessibilityHint={t('providers.openDetailsHint')}
    >
      <View style={styles.providerRow}>
        {/* Icon */}
        <View
          style={[
            styles.providerIcon,
            { backgroundColor: colors.accent + '24' },
          ]}
        >
          <Text style={[styles.providerIconText, { color: colors.accent }]}>
            {getProviderInitial(provider.name)}
          </Text>
        </View>

        {/* Info */}
        <View style={styles.providerInfo}>
          <View style={styles.providerNameRow}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusDotColor },
              ]}
              accessibilityLabel={t('providers.connectionStatus', { status: connectionState?.status ?? 'untested' })}
            />
            <Text
              style={[styles.providerName, { color: colors.text }]}
              numberOfLines={1}
            >
              {provider.name}
            </Text>
          </View>
          <View style={styles.providerMeta}>
            <Text style={[styles.providerMetaText, { color: colors.textTertiary }]}>
              {modelCountLabel}
            </Text>
            <Text style={[styles.providerMetaDot, { color: colors.textTertiary }]}>
              ·
            </Text>
            <Text style={[styles.providerMetaText, { color: colors.textTertiary }]}>
              {apiTypeLabel}
            </Text>
          </View>
        </View>

        {/* Masked key */}
        <Text style={[styles.maskedKey, { color: colors.textTertiary }]}>
          {maskedKeyDisplay}
        </Text>

        {/* Chevron */}
        <Text style={[styles.chevronRight, { color: colors.textTertiary }]}>
          {'\u203A'}
        </Text>
      </View>

      {/* Separator */}
      {!isLast && (
        <View
          style={[
            styles.rowSeparator,
            { backgroundColor: colors.border },
          ]}
        />
      )}
    </Pressable>
  );
}

interface SystemPromptRowProps {
  prompt: { id: string; name: string; content: string; isDefault: boolean };
  onToggleDefault: () => void;
  isLast: boolean;
}

function SystemPromptRow({ prompt, onToggleDefault, isLast }: SystemPromptRowProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const preview = truncateText(prompt.content, SNIPPET_MAX_CHARS);

  return (
    <View style={styles.promptRow}>
      <View style={styles.promptContent}>
        <View style={styles.promptNameRow}>
          <Text
            style={[styles.promptName, { color: colors.text }]}
            numberOfLines={1}
          >
            {prompt.name}
          </Text>
          <Pressable
            onPress={onToggleDefault}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={prompt.isDefault ? `${prompt.name} is default` : `Set ${prompt.name} as default`}
            accessibilityHint="Tap to set as default system prompt"
          >
            <Text
              style={[
                styles.defaultCheck,
                { color: prompt.isDefault ? colors.accent : colors.textTertiary },
              ]}
            >
              {'\u2713'}
            </Text>
          </Pressable>
        </View>
        <Text
          style={[styles.promptPreview, { color: colors.textTertiary }]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      {/* Edit button */}
      <Pressable
        style={styles.editButton}
        accessibilityRole="button"
        accessibilityLabel={`${t('systemPrompts.edit')} ${prompt.name}`}
      >
        <Text style={[styles.editButtonText, { color: colors.accent }]}>
          {t('accessibility.editButton')}
        </Text>
      </Pressable>

      {/* Separator */}
      {!isLast && (
        <View
          style={[
            styles.rowSeparator,
            { backgroundColor: colors.border },
          ]}
        />
      )}
    </View>
  );
}

interface GenerationParamRowProps {
  label: string;
  value: string;
  onPress: () => void;
  isLast: boolean;
}

function GenerationParamRow({ label, value, onPress, isLast }: GenerationParamRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={styles.paramRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      accessibilityHint="Tap to adjust"
    >
      <Text style={[styles.paramLabel, { color: colors.text }]}>
        {label}
      </Text>
      <View style={styles.paramValueRow}>
        <Text style={[styles.paramValue, { color: colors.textSecondary }]}>
          {value}
        </Text>
        <Text style={[styles.chevronRight, { color: colors.textTertiary }]}>
          {'\u203A'}
        </Text>
      </View>

      {/* Separator */}
      {!isLast && (
        <View
          style={[
            styles.rowSeparator,
            { backgroundColor: colors.border },
          ]}
        />
      )}
    </Pressable>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 8,
    elevation: 8,
  },
  header: {
    paddingTop: 54, // Safe area top
    zIndex: 10,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 60,
    minHeight: 44,
  },
  backChevron: {
    fontSize: 24,
    fontWeight: '300',
    marginRight: 2,
  },
  backLabel: {
    fontSize: 17,
    fontWeight: '400',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSpacer: {
    minWidth: 60,
  },
  separator: {
    height: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 16,
  },
  groupedList: {
    overflow: 'hidden',
  },

  // Provider card
  providerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerIcon: {
    width: PROVIDER_ICON_SIZE,
    height: PROVIDER_ICON_SIZE,
    borderRadius: PROVIDER_ICON_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  providerIconText: {
    fontSize: 16,
    fontWeight: '600',
  },
  providerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  providerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  providerMetaText: {
    fontSize: 12,
    fontWeight: '400',
  },
  providerMetaDot: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  maskedKey: {
    fontSize: 13,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  chevronRight: {
    fontSize: 20,
    fontWeight: '300',
  },
  rowSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 62,
    right: 0,
    height: 0.5,
  },

  // System prompts
  promptRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptContent: {
    flex: 1,
  },
  promptNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  promptName: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 20,
  },
  defaultCheck: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  promptPreview: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
  },
  editButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '400',
  },
  emptyPrompts: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyPromptsText: {
    fontSize: 13,
    fontWeight: '400',
  },
  addActionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  addActionText: {
    fontSize: 15,
    fontWeight: '400',
  },

  // Generation parameters
  paramRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  paramLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  paramValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paramValue: {
    fontSize: 15,
    fontWeight: '400',
    marginRight: 6,
  },
  settingToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },

  // Edit parameter modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  modalContent: {
    width: '100%',
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalDescription: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 16,
  },
  modalInput: {
    fontSize: 17,
    fontWeight: '400',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  modalCancelButton: {
    marginRight: 8,
  },
  modalSaveButton: {},
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addPromptModalWrapper: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty state
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 120,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    marginBottom: 24,
  },
  addProviderButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  addProviderText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default SettingsScreen;
