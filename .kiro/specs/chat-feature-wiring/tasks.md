# Implementation Plan: Chat Feature Wiring (Narrowed)

## Overview

Wire three existing but unintegrated chat features into the ChatShell composition layer: single-message deletion, auto-session creation on empty state, and scroll-to-bottom refinement. All underlying data-layer primitives exist — this work connects them to the store, hooks, and UI shell.

## Tasks

- [x] 1. Create scroll behavior hook and ScrollFAB component
  - [x] 1.1 Create `src/hooks/useScrollBehavior.ts`
    - Export pure function `isNearBottom(contentHeight, scrollOffset, layoutHeight, threshold?)` returning boolean
    - Use 100-point default threshold: `contentHeight - scrollOffset - layoutHeight <= threshold`
    - Implement `useScrollBehavior` hook returning `flatListRef`, `showFAB`, `onScroll`, `onContentSizeChange`, `onLayout`, `scrollToBottom`
    - `onContentSizeChange` auto-scrolls only when `isNearBottomRef` is true
    - `onScroll` updates `isNearBottomRef` and toggles `showFAB` state
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 1.2 Create `src/components/chat/ScrollFAB.tsx`
    - Floating button positioned absolute, right: 16, bottom: 80 (above InputChrome)
    - `visible` prop controls render (return null when false)
    - `react-native-reanimated` FadeIn/FadeOut for enter/exit animations
    - Accessibility label "Scroll to bottom", role "button"
    - Themed background from `useTheme()` colors
    - _Requirements: 3.3, 3.4_

- [x] 2. Add deleteMessage action to session store
  - [x] 2.1 Add `deleteMessage` action to `src/stores/session-store.ts`
    - Add `deleteMessage: (sessionId: string, messageId: string) => Promise<void>` to the store interface
    - Import existing `deleteMessage` from `message-repo.ts` (alias as `deleteMessageFromDb`)
    - Call `deleteMessageFromDb(db, messageId)` then filter message from in-memory `messages[sessionId]` array
    - Throw if `db` is null (database not initialized)
    - _Requirements: 1.1, 1.3_

  - [x] 2.2 Write property test for `isNearBottom` pure function
    - **Property 4: Scroll threshold determines auto-scroll and FAB visibility**
    - Test that `isNearBottom` returns true iff `contentHeight - scrollOffset - layoutHeight <= 100`
    - Test boundary values at exactly 100 and 101
    - Create file `src/hooks/__tests__/useScrollBehavior.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5**

  - [x] 2.3 Write unit test for `deleteMessage` store action
    - **Property 1: Message deletion removes exactly one message**
    - Mock `deleteMessageFromDb`, verify store state has N-1 messages after call
    - Verify all other messages remain unchanged
    - Create file `src/stores/__tests__/session-store-delete.test.ts`
    - **Validates: Requirements 1.1, 1.3**

- [x] 3. Checkpoint — hooks and store action ready
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Wire auto-create session logic
  - [x] 4.1 Add bootstrap auto-create in `src/app/_layout.tsx`
    - After `loadSessions()` completes, check if sessions list is empty
    - If empty AND a provider with at least one model is configured, call `createSession(providerId, modelId)`
    - Set new session as active via `setActiveSession(sessionId)`
    - If no provider/model available, skip (user lands on empty state)
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 Add first-send auto-create in `src/hooks/useChat.ts`
    - Replace `if (!activeSessionId) return` guard with auto-creation logic
    - If `activeSessionId` is null but provider/model available: create session, set active, continue send
    - If no provider/model configured: set error "No provider configured" with `isRetryable: false`
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 4.3 Write property test for auto-create session on send
    - **Property 3: Auto-create session on send with no active session**
    - Mock `createSession` and `setActiveSession`, verify they're called when `activeSessionId` is null
    - Verify message is sent in newly created session
    - Create file `src/hooks/__tests__/useChat-autocreate.test.ts`
    - **Validates: Requirements 2.3, 2.4**

- [x] 5. Wire delete and scroll into ChatShell
  - [x] 5.1 Add delete handler to `src/screens/ChatShell.tsx`
    - Implement `handleDeleteMessage(messageId)` using `Alert.alert` confirmation dialog
    - i18n keys: `chat.deleteMessage`, `chat.deleteMessageConfirm`, `common.cancel`, `common.delete`
    - On confirm: call `deleteMessage(activeSessionId, messageId)` from session store
    - On cancel: dismiss (no-op)
    - Pass handler to MessageFlow's `onDelete` prop (currently empty)
    - _Requirements: 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Integrate `useScrollBehavior` into ChatShell FlatList
    - Instantiate `useScrollBehavior()` in ChatShell
    - Replace existing `flatListRef` and `setTimeout` scroll pattern with hook's returns
    - Wire `onScroll`, `onContentSizeChange`, `onLayout` to FlatList with `scrollEventThrottle={16}`
    - Render `ScrollFAB` component with `visible={showFAB}` and `onPress={scrollToBottom}`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.3 Write unit tests for delete confirmation flow
    - Mock `Alert.alert`, verify cancel leaves messages unchanged
    - Verify confirm calls `deleteMessage` with correct IDs
    - Create file `src/screens/__tests__/ChatShell-delete.test.ts`
    - **Validates: Requirements 1.2, 1.4, 1.5**

- [x] 6. Add i18n translation keys
  - [x] 6.1 Add new i18n keys to English translation file
    - `chat.deleteMessage`: "Delete Message"
    - `chat.deleteMessageConfirm`: "Are you sure you want to delete this message?"
    - `common.cancel`: "Cancel" (if not already present)
    - `common.delete`: "Delete"
    - Accessibility label for ScrollFAB already hardcoded in component
    - _Requirements: 1.2, 3.4_

- [x] 7. Final checkpoint — all three features wired
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate correctness properties from the design document
- Key files to modify: `ChatShell.tsx`, `session-store.ts`, `useChat.ts`, `_layout.tsx`
- New files to create: `useScrollBehavior.ts`, `ScrollFAB.tsx`
- Existing `deleteMessage` in `message-repo.ts` is ready to use — no data-layer changes needed

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "4.1", "4.2"] },
    { "id": 2, "tasks": ["4.3", "5.1", "5.2", "6.1"] },
    { "id": 3, "tasks": ["5.3"] }
  ]
}
```
