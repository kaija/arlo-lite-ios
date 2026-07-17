# Implementation Plan: Per-Message Model Tracking

## Overview

This plan implements per-message model identification in the chat interface, removes the Edit action entirely, extends Regenerate to any assistant message (with truncation of subsequent messages), and adds a new `deleteMessageAndSubsequent` store action plus a `regenerateFrom` hook method. The implementation language is TypeScript (React Native / Expo).

## Tasks

- [x] 1. Create `resolveModelName` utility and update i18n keys
  - [x] 1.1 Create `src/utils/resolve-model-name.ts` with the `resolveModelName` pure function
    - Accepts `modelId: string` and `models: ModelConfig[]`
    - Returns `match.displayName` if found, raw `modelId` if not
    - Import `ModelConfig` type from `@/stores/provider-store`
    - _Requirements: 1.3, 1.4_

  - [x] 1.2 Add new i18n keys to `src/i18n/locales/en.json` and `src/i18n/locales/zh-TW.json`
    - Add `accessibility.modelLabel`: `"Model: {{model}}"` (en) / appropriate zh-TW equivalent
    - Remove `accessibility.editButton` key (or leave for backwards compat — decide based on whether other code references it)
    - Confirm `accessibility.copyButton`, `accessibility.regenerateButton`, `accessibility.deleteButton` keys exist (they already do)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.3 Write property test for `resolveModelName`
    - **Property 1: Model Name Resolution**
    - **Validates: Requirements 1.3, 1.4**
    - For any modelId and models list: if models contains a match, returns displayName; otherwise returns raw modelId

- [x] 2. Update `MessageActions` component — remove Edit, enable Regenerate on all assistant messages
  - [x] 2.1 Update `MessageActionsProps` interface in `src/components/chat/MessageActions.tsx`
    - Remove `onEdit` prop
    - Remove `isLastAssistant` prop
    - Add `onDelete: () => Promise<void>` prop
    - Keep `onCopy` and `onRegenerate` props
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 4.1, 4.3_

  - [x] 2.2 Update `MessageActions` render logic
    - Remove the Edit `TouchableOpacity` block entirely
    - Show Regenerate for all `message.role === 'assistant'` messages (remove `isLastAssistant` gating)
    - Show Delete button for all messages
    - User messages: Copy, Delete only
    - Assistant messages: Copy, Regenerate, Delete
    - _Requirements: 2.1–2.4, 3.1–3.4, 4.1_

  - [x] 2.3 Write property tests for action button sets
    - **Property 2: Assistant Message Action Set** — exactly {Copy, Regenerate, Delete} for any assistant message
    - **Property 3: User Message Action Set** — exactly {Copy, Delete} for any user message
    - **Validates: Requirements 2.1–2.4, 3.1–3.4, 4.1**

- [x] 3. Update `MessageFlow` component — add model label, remove edit, wire new actions
  - [x] 3.1 Update `MessageFlowProps` in `src/components/chat/MessageFlow.tsx`
    - Remove `onEdit` prop
    - Rename `modelName` to `modelDisplayName` for clarity (or keep `modelName` — match design)
    - Ensure `onRegenerate`, `onCopy`, `onDelete` remain
    - _Requirements: 4.2, 4.3_

  - [x] 3.2 Add model label display in the sender row
    - For assistant messages: display `modelDisplayName` as the sender label (already done via `senderLabel` variable — verify it uses modelName correctly)
    - For user messages: display the active model name after the "You" label
    - Add `accessibilityLabel={t('accessibility.modelLabel', { model: modelDisplayName })}` to the model label Text element
    - _Requirements: 1.1, 1.2, 1.5, 8.1_

  - [x] 3.3 Remove the EditIcon action button rendering and `EditIcon` import
    - Remove the `isUser && <ActionButton icon={<EditIcon …} />` block
    - Remove `import { EditIcon }` if no longer used elsewhere
    - _Requirements: 4.1, 4.2_

  - [x] 3.4 Ensure Regenerate button shows on all assistant messages (not gated by position)
    - The current code already shows Regenerate for `!isUser` — verify no `isLastAssistant` gating exists in MessageFlow
    - _Requirements: 2.2_

  - [x] 3.5 Write property test for action visibility vs streaming state
    - **Property 6: Action Visibility Follows Streaming State**
    - **Validates: Requirements 7.1, 7.2**
    - When `isStreaming=true`, no action buttons rendered; when `false`, actions are shown

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Add `deleteMessageAndSubsequent` action to `SessionStore`
  - [x] 5.1 Add `deleteMessageAndSubsequent` to `SessionStore` interface and implementation in `src/stores/session-store.ts`
    - Signature: `deleteMessageAndSubsequent: (sessionId: string, messageId: string) => Promise<void>`
    - Find target message by ID in the session's message list
    - Delete all messages with `createdAt >= target.createdAt` from DB using `DELETE FROM messages WHERE session_id = ? AND created_at >= ?`
    - Update in-memory state: filter to keep only messages with `createdAt < target.createdAt`
    - Throw error (surfaced as ChatError) if DB not initialized; no-op if message not found
    - _Requirements: 5.1, 5.2, 6.1, 6.2, 6.3_

  - [x] 5.2 Write property test for regeneration truncation
    - **Property 4: Regeneration Truncation**
    - **Validates: Requirements 5.1, 5.2, 6.1, 6.2**
    - For any message list and target index, after truncation only messages before target remain

  - [x] 5.3 Write property test for in-memory/database consistency
    - **Property 5: In-Memory/Database Consistency After Truncation**
    - **Validates: Requirements 6.3**

- [x] 6. Add `regenerateFrom` method to `useChat` hook
  - [x] 6.1 Add `regenerateFrom` to `UseChatResult` interface and implement in `src/hooks/useChat.ts`
    - Signature: `regenerateFrom: (messageId: string) => Promise<void>`
    - Call `useSessionStore.getState().deleteMessageAndSubsequent(sessionId, messageId)`
    - After deletion, call `resendContext()` to generate a new completion with current active model
    - On failure, surface via `setError` as ChatError with appropriate retryable flag
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4_

  - [x] 6.2 Update `useMessageActions` hook in `src/hooks/useMessageActions.ts`
    - Remove `editMessage` from the hook's return interface
    - Remove `editMessage` implementation (and the `Alert.prompt` flow)
    - Replace `regenerate` with a `regenerateFrom(messageId: string)` method that calls `useChat().regenerateFrom(messageId)`
    - Remove `isLastAssistantMessage` helper (no longer needed)
    - Keep `copyMessage` unchanged
    - Add `deleteMessage(messageId: string)` that calls the session store's existing `deleteMessage`
    - _Requirements: 4.2, 4.3, 5.1–5.5_

  - [x] 6.3 Write unit tests for `regenerateFrom` flow
    - Test that `deleteMessageAndSubsequent` is called before `resendContext`
    - Test error handling paths
    - _Requirements: 5.1–5.5, 6.4_

- [x] 7. Wire updated components in the chat screen
  - [x] 7.1 Update the chat screen / message list renderer to pass new props
    - Pass `modelDisplayName` resolved via `resolveModelName(message.modelId, models)` to each `MessageFlow`
    - Pass `onRegenerate={() => regenerateFrom(message.id)}` for assistant messages
    - Pass `onDelete={() => deleteMessage(sessionId, message.id)}` for all messages
    - Remove `onEdit` prop passing
    - Remove any `isLastAssistant` logic when rendering `MessageActions`
    - _Requirements: 1.1–1.5, 2.1–2.4, 3.1–3.4, 5.1–5.5_

  - [x] 7.2 Update `MessageActions` usage sites to match new props
    - Remove `onEdit` and `isLastAssistant` props wherever `MessageActions` is rendered
    - Add `onDelete` prop
    - _Requirements: 4.1–4.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `deleteMessagesAfter` function in `message-repo.ts` handles the SQL deletion — `deleteMessageAndSubsequent` in the store wraps it with the in-memory state update
- No database schema migration is needed — `model_id` and `provider_id` already exist on the messages table
- The `EditIcon` import can be removed from `MessageFlow.tsx` once the edit button is deleted

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1"] },
    { "id": 3, "tasks": ["2.3", "3.2", "3.3", "3.4"] },
    { "id": 4, "tasks": ["3.5", "5.1"] },
    { "id": 5, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 6, "tasks": ["6.2", "6.3"] },
    { "id": 7, "tasks": ["7.1", "7.2"] }
  ]
}
```
