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
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Reanimated, {
  useAnimatedStyle,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';

import { useTheme } from '@/theme';
import { SETTINGS_SLIDE_DURATION, DIALOG_EASING } from '@/theme/animations';
import { useProviderStore } from '@/stores/provider-store';
import type { ModelConfig } from '@/stores/provider-store';
import { getApiKey } from '@/database/secure-store';
import { useSwipeToDelete } from '@/hooks/useSwipeToDelete';
import type { OpenAIApiMode } from '@/database/repositories/provider-repo';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProviderDetailScreenProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** The provider ID to display */
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
  const deleteModel = useProviderStore((s) => s.deleteModel);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providers, providerId]
  );

  const providerModels = useMemo(
    () => models.filter((m) => m.providerId === providerId),
    [models, providerId]
  );

  // API key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);

  useEffect(() => {
    if (visible && providerId) {
      getApiKey(providerId).then((key) => {
        setApiKey(key);
      });
      // Reset reveal state when opening
      setKeyRevealed(false);
    }
  }, [visible, providerId]);

  // Configuration state (editable)
  const [baseUrl, setBaseUrl] = useState('');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [apiMode, setApiMode] = useState<OpenAIApiMode>('responses');

  useEffect(() => {
    if (provider) {
      setBaseUrl(provider.baseUrl);
      setStreamingEnabled(provider.streamingEnabled);
      setApiMode(provider.apiMode ?? 'responses');
    }
  }, [provider]);

  // Handlers
  const handleBaseUrlChange = useCallback(
    (text: string) => {
      const trimmed = text.slice(0, MAX_BASE_URL_LENGTH);
      setBaseUrl(trimmed);
      if (providerId) {
        updateProvider(providerId, { baseUrl: trimmed });
      }
    },
    [providerId, updateProvider]
  );

  const handleStreamingToggle = useCallback(
    (value: boolean) => {
      setStreamingEnabled(value);
      if (providerId) {
        updateProvider(providerId, { streamingEnabled: value });
      }
    },
    [providerId, updateProvider]
  );

  const handleApiModeChange = useCallback(
    (mode: OpenAIApiMode) => {
      setApiMode(mode);
      if (providerId) {
        updateProvider(providerId, { apiMode: mode });
      }
    },
    [providerId, updateProvider]
  );

  const handleDeleteModel = useCallback(
    (modelId: string) => {
      deleteModel(modelId);
    },
    [deleteModel]
  );

  if (!shouldRender) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: colors.background, transform: [{ translateX }] },
      ]}
      accessibilityViewIsModal
      accessibilityLabel="Provider detail"
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
          {provider?.name ?? 'Provider'}
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
              // Empty models → "Add Model" as sole item
              <Pressable
                style={styles.addModelRow}
                onPress={() => {
                  // Placeholder: navigate to add model flow
                }}
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
                  onPress={() => {
                    // Placeholder: navigate to add model flow
                  }}
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
      </ScrollView>
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
});

export default ProviderDetailScreen;
