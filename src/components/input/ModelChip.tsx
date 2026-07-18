import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

export interface ModelChipProps {
  /** Display name of the active model */
  modelName: string;
  /** Called when the chip is pressed to open the model picker */
  onPress: () => void;
}

/**
 * Pill-shaped button displaying the active model name with a disclosure chevron.
 *
 * Uses accent tint background, full border radius (pill), and a scale-down
 * press animation (0.97) for tactile feedback.
 *
 * VoiceOver announces the active model name for accessibility.
 */
export function ModelChip({ modelName, onPress }: ModelChipProps) {
  const { colors, borderRadii } = useTheme();
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
    opacity.value = withSpring(0.82, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={t('accessibility.modelLabel', { model: modelName })}
        accessibilityHint={t('accessibility.modelSwitcherButton')}
        style={[
          styles.container,
          {
            backgroundColor: colors.accent + '1A', // 10% accent tint
            borderRadius: borderRadii.full,
          },
        ]}
      >
        <Text
          style={[styles.label, { color: colors.accent }]}
          numberOfLines={1}
        >
          {modelName}
        </Text>
        <View style={styles.chevronContainer}>
          <Text style={[styles.chevron, { color: colors.accent }]}>
            {'\u203A'}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    maxWidth: 160,
  },
  chevronContainer: {
    marginLeft: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevron: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 16,
  },
});
