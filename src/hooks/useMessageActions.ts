/**
 * useMessageActions hook — orchestrates regenerate and edit message flows.
 *
 * Handles:
 * - Regenerate: rebuilds context up to last user message, resends to provider, replaces assistant response
 * - Edit: updates user message content, discards subsequent messages, resends with new content
 * - Copy: copies full message text to clipboard
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useChat } from '@/hooks/useChat';
import { buildRegenerationContext } from '@/domain/session-manager';
import { copyToClipboard } from '@/utils/clipboard';
import { useToast } from '@/components/overlays/ToastProvider';
import type { Message } from '@/database/repositories/message-repo';

/** Stable empty array to avoid infinite re-render loops in selectors */
const EMPTY_MESSAGES: Message[] = [];

export interface UseMessageActionsResult {
  /** Copy message content to clipboard */
  copyMessage: (message: Message) => Promise<void>;
  /** Regenerate the last assistant message */
  regenerate: () => Promise<void>;
  /** Edit a user message (prompts for new text, discards subsequent, resends) */
  editMessage: (message: Message) => void;
  /** Whether the given message is the last assistant message */
  isLastAssistantMessage: (message: Message) => boolean;
}

/**
 * Hook providing message action handlers for copy, regenerate, and edit flows.
 */
export function useMessageActions(): UseMessageActionsResult {
  const { t } = useTranslation();
  const toast = useToast();

  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const messagesMap = useSessionStore((s) => s.messages);
  const messages = (activeSessionId ? messagesMap[activeSessionId] : undefined) ?? EMPTY_MESSAGES;
  const editMessageInStore = useSessionStore((s) => s.editMessage);
  const { resendContext } = useChat();
  const isStreaming = useChatStore((s) => s.isStreaming);

  /**
   * Copy full message text to system clipboard with toast feedback.
   */
  const copyMessage = useCallback(async (message: Message) => {
    await copyToClipboard(message.content);
    toast.show(t('chat.copied', { defaultValue: 'Copied' }));
  }, [toast, t]);

  /**
   * Determine if a message is the last assistant message in the session.
   */
  const isLastAssistantMessage = useCallback(
    (message: Message): boolean => {
      if (isStreaming) return false;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') {
          return messages[i].id === message.id;
        }
      }
      return false;
    },
    [messages, isStreaming]
  );

  /**
   * Regenerate the last assistant response:
   * 1. Build context up to the last user message (dropping the assistant reply)
   * 2. Edit the last user message with same content (discards all messages after it)
   * 3. Resend using existing context (no new user message added)
   */
  const regenerate = useCallback(async () => {
    if (!activeSessionId || messages.length === 0 || isStreaming) return;

    // Build regeneration context (everything up to and including last user message)
    const context = buildRegenerationContext(messages);
    if (context.length === 0) return;

    const lastUserMessage = context[context.length - 1];

    // Edit the last user message with same content — this discards everything after it
    // (including the assistant reply we want to regenerate)
    await editMessageInStore(activeSessionId, lastUserMessage.id, lastUserMessage.content);

    // Resend using current session context (no new user message added)
    await resendContext();
  }, [activeSessionId, messages, isStreaming, editMessageInStore, resendContext]);

  /**
   * Edit a user message: prompt for new text, discard subsequent messages, resend.
   */
  const editMessage = useCallback(
    (message: Message) => {
      if (!activeSessionId || message.role !== 'user' || isStreaming) return;

      Alert.prompt(
        t('chat.edit'),
        undefined,
        async (newText: string) => {
          if (!newText || newText.trim() === '' || newText.trim() === message.content) return;

          // Edit in store (updates content and discards subsequent messages)
          await editMessageInStore(activeSessionId, message.id, newText.trim());

          // Resend context (the edited message is already updated in store)
          await resendContext();
        },
        'plain-text',
        message.content
      );
    },
    [activeSessionId, isStreaming, editMessageInStore, resendContext, t]
  );

  return {
    copyMessage,
    regenerate,
    editMessage,
    isLastAssistantMessage,
  };
}
