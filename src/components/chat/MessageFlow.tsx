/**
 * MessageFlow — Full-width flowing message layout without chat bubbles.
 *
 * Renders user and assistant messages with sender avatars, labels,
 * token metadata, and action buttons. Uses react-native-reanimated
 * entering animation for new messages (fade-up: translateY(10) + scale(0.98) → identity).
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, { FadeIn } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';

import { useTheme, Theme } from '@/theme';
import { usePressAnimation } from '@/hooks/usePressAnimation';
import { formatTokenMetadata } from '@/utils/token-formatting';
import { CodeBlock } from './CodeBlock';
import { CopyIcon, RegenerateIcon, DeleteIcon } from '@/components/icons';
import type { Message } from '@/database/repositories/message-repo';

export interface MessageFlowProps {
  /** The message to render */
  message: Message;
  /** Resolved display name of the model */
  modelDisplayName: string;
  /** Whether to show the sender avatar */
  showAvatars: boolean;
  /** Whether the message is currently streaming */
  isStreaming: boolean;
  /** Handler to copy message content */
  onCopy: () => void;
  /** Handler to regenerate assistant response */
  onRegenerate: () => void;
  /** Handler to delete message */
  onDelete: () => void;
}

/**
 * Custom entering animation: fade-up with translateY(10) + scale(0.98) → identity over 300ms.
 */
const messageEntering = FadeIn.duration(300).withInitialValues({
  transform: [{ translateY: 10 }, { scale: 0.98 }],
});

/**
 * Full-width flowing text message component.
 *
 * Differentiates user vs assistant by avatar color and label style.
 * Displays token metadata when available, and contextual action buttons
 * (hidden while streaming).
 */
export function MessageFlow({
  message,
  modelDisplayName,
  showAvatars,
  isStreaming,
  onCopy,
  onRegenerate,
  onDelete,
}: MessageFlowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme, message.role);
  const markdownStyles = createMarkdownStyles(theme);

  const isUser = message.role === 'user';
  const senderLabel = isUser
    ? t('chat.roleUser', 'You')
    : modelDisplayName;

  // Cost metadata line: only render when all three fields are non-null
  const formattedMetadata =
    message.promptTokens != null &&
    message.completionTokens != null &&
    message.cost != null
      ? `${formatTokenMetadata(message.promptTokens, message.completionTokens)} · $${message.cost.toFixed(3)}`
      : null;

  const showActions = !isStreaming;

  return (
    <Animated.View
      entering={messageEntering}
      style={styles.container}
      accessibilityLabel={`${senderLabel}: ${message.content}`}
      accessibilityRole="text"
    >
      {/* Sender row: avatar + label + model label + token metadata */}
      <View style={styles.senderRow}>
        {showAvatars && (
          <View style={[styles.avatar, isUser ? styles.userAvatar : styles.assistantAvatar]} />
        )}
        {isUser ? (
          <>
            <Text style={[styles.senderLabel, styles.userLabel]}>
              {senderLabel}
            </Text>
            <Text
              style={[styles.modelLabel, styles.userModelLabel]}
              accessibilityLabel={t('accessibility.modelLabel', { model: modelDisplayName })}
            >
              {modelDisplayName}
            </Text>
          </>
        ) : (
          <Text
            style={[styles.senderLabel, styles.assistantLabel]}
            accessibilityLabel={t('accessibility.modelLabel', { model: modelDisplayName })}
          >
            {senderLabel}
          </Text>
        )}
        {formattedMetadata && (
          <Text style={styles.tokenMetadata}>{formattedMetadata}</Text>
        )}
      </View>

      {/* Message body */}
      <View style={styles.bodyContainer}>
        {message.role === 'assistant' ? (
          <Markdown
            style={markdownStyles}
            rules={{
              fence: (node) => {
                const language = (node as unknown as { sourceInfo?: string }).sourceInfo || undefined;
                const code = node.content || '';
                return (
                  <CodeBlock
                    key={node.key}
                    code={code.replace(/\n$/, '')}
                    language={language}
                  />
                );
              },
              code_inline: (node) => (
                <Text key={node.key} style={markdownStyles.code_inline}>
                  {node.content}
                </Text>
              ),
            }}
          >
            {message.content}
          </Markdown>
        ) : (
          <Text style={styles.bodyText} selectable>
            {message.content}
          </Text>
        )}
      </View>

      {/* Action buttons — hidden while streaming */}
      {showActions && (
        <View style={styles.actionsRow}>
          <ActionButton
            icon={<CopyIcon size={20} color={theme.colors.textTertiary} />}
            accessibilityLabel={t('accessibility.copyButton', 'Copy message')}
            onPress={onCopy}
          />
          {!isUser && (
            <ActionButton
              icon={<RegenerateIcon size={20} color={theme.colors.textTertiary} />}
              accessibilityLabel={t('accessibility.regenerateButton', 'Regenerate response')}
              onPress={onRegenerate}
            />
          )}
          <ActionButton
            icon={<DeleteIcon size={20} color={theme.colors.textTertiary} />}
            accessibilityLabel={t('accessibility.deleteButton', 'Delete message')}
            onPress={onDelete}
          />
        </View>
      )}
    </Animated.View>
  );
}

// ─── Action Button ─────────────────────────────────────────────────────────────

interface ActionButtonProps {
  icon: React.ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
}

/**
 * Individual action button with 44×44 tap target and press animation.
 * Renders an SVG icon instead of a text label.
 */
function ActionButton({ icon, accessibilityLabel, onPress }: ActionButtonProps) {
  const { animatedStyle, onPressIn, onPressOut } = usePressAnimation();

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={actionButtonStyles.pressable}
      >
        {icon}
      </Pressable>
    </Animated.View>
  );
}

const actionButtonStyles = StyleSheet.create({
  pressable: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

// ─── Styles ────────────────────────────────────────────────────────────────────

function createStyles(theme: Theme, role: string) {
  const isUser = role === 'user';

  const container: ViewStyle = {
    paddingHorizontal: 18,
    marginBottom: 26,
  };

  const senderRow: ViewStyle = {
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

  const userAvatar: ViewStyle = {
    backgroundColor: theme.colors.surfaceSecondary,
  };

  const assistantAvatar: ViewStyle = {
    backgroundColor: `${theme.colors.accent}24`, // 14% accent opacity
  };

  const senderLabel: TextStyle = {
    fontSize: 13,
    fontWeight: '600',
  };

  const userLabel: TextStyle = {
    color: theme.colors.textSecondary,
  };

  const assistantLabel: TextStyle = {
    color: theme.colors.accent,
  };

  const modelLabel: TextStyle = {
    fontSize: 13,
    fontWeight: '400',
  };

  const userModelLabel: TextStyle = {
    color: theme.colors.textTertiary,
    marginLeft: 6,
  };

  const tokenMetadata: TextStyle = {
    fontSize: 11,
    fontWeight: '400',
    color: theme.colors.textTertiary,
    marginLeft: 'auto',
    ...(Platform.OS === 'ios'
      ? { fontFamily: 'Menlo' }
      : { fontFamily: 'monospace' }),
  };

  const bodyContainer: ViewStyle = {
    // Full-width, no extra horizontal padding beyond container's 18px
  };

  const bodyText: TextStyle = {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  };

  const actionsRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 16,
  };

  return StyleSheet.create({
    container,
    senderRow,
    avatar,
    userAvatar,
    assistantAvatar,
    senderLabel,
    userLabel,
    assistantLabel,
    modelLabel,
    userModelLabel,
    tokenMetadata,
    bodyContainer,
    bodyText,
    actionsRow,
  });
}

function createMarkdownStyles(theme: Theme) {
  return {
    body: {
      fontSize: 15,
      lineHeight: 22,
      color: theme.colors.text,
    },
    heading1: {
      ...theme.typography.title1,
      color: theme.colors.text,
      marginTop: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    heading2: {
      ...theme.typography.title2,
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    heading3: {
      ...theme.typography.title3,
      color: theme.colors.text,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    paragraph: {
      marginBottom: theme.spacing.sm,
    },
    strong: {
      fontWeight: '700' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    link: {
      color: theme.colors.accent,
      textDecorationLine: 'underline' as const,
    },
    list_item: {
      marginBottom: theme.spacing.xs,
    },
    bullet_list: {
      marginBottom: theme.spacing.sm,
    },
    ordered_list: {
      marginBottom: theme.spacing.sm,
    },
    code_inline: {
      ...theme.typography.code,
      backgroundColor: theme.colors.inlineCodeBackground,
      color: theme.colors.inlineCodeText,
      paddingHorizontal: theme.spacing.xs + 2, // 6px for comfortable padding
      paddingVertical: 2,
      borderRadius: theme.borderRadii.sm,
    },
    fence: {
      // Handled by custom rule (CodeBlock component)
    },
    table: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadii.sm,
      marginVertical: theme.spacing.sm,
    },
    thead: {
      backgroundColor: theme.colors.surface,
    },
    th: {
      ...theme.typography.subheadline,
      fontWeight: '600' as const,
      color: theme.colors.text,
      padding: theme.spacing.sm,
      borderBottomWidth: 1,
      borderColor: theme.colors.border,
      flexShrink: 1,
    },
    td: {
      ...theme.typography.subheadline,
      color: theme.colors.text,
      padding: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      flexShrink: 1,
    },
    tr: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
      backgroundColor: 'transparent',
      paddingLeft: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      marginVertical: theme.spacing.sm,
    },
    hr: {
      backgroundColor: theme.colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: theme.spacing.lg,
    },
  };
}
