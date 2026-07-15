/**
 * Session manager — pure business logic for session lifecycle operations.
 *
 * These functions are stateless and testable, operating on message arrays
 * rather than database state. They handle:
 * - Message regeneration context building
 * - Edit position calculations
 * - Auto-title generation decisions
 */

import type { Message } from '@/database/repositories/message-repo';

/**
 * Build the context to resend when regenerating the last assistant message.
 *
 * Takes all messages and returns the list up to and including the last user
 * message, effectively dropping the last assistant message. This prepares the
 * context to be resent to the provider for a fresh response.
 *
 * @param messages - All messages in the session (ordered by creation)
 * @returns Messages to include as context for regeneration (everything up to
 *          and including the last user message). Returns an empty array if
 *          there are no messages or no user messages.
 */
export function buildRegenerationContext(messages: Message[]): Message[] {
  if (messages.length === 0) {
    return [];
  }

  // Find the index of the last user message
  let lastUserIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIndex = i;
      break;
    }
  }

  if (lastUserIndex === -1) {
    return [];
  }

  return messages.slice(0, lastUserIndex + 1);
}

/**
 * Calculate how many messages should remain after editing at a given position.
 *
 * When a user edits a message at position K, all messages after it are discarded.
 * The edited message itself is kept, so the count is editPosition + 1.
 *
 * @param totalMessages - Total number of messages in the session (must be >= 0)
 * @param editPosition - Zero-based index of the message being edited (0 <= editPosition < totalMessages)
 * @returns Number of messages that should remain after the edit
 */
export function getMessageCountAfterEdit(
  totalMessages: number,
  editPosition: number
): number {
  return editPosition + 1;
}

/**
 * Determine whether the session title should be auto-generated.
 *
 * Returns true when this is the first user message in a session that still
 * has the default "New Chat" title — indicating the session hasn't been
 * manually renamed and needs an auto-generated title.
 *
 * @param messages - Current messages in the session (before the new message is added)
 * @param sessionTitle - The current session title
 * @returns true if auto-title generation should fire
 */
export function shouldAutoGenerateTitle(
  messages: Message[],
  sessionTitle: string
): boolean {
  if (sessionTitle !== 'New Chat') {
    return false;
  }

  // Check that there are no existing user messages
  const hasUserMessage = messages.some((m) => m.role === 'user');
  return !hasUserMessage;
}
