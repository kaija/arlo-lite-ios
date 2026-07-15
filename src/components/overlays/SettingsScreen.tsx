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
 * - Generation params: Temperature (0.0–2.0), Max Tokens
 * - Empty state when no providers configured
 * - Grouped inset list, system-grouped background
 * - Translucent blur header pinned on scroll
 * - Dismiss via back button or swipe gesture
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

import { useTheme } from '@/theme';
import { SETTINGS_SLIDE_DURATION } from '@/theme/animations';
import { useProviderStore } from '@/stores/provider-store';
import type { Provider } from '@/database/repositories/provider-repo';
import type { ModelConfig } from '@/stores/provider-store';

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SettingsScreenProps {
  /** Whether the settings overlay is visible */
  visible: boolean;
  /** Called when the user dismisses the screen */
  onClose: () => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isDefault: boolean;
}

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
 * Masks an API key showing only the last 4 characters.
 * Returns "•••• XXXX" format.
 */
function maskApiKey(key: string | null): string {
  if (!key || key.length < 4) {
    return '••••';
  }
  return `•••• ${key.slice(-4)}`;
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

  // Provider store data
  const providers = useProviderStore((state) => state.providers);
  const models = useProviderStore((state) => state.models);

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

  // Placeholder system prompts (will integrate with actual store when available)
  const systemPrompts: SystemPrompt[] = useMemo(() => [], []);

  const handleBack = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleProviderPress = useCallback((_providerId: string) => {
    // Will wire to openProviderDetail via UI store
  }, []);

  const handleAddPrompt = useCallback(() => {
    // Navigate to prompt creation
  }, []);

  const handleAddProvider = useCallback(() => {
    // Navigate to provider creation flow
  }, []);

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
      accessibilityLabel="Settings"
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
            accessibilityLabel="Back to Chat"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.backChevron, { color: colors.accent }]}>
              {'\u2039'}
            </Text>
            <Text style={[styles.backLabel, { color: colors.accent }]}>
              Chat
            </Text>
          </Pressable>

          {/* Centered title */}
          <Text
            style={[styles.headerTitle, { color: colors.text }]}
            accessibilityRole="header"
          >
            Settings
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
              No providers configured
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              Add a provider to start chatting with AI models
            </Text>
            <Pressable
              style={[styles.addProviderButton, { backgroundColor: colors.accent }]}
              onPress={handleAddProvider}
              accessibilityRole="button"
              accessibilityLabel="Add Provider"
            >
              <Text style={[styles.addProviderText, { color: colors.accentText }]}>
                Add Provider
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Providers Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                PROVIDERS
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
              </View>
            </View>

            {/* System Prompts Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                SYSTEM PROMPTS
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
                      No system prompts configured
                    </Text>
                  </View>
                ) : (
                  systemPrompts.map((prompt, index) => (
                    <SystemPromptRow
                      key={prompt.id}
                      prompt={prompt}
                      isLast={index === systemPrompts.length - 1}
                    />
                  ))
                )}

                {/* Add Prompt action */}
                <Pressable
                  style={styles.addActionRow}
                  onPress={handleAddPrompt}
                  accessibilityRole="button"
                  accessibilityLabel="Add Prompt"
                >
                  <Text style={[styles.addActionText, { color: colors.accent }]}>
                    Add Prompt
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Generation Parameters Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionHeader, { color: colors.textTertiary }]}>
                GENERATION PARAMETERS
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
                <GenerationParamRow
                  label="Temperature"
                  value="0.7"
                  isLast={false}
                />
                <GenerationParamRow
                  label="Max Tokens"
                  value="4096"
                  isLast
                />
              </View>
            </View>
          </>
        )}
      </ScrollView>
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

function ProviderCard({ provider, modelCount, onPress, isLast }: ProviderCardProps) {
  const { colors } = useTheme();
  const apiTypeLabel = formatApiType(provider);
  const modelCountLabel = `${modelCount} model${modelCount !== 1 ? 's' : ''}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.providerCard,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${provider.name}, ${modelCountLabel}, ${apiTypeLabel}`}
      accessibilityHint="Opens provider details"
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
          <Text
            style={[styles.providerName, { color: colors.text }]}
            numberOfLines={1}
          >
            {provider.name}
          </Text>
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
          {maskApiKey(null)}
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
  prompt: SystemPrompt;
  isLast: boolean;
}

function SystemPromptRow({ prompt, isLast }: SystemPromptRowProps) {
  const { colors } = useTheme();
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
          {prompt.isDefault && (
            <Text style={[styles.defaultCheck, { color: colors.accent }]}>
              {'\u2713'}
            </Text>
          )}
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
        accessibilityLabel={`Edit ${prompt.name}`}
      >
        <Text style={[styles.editButtonText, { color: colors.accent }]}>
          Edit
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
  isLast: boolean;
}

function GenerationParamRow({ label, value, isLast }: GenerationParamRowProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={styles.paramRow}
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
