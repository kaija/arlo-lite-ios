import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';

export interface NavigationChromeProps {
  /** Session title displayed in the center */
  title: string;
  /** Called when the sidebar toggle button is pressed */
  onSidebarToggle: () => void;
  /** Called when the settings button is pressed */
  onSettingsOpen: () => void;
}

/** Minimum tap target size per Apple HIG */
const TAP_TARGET = 44;

/** Bottom border thickness */
const BORDER_WIDTH = 0.5;

/**
 * Translucent top navigation bar for the chat screen.
 *
 * Uses expo-blur BlurView with systemUltraThinMaterial for native iOS vibrancy.
 * Falls back to a semi-transparent solid background on Android.
 *
 * Layout:
 * - Leading: sidebar hamburger toggle (44×44pt tap target)
 * - Center: session title (semibold, single-line truncation)
 * - Trailing: settings gear button (44×44pt tap target)
 *
 * Pinned to top, full-width, positioned below safe area insets.
 * All interactive elements have VoiceOver labels.
 */
export function NavigationChrome({
  title,
  onSidebarToggle,
  onSettingsOpen,
}: NavigationChromeProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const barContent = (
    <View style={styles.contentRow}>
      <NavButton
        onPress={onSidebarToggle}
        accessibilityLabel={t('accessibility.toggleSidebar')}
        accessibilityHint={t('accessibility.toggleSidebarHint')}
        icon={<HamburgerIcon color={colors.accent} />}
      />
      <View style={styles.titleContainer}>
        <Text
          style={[styles.title, { color: colors.text }]}
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </Text>
      </View>
      <NavButton
        onPress={onSettingsOpen}
        accessibilityLabel={t('accessibility.settingsButton')}
        accessibilityHint={t('accessibility.settingsButtonHint')}
        icon={<GearIcon color={colors.accent} />}
      />
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <BlurView
        intensity={20}
        tint="systemUltraThinMaterial"
        style={[
          styles.container,
          { paddingTop: insets.top, borderBottomColor: colors.border },
        ]}
      >
        {barContent}
      </BlurView>
    );
  }

  // Android fallback: semi-transparent solid background
  return (
    <View
      style={[
        styles.container,
        styles.androidFallback,
        {
          paddingTop: insets.top,
          borderBottomColor: colors.border,
          backgroundColor: colors.background + 'C2', // ~76% opacity
        },
      ]}
    >
      {barContent}
    </View>
  );
}

// ─── Internal Components ──────────────────────────────────────────────────────

interface NavButtonProps {
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  icon: React.ReactNode;
}

/**
 * 44×44pt pressable button with scale-down micro-interaction.
 */
function NavButton({
  onPress,
  accessibilityLabel,
  accessibilityHint,
  icon,
}: NavButtonProps) {
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
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        style={styles.navButton}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

/** Three-line hamburger icon for the sidebar toggle */
function HamburgerIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M3 5h14M3 10h14M3 15h14"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Gear/settings icon */
function GearIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
      <Path
        d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.2 12.5a1.4 1.4 0 00.28 1.54l.05.05a1.7 1.7 0 01-1.2 2.9 1.7 1.7 0 01-1.2-.5l-.05-.04a1.4 1.4 0 00-1.54-.28 1.4 1.4 0 00-.84 1.28v.15a1.7 1.7 0 01-3.4 0v-.08a1.4 1.4 0 00-.92-1.28 1.4 1.4 0 00-1.54.28l-.05.05a1.7 1.7 0 01-2.4-2.4l.04-.05a1.4 1.4 0 00.28-1.54 1.4 1.4 0 00-1.28-.84h-.15a1.7 1.7 0 010-3.4h.08a1.4 1.4 0 001.28-.92 1.4 1.4 0 00-.28-1.54l-.05-.05a1.7 1.7 0 012.4-2.4l.05.04a1.4 1.4 0 001.54.28h.07a1.4 1.4 0 00.84-1.28v-.15a1.7 1.7 0 013.4 0v.08a1.4 1.4 0 00.84 1.28 1.4 1.4 0 001.54-.28l.05-.05a1.7 1.7 0 012.4 2.4l-.04.05a1.4 1.4 0 00-.28 1.54v.07a1.4 1.4 0 001.28.84h.15a1.7 1.7 0 010 3.4h-.08a1.4 1.4 0 00-1.28.84z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    borderBottomWidth: BORDER_WIDTH,
  },
  androidFallback: {
    // Android doesn't support BlurView well; use solid translucent fill
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TAP_TARGET,
    paddingHorizontal: 4,
  },
  navButton: {
    width: TAP_TARGET,
    height: TAP_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
});
