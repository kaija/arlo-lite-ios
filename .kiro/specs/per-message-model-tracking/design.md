# Design Document: Per-Message Model Tracking

## Overview

This feature adds per-message model identification to the chat interface, removes the Edit action entirely, and extends Regenerate to work on any assistant message (not just the last). Regenerating a mid-conversation message deletes it and all subsequent messages before producing a new response from the currently active model.

## Architecture

The implementation touches three layers:

1. **Presentation Layer** — `MessageFlow` and `MessageActions` components gain a model label display and revised action button sets.
2. **Logic Layer** — A new `resolveModelName` utility resolves `modelId` → display name, and `useChat` gains a `regenerateFrom(messageId)` method.
3. **Persistence Layer** — The existing `deleteMessagesAfter` function in `message-repo.ts` already supports the truncation operation needed for mid-conversation regeneration.

### Data Flow

```
┌──────────────┐       ┌────────────────┐       ┌──────────────────┐
│ MessageFlow  │──────▶│ resolveModelName│──────▶│ ProviderStore    │
│ (render)     │       │ (utility)       │       │ (models[])       │
└──────────────┘       └────────────────┘       └──────────────────┘
       │
       │ onRegenerate(messageId)
       ▼
┌──────────────┐       ┌────────────────┐       ┌──────────────────┐
│ useChat      │──────▶│ SessionStore   │──────▶│ message-repo     │
│ (hook)       │       │ (deleteMessage │       │ (SQLite)         │
│              │       │  + truncation) │       │                  │
└──────────────┘       └────────────────┘       └──────────────────┘
       │
       │ resendContext()
       ▼
┌──────────────────────┐
│ CompletionService    │
│ (stream/complete)    │
└──────────────────────┘
```

## Components

### 1. `resolveModelName` Utility

**Location:** `src/utils/resolve-model-name.ts`

A pure function that maps a `modelId` to a human-readable display name by searching the ProviderStore's models array.

```typescript
import type { ModelConfig } from '@/stores/provider-store';

/**
 * Resolve a modelId to its human-readable display name.
 * Falls back to the raw modelId string if not found in the models list.
 */
export function resolveModelName(
  modelId: string,
  models: ModelConfig[]
): string {
  const match = models.find((m) => m.modelId === modelId);
  return match?.displayName ?? modelId;
}
```

### 2. Updated `MessageFlow` Component

**Changes:**
- Remove `onEdit` prop from `MessageFlowProps`
- Replace `modelName` prop with `modelId` + `models` props (or continue passing resolved name from parent)
- Display model label in the sender row for both user and assistant messages
- Add `accessibilityLabel` to the model label element: `"Model: {displayName}"`
- Remove the EditIcon action button
- Show Regenerate on all assistant messages (remove `isLastAssistant` gating)
- `onRegenerate` callback now accepts the message ID

**Updated Props Interface:**

```typescript
export interface MessageFlowProps {
  message: Message;
  /** Resolved display name of the model */
  modelDisplayName: string;
  showAvatars: boolean;
  isStreaming: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
}
```

### 3. Updated `MessageActions` Component

**Changes:**
- Remove `onEdit` prop and `isLastAssistant` prop
- Assistant messages: Copy, Regenerate, Delete
- User messages: Copy, Delete
- No Edit button for any role

**Updated Props Interface:**

```typescript
export interface MessageActionsProps {
  message: Message;
  onCopy: (message: Message) => Promise<void>;
  onRegenerate: () => Promise<void>;
  onDelete: () => Promise<void>;
}
```

### 4. `regenerateFrom` in `useChat`

**New method** added to `UseChatResult`:

```typescript
/** Regenerate from a specific assistant message: delete it + subsequent, then resend context */
regenerateFrom: (messageId: string) => Promise<void>;
```

**Implementation logic:**

1. Find the target message in the session's message list.
2. Call a new store action `deleteMessageAndSubsequent(sessionId, messageId)` which:
   - Finds the target message's `createdAt` timestamp.
   - Deletes all messages with `createdAt >= target.createdAt` from the database.
   - Updates the in-memory message list to exclude deleted messages.
3. After deletion completes, call the existing `resendContext()` flow to generate a new completion using the current active model/provider.
4. On failure at any step, surface via `ChatError`.

### 5. `deleteMessageAndSubsequent` Store Action

**Location:** Added to `SessionStore`

```typescript
/**
 * Delete a message and all subsequent messages in the session.
 * Used by the RegenerateFlow to truncate conversation history.
 */
deleteMessageAndSubsequent: (sessionId: string, messageId: string) => Promise<void>;
```

**Implementation:**

```typescript
deleteMessageAndSubsequent: async (sessionId: string, messageId: string) => {
  const { db, messages } = get();
  if (!db) throw new Error('Database not initialized.');

  const sessionMessages = messages[sessionId] ?? [];
  const target = sessionMessages.find((m) => m.id === messageId);
  if (!target) return;

  // Delete target and all messages after it from DB
  await db.runAsync(
    'DELETE FROM messages WHERE session_id = ? AND created_at >= ?',
    sessionId,
    target.createdAt
  );

  // Update in-memory state
  set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: (state.messages[sessionId] ?? []).filter(
        (m) => m.createdAt < target.createdAt
      ),
    },
  }));
};
```

## Interfaces

### ModelLabel Rendering

The model label is rendered within the existing sender row. For assistant messages it uses the `assistantLabel` style (accent color). For user messages it uses a secondary text style positioned after the sender name.

```typescript
// Inside MessageFlow sender row
<Text
  style={[styles.modelLabel, isUser ? styles.userModelLabel : styles.assistantModelLabel]}
  accessibilityLabel={t('accessibility.modelLabel', { model: modelDisplayName })}
>
  {modelDisplayName}
</Text>
```

The i18n key `accessibility.modelLabel` resolves to: `"Model: {{model}}"`.

### Action Button Determination

Action buttons are determined purely by message role:

| Role      | Actions                    |
|-----------|----------------------------|
| user      | Copy, Delete               |
| assistant | Copy, Regenerate, Delete   |

No positional logic (first/last) affects which buttons appear.

## Data Model

No schema changes required. The `messages` table already stores `provider_id` and `model_id` per message. The `models` table already holds `display_name` for resolution.

Existing relevant columns in `messages`:
- `provider_id TEXT NOT NULL`
- `model_id TEXT NOT NULL`

Existing relevant columns in `models`:
- `model_id TEXT NOT NULL` (the API model identifier)
- `display_name TEXT NOT NULL` (human-readable name)

## Error Handling

| Scenario | Handling |
|----------|----------|
| `modelId` not found in ProviderStore | Display raw `modelId` string (graceful fallback) |
| Database deletion fails during regeneration | Surface via `ChatError` with `isRetryable: true` |
| Completion fails after truncation | Messages already deleted; error shown in chat; user can retry |
| Provider not configured when regenerating | Surface as non-retryable `ChatError` |

## Accessibility

- **ModelLabel:** `accessibilityLabel="Model: {displayName}"` on each model label text element.
- **Copy button:** `accessibilityLabel` from i18n key `accessibility.copyButton` ("Copy message").
- **Regenerate button:** `accessibilityLabel` from i18n key `accessibility.regenerateButton` ("Regenerate response").
- **Delete button:** `accessibilityLabel` from i18n key `accessibility.deleteButton` ("Delete message").
- All action buttons maintain 44×44pt minimum tap target.

## Internationalization

New/updated i18n keys:

```json
{
  "accessibility": {
    "modelLabel": "Model: {{model}}",
    "copyButton": "Copy message",
    "regenerateButton": "Regenerate response",
    "deleteButton": "Delete message"
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Model Name Resolution

*For any* modelId string and any list of ModelConfig objects, `resolveModelName(modelId, models)` returns the `displayName` of the matching model if one exists, or the raw `modelId` string unchanged if no match exists.

**Validates: Requirements 1.3, 1.4**

### Property 2: Assistant Message Action Set

*For any* assistant message, the set of rendered action buttons is exactly {Copy, Regenerate, Delete} with no Edit button present, regardless of the message's position in the conversation.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 4.1**

### Property 3: User Message Action Set

*For any* user message, the set of rendered action buttons is exactly {Copy, Delete} with no Edit or Regenerate button present.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1**

### Property 4: Regeneration Truncation

*For any* session containing N messages and any assistant message at index i (0-based), after `deleteMessageAndSubsequent` is called on that message, the remaining message list contains exactly the messages with indices 0 through i-1 (all messages before the target), and no message with `createdAt >= target.createdAt` remains.

**Validates: Requirements 5.1, 5.2, 6.1, 6.2**

### Property 5: In-Memory/Database Consistency After Truncation

*For any* session, after `deleteMessageAndSubsequent` completes successfully, the in-memory message list for that session is identical to the result of querying the database for that session's messages.

**Validates: Requirements 6.3**

### Property 6: Action Visibility Follows Streaming State

*For any* message rendered by MessageFlow, action buttons are visible if and only if `isStreaming` is `false`. When `isStreaming` is `true`, no action buttons are rendered for any message.

**Validates: Requirements 7.1, 7.2**

### Property 7: ModelLabel Accessibility Format

*For any* model display name string, the `accessibilityLabel` on the ModelLabel element matches the pattern `"Model: {displayName}"`.

**Validates: Requirements 8.1**
