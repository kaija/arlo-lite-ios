import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { EqualiserAnimation } from '@/components/input/EqualiserAnimation';
import { ThinkingDisclosure } from '@/components/chat/ThinkingDisclosure';

export interface StreamingMessageProps {
  /** The streamed content so far. */
  content: string;
  /** Thinking/reasoning content while in thinking phase. */
  thinkingContent: string;
  /** Whether the model is currently in the thinking phase. */
  isThinking: boolean;
  /** Display name of the active model. */
  modelName: string;
  /** Current token rate in tokens per second (rolling 2s average). */
  tokenRate: number;
  /** Whether to show the avatar column. */
  showAvatars: boolean;
}

/** Duration for cursor blink half-cycle (on or off) in ms. */
const CURSOR_BLINK_DURATION = 500;

/** Width of the blinking cursor bar in points. */
const CURSOR_WIDTH = 2.5;

/** Height of the blinking cursor bar in points. */
const CURSOR_HEIGHT = 18;

/** Duration for the completion wind-down animation in ms. */
const WIND_DOWN_DURATION = 300;

/** Threshold in seconds before token rate shows "stalled". */
const STALL_THRESHOLD_SECONDS = 3;

/**
 * StreamingMessage renders the active streaming state of an assistant message.
 *
 * Displays:
 * - Model name with token rate (or "stalled" label) on the header row
 * - Thinking disclosure (collapsible reasoning content) during thinking phase
 * - Streaming content text with a blinking accent-colored cursor
 * - Equaliser animation indicating active generation
 *
 * The blinking cursor, token rate display, and equaliser are removed within
 * 300ms when streaming completes (parent should unmount or pass empty content).
 *
 * Requirements: 4.1, 4.2, 4.6, 4.8
 */
export function StreamingMessage({
  content,
  thinkingContent,
  isThinking,
  modelName,
  tokenRate,
  showAvatars,
}: StreamingMessageProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [isStalled, setIsStalled] = useState(false);

  // Track how long the token rate has been zero to detect stall
  const stallTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tokenRate > 0) {
      setIsStalled(false);
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    } else {
      // Start stall timer if not already running
      if (!stallTimerRef.current) {
        stallTimerRef.current = setTimeout(() => {
          setIsStalled(true);
        }, STALL_THRESHOLD_SECONDS * 1000);
      }
    }

    return () => {
      if (stallTimerRef.current) {
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [tokenRate]);

  // Blinking cursor animation
  const cursorOpacity = useSharedValue(1);

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, {
          duration: CURSOR_BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(1, {
          duration: CURSOR_BLINK_DURATION,
          easing: Easing.inOut(Easing.ease),
        }),
      ),
      -1, // infinite
      false,
    );

    return () => {
      cancelAnimation(cursorOpacity);
    };
  }, [cursorOpacity]);

  const cursorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }));

  const toggleThinking = useCallback(() => {
    setThinkingExpanded((prev) => !prev);
  }, []);

  /**
   * Format the token rate for display.
   * Shows "stalled" when zero for > 3s, otherwise "X.X tok/s".
   */
  const formattedRate = isStalled
    ? t('chat.stalled', { defaultValue: 'stalled' })
    : `${tokenRate.toFixed(1)} tok/s`;

  return (
    <View style={styles.container}>
      {/* Model name row with token rate */}
      <View style={styles.headerRow}>
        {showAvatars && (
          <View style={[styles.avatar, { backgroundColor: `${theme.colors.accent}24` }]} />
        )}
        <View style={styles.headerContent}>
          <Text
            style={styles.modelName}
            numberOfLines={1}
            accessibilityRole="text"
          >
            {modelName}
          </Text>
          <View style={styles.rateContainer}>
            <Text
              style={[
                styles.tokenRate,
                isStalled && styles.stalledText,
              ]}
              accessibilityLabel={
                isStalled
                  ? t('accessibility.streamStalled', { defaultValue: 'Stream stalled' })
                  : t('accessibility.tokenRate', {
                      defaultValue: `${tokenRate.toFixed(1)} tokens per second`,
                    })
              }
            >
              {formattedRate}
            </Text>
            <EqualiserAnimation isActive={true} />
          </View>
        </View>
      </View>

      {/* Thinking disclosure */}
      {isThinking && thinkingContent.length > 0 && (
        <ThinkingDisclosure
          content={thinkingContent}
          isExpanded={thinkingExpanded}
          onToggle={toggleThinking}
        />
      )}

      {/* Streaming content with blinking cursor */}
      <View style={styles.contentRow}>
        {showAvatars && <View style={styles.avatarSpacer} />}
        <View style={styles.contentContainer}>
          {content.length > 0 && (
            <Text style={styles.contentText} selectable>
              {content}
            </Text>
          )}
          <Animated.View
            style={[styles.cursor, cursorAnimatedStyle]}
            accessibilityLabel={t('accessibility.streamingCursor', {
              defaultValue: 'Generating response',
            })}
          />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    paddingHorizontal: 18,
    paddingVertical: 8,
  };

  const headerRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  };

  const avatar: ViewStyle = {
    width: 23,
    height: 23,
    borderRadius: 7,
    marginRight: 8,
  };

  const headerContent: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const modelName: TextStyle = {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.accent,
    flexShrink: 1,
  };

  const rateContainer: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  };

  const tokenRate: TextStyle = {
    ...theme.typography.caption2,
    fontFamily: (theme.typography.code as TextStyle).fontFamily,
    color: theme.colors.textTertiary,
  };

  const stalledText: TextStyle = {
    color: theme.colors.contextWarning,
  };

  const contentRow: ViewStyle = {
    flexDirection: 'row',
  };

  const avatarSpacer: ViewStyle = {
    width: 23 + 8, // avatar width + margin
  };

  const contentContainer: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
  };

  const contentText: TextStyle = {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  };

  const cursor: ViewStyle = {
    width: CURSOR_WIDTH,
    height: CURSOR_HEIGHT,
    backgroundColor: theme.colors.accent,
    borderRadius: CURSOR_WIDTH / 2,
    marginLeft: 1,
    marginBottom: 2,
  };

  return StyleSheet.create({
    container,
    headerRow,
    avatar,
    headerContent,
    modelName,
    rateContainer,
    tokenRate,
    stalledText,
    contentRow,
    avatarSpacer,
    contentContainer,
    contentText,
    cursor,
  });
}


