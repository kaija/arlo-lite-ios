import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, DrawerActions } from '@react-navigation/native';

import { useTheme, Theme } from '@/theme';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { formatRelativeTime } from '@/utils/date';
import type { Session } from '@/database/repositories/session-repo';

/**
 * SessionListScreen — drawer content showing all sessions ordered
 * by last-modified (most recent first). Supports creating new sessions,
 * inline rename, and delete with confirmation.
 */
export function SessionListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);
  const navigation = useNavigation();

  const sessions = useSessionStore((state) => state.sessions);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const createSession = useSessionStore((state) => state.createSession);
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const renameSession = useSessionStore((state) => state.renameSession);

  const activeProviderId = useChatStore((state) => state.activeProviderId);
  const activeModelId = useChatStore((state) => state.activeModelId);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const handleNewSession = useCallback(async () => {
    const providerId = activeProviderId ?? 'default';
    const modelId = activeModelId ?? 'default';
    const sessionId = await createSession(providerId, modelId);
    await setActiveSession(sessionId);
    navigation.dispatch(DrawerActions.closeDrawer());
  }, [activeProviderId, activeModelId, createSession, setActiveSession, navigation]);

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      await setActiveSession(sessionId);
      navigation.dispatch(DrawerActions.closeDrawer());
    },
    [setActiveSession, navigation]
  );

  const handleLongPress = useCallback(
    (session: Session) => {
      Alert.alert(session.title, undefined, [
        {
          text: t('sessions.rename'),
          onPress: () => {
            setRenamingId(session.id);
            setRenameText(session.title);
          },
        },
        {
          text: t('sessions.delete'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('sessions.deleteTitle'),
              t('sessions.deleteConfirm'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('common.confirm'),
                  style: 'destructive',
                  onPress: () => deleteSession(session.id),
                },
              ]
            );
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
    },
    [t, deleteSession]
  );

  const handleRenameSubmit = useCallback(
    async (sessionId: string) => {
      const trimmed = renameText.trim();
      if (trimmed.length > 0) {
        await renameSession(sessionId, trimmed);
      }
      setRenamingId(null);
      setRenameText('');
    },
    [renameText, renameSession]
  );

  const renderSessionItem = useCallback(
    ({ item }: { item: Session }) => {
      const isRenaming = renamingId === item.id;
      const relativeTime = formatRelativeTime(item.updatedAt);

      if (isRenaming) {
        return (
          <View style={styles.sessionItem}>
            <TextInput
              style={styles.renameInput}
              value={renameText}
              onChangeText={setRenameText}
              onSubmitEditing={() => handleRenameSubmit(item.id)}
              onBlur={() => handleRenameSubmit(item.id)}
              autoFocus
              selectTextOnFocus
              returnKeyType="done"
              accessibilityLabel={t('sessions.rename')}
            />
          </View>
        );
      }

      return (
        <TouchableOpacity
          style={styles.sessionItem}
          onPress={() => handleSelectSession(item.id)}
          onLongPress={() => handleLongPress(item)}
          accessibilityLabel={t('accessibility.sessionItem', {
            title: item.title,
            date: relativeTime,
          })}
          accessibilityRole="button"
        >
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.sessionDate}>{relativeTime}</Text>
        </TouchableOpacity>
      );
    },
    [
      renamingId,
      renameText,
      styles,
      t,
      handleSelectSession,
      handleLongPress,
      handleRenameSubmit,
    ]
  );

  const renderEmptyState = useCallback(() => {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('sessions.empty')}</Text>
      </View>
    );
  }, [styles, t]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('sessions.title')}</Text>
      </View>

      <TouchableOpacity
        style={styles.newSessionButton}
        onPress={handleNewSession}
        accessibilityLabel={t('accessibility.newChatButton')}
        accessibilityRole="button"
      >
        <Text style={styles.newSessionText}>{t('sessions.newSession')}</Text>
      </TouchableOpacity>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderSessionItem}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={sessions.length === 0 ? styles.emptyListContent : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: theme.spacing.xxxl,
  };

  const header: ViewStyle = {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  };

  const headerTitle: TextStyle = {
    ...theme.typography.title2,
    color: theme.colors.text,
    fontWeight: '700',
  };

  const newSessionButton: ViewStyle = {
    marginHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadii.md,
    alignItems: 'center',
  };

  const newSessionText: TextStyle = {
    ...theme.typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  };

  const sessionItem: ViewStyle = {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  };

  const sessionTitle: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  };

  const sessionDate: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
  };

  const renameInput: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    borderRadius: theme.borderRadii.sm,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  };

  const emptyContainer: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xxxl,
  };

  const emptyText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  };

  const emptyListContent: ViewStyle = {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  };

  return StyleSheet.create({
    container,
    header,
    headerTitle,
    newSessionButton,
    newSessionText,
    sessionItem,
    sessionTitle,
    sessionDate,
    renameInput,
    emptyContainer,
    emptyText,
    emptyListContent,
  });
}
