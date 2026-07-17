/**
 * useMessageActions hook — orchestrates message action flows.
 *
 * Handles:
 * - RegenerateFrom: deletes target assistant message + subsequent, resends context
 * - Copy: copies full message text to clipboard
 * - Delete: removes a single message from the session
 */

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '@/stores/session-store';
import { useChat } from '@/hooks/useChat';
import { copyToClipboard } from '@/utils/clipboard';
import { useToast } from '@/components/overlays/ToastProvider';
import type { Message } from '@/database/repositories/message-repo';

export interface UseMessageActionsResult {
  /** Copy message content to clipboard */
  copyMessage: (message: Message) => Promise<void>;
  /** Regenerate from a specific assistant message (deletes it + subsequent, then resends) */
  regenerateFrom: (messageId: string) => Promise<void>;
  /** Delete a single message from the active session */
  deleteMessage: (messageId: string) => Promise<void>;
}

/**
 * Hook providing message action handlers for copy, regenerateFrom, and delete flows.
 */
export function useMessageActions(): UseMessageActionsResult {
  const { t } = useTranslation();
  const toast = useToast();

  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const deleteMessageFromStore = useSessionStore((s) => s.deleteMessage);
  const { regenerateFrom: regenerateFromChat } = useChat();

  /**
   * Copy full message text to system clipboard with toast feedback.
   */
  const copyMessage = useCallback(async (message: Message) => {
    await copyToClipboard(message.content);
    toast.show(t('chat.copied', { defaultValue: 'Copied' }));
  }, [toast, t]);

  /**
   * Regenerate from a specific assistant message: delete it + subsequent, then
   * resend the remaining context to generate a new completion with the current model.
   */
  const regenerateFrom = useCallback(
    async (messageId: string) => {
      await regenerateFromChat(messageId);
    },
    [regenerateFromChat]
  );

  /**
   * Delete a single message from the active session.
   */
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;
      await deleteMessageFromStore(activeSessionId, messageId);
    },
    [activeSessionId, deleteMessageFromStore]
  );

  return {
    copyMessage,
    regenerateFrom,
    deleteMessage,
  };
}
