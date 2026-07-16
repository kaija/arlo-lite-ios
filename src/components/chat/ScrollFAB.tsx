import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, Theme } from '@/theme';

export interface ScrollFABProps {
  /** Whether the FAB is visible */
  visible: boolean;
  /** Callback when the user presses the button */
  onPress: () => void;
}

/**
 * Floating action button that scrolls the chat FlatList to the bottom.
 *
 * Positioned above the InputChrome and animated with FadeIn/FadeOut
 * transitions via react-native-reanimated.
 */
export function ScrollFAB({ visible, onPress }: ScrollFABProps) {
  const theme = useTheme();
  const styles = createStyles(theme);

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      <Pressable
        onPress={onPress}
        style={styles.button}
        accessibilityLabel="Scroll to bottom"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-down" size={20} color={theme.colors.text} />
      </Pressable>
    </Animated.View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    position: 'absolute',
    right: 16,
    bottom: 80,
    zIndex: 5,
  };

  const button: ViewStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  };

  return StyleSheet.create({
    container,
    button,
  });
}
