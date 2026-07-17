/**
 * ChatShell — Main composition shell for the chat screen.
 *
 * Wraps the entire chat experience: sidebar (z=1), chat layer (z=2),
 * and overlay components (model picker, rename dialog, settings, provider detail, toast).
 *
 * Features:
 * - Edge pan gesture zone (left 24px) wired to `useSidebarTransition`
 * - Applies `chatAnimatedStyle` / `sidebarAnimatedStyle` transforms
 * - Mounts NavigationChrome, MessageList (FlatList with MessageFlow items), InputChrome
 * - Mounts overlays conditionally from UI store
 * - Semi-transparent overlay over chat area when sidebar is open
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 14.1, 14.4
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, interpolate, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import { useSidebarTransition } from '@/hooks/useSidebarTransition';
import { useUIStore } from '@/stores/ui-store';
import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { useChat } from '@/hooks/useChat';
import { useMessageActions } from '@/hooks/useMessageActions';
import { useScrollBehavior } from '@/hooks/useScrollBehavior';

import { NavigationChrome } from '@/components/layout/NavigationChrome';
import { InputChrome } from '@/components/layout/InputChrome';
import { SessionSidebar } from '@/components/sidebar/SessionSidebar';
import { MessageFlow } from '@/components/chat/MessageFlow';
import { StreamingMessage } from '@/components/chat/StreamingMessage';
import { ErrorBanner } from '@/components/chat/ErrorBanner';
import { ModelPicker } from '@/components/overlays/ModelPicker';
import { RenameDialog } from '@/components/overlays/RenameDialog';
import { SettingsScreen } from '@/components/overlays/SettingsScreen';
import { ProviderDetailScreen } from '@/components/overlays/ProviderDetailScreen';
import { ScrollFAB } from '@/components/chat/ScrollFAB';
import { resolveModelName } from '@/utils/resolve-model-name';

import type { Message } from '@/database/repositories/message-repo';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ChatShellProps {
  children?: React.ReactNode;
}

// Stable empty array reference to avoid infinite re-render loops in selectors
const EMPTY_MESSAGES: Message[] = [];

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Main chat screen composition shell.
 *
 * Manages the sidebar transition gesture, renders the z-ordered layer stack,
 * and mounts overlay components conditionally based on UI store state.
 */
export function ChatShell({ children }: ChatShellProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // ─── Sidebar Transition ─────────────────────────────────────────────

  const {
    progress,
    chatAnimatedStyle,
    sidebarAnimatedStyle,
    panGesture,
    close: closeSidebar,
    toggle: toggleSidebar,
  } = useSidebarTransition();

  // ─── UI Store ───────────────────────────────────────────────────────

  const {
    settingsVisible,
    providerDetailId,
    modelPickerVisible,
    renameSessionId,
    openSettings,
    closeSettings,
    openModelPicker,
    closeModelPicker,
    openRename,
    closeRename,
    openProviderDetail,
    closeProviderDetail,
  } = useUIStore();

  // ─── Session Store ──────────────────────────────────────────────────

  const sessions = useSessionStore((state) => state.sessions);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const messagesMap = useSessionStore((state) => state.messages);
  const messages = (activeSessionId ? messagesMap[activeSessionId] : undefined) ?? EMPTY_MESSAGES;
  const deleteSession = useSessionStore((state) => state.deleteSession);
  const deleteMessage = useSessionStore((state) => state.deleteMessage);
  const renameSession = useSessionStore((state) => state.renameSession);
  const createSession = useSessionStore((state) => state.createSession);
  const setActiveSession = useSessionStore((state) => state.setActiveSession);
  const updateSession = useSessionStore((state) => state.updateSession);

  // ─── Chat Store ─────────────────────────────────────────────────────

  const {
    isStreaming,
    streamContent,
    thinkingContent,
    thinkingLevel,
    activeProviderId,
    activeModelId,
  } = useChatStore();
  const setThinkingLevel = useChatStore((state) => state.setThinkingLevel);
  const switchModel = useChatStore((state) => state.switchModel);

  // ─── Provider Store ─────────────────────────────────────────────────

  const providers = useProviderStore((state) => state.providers);
  const models = useProviderStore((state) => state.models);
  const activeModel = models.find(
    (m) => m.providerId === activeProviderId && m.modelId === activeModelId,
  );

  // If no active model but models exist, auto-select the first one
  useEffect(() => {
    if (!activeModel && providers.length > 0 && models.length > 0) {
      // Try to restore from active session first
      if (activeSessionId) {
        const session = sessions.find((s) => s.id === activeSessionId);
        if (session?.providerId && session?.modelId) {
          const sessionModel = models.find(
            (m) => m.providerId === session.providerId && m.modelId === session.modelId
          );
          if (sessionModel) {
            switchModel(session.providerId, session.modelId);
            return;
          }
        }
      }
      // Fall back to first available model
      const firstProvider = providers[0];
      const firstModel = models.find((m) => m.providerId === firstProvider.id);
      if (firstModel) {
        switchModel(firstProvider.id, firstModel.modelId);
      }
    }
  }, [activeModel, activeSessionId, sessions, providers, models, switchModel]);

  // ─── Chat Hook ──────────────────────────────────────────────────────

  const { sendMessage: rawSendMessage, stopGeneration, tokenRate, error, retry, clearError } = useChat();
  const { copyMessage, regenerateFrom } = useMessageActions();

  // ─── FlatList Ref ───────────────────────────────────────────────────

  const {
    flatListRef,
    showFAB,
    onScroll,
    onContentSizeChange,
    onLayout,
    scrollToBottom,
    onMessageSent,
  } = useScrollBehavior(messages.length);

  /** Wraps sendMessage to trigger auto-scroll on send. */
  const sendMessage = useCallback(
    async (text: string, attachments?: any) => {
      onMessageSent();
      await rawSendMessage(text, attachments);
    },
    [rawSendMessage, onMessageSent]
  );

  // ─── Sidebar Sync ──────────────────────────────────────────────────

  // Sync UI store sidebar state with the transition hook
  const handleSidebarToggle = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  // ─── Dim Overlay Animated Style ─────────────────────────────────────

  // Track whether sidebar has any progress (for pointer events control)
  const [sidebarActive, setSidebarActive] = useState(false);

  useAnimatedReaction(
    () => progress.value > 0,
    (isActive) => {
      runOnJS(setSidebarActive)(isActive);
    },
    [progress],
  );

  // Animated opacity for the semi-transparent overlay when sidebar is open
  const dimOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.3]),
  }));

  // ─── Session Handlers ───────────────────────────────────────────────

  const handleSessionSelect = useCallback(
    (id: string) => {
      setActiveSession?.(id);

      // Restore model and thinking level from the selected session
      const session = sessions.find((s) => s.id === id);
      if (session) {
        if (session.providerId && session.modelId) {
          // Verify the model still exists in the store
          const modelExists = models.find(
            (m) => m.providerId === session.providerId && m.modelId === session.modelId
          );
          if (modelExists) {
            switchModel(session.providerId, session.modelId);
          } else if (providers.length > 0 && models.length > 0) {
            // Model was deleted — fall back to first available
            const firstProvider = providers[0];
            const firstModel = models.find((m) => m.providerId === firstProvider.id);
            if (firstModel) {
              switchModel(firstProvider.id, firstModel.modelId);
            }
          }
        } else if (providers.length > 0 && models.length > 0) {
          // Session has no model stored — use first available
          const firstProvider = providers[0];
          const firstModel = models.find((m) => m.providerId === firstProvider.id);
          if (firstModel) {
            switchModel(firstProvider.id, firstModel.modelId);
          }
        }
        if (session.thinkingLevel) {
          setThinkingLevel(session.thinkingLevel as typeof thinkingLevel);
        } else {
          setThinkingLevel('off');
        }
      }

      closeSidebar();
    },
    [setActiveSession, sessions, providers, models, switchModel, setThinkingLevel, thinkingLevel, closeSidebar],
  );

  const handleSessionDelete = useCallback(
    (id: string) => {
      deleteSession(id);
    },
    [deleteSession],
  );

  const handleSessionRename = useCallback(
    (id: string) => {
      openRename(id);
    },
    [openRename],
  );

  const handleNewChat = useCallback(async () => {
    let providerId = activeProviderId;
    let modelId = activeModelId;

    // If no model active, pick the first available
    if (!providerId || !modelId) {
      if (providers.length > 0 && models.length > 0) {
        const firstProvider = providers[0];
        const firstModel = models.find((m) => m.providerId === firstProvider.id);
        if (firstModel) {
          providerId = firstProvider.id;
          modelId = firstModel.modelId;
        }
      }
    }

    try {
      if (providerId && modelId) {
        const newSessionId = await createSession(providerId, modelId);
        await setActiveSession(newSessionId);
        switchModel(providerId, modelId);
      }
    } catch (error) {
      // Log but don't crash — session creation failures shouldn't block UI
      console.warn('[handleNewChat] Failed to create session:', error);
    } finally {
      closeSidebar();
    }
  }, [activeProviderId, activeModelId, providers, models, createSession, setActiveSession, switchModel, closeSidebar]);

  // ─── Delete Message Handler ──────────────────────────────────────────

  const handleDeleteMessage = useCallback(
    (messageId: string) => {
      Alert.alert(
        t('chat.deleteMessage', 'Delete Message'),
        t('chat.deleteMessageConfirm', 'Are you sure you want to delete this message?'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('common.delete', 'Delete'),
            style: 'destructive',
            onPress: () => {
              if (activeSessionId) {
                deleteMessage(activeSessionId, messageId);
              }
            },
          },
        ],
      );
    },
    [activeSessionId, deleteMessage, t],
  );

  // ─── Rename Handlers ────────────────────────────────────────────────

  const renameCurrentTitle = useCallback(() => {
    if (!renameSessionId) return '';
    const session = sessions.find((s) => s.id === renameSessionId);
    return session?.title ?? '';
  }, [renameSessionId, sessions]);

  const handleRenameSave = useCallback(
    (newTitle: string) => {
      if (renameSessionId) {
        renameSession(renameSessionId, newTitle);
      }
      closeRename();
    },
    [renameSessionId, renameSession, closeRename],
  );

  // ─── Model Picker Handlers ─────────────────────────────────────────

  const handleModelSelect = useCallback(
    (providerId: string, modelId: string) => {
      switchModel(providerId, modelId);

      // Reset thinking level if the new model doesn't support reasoning (Req 1.4)
      const newModel = models.find(
        (m) => m.providerId === providerId && m.modelId === modelId,
      );
      if (!newModel?.supportsReasoning) {
        setThinkingLevel('off');
      }

      // Persist model selection to the active session
      if (activeSessionId) {
        updateSession(activeSessionId, { providerId, modelId });
      }
      closeModelPicker();
    },
    [switchModel, models, setThinkingLevel, activeSessionId, updateSession, closeModelPicker],
  );

  // ─── Thinking Level Cycle ───────────────────────────────────────────

  const handleThinkingCycle = useCallback(() => {
    const levels: Array<typeof thinkingLevel> = [
      'off',
      'minimal',
      'low',
      'medium',
      'high',
      'xhigh',
    ];
    const currentIndex = levels.indexOf(thinkingLevel);
    const nextIndex = (currentIndex + 1) % levels.length;
    const nextLevel = levels[nextIndex];
    setThinkingLevel(nextLevel);

    // Persist the new thinking level to the active session
    if (activeSessionId) {
      updateSession(activeSessionId, { thinkingLevel: nextLevel });
    }
  }, [thinkingLevel, setThinkingLevel, activeSessionId, updateSession]);

  // ─── Context Usage ──────────────────────────────────────────────────

  // Calculate approximate context usage percentage
  const contextUsagePercent = useCallback(() => {
    if (!activeModel?.contextWindow) return 0;
    // Rough token count: sum of message content lengths / 4 (avg chars per token)
    const totalChars = messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0);
    const approxTokens = Math.ceil(totalChars / 4);
    return Math.min(Math.round((approxTokens / activeModel.contextWindow) * 100), 100);
  }, [messages, activeModel])();

  // ─── Active Session Title ───────────────────────────────────────────

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle = activeSession?.title ?? t('chat.newSession', 'New Chat');

  // ─── Render Message Item ────────────────────────────────────────────

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <MessageFlow
        message={item}
        modelDisplayName={resolveModelName(item.modelId, models)}
        showAvatars={true}
        isStreaming={false}
        onCopy={() => copyMessage(item)}
        onRegenerate={() => regenerateFrom(item.id)}
        onDelete={() => handleDeleteMessage(item.id)}
      />
    ),
    [models, copyMessage, regenerateFrom, handleDeleteMessage],
  );

  // ─── Render Footer (Streaming) ─────────────────────────────────────

  const renderFooter = useCallback(() => {
    const streamingFooter =
      isStreaming ? (
        <StreamingMessage
          content={streamContent}
          thinkingContent={thinkingContent}
          isThinking={!!thinkingContent && !streamContent}
          modelName={activeModel?.displayName ?? 'Assistant'}
          tokenRate={tokenRate}
          showAvatars={true}
        />
      ) : null;

    const errorFooter =
      error && !isStreaming ? (
        <ErrorBanner
          message={error.message}
          detail={error.detail}
          isRetryable={error.isRetryable}
          onRetry={retry}
          onDismiss={clearError}
        />
      ) : null;

    if (!streamingFooter && !errorFooter) return null;

    return (
      <>
        {streamingFooter}
        {errorFooter}
      </>
    );
  }, [isStreaming, streamContent, thinkingContent, activeModel, error, retry, clearError]);

  // ─── Render Empty State ─────────────────────────────────────────────

  const renderEmptyState = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('chat.newSession', 'New Chat')}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
          {t('chat.emptySubtitle', 'Start a conversation by typing a message below.')}
        </Text>
      </View>
    ),
    [colors, t],
  );

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={panGesture}>
        <View style={[styles.layerContainer, { backgroundColor: colors.background }]}>
          {/* Layer 1: Sidebar (z=1) */}
          <Animated.View
            style={[
              styles.sidebarLayer,
              sidebarAnimatedStyle,
            ]}
          >
            <SessionSidebar
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSessionSelect={handleSessionSelect}
              onSessionDelete={handleSessionDelete}
              onSessionRename={handleSessionRename}
              onNewChat={handleNewChat}
            />
          </Animated.View>

          {/* Layer 2: Chat Layer (z=2) */}
          <Animated.View
            pointerEvents={sidebarActive ? 'none' : 'auto'}
            style={[
              styles.chatLayer,
              { backgroundColor: colors.background },
              chatAnimatedStyle,
            ]}
          >
            {/* Semi-transparent dim overlay (visual only when sidebar is open; 
                 touch handling is disabled by parent pointerEvents="none") */}
            <Animated.View
              style={[styles.dimOverlay, dimOverlayStyle]}
              pointerEvents="none"
            >
            </Animated.View>

            {/* Navigation Chrome */}
            <NavigationChrome
              title={sessionTitle}
              onSidebarToggle={handleSidebarToggle}
              onSettingsOpen={openSettings}
            />

            {/* Message List */}
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              ListEmptyComponent={renderEmptyState}
              ListFooterComponent={renderFooter}
              contentContainerStyle={[
                styles.listContent,
                { paddingTop: insets.top + 44 + 8 }, // below nav chrome
              ]}
              onScroll={onScroll}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />

            {/* Scroll to Bottom FAB */}
            <ScrollFAB visible={showFAB} onPress={scrollToBottom} />

            {/* Input Chrome */}
            <InputChrome
              activeModelName={activeModel?.displayName ?? 'Select Model'}
              thinkingLevel={thinkingLevel}
              supportsThinking={activeModel?.supportsReasoning ?? false}
              contextUsagePercent={contextUsagePercent}
              isStreaming={isStreaming}
              onModelPickerOpen={openModelPicker}
              onThinkingCycle={handleThinkingCycle}
              onSend={sendMessage}
              onStop={stopGeneration}
              onAttach={() => {
                // Attachment functionality handled by separate flow
              }}
            />

            {/* Optional children */}
            {children}
          </Animated.View>

          {/* Overlay Layer: Model Picker (z=7) */}
          {modelPickerVisible && (
            <ModelPicker
              visible={modelPickerVisible}
              models={models}
              activeModelId={activeModel?.id ?? null}
              onSelect={handleModelSelect}
              onDismiss={closeModelPicker}
            />
          )}

          {/* Overlay Layer: Settings (z=8) */}
          <SettingsScreen
            visible={settingsVisible}
            onClose={closeSettings}
          />

          {/* Overlay Layer: Provider Detail (z=9) */}
          {providerDetailId != null && (
            <ProviderDetailScreen
              visible={providerDetailId != null}
              providerId={providerDetailId}
              onClose={closeProviderDetail}
            />
          )}

          {/* Overlay Layer: Rename Dialog (z=9) */}
          {renameSessionId != null && (
            <RenameDialog
              visible={renameSessionId != null}
              currentTitle={renameCurrentTitle()}
              onSave={handleRenameSave}
              onCancel={closeRename}
            />
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  layerContainer: {
    flex: 1,
    overflow: 'hidden',
  },
  sidebarLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  chatLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    overflow: 'hidden',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    zIndex: 10,
  },
  listContent: {
    paddingBottom: 16,
    paddingHorizontal: 0,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 120,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
