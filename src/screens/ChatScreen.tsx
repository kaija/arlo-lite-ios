import React, { useRef, useEffect } from 'react';
import {
  View,
  FlatList,
  Text,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageInput } from '@/components/chat/MessageInput';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { NetworkStatus } from '@/components/common/NetworkStatus';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { useChat } from '@/hooks/useChat';
import { useNetwork } from '@/hooks/useNetwork';
import { useMessageActions } from '@/hooks/useMessageActions';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Main chat screen displaying the message list with auto-scroll,
 * keyboard avoidance, message input, and streaming state.
 */
export function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const messages = useSessionStore((state) =>
    activeSessionId ? (state.messages[activeSessionId] ?? []) : []
  );

  const { isStreaming, streamContent, thinkingContent } = useChatStore();
  const { sendMessage, stopGeneration, error, retry, clearError } = useChat();
  const { copyMessage, regenerate, editMessage, isLastAssistantMessage } = useMessageActions();
  const { isConnected } = useNetwork();

  // Get active model capabilities for attachment support
  const activeModelId = useChatStore((state) => state.activeModelId);
  const activeProviderId = useChatStore((state) => state.activeProviderId);
  const models = useProviderStore((state) => state.models);
  const activeModel = models.find(
    (m) => m.providerId === activeProviderId && m.modelId === activeModelId
  );

  const flatListRef = useRef<FlatList<Message>>(null);

  // Auto-scroll to bottom when new messages arrive or stream content updates
  useEffect(() => {
    if ((messages.length > 0 || streamContent) && flatListRef.current) {
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length, streamContent]);

  function renderMessage({ item }: { item: Message }) {
    return (
      <MessageBubble
        message={item}
        isLastAssistant={isLastAssistantMessage(item)}
        onCopy={copyMessage}
        onRegenerate={regenerate}
        onEdit={editMessage}
      />
    );
  }

  function renderEmptyState() {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>{t('chat.newSession')}</Text>
        <Text style={styles.emptySubtitle}>
          {t('chat.emptySubtitle', 'Start a conversation by typing a message below.')}
        </Text>
      </View>
    );
  }

  /**
   * Footer shows streaming content in progress and/or error banners.
   */
  function renderFooter() {
    return (
      <>
        {isStreaming && streamContent ? (
          <View style={styles.streamingContainer}>
            <Text style={styles.roleLabel}>
              {t('chat.roleAssistant', 'Assistant')}
            </Text>
            <Text style={styles.streamingText} selectable>
              {streamContent}
              <Text style={styles.cursor}>{'\u258C'}</Text>
            </Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorContainer}>
            <ErrorBanner
              message={error.message}
              detail={error.detail}
              onRetry={error.isRetryable ? retry : undefined}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <NetworkStatus isOffline={!isConnected} />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        contentContainerStyle={
          messages.length === 0 && !isStreaming ? styles.emptyListContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />

      <MessageInput
        onSend={sendMessage}
        onStop={stopGeneration}
        isStreaming={isStreaming}
        disabled={!activeSessionId}
        supportsImageInput={activeModel?.supportsImageInput ?? false}
        supportsFileInput={activeModel?.supportsFileInput ?? false}
      />
    </KeyboardAvoidingView>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
  };

  const listContent: ViewStyle = {
    paddingVertical: theme.spacing.sm,
  };

  const emptyListContent: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const emptyContainer: ViewStyle = {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxxl,
  };

  const emptyTitle: TextStyle = {
    ...theme.typography.title2,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  };

  const emptySubtitle: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  };

  const streamingContainer: ViewStyle = {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  };

  const roleLabel: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const streamingText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
  };

  const cursor: TextStyle = {
    color: theme.colors.accent,
  };

  const errorContainer: ViewStyle = {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  };

  return StyleSheet.create({
    container,
    listContent,
    emptyListContent,
    emptyContainer,
    emptyTitle,
    emptySubtitle,
    streamingContainer,
    roleLabel,
    streamingText,
    cursor,
    errorContainer,
  });
}
