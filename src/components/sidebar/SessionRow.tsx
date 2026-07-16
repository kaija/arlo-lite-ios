/**
 * SessionRow — A swipeable session list row for the sidebar.
 *
 * Features:
 * - Active highlight (12% accent tint background, accent text, 600 weight)
 * - Swipe-left > 40px reveals a red delete button (72px wide)
 * - Tap delete → immediate remove, animate row out via FadeOut, no confirmation
 * - Long-press at 550ms fires expo-haptics impactAsync(Light) then opens rename
 * - VoiceOver custom actions for swipe-delete and long-press rename
 *
 * Uses `useSwipeToDelete` hook for the swipe gesture and `usePressAnimation`
 * for press-state micro-interaction feedback.
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  FadeOut,
} from 'react-native-reanimated';
import { GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '@/theme';
import { useSwipeToDelete } from '@/hooks/useSwipeToDelete';
import { usePressAnimation } from '@/hooks/usePressAnimation';
import type { Session } from '@/database/repositories/session-repo';

export interface SessionRowProps {
  /** The session data to display */
  session: Session;
  /** Whether this row represents the currently active session */
  isActive: boolean;
  /** Called when the row is tapped to select this session */
  onSelect: () => void;
  /** Called when the delete button is tapped */
  onDelete: () => void;
  /** Called when long-press is recognized (opens rename) */
  onRename: () => void;
}

/** Delete button width matching useSwipeToDelete reveal */
const DELETE_BUTTON_WIDTH = 72;

/** Long-press duration in ms before firing rename */
const LONG_PRESS_DURATION = 550;

/**
 * A single session row in the sidebar list.
 *
 * - Active sessions get a 12% accent tint background, accent-colored text, and 600 weight.
 * - Swipe-left > 40px reveals a red delete button (72px wide).
 * - Tapping delete immediately removes the session with a FadeOut animation.
 * - Long-press at 550ms fires expo-haptics impactAsync(Light) then triggers rename.
 * - VoiceOver custom actions provide accessible alternatives for gesture interactions.
 */
export function SessionRow({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: SessionRowProps) {
  const { colors } = useTheme();
  const { translateX, panGesture, reset } = useSwipeToDelete();
  const { animatedStyle: pressStyle, onPressIn, onPressOut } = usePressAnimation();

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleLongPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reset();
    onRename();
  }, [onRename, reset]);

  const handleDelete = useCallback(() => {
    reset();
    onDelete();
  }, [onDelete, reset]);

  // Use opaque backgrounds so the delete button behind is fully hidden
  const titleColor = isActive ? colors.accent : colors.text;
  const titleWeight = isActive ? '600' : '400';

  return (
    <Animated.View style={styles.rowContainer} exiting={FadeOut.duration(200)}>
      {/* Delete button sits behind the row content */}
      <View style={[styles.deleteButton, { backgroundColor: colors.error }]}>
        <Pressable
          onPress={handleDelete}
          style={styles.deleteButtonPressable}
          accessibilityRole="button"
          accessibilityLabel="Delete session"
        >
          <TrashIcon color="#FFFFFF" />
        </Pressable>
      </View>

      {/* Swipeable row content */}
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.rowContent,
            rowAnimatedStyle,
            { backgroundColor: colors.background },
          ]}
        >
          {/* Active tint overlay */}
          {isActive && (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.accent, opacity: 0.12, borderRadius: 8 },
              ]}
            />
          )}
          <Animated.View style={pressStyle}>
            <Pressable
              onPress={onSelect}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onLongPress={handleLongPress}
              delayLongPress={LONG_PRESS_DURATION}
              style={styles.rowPressable}
              accessibilityRole="button"
              accessibilityLabel={
                isActive ? `${session.title}, active session` : session.title
              }
              accessibilityState={{ selected: isActive }}
              accessibilityActions={[
                { name: 'delete', label: 'Delete session' },
                { name: 'rename', label: 'Rename session' },
              ]}
              onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'delete') {
                  onDelete();
                } else if (event.nativeEvent.actionName === 'rename') {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onRename();
                }
              }}
            >
              <Text
                style={[
                  styles.title,
                  { color: titleColor, fontWeight: titleWeight as '400' | '600' },
                ]}
                numberOfLines={1}
              >
                {session.title}
              </Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

/** Trash icon for the delete button */
function TrashIcon({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 1,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_BUTTON_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  deleteButtonPressable: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: {
    borderRadius: 8,
  },
  rowPressable: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
});
