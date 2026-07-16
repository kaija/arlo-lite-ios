# Design Document: Provider UI Integration

## Overview

This feature wires together existing stores, services, and UI components into a cohesive end-to-end experience. No new architectural layers are introduced — the work consists of connecting data-flow edges, adding persistence where ephemeral state was used, enriching UI components with live store data, and removing the stale duplicate screen.

## Architecture

The existing architecture follows a unidirectional data flow:

```
UI Components → Hooks → Stores → Database/SecureStore
                   ↓
              Services → Provider Adapters → External APIs
```

This feature adds the following data-flow connections (edges) to the existing graph:

1. **SettingsStore → SettingsScreen**: System prompts array rendered as list rows.
2. **ProviderStore (generationParams) → SettingsScreen**: Live temperature/maxTokens displayed.
3. **ProviderStore (generationParams) → CompletionService**: Params injected into request payload.
4. **SecureStore → ProviderCard**: Masked API key suffix loaded asynchronously.
5. **ProviderStore (connectionStatuses) → ProviderCard**: Colored status dot rendered.
6. **ChatStore ↔ SessionStore**: Model selection and thinking level persisted/restored per session.
7. **Message (token/cost fields) → MessageFlow**: Cost metadata line rendered conditionally.
8. **useChat (error) → ChatShell → ErrorBanner**: Inline error display with retry.
9. **SettingsStore (defaultSystemPromptId) → CompletionService**: System prompt prepended to request.
10. **Messages + ModelConfig.contextWindow → ContextRing**: Usage percentage with threshold colors.

## Components

### Modified Components

#### ProviderCard (within SettingsScreen)

Currently renders provider name, model count, API type, and a hardcoded masked key placeholder. Changes:

- **Add**: Async load of API key suffix from `SecureStore.getApiKey(providerId)` → extract last 4 chars.
- **Add**: Connection status dot (8×8pt circle) positioned left of the provider name, colored by `connectionStatuses[providerId].status`.
- **Add**: Loading state (`"••••"`) and empty state (`"No key"`) for the masked key field.

```typescript
// Hook for loading masked key suffix
function useMaskedKey(providerId: string): { suffix: string; loading: boolean } {
  const [suffix, setSuffix] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getApiKey(providerId).then((key) => {
      if (cancelled) return;
      setSuffix(key ? key.slice(-4) : null);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [providerId]);

  return {
    suffix: loading ? '••••' : suffix ? `•••• ${suffix}` : 'No key',
    loading,
  };
}
```

#### SettingsScreen

- **System Prompts section**: Replace hardcoded empty array with `useSettingsStore(s => s.systemPrompts)`. Render each prompt as a row with name, `content.slice(0, 60)` preview, and a default checkmark that calls `setDefaultSystemPromptId(prompt.id)`.
- **Generation Parameters section**: Replace hardcoded `"0.7"` and `"4096"` with values from the active provider's `generationParams`. Editing persists via `updateProvider(providerId, { generationParams: { ... } })`.
- **Add Prompt action**: Invokes `addSystemPrompt(db, { name, content })` from SettingsStore.

#### ChatShell

- **ErrorBanner injection**: When `useChat().error` is non-null, render an `ErrorBanner` component as the last item (or `ListFooterComponent`) in the message FlatList, positioned where the assistant reply would appear.

#### MessageFlow

- **Cost metadata line**: Below the message body (after markdown rendering), conditionally render a metadata line when `message.promptTokens`, `message.completionTokens`, and `message.cost` are all non-null. Format: `"{promptTokens} in / {completionTokens} out · $X.XXX"` using `textTertiary` color, 11pt monospace.

#### ChatStore

- **switchModel**: After updating local state, persist `activeProviderId` and `activeModelId` to the active session via `SessionStore.updateSession(sessionId, { providerId, modelId })`.
- **setThinkingLevel**: After updating local state, persist the level to the session record (requires new `thinkingLevel` column or field on sessions).
- **Session restore**: When `setActiveSession` is called, read the session's `providerId`, `modelId`, and `thinkingLevel` and apply them to ChatStore state.

#### CompletionService

- **Generation params**: Before building `CompletionRequest`, read the active provider's `generationParams` from ProviderStore and include `temperature` and `maxTokens` in the request.
- **System prompt prepend**: Before sending messages, check `SettingsStore.defaultSystemPromptId`. If non-null, find the matching prompt and prepend `{ role: 'system', content: prompt.content }` at index 0 of the messages array.

#### ContextRing (existing — minor wiring)

The ContextRing component already implements the correct logic (char/4 approximation, threshold colors, haptic feedback). The integration ensures `ChatShell` passes the correct `percentage` prop computed from current messages and the active model's `contextWindow`.

### New Components

#### ErrorBanner

An inline error display component rendered within the message stream.

```typescript
export interface ErrorBannerProps {
  /** Short error message */
  message: string;
  /** Full error detail shown on expand */
  detail?: string;
  /** Whether to show the retry button */
  isRetryable: boolean;
  /** Called when retry is tapped */
  onRetry: () => void;
  /** Called when the error is dismissed (on successful retry) */
  onDismiss: () => void;
}
```

Behavior:
- Renders a single-line error message in `textSecondary` color with a warning icon.
- Tapping the message expands to show `detail` text.
- When `isRetryable` is true, shows a "Retry" button that invokes `onRetry`.
- On successful retry, parent dismisses the banner and the assistant response renders in its place.

### Deleted Components

- `src/screens/ProviderDetailScreen.tsx` — removed (duplicate of overlay version).
- `src/screens/__tests__/ProviderDetailScreen.test.ts` — removed (test for deleted file).
- Any imports referencing `src/screens/ProviderDetailScreen` — removed or redirected.

## Interfaces & Data Models

### GenerationParams (new type, added to ProviderStore)

```typescript
export interface GenerationParams {
  /** Sampling temperature: 0.0–2.0, default 0.7 */
  temperature: number;
  /** Maximum tokens to generate, default 4096 */
  maxTokens: number;
}
```

### Provider Schema Extension

The `providers` table gains a `generation_params` TEXT column (JSON-serialized `GenerationParams`). Default: `'{"temperature":0.7,"maxTokens":4096}'`.

```typescript
// In provider-store.ts, Provider type extended:
export interface Provider {
  // ... existing fields
  generationParams: GenerationParams;
}
```

### Session Schema Extension

The `sessions` table gains a `thinking_level` TEXT column (nullable, stores `ThinkingLevel` string). Default: `null` (interpreted as `'off'`).

```typescript
// In session-repo.ts, Session type extended:
export interface Session {
  // ... existing fields
  thinkingLevel: ThinkingLevel | null;
}
```

### CompletionRequest Extension

The existing `CompletionRequest` type already has an optional `maxTokens` field. Add `temperature`:

```typescript
export interface CompletionRequest {
  // ... existing fields
  /** Sampling temperature (0.0–2.0). */
  temperature?: number;
  /** Maximum tokens to generate. */
  maxTokens?: number;
}
```

### ErrorBanner Data (already defined in useChat)

The `ChatError` interface already exists in `useChat.ts`:

```typescript
export interface ChatError {
  message: string;
  detail?: string;
  isRetryable: boolean;
}
```

## Data Flow Sequences

### Send Message with System Prompt + Generation Params

```
1. User types message → InputChrome.onSend(text)
2. useChat.sendMessage(text)
3.   → SessionStore.addMessage(sessionId, userMessage)
4.   → Read SettingsStore.defaultSystemPromptId
5.   → If non-null, find prompt in SettingsStore.systemPrompts
6.   → Prepend { role: 'system', content: prompt.content } to messages
7.   → Read ProviderStore.provider.generationParams (temperature, maxTokens)
8.   → Build CompletionRequest with messages, model, thinkingLevel, temperature, maxTokens
9.   → CompletionService.streamCompletion(messages, options, signal)
10.  → Stream chunks → ChatStore.appendStreamContent
11.  → On done: calculate cost, persist assistant message with tokens/cost
```

### Switch Session with Model + Thinking Level Restore

```
1. User taps session in sidebar → SessionSidebar.onSessionSelect(id)
2. SessionStore.setActiveSession(id)
3.   → Load messages from DB
4. ChatStore reads session.providerId, session.modelId, session.thinkingLevel
5.   → If providerId/modelId non-null: ChatStore.switchModel(providerId, modelId)
6.   → If thinkingLevel non-null: ChatStore.setThinkingLevel(thinkingLevel)
7.   → If thinkingLevel null: ChatStore.setThinkingLevel('off')
```

### Error → ErrorBanner → Retry Flow

```
1. CompletionService throws ProviderError
2. useChat maps to ChatError { message, detail, isRetryable }
3. ChatShell detects error !== null → renders ErrorBanner in message list
4. User taps "Retry" → useChat.retry() → resends last message
5. On success: error cleared → ErrorBanner unmounts → assistant message renders
```

## Error Handling

| Error Source | Handling Strategy |
|---|---|
| API key not found | ProviderError('authentication') → ErrorBanner with "Check your API key in provider settings." |
| Rate limit | ProviderError('rate_limit') → ErrorBanner with retry-after detail, retry button visible |
| Network failure | Generic error → ErrorBanner with retry button |
| Invalid model/provider | Non-retryable ChatError → ErrorBanner without retry button |
| SecureStore read failure | Masked key shows "••••" (loading state fallback) |
| Empty system prompts | SettingsScreen shows "No system prompts configured" text |
| Null contextWindow | ContextRing shows 0% (no division by zero) |

## Migration Strategy

A new SQLite migration adds:
1. `generation_params TEXT DEFAULT '{"temperature":0.7,"maxTokens":4096}'` to `providers` table.
2. `thinking_level TEXT DEFAULT NULL` to `sessions` table.

Existing data remains valid — defaults apply to all existing rows.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: System Prompt Rendering Completeness

*For any* non-empty array of system prompts from the SettingsStore, *for each* prompt in that array, the SettingsScreen SHALL render a row containing the prompt's `name`, its `content` truncated to 60 characters, and a default indicator if that prompt's id matches `defaultSystemPromptId`.

**Validates: Requirements 1.1**

### Property 2: Store Action Passthrough Correctness

*For any* user interaction that invokes a store action (addSystemPrompt with a name/content pair, or setDefaultSystemPromptId with a prompt id), the SettingsScreen SHALL pass the exact user-provided values to the corresponding SettingsStore action without modification.

**Validates: Requirements 1.3, 1.4**

### Property 3: Generation Params Schema Invariant

*For any* provider in the ProviderStore, its `generationParams.temperature` SHALL be a number in the range [0.0, 2.0] and its `generationParams.maxTokens` SHALL be a positive integer. A newly created provider SHALL have temperature 0.7 and maxTokens 4096.

**Validates: Requirements 2.1**

### Property 4: Generation Params Display and Persistence

*For any* active provider with generation parameters `{ temperature: T, maxTokens: M }`, the SettingsScreen SHALL display `T` and `M` (not hardcoded defaults), and after the user edits a parameter to a new valid value V, the ProviderStore SHALL contain the updated value V for that provider.

**Validates: Requirements 2.2, 2.3**

### Property 5: Generation Params in Completion Request

*For any* completion request initiated against a provider with `generationParams { temperature: T, maxTokens: M }`, the `CompletionRequest` payload sent to the provider adapter SHALL include `temperature === T` and `maxTokens === M`.

**Validates: Requirements 2.4**

### Property 6: API Key Masking

*For any* stored API key string of length ≥ 4, the ProviderCard SHALL display a masked representation ending with the last 4 characters of that key. *For any* provider with no stored API key, the display SHALL show "No key".

**Validates: Requirements 3.1, 3.3**

### Property 7: Connection Status Mapping

*For any* provider id P and *for any* ConnectionStatus value S in the ProviderStore's `connectionStatuses[P]`, the ProviderCard for provider P SHALL render a status dot whose color corresponds to S (green for connected, red for failed, gray for untested).

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 8: Model Selection Round-Trip Persistence

*For any* session S and *for any* provider/model pair (P, M) selected via the model picker, switching away from S and then switching back SHALL restore `activeProviderId === P` and `activeModelId === M` in the ChatStore.

**Validates: Requirements 5.1, 5.2**

### Property 9: Thinking Level Round-Trip Persistence

*For any* session S and *for any* valid ThinkingLevel value L set via the thinking level control, switching away from S and then switching back SHALL restore `thinkingLevel === L` in the ChatStore.

**Validates: Requirements 6.1, 6.2**

### Property 10: Cost Metadata Conditional Formatting

*For any* assistant message, if `promptTokens`, `completionTokens`, and `cost` are all non-null, the MessageFlow SHALL render a metadata line matching the format `"{promptTokens} in / {completionTokens} out · ${cost.toFixed(3)}"`. If any of those fields is null, no metadata line SHALL be rendered.

**Validates: Requirements 7.1, 7.2, 7.4**

### Property 11: Error Banner Retry Visibility

*For any* ChatError, the ErrorBanner SHALL display the `message` text. If `isRetryable` is true, a "Retry" button SHALL be visible; if `isRetryable` is false, no retry button SHALL appear.

**Validates: Requirements 8.2, 8.3**

### Property 12: System Prompt Prepend Correctness

*For any* set of conversation messages and *for any* non-null `defaultSystemPromptId` resolving to a prompt with content C, the messages array sent to the provider SHALL have `messages[0].role === 'system'` and `messages[0].content === C`. When `defaultSystemPromptId` is null, `messages[0].role` SHALL NOT be `'system'` (unless the user explicitly added one).

**Validates: Requirements 10.1, 10.2, 10.3**

### Property 13: Context Ring Usage Computation

*For any* set of messages with total character count N and *for any* active model with `contextWindow` W > 0, the ContextRing percentage SHALL equal `min(ceil(N/4) / W * 100, 100)`. When W is null or 0, the percentage SHALL be 0.

**Validates: Requirements 11.1, 11.2, 11.5**

### Property 14: Context Ring Color Thresholds

*For any* usage percentage P: if P < 50 the ring color SHALL be the accent color; if 50 ≤ P < 75 the ring color SHALL be `contextWarning` (orange); if P ≥ 75 the ring color SHALL be `contextCritical` (red).

**Validates: Requirements 11.3, 11.4**
