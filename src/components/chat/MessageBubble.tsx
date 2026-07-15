import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-native-markdown-display';

import { useTheme, Theme } from '@/theme';
import { CodeBlock } from './CodeBlock';
import { ImageDisplay } from './ImageDisplay';
import { MessageActions } from './MessageActions';
import type { Message } from '@/database/repositories/message-repo';

export interface MessageBubbleProps {
  /** The message to render */
  message: Message;
  /** Whether this is the last assistant message (enables regenerate action) */
  isLastAssistant?: boolean;
  /** Image URLs to display inline (for generated images or user attachments) */
  imageUrls?: string[];
  /** Handler to copy message content */
  onCopy?: (message: Message) => Promise<void>;
  /** Handler to regenerate the last assistant response */
  onRegenerate?: () => Promise<void>;
  /** Handler to edit a user message */
  onEdit?: (message: Message) => void;
}

/**
 * Full-width message component differentiated by sender label.
 * No chat bubbles — uses role labels and subtle background for user messages.
 * Assistant messages render markdown content including code blocks.
 * Optionally displays action buttons (copy, edit, regenerate) beneath the message.
 */
export function MessageBubble({
  message,
  isLastAssistant = false,
  imageUrls,
  onCopy,
  onRegenerate,
  onEdit,
}: MessageBubbleProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme, message.role);
  const markdownStyles = createMarkdownStyles(theme);

  const roleLabel = message.role === 'user' ? t('chat.roleUser', 'You') : t('chat.roleAssistant', 'Assistant');

  return (
    <View
      style={styles.container}
      accessibilityLabel={`${roleLabel}: ${message.content}`}
      accessibilityRole="text"
    >
      <Text style={styles.roleLabel}>{roleLabel}</Text>
      {message.role === 'assistant' ? (
        <Markdown
          style={markdownStyles}
          rules={{
            fence: (node) => {
              // sourceInfo is set at runtime from markdown-it token.info (the language hint)
              // but isn't declared in the package's TypeScript definitions
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
        <Text style={styles.userText} selectable>
          {message.content}
        </Text>
      )}
      {/* Render inline images (generated images from assistant or user attachments) */}
      {imageUrls && imageUrls.length > 0 && (
        <View>
          {imageUrls.map((url, index) => (
            <ImageDisplay
              key={`img-${index}`}
              url={url}
              alt={message.role === 'assistant' ? t('attachments.generatedImage') : t('attachments.attachedImage', { index: index + 1 })}
            />
          ))}
        </View>
      )}
      {onCopy && onRegenerate && onEdit && (
        <MessageActions
          message={message}
          isLastAssistant={isLastAssistant}
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onEdit={onEdit}
        />
      )}
    </View>
  );
}

function createStyles(theme: Theme, role: string) {
  const isUser = role === 'user';

  const container: ViewStyle = {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: isUser ? theme.colors.surfaceSecondary : 'transparent',
  };

  const roleLabel: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const userText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
  };

  return StyleSheet.create({
    container,
    roleLabel,
    userText,
  });
}

function createMarkdownStyles(theme: Theme) {
  return {
    body: {
      ...theme.typography.body,
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
      backgroundColor: theme.colors.codeBackground,
      color: '#E8E8E8',
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 2,
      borderRadius: theme.borderRadii.sm,
      overflow: 'hidden' as const,
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
    },
    td: {
      ...theme.typography.subheadline,
      color: theme.colors.text,
      padding: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    tr: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.accent,
      paddingLeft: theme.spacing.md,
      marginVertical: theme.spacing.sm,
      opacity: 0.85,
    },
    hr: {
      backgroundColor: theme.colors.border,
      height: StyleSheet.hairlineWidth,
      marginVertical: theme.spacing.lg,
    },
  };
}
