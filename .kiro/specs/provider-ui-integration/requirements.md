# Requirements Document

## Introduction

This feature integrates the existing provider, settings, chat, and completion layers into a fully wired end-to-end experience. The focus is breadth — connecting all data-flow points between stores, UI components, and the completion service so that settings are live, cost data renders, errors surface inline, and stale duplicates are removed.

## Glossary

- **SettingsScreen**: The full-screen overlay component at `src/components/overlays/SettingsScreen.tsx` providing provider management, system prompt management, and generation parameter editing.
- **ProviderDetailScreen**: The overlay component at `src/components/overlays/ProviderDetailScreen.tsx` showing a single provider's models and API key field.
- **ProviderStore**: The Zustand store at `src/stores/provider-store.ts` managing providers, models, and connection status.
- **SettingsStore**: The Zustand store at `src/stores/settings-store.ts` managing theme, locale, default system prompt, and system prompt CRUD.
- **ChatStore**: The Zustand store at `src/stores/chat-store.ts` managing ephemeral streaming state, active provider/model, and thinking level.
- **CompletionService**: The service at `src/services/completion-service.ts` orchestrating completion requests.
- **MessageFlow**: The message rendering component at `src/components/chat/MessageFlow.tsx`.
- **SecureStore**: The `expo-secure-store` based module at `src/database/secure-store.ts` for API key storage and retrieval.
- **ConnectionStatus**: A provider's connectivity state — one of `untested`, `connected`, or `failed`.
- **GenerationParameters**: Per-provider settings for temperature (0.0–2.0) and maxTokens (integer) sent with completion requests.
- **ErrorBanner**: An inline error display rendered in the message stream showing a short message, expandable detail, and retry action.
- **ContextRing**: The context usage indicator near the input field showing approximate token usage as a percentage of the model's context window.

## Requirements

### Requirement 1: System Prompts Integration in SettingsScreen

**User Story:** As a user, I want the SettingsScreen to display my saved system prompts so that I can view, add, edit, and set a default without navigating elsewhere.

#### Acceptance Criteria

1. WHEN the SettingsScreen mounts, THE SettingsScreen SHALL read system prompts from the SettingsStore `systemPrompts` array and render each as a list row showing name, content preview (first 60 characters), and default indicator.
2. WHEN the SettingsStore `systemPrompts` array is empty, THE SettingsScreen SHALL display the text "No system prompts configured" with an "Add Prompt" action.
3. WHEN the user taps "Add Prompt", THE SettingsScreen SHALL invoke the SettingsStore `addSystemPrompt` action with the user-provided name and content.
4. WHEN the user taps the default checkmark on a system prompt row, THE SettingsScreen SHALL invoke the SettingsStore `setDefaultSystemPromptId` action with that prompt's id.

### Requirement 2: Per-Provider Generation Parameters

**User Story:** As a user, I want to configure temperature and maxTokens per provider so that different providers use different generation settings.

#### Acceptance Criteria

1. THE ProviderStore schema SHALL include a `generationParams` field per provider containing `temperature` (number, range 0.0–2.0, default 0.7) and `maxTokens` (integer, default 4096).
2. WHEN the user views the Generation Parameters section in SettingsScreen, THE SettingsScreen SHALL display the active provider's stored temperature and maxTokens values instead of hardcoded strings.
3. WHEN the user edits a generation parameter value, THE SettingsScreen SHALL persist the updated value to the ProviderStore via the `updateProvider` action for the currently selected provider.
4. WHEN the CompletionService builds a CompletionRequest, THE CompletionService SHALL include the active provider's `temperature` and `maxTokens` from the ProviderStore in the request payload.

### Requirement 3: API Key Display on Provider Cards

**User Story:** As a user, I want provider cards to show the last 4 characters of my stored API key so that I can confirm which key is configured without revealing the full secret.

#### Acceptance Criteria

1. WHEN the SettingsScreen renders a ProviderCard, THE ProviderCard SHALL retrieve the masked API key suffix (last 4 characters) from SecureStore for the corresponding provider id.
2. WHILE the API key suffix is loading, THE ProviderCard SHALL display "••••" as a placeholder.
3. IF no API key is stored for a provider, THEN THE ProviderCard SHALL display "No key" in the masked key position.

### Requirement 4: Connection Status Indicators on Provider Cards

**User Story:** As a user, I want to see a colored status dot on each provider card so that I can quickly identify which providers are connected, failed, or untested.

#### Acceptance Criteria

1. WHEN a provider's ConnectionStatus is `connected`, THE ProviderCard SHALL display a green dot (8×8pt circle) to the left of the provider name.
2. WHEN a provider's ConnectionStatus is `failed`, THE ProviderCard SHALL display a red dot (8×8pt circle) to the left of the provider name.
3. WHEN a provider's ConnectionStatus is `untested`, THE ProviderCard SHALL display a gray dot (8×8pt circle) to the left of the provider name.
4. THE ProviderCard SHALL read connection status from the ProviderStore `connectionStatuses` record keyed by provider id.

### Requirement 5: Model Selection Persistence

**User Story:** As a user, I want my selected model to persist across session switches so that switching sessions restores the last-used model for each session.

#### Acceptance Criteria

1. WHEN the user switches the active model via the model picker, THE ChatStore SHALL persist the `activeProviderId` and `activeModelId` to the active session record in the SessionStore.
2. WHEN the user switches to an existing session, THE ChatStore SHALL restore `activeProviderId` and `activeModelId` from that session's stored provider and model ids.
3. IF a session has no stored provider or model id, THEN THE ChatStore SHALL retain the current active provider and model without change.

### Requirement 6: Thinking Level Persistence Per Session

**User Story:** As a user, I want my thinking level setting to persist per session so that each conversation remembers its reasoning effort preference.

#### Acceptance Criteria

1. WHEN the user cycles the thinking level control, THE ChatStore SHALL persist the updated `thinkingLevel` value to the active session record in the SessionStore.
2. WHEN the user switches to an existing session, THE ChatStore SHALL restore the `thinkingLevel` from that session's stored thinking level value.
3. IF a session has no stored thinking level, THEN THE ChatStore SHALL default to `off`.

### Requirement 7: Cost Display in MessageFlow

**User Story:** As a user, I want to see cost and token usage below each assistant message so that I can track per-message spending at a glance.

#### Acceptance Criteria

1. WHEN an assistant message has non-null `promptTokens`, `completionTokens`, and `cost` fields, THE MessageFlow component SHALL render a faint metadata line below the message body showing formatted token counts and cost.
2. THE cost metadata line SHALL use the format "{inputTokens} in / {outputTokens} out · ${cost}" with cost rounded to 3 decimal places.
3. THE cost metadata line SHALL use `textTertiary` color at 11pt monospace font to remain unobtrusive.
4. WHEN an assistant message has null cost or null token fields, THE MessageFlow component SHALL omit the cost metadata line entirely.

### Requirement 8: Error Banner Wiring

**User Story:** As a user, I want API errors to appear inline in the message stream so that I can see what went wrong and retry without disruption.

#### Acceptance Criteria

1. WHEN the `useChat` hook `error` state is non-null, THE ChatShell SHALL render an ErrorBanner component in the message list at the position where the assistant reply would appear.
2. THE ErrorBanner SHALL display the `error.message` text as a single line, expandable to show `error.detail` when tapped.
3. WHEN the error is retryable (`error.isRetryable` is true), THE ErrorBanner SHALL display a "Retry" button that invokes the `useChat` hook `retry` action.
4. WHEN the user taps "Retry" and the retry succeeds, THE ErrorBanner SHALL dismiss and the assistant response SHALL render in its place.

### Requirement 9: Delete Duplicate ProviderDetailScreen

**User Story:** As a developer, I want only one ProviderDetailScreen to exist so that the codebase has no conflicting implementations.

#### Acceptance Criteria

1. THE file `src/screens/ProviderDetailScreen.tsx` SHALL be deleted from the repository.
2. THE file `src/screens/__tests__/ProviderDetailScreen.test.ts` SHALL be deleted from the repository.
3. THE overlay version at `src/components/overlays/ProviderDetailScreen.tsx` SHALL remain the sole implementation used by ChatShell.
4. IF any import references `src/screens/ProviderDetailScreen`, THEN those references SHALL be removed or redirected to the overlay version.

### Requirement 10: System Prompt Prepend in Completion Requests

**User Story:** As a user, I want my default system prompt to be prepended to every completion request so that the model follows my instructions.

#### Acceptance Criteria

1. WHEN a completion request is initiated and the SettingsStore `defaultSystemPromptId` is non-null, THE CompletionService SHALL prepend the matching system prompt content as a `system` role message at the beginning of the messages array.
2. WHEN the SettingsStore `defaultSystemPromptId` is null, THE CompletionService SHALL send messages without a prepended system prompt.
3. THE system prompt message SHALL appear before all user and assistant messages in the request payload sent to the provider.

### Requirement 11: Context Ring Approximation

**User Story:** As a user, I want the context usage ring to show an approximate fill level so that I can gauge how much of the model's context window I have consumed.

#### Acceptance Criteria

1. THE ContextRing SHALL calculate approximate token usage by dividing total message character count by 4 (chars-per-token approximation).
2. THE ContextRing SHALL divide the approximate token count by the active model's `contextWindow` value to produce a usage percentage.
3. WHEN usage crosses 50%, THE ContextRing color SHALL shift from the default accent hue to orange.
4. WHEN usage crosses 75%, THE ContextRing color SHALL shift from orange to red.
5. IF the active model has no `contextWindow` value, THEN THE ContextRing SHALL display 0% usage.
