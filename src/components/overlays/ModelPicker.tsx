/**
 * ModelPicker — Dropdown overlay for selecting the active model.
 *
 * Anchored above the input chrome, displays available models grouped by provider
 * with uppercase section headers. Each row shows model name + context window size.
 * The active model is indicated with an accent-colored checkmark.
 *
 * Features:
 * - Fade-up animation (0.28s cubic-bezier(0.32,0.72,0,1))
 * - Card surface bg, 14px border-radius, drop shadow
 * - Tap outside (scrim) dismisses without change
 * - Select model → set active, update chip, dismiss
 * - Empty state if no models configured
 * - Scrollable if > 5 visible rows
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9
 */

import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useTheme } from '@/theme';
import { MODEL_PICKER_FADE_DURATION, DIALOG_EASING } from '@/theme/animations';
import type { ModelConfig } from '@/stores/provider-store';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelPickerProps {
  /** Whether the picker overlay is visible */
  visible: boolean;
  /** All configured models across providers */
  models: ModelConfig[];
  /** Currently active model ID (the internal `id` field) */
  activeModelId: string | null;
  /** Called when a model is selected; receives providerId and modelId */
  onSelect: (providerId: string, modelId: string) => void;
  /** Called when the picker is dismissed (tap outside) */
  onDismiss: () => void;
}

interface ModelGroup {
  providerName: string;
  models: ModelConfig[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum visible rows before scrolling activates */
const MAX_VISIBLE_ROWS = 5;

/** Approximate height per model row (name + subline + padding) */
const ROW_HEIGHT = 52;

/** Section header height */
const SECTION_HEADER_HEIGHT = 28;

/** Vertical translate distance for the fade-up entrance */
const TRANSLATE_Y_DISTANCE = 8;

/** Easing curve matching DIALOG_EASING as a Bezier */
const PICKER_EASING = Easing.bezier(
  DIALOG_EASING[0],
  DIALOG_EASING[1],
  DIALOG_EASING[2],
  DIALOG_EASING[3]
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Formats a context window size into a human-readable string.
 * e.g. 200000 → "200K", 128000 → "128K", 4096 → "4K"
 */
function formatContextWindow(contextWindow: number | null): string | null {
  if (contextWindow == null || contextWindow <= 0) return null;
  if (contextWindow >= 1000) {
    const k = Math.round(contextWindow / 1000);
    return `${k}K`;
  }
  return `${contextWindow}`;
}

/**
 * Groups models by their provider ID and pairs them with provider names.
 * Uses the model's providerId to group — the provider name is derived
 * from the providerId (uppercase) as a fallback since we don't receive
 * provider objects here.
 */
function groupModelsByProvider(
  models: ModelConfig[],
  providerNames?: Map<string, string>
): ModelGroup[] {
  const grouped = new Map<string, ModelConfig[]>();

  for (const model of models) {
    const existing = grouped.get(model.providerId);
    if (existing) {
      existing.push(model);
    } else {
      grouped.set(model.providerId, [model]);
    }
  }

  const groups: ModelGroup[] = [];
  for (const [providerId, providerModels] of grouped) {
    groups.push({
      providerName: providerNames?.get(providerId) ?? providerId,
      models: providerModels,
    });
  }

  return groups;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ModelPicker({
  visible,
  models,
  activeModelId,
  onSelect,
  onDismiss,
}: ModelPickerProps) {
  const { colors, borderRadii, typography } = useTheme();

  // Animation shared values
  const opacity = useSharedValue(visible ? 1 : 0);
  const translateY = useSharedValue(visible ? 0 : TRANSLATE_Y_DISTANCE);

  // Track if we should render the component (stays true during exit animation)
  const [shouldRender, setShouldRender] = React.useState(visible);

  React.useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Animate in
      opacity.value = withTiming(1, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      translateY.value = withTiming(0, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
    } else {
      // Animate out
      opacity.value = withTiming(0, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      translateY.value = withTiming(TRANSLATE_Y_DISTANCE, {
        duration: MODEL_PICKER_FADE_DURATION,
        easing: PICKER_EASING,
      });
      // Unmount after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, MODEL_PICKER_FADE_DURATION);
      return () => clearTimeout(timer);
    }
  }, [visible, opacity, translateY]);

  // Animated styles
  const scrimAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.32,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Group models by provider
  const groups = useMemo(() => groupModelsByProvider(models), [models]);

  // Calculate max scroll height (5 rows worth)
  const totalRows = models.length;
  const needsScroll = totalRows > MAX_VISIBLE_ROWS;
  const maxHeight = needsScroll
    ? MAX_VISIBLE_ROWS * ROW_HEIGHT + SECTION_HEADER_HEIGHT
    : undefined;

  if (!shouldRender) return null;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap to dismiss */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss model picker"
      >
        <Animated.View
          style={[styles.scrim, scrimAnimatedStyle]}
        />
      </Pressable>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderRadius: 14,
            shadowColor: '#000',
          },
          cardAnimatedStyle,
        ]}
        accessibilityRole="menu"
        accessibilityLabel="Model picker"
      >
        {models.length === 0 ? (
          // Empty state
          <View style={styles.emptyState}>
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.textSecondary },
              ]}
            >
              No models configured
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.textTertiary },
              ]}
            >
              Add a provider and model in Settings
            </Text>
          </View>
        ) : (
          <ScrollView
            style={needsScroll ? { maxHeight } : undefined}
            showsVerticalScrollIndicator={needsScroll}
            bounces={false}
          >
            {groups.map((group) => (
              <View key={group.providerName}>
                {/* Section header */}
                <View style={styles.sectionHeader}>
                  <Text
                    style={[
                      styles.sectionHeaderText,
                      { color: colors.textTertiary },
                    ]}
                  >
                    {group.providerName.toUpperCase()}
                  </Text>
                </View>

                {/* Model rows */}
                {group.models.map((model) => {
                  const isActive = model.id === activeModelId;
                  const contextLabel = formatContextWindow(model.contextWindow);

                  return (
                    <Pressable
                      key={model.id}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && { backgroundColor: colors.surfaceSecondary },
                      ]}
                      onPress={() => onSelect(model.providerId, model.modelId)}
                      accessibilityRole="menuitem"
                      accessibilityLabel={`${model.displayName}${contextLabel ? `, ${contextLabel} context` : ''}${isActive ? ', selected' : ''}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <View style={styles.rowContent}>
                        <Text
                          style={[
                            styles.modelName,
                            { color: colors.text },
                          ]}
                          numberOfLines={1}
                        >
                          {model.displayName}
                        </Text>
                        {contextLabel && (
                          <Text
                            style={[
                              styles.modelSubline,
                              { color: colors.textTertiary },
                            ]}
                          >
                            {contextLabel}
                          </Text>
                        )}
                      </View>

                      {/* Active checkmark */}
                      {isActive && (
                        <Text
                          style={[styles.checkmark, { color: colors.accent }]}
                        >
                          {'\u2713'}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 7,
    elevation: 7,
    justifyContent: 'flex-end',
    paddingBottom: 120, // Position above input chrome
    paddingHorizontal: 16,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    overflow: 'hidden',
    paddingVertical: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    height: SECTION_HEADER_HEIGHT,
    justifyContent: 'center',
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: ROW_HEIGHT,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modelName: {
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 20,
  },
  modelSubline: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
    marginTop: 2,
  },
  checkmark: {
    fontSize: 17,
    fontWeight: '600',
    marginLeft: 12,
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    textAlign: 'center',
  },
});

export default ModelPicker;
