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
import { useSessionStore } from '@/stores/session-store';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Main chat screen displaying the message list with auto-scroll,
 * keyboard avoidance, and an empty state for new chats.
 */
export function ChatScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const messages = useSessionStore((state) =>
    activeSessionId ? (state.messages[activeSessionId] ?? []) : []
  );

  const flatListRef = useRef<FlatList<Message>>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Use a small timeout to ensure the FlatList has rendered new items
      const timer = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  function renderMessage({ item }: { item: Message }) {
    return <MessageBubble message={item} />;
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={
          messages.length === 0 ? styles.emptyListContent : styles.listContent
        }
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
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

  return StyleSheet.create({
    container,
    listContent,
    emptyListContent,
    emptyContainer,
    emptyTitle,
    emptySubtitle,
  });
}
