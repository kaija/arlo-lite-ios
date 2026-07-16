# Implementation Plan: Provider UI Integration

## Overview

Wire together existing stores, services, and UI components into a fully functional end-to-end experience. Connect data-flow edges, add persistence where ephemeral state was used, enrich UI components with live store data, and remove the stale duplicate screen. No new architectural layers — breadth-first integration of all existing pieces.

## Tasks

- [x] 1. Database migration and schema updates
  - [x] 1.1 Create migration v2 in `src/database/migrations/v2.ts`
    - Add `generation_params TEXT DEFAULT '{"temperature":0.7,"maxTokens":4096}'` column to `providers` table
    - Add `thinking_level TEXT DEFAULT NULL` column to `sessions` table
    - Register migration in `src/database/database.ts`
    - _Requirements: 2.1, 6.1_

  - [x] 1.2 Update Provider interface and row mapping in `src/database/repositories/provider-repo.ts`
    - Add `generationParams: GenerationParams` to `Provider` interface
    - Add `generation_params` to `ProviderRow` interface
    - Parse JSON in `rowToProvider` mapping function
    - Serialize JSON in `createProvider` and `updateProvider` functions
    - Add `GenerationParams` type export: `{ temperature: number; maxTokens: number }`
    - _Requirements: 2.1_

  - [x] 1.3 Update Session interface and row mapping in `src/database/repositories/session-repo.ts`
    - Add `thinkingLevel: string | null` to `Session` interface
    - Add `thinking_level` to `SessionRow` interface
    - Map in `rowToSession` function
    - Add `thinkingLevel` to `UpdateSessionData` and update the `updateSession` function
    - _Requirements: 6.1, 6.2_

- [x] 2. Provider store generation params integration
  - [x] 2.1 Update `src/stores/provider-store.ts` to expose generation params
    - Add `generationParams` field to the `Provider` type re-export (from provider-repo)
    - Ensure `addProvider` defaults `generationParams` to `{ temperature: 0.7, maxTokens: 4096 }` when not provided
    - Ensure `updateProvider` supports updating `generationParams` field
    - _Requirements: 2.1, 2.3_

- [x] 3. Session model and thinking level persistence
  - [x] 3.1 Update ChatStore to persist model selection in `src/stores/chat-store.ts`
    - Modify `switchModel` to also persist `providerId` and `modelId` to the active session via `useSessionStore.getState().renameSession` → actually use a new helper or direct DB call via session store's `setActiveSession` flow
    - Better approach: call `updateSession(sessionId, { providerId, modelId })` from within ChatShell when model is switched (since ChatStore shouldn't directly depend on SessionStore for writes)
    - _Requirements: 5.1_

  - [x] 3.2 Update ChatShell to restore model and thinking level on session switch
    - In `handleSessionSelect`, after `setActiveSession(id)`, read the session's `providerId`, `modelId`, and `thinkingLevel` from the session store
    - If providerId and modelId are non-null, call `switchModel(providerId, modelId)` on ChatStore
    - If thinkingLevel is non-null, call `setThinkingLevel(thinkingLevel)` on ChatStore; otherwise default to 'off'
    - _Requirements: 5.2, 5.3, 6.2, 6.3_

  - [x] 3.3 Persist thinking level changes to session
    - In ChatShell's `handleThinkingCycle`, after cycling the level, persist the new level to the active session via SessionStore `updateSession`
    - _Requirements: 6.1_

  - [x] 3.4 Persist model selection changes to session
    - In ChatShell's `handleModelSelect`, after `switchModel(providerId, modelId)`, persist to the active session via SessionStore `updateSession`
    - _Requirements: 5.1_

- [x] 4. CompletionService system prompt and generation params
  - [x] 4.1 Update `src/services/completion-service.ts` to accept and inject generation params
    - Add `temperature` and `maxTokens` to `CompletionServiceOptions`
    - Include them in the `CompletionRequest` built by `streamCompletion` and `complete`
    - _Requirements: 2.4_

  - [x] 4.2 Update `src/hooks/useChat.ts` to pass generation params from provider store
    - Read `providerConfig.generationParams` when building `CompletionServiceOptions`
    - Pass `temperature` and `maxTokens` to the options
    - _Requirements: 2.4_

  - [x] 4.3 Update `src/hooks/useChat.ts` to prepend system prompt
    - Before calling `streamCompletion` or `complete`, read `defaultSystemPromptId` from settings store
    - If non-null, find the matching system prompt and prepend `{ role: 'system', content: prompt.content }` at index 0 of the chatMessages array
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 5. SettingsScreen wiring
  - [x] 5.1 Wire system prompts in `src/components/overlays/SettingsScreen.tsx`
    - Replace the empty `systemPrompts` useMemo array with `useSettingsStore((s) => s.systemPrompts)`
    - Read `defaultSystemPromptId` from settings store to show the default checkmark
    - Wire "Add Prompt" button to settings store's `addSystemPrompt` action (open a simple dialog or inline form)
    - Wire tap on default checkmark to `setDefaultSystemPromptId`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 5.2 Wire generation parameters in SettingsScreen
    - Replace hardcoded "0.7" and "4096" with values from the active provider's `generationParams`
    - Determine "active provider" as the first provider or the one currently selected in ChatStore
    - On tap of a generation param row, open an edit modal/dialog that persists changes via `updateProvider(providerId, { generationParams: { ... } })`
    - _Requirements: 2.2, 2.3_

- [x] 6. ProviderCard enhancements
  - [x] 6.1 Load and display masked API key suffix in ProviderCard
    - Create a `useMaskedKey(providerId)` hook that async-loads from `getApiKey(providerId)` and returns last 4 chars
    - Replace `maskApiKey(null)` with the hook's output
    - Show "••••" while loading, "No key" when no key stored
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 6.2 Display connection status dot on ProviderCard
    - Read `connectionStatuses[provider.id]` from ProviderStore
    - Render an 8×8pt circle: green (#34C759) for 'connected', red (#FF3B30) for 'failed', gray (#8E8E93) for 'untested'
    - Position left of the provider name
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 7. Checkpoint - Verify store integration
  - Ensure all tests pass and the app builds without errors.

- [x] 8. MessageFlow cost display
  - [x] 8.1 Add cost metadata line to `src/components/chat/MessageFlow.tsx`
    - Below the message body, conditionally render when `message.promptTokens`, `message.completionTokens`, and `message.cost` are all non-null
    - Format: `formatTokenMetadata(promptTokens, completionTokens)` + ` · $${cost.toFixed(3)}`
    - Style: textTertiary color, 11pt monospace, right-aligned on sender row
    - Import `formatTokenMetadata` from `src/utils/token-formatting.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 9. ErrorBanner component and wiring
  - [x] 9.1 Create `src/components/chat/ErrorBanner.tsx`
    - Implement `ErrorBannerProps: { message, detail?, isRetryable, onRetry, onDismiss }`
    - Render inline in message stream style: warning icon + single-line message + expandable detail + Retry button
    - Use theme colors: error color for icon, textSecondary for message, accent for retry button
    - VoiceOver: announce error, label retry button
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 9.2 Wire ErrorBanner in `src/components/layout/ChatShell.tsx`
    - Import `useChat` error state (currently useChat is already used in ChatShell)
    - When `error` is non-null and not streaming, render ErrorBanner as ListFooterComponent or after the streaming footer
    - Pass `onRetry` → `retry()`, `onDismiss` → `clearError()`
    - On successful retry, error clears automatically
    - _Requirements: 8.1, 8.4_

- [x] 10. Delete duplicate ProviderDetailScreen
  - [x] 10.1 Remove `src/screens/ProviderDetailScreen.tsx`
    - Delete the file
    - _Requirements: 9.1_

  - [x] 10.2 Remove `src/screens/__tests__/ProviderDetailScreen.test.ts` (if it exists)
    - Delete the test file if present
    - _Requirements: 9.2_

  - [x] 10.3 Clean up imports referencing `src/screens/ProviderDetailScreen`
    - Search for imports of the deleted file in navigation types, route configs, or other files
    - Remove or redirect them
    - _Requirements: 9.3, 9.4_

- [x] 11. CompletionRequest type extension
  - [x] 11.1 Add `temperature` field to `CompletionRequest` in `src/providers/types.ts`
    - Add optional `temperature?: number` field
    - Ensure Anthropic, OpenAI, and Custom providers pass it through to their API calls
    - _Requirements: 2.4_

- [x] 12. Provider adapters: pass temperature and maxTokens
  - [x] 12.1 Update AnthropicProvider to pass `temperature` from CompletionRequest
    - In `complete()` and `streamCompletion()`, include `temperature` in the SDK call when it's defined
    - _Requirements: 2.4_

  - [x] 12.2 Update OpenAIProvider to pass `temperature` from CompletionRequest
    - In both chat-completions and responses modes, include `temperature` when defined
    - _Requirements: 2.4_

  - [x] 12.3 Update CustomProvider to pass `temperature` from CompletionRequest
    - Include in the fetch request body when defined
    - _Requirements: 2.4_

- [x] 13. Checkpoint - Full integration verification
  - Ensure all tests pass and the app builds without errors.

- [x] 14. Property tests
  - [x] 14.1 Write property tests for generation params schema invariant
    - **Property 3: Generation Params Schema Invariant**
    - **Validates: Requirements 2.1**
    - Verify temperature in [0.0, 2.0], maxTokens positive integer, defaults correct
    - Place in `src/stores/__tests__/provider-store.property.test.ts`

  - [x] 14.2 Write property tests for API key masking
    - **Property 6: API Key Masking**
    - **Validates: Requirements 3.1, 3.3**
    - For any key length ≥ 4, output ends with last 4 chars; for no key → "No key"
    - Place in `src/components/overlays/__tests__/provider-card.property.test.ts`

  - [x] 14.3 Write property tests for connection status mapping
    - **Property 7: Connection Status Mapping**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - For each status value, verify correct color output

  - [x] 14.4 Write property tests for model selection round-trip
    - **Property 8: Model Selection Round-Trip Persistence**
    - **Validates: Requirements 5.1, 5.2**
    - Switch model, switch away, switch back → same model restored

  - [x] 14.5 Write property tests for thinking level round-trip
    - **Property 9: Thinking Level Round-Trip Persistence**
    - **Validates: Requirements 6.1, 6.2**
    - Set thinking level, switch away, switch back → same level restored

  - [x] 14.6 Write property tests for cost metadata formatting
    - **Property 10: Cost Metadata Conditional Formatting**
    - **Validates: Requirements 7.1, 7.2, 7.4**
    - Non-null fields → formatted output; any null → no output

  - [x] 14.7 Write property tests for error banner retry visibility
    - **Property 11: Error Banner Retry Visibility**
    - **Validates: Requirements 8.2, 8.3**
    - isRetryable true → retry visible; false → no retry

  - [x] 14.8 Write property tests for system prompt prepend
    - **Property 12: System Prompt Prepend Correctness**
    - **Validates: Requirements 10.1, 10.2, 10.3**
    - Non-null default → messages[0] is system; null → no system prepend

  - [x] 14.9 Write property tests for context ring computation
    - **Property 13 + 14: Context Ring Usage + Thresholds**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
    - Verify percentage calculation and color thresholds

- [x] 15. Final checkpoint
  - Ensure all tests pass, TypeScript compiles cleanly, and the app runs correctly.

## Notes

- The Session schema already has `provider_id` and `model_id` columns, so model persistence per session only requires wiring the ChatStore/ChatShell to use the existing updateSession function — no new migration needed for that.
- The `thinking_level` column IS new and requires the v2 migration.
- The `generation_params` column IS new and requires the v2 migration.
- The useChat hook already calculates cost and stores it on messages — we just need MessageFlow to display it.
- The SettingsStore already has full system prompt CRUD — we just need SettingsScreen to read from it instead of an empty array.
- ErrorBanner is a new component but the error state and retry mechanism already exist in useChat.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "10.1", "10.2", "10.3", "11.1"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "4.1", "12.1", "12.2", "12.3"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1", "5.2", "6.1", "6.2"] },
    { "id": 4, "tasks": ["8.1", "9.1"] },
    { "id": 5, "tasks": ["9.2"] },
    { "id": 6, "tasks": ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "14.8", "14.9"] }
  ]
}
```
