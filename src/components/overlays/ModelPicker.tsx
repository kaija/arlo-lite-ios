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

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

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
  /** Map of provider ID → display name */
  providerNames: Map<string, string>;
  /** Called when a model is selected; receives providerId and modelId */
  onSelect: (providerId: string, modelId: string) => void;
  /** Called when the picker is dismissed (tap outside) */
  onDismiss: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum visible rows before scrolling activates */
const MAX_VISIBLE_ROWS = 6;

/** Approximate height per model row (single line + padding) */
const ROW_HEIGHT = 40;

/** Section header height (unused but kept for reference) */
const SECTION_HEADER_HEIGHT = 0;

/** Vertical translate distance for the fade-up entrance */
const TRANSLATE_Y_DISTANCE = 8;

/** Easing curve matching DIALOG_EASING as a Bezier */
const PICKER_EASING = Easing.bezier(
  DIALOG_EASING[0],
  DIALOG_EASING[1],
  DIALOG_EASING[2],
  DIALOG_EASING[3]
);

// ─── Component ────────────────────────────────────────────────────────────────

export function ModelPicker({
  visible,
  models,
  activeModelId,
  providerNames,
  onSelect,
  onDismiss,
}: ModelPickerProps) {
  const { colors, borderRadii, typography } = useTheme();
  const { t } = useTranslation();

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

  // Calculate max scroll height
  const totalRows = models.length;
  const needsScroll = totalRows > MAX_VISIBLE_ROWS;
  const maxHeight = needsScroll
    ? MAX_VISIBLE_ROWS * ROW_HEIGHT
    : undefined;

  if (!shouldRender) return null;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Scrim — tap to dismiss */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.dismissModelPicker')}
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
        accessibilityLabel={t('modelSwitcher.title')}
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
              {t('models.empty')}
            </Text>
            <Text
              style={[
                styles.emptySubtitle,
                { color: colors.textTertiary },
              ]}
            >
              {t('models.emptyHint')}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={needsScroll ? { maxHeight } : undefined}
            showsVerticalScrollIndicator={needsScroll}
            bounces={false}
          >
            {models.map((model) => {
              const isActive = model.id === activeModelId;
              const provider = providerNames.get(model.providerId) ?? model.providerId;

              return (
                <Pressable
                  key={model.id}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: colors.surfaceSecondary },
                  ]}
                  onPress={() => onSelect(model.providerId, model.modelId)}
                  accessibilityRole="menuitem"
                  accessibilityLabel={`${model.modelId}, ${provider}${isActive ? ', selected' : ''}`}
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
                      {model.modelId}
                      <Text style={[styles.providerLabel, { color: colors.textTertiary }]}>
                        {' '}({provider})
                      </Text>
                    </Text>
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
    alignItems: 'center',
    paddingBottom: 120, // Position above input chrome
    paddingHorizontal: 32,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    overflow: 'hidden',
    paddingVertical: 6,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    maxWidth: 300,
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: ROW_HEIGHT,
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  modelName: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 18,
  },
  providerLabel: {
    fontSize: 12,
    fontWeight: '400',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  emptyState: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
  },
});

export default ModelPicker;
