import React, { useCallback, useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { groupSessionsByDate } from '@/utils/session-grouping';
import { SessionRow } from '@/components/sidebar/SessionRow';
import type { Session } from '@/database/repositories/session-repo';

export interface SessionSidebarProps {
  /** All sessions to display, already sorted by updatedAt descending */
  sessions: Session[];
  /** Currently active session ID, or null if none */
  activeSessionId: string | null;
  /** Called when a session row is tapped */
  onSessionSelect: (id: string) => void;
  /** Called when a session should be deleted */
  onSessionDelete: (id: string) => void;
  /** Called when a session should be renamed (opens rename dialog) */
  onSessionRename: (id: string) => void;
  /** Called when the "New Chat" button is tapped */
  onNewChat: () => void;
}

/**
 * Session sidebar with date-grouped list, "New Chat" button, and empty state.
 *
 * Features:
 * - Sessions grouped by date: Today, Yesterday, This Week, This Month, Older
 * - 11px uppercase section headers in tertiary text
 * - Empty state message when no sessions exist
 * - "New Chat" button: 34px circle, tertiary fill, accent compose icon, top-right header
 * - Footer hint text: "Swipe left to delete · hold to rename" (caption2, tertiary)
 * - Semi-transparent overlay (opacity 0.3, black) over chat area handled by parent
 */
export function SessionSidebar({
  sessions,
  activeSessionId,
  onSessionSelect,
  onSessionDelete,
  onSessionRename,
  onNewChat,
}: SessionSidebarProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();

  // Group sessions by date for section rendering
  const sections = useMemo(() => {
    const groups = groupSessionsByDate(sessions);
    return groups.map((group) => ({
      title: group.label,
      data: group.sessions,
    }));
  }, [sessions]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: { title: string } }) => (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionHeaderText, { color: colors.textTertiary }]}>
          {section.title.toUpperCase()}
        </Text>
      </View>
    ),
    [colors.textTertiary]
  );

  const renderItem = useCallback(
    ({ item }: { item: Session }) => (
      <SessionRow
        session={item}
        isActive={item.id === activeSessionId}
        onSelect={() => onSessionSelect(item.id)}
        onDelete={() => onSessionDelete(item.id)}
        onRename={() => onSessionRename(item.id)}
      />
    ),
    [activeSessionId, onSessionSelect, onSessionDelete, onSessionRename]
  );

  const keyExtractor = useCallback((item: Session) => item.id, []);

  const listFooter = useMemo(
    () => (
      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          Swipe left to delete · hold to rename
        </Text>
      </View>
    ),
    [colors.textTertiary]
  );

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No conversations yet
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Tap the compose button to start a new chat
        </Text>
      </View>
    ),
    [colors.textSecondary, colors.textTertiary]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with title and New Chat button */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Chats
        </Text>
        <Pressable
          onPress={onNewChat}
          style={[styles.newChatButton, { backgroundColor: colors.surfaceSecondary }]}
          accessibilityRole="button"
          accessibilityLabel="New chat"
          accessibilityHint="Creates a new chat session"
        >
          <ComposeIcon color={colors.accent} />
        </Pressable>
      </View>

      {/* Session list */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={keyExtractor}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={sessions.length > 0 ? listFooter : null}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

/** Compose/pencil icon for the "New Chat" button */
function ComposeIcon({ color }: { color: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 5v14M5 12h14"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  newChatButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
