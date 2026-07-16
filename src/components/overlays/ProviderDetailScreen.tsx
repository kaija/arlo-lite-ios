/**
 * ProviderDetailScreen — Slide-from-right overlay for viewing/managing a provider.
 *
 * Slides from right over the settings screen (0.4s cubic-bezier(0.32,0.72,0,1)).
 * Displays:
 * - API key section: masked bullets + last 4 chars (monospace 13.5px), eye toggle, keychain note
 * - Configuration: Base URL (max 2048), Streaming toggle, API type selector (OpenAI only)
 * - Models list: name (15px), context + pricing (12px tertiary), "Add Model" action
 * - Back button "Settings" with left chevron (accent)
 * - Swipe-left on model row → delete with confirmation
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '@/theme';
import { SETTINGS_SLIDE_DURATION, DIALOG_EASING } from '@/theme/animations';
import { useProviderStore } from '@/stores/provider-store';
import type { ModelConfig, CreateModelData } from '@/stores/provider-store';
import { getApiKey, storeApiKey } from '@/database/secure-store';
import { useSwipeToDelete } from '@/hooks/useSwipeToDelete';
import { DEFAULT_PROVIDER_URLS } from '@/constants/defaults';
import { getProvider } from '@/providers/registry';
import { ProviderError } from '@/providers/errors';
import type { OpenAIApiMode, ProviderType } from '@/database/repositories/provider-repo';
import type { ProviderConfig } from '@/providers/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderDetailScreenProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** The provider ID to display, or empty string for "add new" */
  providerId: string;
  /** Called when the user dismisses the screen */
  onClose: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width;
const MAX_BASE_URL_LENGTH = 2048;

/** Easing curve matching DIALOG_EASING as cubic-bezier */
const SLIDE_EASING = Easing.bezier(
  DIALOG_EASING[0],
  DIALOG_EASING[1],
  DIALOG_EASING[2],
  DIALOG_EASING[3]
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Masks an API key showing only the last 4 characters.
 * e.g. "sk-abc123xyz" → "•••••••xyz" (bullets + last 4)
 */
function maskApiKey(key: string): string {
  if (key.length <= 4) return key;
  const last4 = key.slice(-4);
  return '••••' + last4;
}

/**
 * Formats a context window size into a human-readable string.
 * e.g. 200000 → "200K tokens"
 */
function formatContextWindow(contextWindow: number | null): string {
  if (contextWindow == null || contextWindow <= 0) return 'Unknown';
  if (contextWindow >= 1000) {
    const k = Math.round(contextWindow / 1000);
    return `${k}K tokens`;
  }
  return `${contextWindow} tokens`;
}

/**
 * Formats pricing as a $/M tokens string.
 * e.g. 0.000003 → "$3.00/M"
 */
function formatPrice(pricePerToken: number | null): string | null {
  if (pricePerToken == null) return null;
  const perMillion = pricePerToken * 1_000_000;
  return `$${perMillion.toFixed(2)}/M`;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

interface ModelRowProps {
  model: ModelConfig;
  onDelete: (modelId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

function ModelRow({ model, onDelete, colors }: ModelRowProps) {
  const contextLabel = formatContextWindow(model.contextWindow);
  const inputPriceLabel = formatPrice(model.inputPrice);
  const outputPriceLabel = formatPrice(model.outputPrice);

  const pricingText = useMemo(() => {
    if (!inputPriceLabel && !outputPriceLabel) return null;
    const parts: string[] = [];
    if (inputPriceLabel) parts.push(`In: ${inputPriceLabel}`);
    if (outputPriceLabel) parts.push(`Out: ${outputPriceLabel}`);
    return parts.join(' · ');
  }, [inputPriceLabel, outputPriceLabel]);

  const { translateX, panGesture, reset } = useSwipeToDelete();

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleDeleteConfirm = useCallback(() => {
    Alert.alert(
      'Delete Model',
      `Remove "${model.displayName}" from this provider?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => reset(),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(model.id),
        },
      ]
    );
  }, [model.id, model.displayName, onDelete, reset]);

  return (
    <View style={styles.modelRowWrapper}>
      {/* Delete button revealed behind the row */}
      <Pressable
        style={styles.deleteButton}
        onPress={handleDeleteConfirm}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${model.displayName}`}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </Pressable>

      {/* Swipeable model row */}
      <GestureDetector gesture={panGesture}>
        <Reanimated.View style={[styles.modelRow, rowAnimatedStyle, { backgroundColor: colors.surface }]}>
          <View style={styles.modelRowContent}>
            <Text
              style={[styles.modelName, { color: colors.text }]}
              numberOfLines={1}
            >
              {model.displayName}
            </Text>
            <Text
              style={[styles.modelDetails, { color: colors.textTertiary }]}
              numberOfLines={1}
            >
              {contextLabel}
              {pricingText ? ` · ${pricingText}` : ''}
            </Text>
          </View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProviderDetailScreen({
  visible,
  providerId,
  onClose,
}: ProviderDetailScreenProps) {
  const { colors, borderRadii, spacing } = useTheme();

  // Determine if we're in "add new" mode (empty providerId)
  const isAddMode = providerId === '';

  // Animation
  const translateX = useMemo(() => new Animated.Value(SCREEN_WIDTH), []);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      Animated.timing(translateX, {
        toValue: 0,
        duration: SETTINGS_SLIDE_DURATION,
        easing: SLIDE_EASING,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: SCREEN_WIDTH,
        duration: SETTINGS_SLIDE_DURATION,
        easing: SLIDE_EASING,
        useNativeDriver: true,
      }).start(() => {
        setShouldRender(false);
      });
    }
  }, [visible, translateX]);

  // Provider data
  const providers = useProviderStore((s) => s.providers);
  const models = useProviderStore((s) => s.models);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const addProvider = useProviderStore((s) => s.addProvider);
  const deleteModel = useProviderStore((s) => s.deleteModel);

  const provider = useMemo(
    () => (isAddMode ? undefined : providers.find((p) => p.id === providerId)),
    [providers, providerId, isAddMode]
  );

  const providerModels = useMemo(
    () => (isAddMode ? [] : models.filter((m) => m.providerId === providerId)),
    [models, providerId, isAddMode]
  );

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);

  useEffect(() => {
    if (visible && providerId && !isAddMode) {
      getApiKey(providerId).then((key) => {
        setApiKey(key);
      });
      setKeyRevealed(false);
    } else if (visible && isAddMode) {
      setApiKey('');
      setKeyRevealed(false);
    }
  }, [visible, providerId, isAddMode]);

  // Configuration state (editable)
  const [baseUrl, setBaseUrl] = useState('');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [apiMode, setApiMode] = useState<OpenAIApiMode>('responses');

  // Add-mode specific state
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<ProviderType>('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (provider) {
      setBaseUrl(provider.baseUrl);
      setStreamingEnabled(provider.streamingEnabled);
      setApiMode(provider.apiMode ?? 'responses');
    } else if (isAddMode) {
      setBaseUrl(DEFAULT_PROVIDER_URLS.openai);
      setStreamingEnabled(true);
      setApiMode('responses');
      setNewName('');
      setNewType('openai');
      setNewApiKey('');
    }
  }, [provider, isAddMode]);

  // Handlers for edit mode
  const handleBaseUrlChange = useCallback(
    (text: string) => {
      const trimmed = text.slice(0, MAX_BASE_URL_LENGTH);
      setBaseUrl(trimmed);
      if (providerId && !isAddMode) {
        updateProvider(providerId, { baseUrl: trimmed });
      }
    },
    [providerId, isAddMode, updateProvider]
  );

  const handleStreamingToggle = useCallback(
    (value: boolean) => {
      setStreamingEnabled(value);
      if (providerId && !isAddMode) {
        updateProvider(providerId, { streamingEnabled: value });
      }
    },
    [providerId, isAddMode, updateProvider]
  );

  const handleApiModeChange = useCallback(
    (mode: OpenAIApiMode) => {
      setApiMode(mode);
      if (providerId && !isAddMode) {
        updateProvider(providerId, { apiMode: mode });
      }
    },
    [providerId, isAddMode, updateProvider]
  );

  const handleDeleteModel = useCallback(
    (modelId: string) => {
      deleteModel(modelId);
    },
    [deleteModel]
  );

  // ─── Add Model Modal State ─────────────────────────────────────────

  const [isModelModalVisible, setIsModelModalVisible] = useState(false);
  const [newModelId, setNewModelId] = useState('');
  const [newModelDisplayName, setNewModelDisplayName] = useState('');
  const [isModelSaving, setIsModelSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const addModel = useProviderStore((s) => s.addModel);

  const handleOpenModelModal = useCallback(() => {
    setNewModelId('');
    setNewModelDisplayName('');
    setAvailableModels([]);
    setIsModelModalVisible(true);

    // Fetch available models from provider API
    if (provider) {
      setIsLoadingModels(true);
      getApiKey(provider.id).then(async (key) => {
        if (!key) {
          setIsLoadingModels(false);
          return;
        }
        try {
          const providerAdapter = getProvider(provider.type);
          const providerConfig: ProviderConfig = {
            id: provider.id,
            type: provider.type,
            name: provider.name,
            baseUrl: provider.baseUrl,
            apiMode: provider.apiMode ?? undefined,
            streamingEnabled: provider.streamingEnabled,
            createdAt: provider.createdAt,
            updatedAt: provider.updatedAt,
          };
          const modelIds = await providerAdapter.listModels(providerConfig, key);
          setAvailableModels(modelIds);
        } catch {
          // Silently fail — user can enter model ID manually
        } finally {
          setIsLoadingModels(false);
        }
      });
    }
  }, [provider]);

  const handleCloseModelModal = useCallback(() => {
    setIsModelModalVisible(false);
  }, []);

  const handleSelectModel = useCallback((modelId: string) => {
    setNewModelId(modelId);
    setNewModelDisplayName(modelId);
  }, []);

  const handleSaveModel = useCallback(async () => {
    const trimmedId = newModelId.trim();
    if (!trimmedId || isModelSaving || !provider) return;

    setIsModelSaving(true);
    try {
      const data: CreateModelData = {
        providerId: provider.id,
        modelId: trimmedId,
        displayName: newModelDisplayName.trim() || trimmedId,
        contextWindow: null,
        inputPrice: null,
        outputPrice: null,
        cachedInputPrice: null,
        cachedOutputPrice: null,
        supportsReasoning: false,
        supportsImageInput: false,
        supportsImageGeneration: false,
        supportsFileInput: false,
      };
      await addModel(data);
      setIsModelModalVisible(false);
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsModelSaving(false);
    }
  }, [newModelId, newModelDisplayName, isModelSaving, provider, addModel]);

  // Handler for add-mode type change
  const handleTypeChange = useCallback((type: ProviderType) => {
    setNewType(type);
    if (type === 'openai') {
      setBaseUrl(DEFAULT_PROVIDER_URLS.openai);
    } else if (type === 'anthropic') {
      setBaseUrl(DEFAULT_PROVIDER_URLS.anthropic);
    } else {
      setBaseUrl('');
    }
  }, []);

  // Handler for saving a new provider
  const handleSaveNewProvider = useCallback(async () => {
    if (!newName.trim() || !newApiKey.trim() || !baseUrl.trim() || isSaving) return;

    setIsSaving(true);
    try {
      await addProvider(
        {
          type: newType,
          name: newName.trim(),
          baseUrl: baseUrl.trim(),
          apiMode: newType === 'openai' ? apiMode : undefined,
          streamingEnabled,
        },
        newApiKey.trim(),
      );
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSaving(false);
    }
  }, [newName, newApiKey, baseUrl, isSaving, newType, apiMode, streamingEnabled, addProvider, onClose]);

  // Validate add-mode form
  const isFormValid = !!(newName.trim() && newApiKey.trim() && baseUrl.trim());

  if (!shouldRender) return null;

  const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'custom'];
  const effectiveType = isAddMode ? newType : (provider?.type ?? 'openai');

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background, transform: [{ translateX }] },
      ]}
      accessibilityViewIsModal
      accessibilityLabel={isAddMode ? 'Add provider' : 'Provider detail'}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={styles.backButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Back to Settings"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.backChevron, { color: colors.accent }]}>
            {'‹'}
          </Text>
          <Text style={[styles.backLabel, { color: colors.accent }]}>
            Settings
          </Text>
        </Pressable>

        <Text
          style={[styles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {isAddMode ? 'Add Provider' : (provider?.name ?? 'Provider')}
        </Text>

        {/* Spacer for centering */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isAddMode ? (
          /* ─── Add New Provider Form ─── */
          <>
            {/* Provider Type */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                PROVIDER TYPE
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                <View style={styles.apiTypeSelector}>
                  {PROVIDER_TYPES.map((pt, index) => (
                    <Pressable
                      key={pt}
                      style={[
                        styles.apiTypeOption,
                        {
                          backgroundColor:
                            newType === pt ? colors.accent : colors.surfaceSecondary,
                          borderTopLeftRadius: index === 0 ? 8 : 0,
                          borderBottomLeftRadius: index === 0 ? 8 : 0,
                          borderTopRightRadius: index === PROVIDER_TYPES.length - 1 ? 8 : 0,
                          borderBottomRightRadius: index === PROVIDER_TYPES.length - 1 ? 8 : 0,
                        },
                      ]}
                      onPress={() => handleTypeChange(pt)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: newType === pt }}
                      accessibilityLabel={pt.charAt(0).toUpperCase() + pt.slice(1)}
                    >
                      <Text
                        style={[
                          styles.apiTypeText,
                          {
                            color: newType === pt ? colors.accentText : colors.text,
                          },
                        ]}
                      >
                        {pt.charAt(0).toUpperCase() + pt.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* Display Name */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                NAME
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                <TextInput
                  style={[
                    styles.configInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="e.g. My OpenAI"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Provider name"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* API Key */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                API KEY
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                <TextInput
                  style={[
                    styles.configInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.inputBackground,
                      borderColor: colors.border,
                    },
                  ]}
                  value={newApiKey}
                  onChangeText={setNewApiKey}
                  placeholder="sk-..."
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="API key"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[styles.keychainNote, { color: colors.textTertiary }]}>
                  Stored in the iOS Keychain. Never synced to iCloud.
                </Text>
              </View>
            </View>

            {/* Configuration */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                CONFIGURATION
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                {/* Base URL */}
                <View style={styles.configRow}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    Base URL
                  </Text>
                  <TextInput
                    style={[
                      styles.configInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                      },
                    ]}
                    value={baseUrl}
                    onChangeText={(text) => setBaseUrl(text.slice(0, MAX_BASE_URL_LENGTH))}
                    maxLength={MAX_BASE_URL_LENGTH}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Base URL"
                    placeholder="https://api.example.com"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Streaming Toggle */}
                <View style={styles.switchRow}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    Streaming
                  </Text>
                  <Switch
                    value={streamingEnabled}
                    onValueChange={setStreamingEnabled}
                    trackColor={{
                      false: colors.surfaceSecondary,
                      true: colors.accent,
                    }}
                    accessibilityLabel="Streaming enabled"
                  />
                </View>

                {/* API Mode (OpenAI only) */}
                {newType === 'openai' && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <View style={styles.configRow}>
                      <Text style={[styles.configLabel, { color: colors.text }]}>
                        API Type
                      </Text>
                      <View style={styles.apiTypeSelector}>
                        <Pressable
                          style={[
                            styles.apiTypeOption,
                            {
                              backgroundColor:
                                apiMode === 'responses'
                                  ? colors.accent
                                  : colors.surfaceSecondary,
                              borderTopLeftRadius: 8,
                              borderBottomLeftRadius: 8,
                            },
                          ]}
                          onPress={() => setApiMode('responses')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: apiMode === 'responses' }}
                          accessibilityLabel="Responses API"
                        >
                          <Text
                            style={[
                              styles.apiTypeText,
                              {
                                color:
                                  apiMode === 'responses'
                                    ? colors.accentText
                                    : colors.text,
                              },
                            ]}
                          >
                            Responses
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.apiTypeOption,
                            {
                              backgroundColor:
                                apiMode === 'chat-completions'
                                  ? colors.accent
                                  : colors.surfaceSecondary,
                              borderTopRightRadius: 8,
                              borderBottomRightRadius: 8,
                            },
                          ]}
                          onPress={() => setApiMode('chat-completions')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: apiMode === 'chat-completions' }}
                          accessibilityLabel="Chat Completions API"
                        >
                          <Text
                            style={[
                              styles.apiTypeText,
                              {
                                color:
                                  apiMode === 'chat-completions'
                                    ? colors.accentText
                                    : colors.text,
                              },
                            ]}
                          >
                            Chat Completions
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Save Button */}
            <View style={styles.section}>
              <Pressable
                style={[
                  styles.saveButton,
                  { backgroundColor: colors.accent },
                  (!isFormValid || isSaving) && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveNewProvider}
                disabled={!isFormValid || isSaving}
                accessibilityRole="button"
                accessibilityLabel="Save provider"
                accessibilityState={{ disabled: !isFormValid || isSaving }}
              >
                <Text style={[styles.saveButtonText, { color: colors.accentText }]}>
                  {isSaving ? 'Saving…' : 'Save Provider'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          /* ─── Edit Existing Provider ─── */
          <>
            {/* API Key Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                API KEY
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                <View style={styles.apiKeyRow}>
                  <Text
                    style={[styles.apiKeyText, { color: colors.text }]}
                    numberOfLines={1}
                    accessibilityLabel={
                      keyRevealed ? 'API key revealed' : 'API key masked'
                    }
                  >
                    {apiKey
                      ? keyRevealed
                        ? apiKey
                        : maskApiKey(apiKey)
                      : '••••••••'}
                  </Text>
                  <Pressable
                    onPressIn={() => setKeyRevealed(true)}
                    onPressOut={() => setKeyRevealed(false)}
                    style={styles.eyeToggle}
                    accessibilityRole="button"
                    accessibilityLabel={
                      keyRevealed ? 'Hide API key' : 'Reveal API key'
                    }
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.eyeIcon, { color: colors.textTertiary }]}>
                      {keyRevealed ? '👁' : '👁‍🗨'}
                    </Text>
                  </Pressable>
                </View>
                <Text style={[styles.keychainNote, { color: colors.textTertiary }]}>
                  Stored in the iOS Keychain. Never synced to iCloud.
                </Text>
              </View>
            </View>

            {/* Configuration Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                CONFIGURATION
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                {/* Base URL */}
                <View style={styles.configRow}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    Base URL
                  </Text>
                  <TextInput
                    style={[
                      styles.configInput,
                      {
                        color: colors.text,
                        backgroundColor: colors.inputBackground,
                        borderColor: colors.border,
                      },
                    ]}
                    value={baseUrl}
                    onChangeText={handleBaseUrlChange}
                    maxLength={MAX_BASE_URL_LENGTH}
                    keyboardType="url"
                    autoCapitalize="none"
                    autoCorrect={false}
                    accessibilityLabel="Base URL"
                    placeholder="https://api.example.com"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>

                <View style={[styles.separator, { backgroundColor: colors.border }]} />

                {/* Streaming Toggle */}
                <View style={styles.switchRow}>
                  <Text style={[styles.configLabel, { color: colors.text }]}>
                    Streaming
                  </Text>
                  <Switch
                    value={streamingEnabled}
                    onValueChange={handleStreamingToggle}
                    trackColor={{
                      false: colors.surfaceSecondary,
                      true: colors.accent,
                    }}
                    accessibilityLabel="Streaming enabled"
                  />
                </View>

                {/* API Type Selector (OpenAI only) */}
                {provider?.type === 'openai' && (
                  <>
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                    <View style={styles.configRow}>
                      <Text style={[styles.configLabel, { color: colors.text }]}>
                        API Type
                      </Text>
                      <View style={styles.apiTypeSelector}>
                        <Pressable
                          style={[
                            styles.apiTypeOption,
                            {
                              backgroundColor:
                                apiMode === 'responses'
                                  ? colors.accent
                                  : colors.surfaceSecondary,
                              borderTopLeftRadius: 8,
                              borderBottomLeftRadius: 8,
                            },
                          ]}
                          onPress={() => handleApiModeChange('responses')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: apiMode === 'responses' }}
                          accessibilityLabel="Responses API"
                        >
                          <Text
                            style={[
                              styles.apiTypeText,
                              {
                                color:
                                  apiMode === 'responses'
                                    ? colors.accentText
                                    : colors.text,
                              },
                            ]}
                          >
                            Responses
                          </Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.apiTypeOption,
                            {
                              backgroundColor:
                                apiMode === 'chat-completions'
                                  ? colors.accent
                                  : colors.surfaceSecondary,
                              borderTopRightRadius: 8,
                              borderBottomRightRadius: 8,
                            },
                          ]}
                          onPress={() => handleApiModeChange('chat-completions')}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: apiMode === 'chat-completions' }}
                          accessibilityLabel="Chat Completions API"
                        >
                          <Text
                            style={[
                              styles.apiTypeText,
                              {
                                color:
                                  apiMode === 'chat-completions'
                                    ? colors.accentText
                                    : colors.text,
                              },
                            ]}
                          >
                            Chat Completions
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Models Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                MODELS
              </Text>
              <View
                style={[
                  styles.sectionCard,
                  { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
                ]}
              >
                {providerModels.length === 0 ? (
                  <Pressable
                    style={styles.addModelRow}
                    onPress={handleOpenModelModal}
                    accessibilityRole="button"
                    accessibilityLabel="Add Model"
                  >
                    <Text style={[styles.addModelText, { color: colors.accent }]}>
                      Add Model
                    </Text>
                  </Pressable>
                ) : (
                  <>
                    {providerModels.map((model, index) => (
                      <React.Fragment key={model.id}>
                        {index > 0 && (
                          <View
                            style={[
                              styles.separator,
                              { backgroundColor: colors.border },
                            ]}
                          />
                        )}
                        <ModelRow
                          model={model}
                          onDelete={handleDeleteModel}
                          colors={colors}
                        />
                      </React.Fragment>
                    ))}
                    <View
                      style={[styles.separator, { backgroundColor: colors.border }]}
                    />
                    <Pressable
                      style={styles.addModelRow}
                      onPress={handleOpenModelModal}
                      accessibilityRole="button"
                      accessibilityLabel="Add Model"
                    >
                      <Text style={[styles.addModelText, { color: colors.accent }]}>
                        Add Model
                      </Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Model Modal */}
      <Modal
        visible={isModelModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModelModal}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Modal Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={handleCloseModelModal}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[styles.modalCancelText, { color: colors.accent }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Model</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Loading indicator */}
            {isLoadingModels && (
              <View style={styles.modelLoadingRow}>
                <ActivityIndicator size="small" color={colors.accent} />
                <Text style={[styles.modelLoadingText, { color: colors.textSecondary }]}>
                  Fetching available models…
                </Text>
              </View>
            )}

            {/* Available models from API */}
            {!isLoadingModels && availableModels.length > 0 && !newModelId.trim() && (
              <View style={styles.modelListSection}>
                <Text style={[styles.modelListHeader, { color: colors.textTertiary }]}>
                  AVAILABLE MODELS
                </Text>
                {availableModels.map((modelId) => (
                  <Pressable
                    key={modelId}
                    style={[styles.modelListItem, { backgroundColor: colors.surface }]}
                    onPress={() => handleSelectModel(modelId)}
                    accessibilityRole="button"
                    accessibilityLabel={modelId}
                  >
                    <Text style={[styles.modelListItemText, { color: colors.text }]}>
                      {modelId}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Manual entry */}
            <View style={styles.modelFormSection}>
              <Text style={[styles.modelFormLabel, { color: colors.textSecondary }]}>
                Model ID
              </Text>
              <TextInput
                style={[
                  styles.modelFormInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                value={newModelId}
                onChangeText={setNewModelId}
                placeholder="e.g. gpt-4o, claude-sonnet-4-20250514"
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Model ID"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.modelFormSection}>
              <Text style={[styles.modelFormLabel, { color: colors.textSecondary }]}>
                Display Name (optional)
              </Text>
              <TextInput
                style={[
                  styles.modelFormInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.inputBackground,
                    borderColor: colors.border,
                  },
                ]}
                value={newModelDisplayName}
                onChangeText={setNewModelDisplayName}
                placeholder={newModelId || 'Same as Model ID'}
                placeholderTextColor={colors.textTertiary}
                accessibilityLabel="Display name"
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            {/* Save Button */}
            <Pressable
              style={[
                styles.modelSaveButton,
                { backgroundColor: colors.accent },
                (!newModelId.trim() || isModelSaving) && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveModel}
              disabled={!newModelId.trim() || isModelSaving}
              accessibilityRole="button"
              accessibilityLabel="Save model"
              accessibilityState={{ disabled: !newModelId.trim() || isModelSaving }}
            >
              <Text style={[styles.modelSaveButtonText, { color: colors.accentText }]}>
                {isModelSaving ? 'Saving…' : 'Add Model'}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
    elevation: 9,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60, // Account for safe area (status bar + notch)
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 44,
  },
  backChevron: {
    fontSize: 22,
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
    minWidth: 80,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  apiKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  apiKeyText: {
    fontFamily: 'monospace',
    fontSize: 13.5,
    flex: 1,
  },
  eyeToggle: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  keychainNote: {
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  configRow: {
    paddingVertical: 12,
  },
  configLabel: {
    fontSize: 15,
    fontWeight: '400',
    marginBottom: 8,
  },
  configInput: {
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  apiTypeSelector: {
    flexDirection: 'row',
    overflow: 'hidden',
  },
  apiTypeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiTypeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modelRowWrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 72,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modelRow: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  modelRowContent: {
    flex: 1,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  modelDetails: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2,
  },
  addModelRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  addModelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Add Model Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '400',
    minWidth: 60,
  },
  modalTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalHeaderSpacer: {
    minWidth: 60,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 40,
  },
  modelLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  modelLoadingText: {
    fontSize: 14,
    marginLeft: 8,
  },
  modelListSection: {
    marginBottom: 24,
  },
  modelListHeader: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  modelListItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  modelListItemText: {
    fontSize: 14,
    fontWeight: '400',
  },
  modelFormSection: {
    marginBottom: 16,
  },
  modelFormLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 6,
  },
  modelFormInput: {
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modelSaveButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  modelSaveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProviderDetailScreen;
