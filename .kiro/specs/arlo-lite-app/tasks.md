# Implementation Plan: Arlo Lite App

## Overview

Build the Arlo Lite React Native app incrementally, starting with project scaffold and core infrastructure, then layering in features module by module. The architecture follows a layered approach: Data → Domain → Provider → State → Presentation. Each task builds on the previous one so there is no orphaned code.

## Tasks

- [x] 1. Initialize Expo project and establish folder structure
  - [x] 1.1 Scaffold Expo project and configure base dependencies
    - Initialize Expo managed-workflow project with TypeScript template
    - Install core dependencies: zustand, expo-sqlite, expo-secure-store, react-navigation, i18next, react-i18next, react-native-markdown-display, react-syntax-highlighter, uuid, fast-check (dev)
    - Configure `tsconfig.json` with strict mode and path aliases
    - Create the full directory structure as defined in the design (`src/app`, `src/navigation`, `src/screens`, `src/components/chat`, `src/components/common`, `src/components/settings`, `src/providers`, `src/providers/openai`, `src/providers/anthropic`, `src/providers/custom`, `src/providers/sse`, `src/stores`, `src/domain`, `src/database`, `src/database/migrations`, `src/database/repositories`, `src/services`, `src/i18n`, `src/i18n/locales`, `src/theme`, `src/hooks`, `src/utils`, `src/constants`)
    - _Requirements: 21.1, 21.2, 21.3_

  - [x] 1.2 Set up utility modules and constants
    - Implement `src/utils/uuid.ts` (UUID v4 generation wrapper)
    - Implement `src/utils/date.ts` (timestamp helpers)
    - Implement `src/utils/clipboard.ts` (clipboard write wrapper)
    - Implement `src/constants/defaults.ts` (default system prompt text, default provider URLs, app metadata)
    - _Requirements: 14.1, 1.3, 1.4_

- [x] 2. Set up theming, i18n, and accessibility foundations
  - [x] 2.1 Implement theme system
    - Create `src/theme/colors.ts` with light and dark color palettes maintaining 4.5:1 contrast ratio
    - Create `src/theme/typography.ts` with dynamic font sizing support based on device accessibility settings
    - Create `src/theme/spacing.ts` with consistent spacing scale
    - Create `src/theme/index.ts` exporting a unified theme object with `useTheme` hook support
    - _Requirements: 17.1, 17.2, 17.4_

  - [x] 2.2 Implement i18n setup
    - Create `src/i18n/index.ts` with i18next initialization, device locale detection, lazy-loaded locale files
    - Create `src/i18n/locales/en.json` with all English UI strings
    - Create `src/i18n/locales/zh-TW.json` with Traditional Chinese translations
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 2.3 Write unit tests for theme and i18n
    - Test color contrast ratios meet 4.5:1 minimum
    - Test locale detection and fallback to English
    - Test dynamic font size scaling
    - _Requirements: 17.4, 18.3_

- [x] 3. Implement database layer and secure storage
  - [x] 3.1 Set up SQLite database initialization and migrations
    - Create `src/database/database.ts` with DB initialization, WAL mode, and migration runner
    - Create `src/database/migrations/v1.ts` with the full schema (providers, models, sessions, messages, system_prompts, model_metadata, sync_log tables and indexes)
    - _Requirements: 5.1, 5.6_

  - [x] 3.2 Implement database repositories
    - Create `src/database/repositories/provider-repo.ts` (CRUD for providers table, cascade delete models)
    - Create `src/database/repositories/session-repo.ts` (CRUD for sessions, ordered listing by updated_at DESC)
    - Create `src/database/repositories/message-repo.ts` (CRUD for messages, cascade delete with session, ordered by created_at ASC)
    - Create `src/database/repositories/system-prompt-repo.ts` (CRUD for system prompts, default management)
    - _Requirements: 1.9, 5.1, 5.3, 5.4, 5.5, 5.6, 14.2, 14.3, 14.5_

  - [x] 3.3 Implement secure storage wrapper
    - Create `src/database/secure-store.ts` wrapping expo-secure-store with key pattern `arlo:provider:{providerId}:apiKey`
    - Implement `storeApiKey`, `getApiKey`, `deleteApiKey` functions
    - Ensure API keys never appear in logs or serializable state
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.4 Write property test for cascade deletion integrity
    - **Property 9: Cascade deletion integrity**
    - **Validates: Requirements 1.9, 5.5**

  - [x] 3.5 Write property test for session list ordering
    - **Property 12: Session list ordering**
    - **Validates: Requirements 5.3**

  - [x] 3.6 Write unit tests for database repositories
    - Test provider CRUD with cascade delete
    - Test session ordering by updated_at
    - Test message insertion and retrieval order
    - Test system prompt default designation
    - _Requirements: 1.9, 5.1, 5.3, 5.5_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Zustand stores
  - [x] 5.1 Implement provider store
    - Create `src/stores/provider-store.ts` with Zustand store for providers and models state
    - Implement actions: addProvider, updateProvider, deleteProvider (with cascade), addModel, deleteModel
    - Integrate with provider-repo and secure-store for persistence
    - _Requirements: 1.1, 1.2, 1.8, 1.9, 2.1, 2.6_

  - [x] 5.2 Implement session store
    - Create `src/stores/session-store.ts` with Zustand store for sessions and messages
    - Implement actions: createSession, deleteSession, renameSession, addMessage, editMessage (discard subsequent), setActiveSession
    - Integrate with session-repo and message-repo for persistence
    - Auto-generate title from first user message (truncate to 50 chars)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 9.2_

  - [x] 5.3 Implement chat store
    - Create `src/stores/chat-store.ts` with streaming state, active model tracking, thinking level
    - Implement actions: setStreaming, appendStreamContent, clearStream, setThinkingLevel, switchModel
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 8.1_

  - [x] 5.4 Implement settings store
    - Create `src/stores/settings-store.ts` with theme, locale, system prompts, and default prompt management
    - Implement persist middleware for non-sensitive config
    - _Requirements: 14.3, 14.4, 17.1_

  - [x] 5.5 Write property test for session title truncation
    - **Property 7: Session title truncation**
    - **Validates: Requirements 5.2**

  - [x] 5.6 Write property test for message edit discards subsequent messages
    - **Property 8: Message edit discards subsequent messages**
    - **Validates: Requirements 9.2**

- [x] 6. Implement domain logic layer
  - [x] 6.1 Implement cost calculator
    - Create `src/domain/cost-calculator.ts` with functions: calculateMessageCost, calculateSessionTotal
    - Formula: (promptTokens × inputPrice + completionTokens × outputPrice) / 1_000_000
    - Handle null prices by returning null cost
    - _Requirements: 12.1, 12.2, 12.3_

  - [x] 6.2 Implement context tracker
    - Create `src/domain/context-tracker.ts` with context usage percentage calculation
    - Formula: (tokenCount / contextWindow) × 100
    - Never auto-truncate messages
    - _Requirements: 11.1, 11.2, 11.4_

  - [x] 6.3 Implement token estimator
    - Create `src/domain/token-estimator.ts` with character-based approximation for when provider doesn't return usage
    - Ensure monotonicity: estimate(prefix) ≤ estimate(fullString)
    - _Requirements: 11.3_

  - [x] 6.4 Implement thinking level mapper
    - Create `src/domain/thinking-mapper.ts` mapping ThinkingLevel to provider-specific params
    - OpenAI: off → omit param, minimal/low/medium/high → reasoning_effort values, xhigh → clamp to high
    - Anthropic: off → thinking disabled, minimal → 1024, low → 2048, medium → 8192, high → 16384, xhigh → clamp to high (16384)
    - _Requirements: 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

  - [x] 6.5 Implement session manager
    - Create `src/domain/session-manager.ts` with business logic for session lifecycle
    - Implement message regeneration (resend context, replace last assistant message)
    - _Requirements: 9.1, 9.2_

  - [x] 6.6 Write property test for cost calculation accuracy
    - **Property 4: Cost calculation accuracy**
    - **Validates: Requirements 12.1, 12.2**

  - [x] 6.7 Write property test for context usage percentage
    - **Property 5: Context usage percentage is bounded**
    - **Validates: Requirements 11.2**

  - [x] 6.8 Write property test for token estimation monotonicity
    - **Property 6: Token estimation is monotonic**
    - **Validates: Requirements 11.3**

  - [x] 6.9 Write property test for thinking level mapping correctness
    - **Property 2: Thinking level mapping correctness**
    - **Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement provider adapters
  - [x] 8.1 Define provider interface and types
    - Create `src/providers/types.ts` with full IProvider interface, ProviderConfig, ModelConfig, ChatMessage, StreamChunk, TokenUsage, CompletionRequest, CompletionResponse types
    - _Requirements: 20.1, 20.3_

  - [x] 8.2 Implement OpenAI provider adapter
    - Create `src/providers/openai/openai-provider.ts` implementing IProvider
    - Create `src/providers/openai/openai-responses.ts` for Responses API request/response format
    - Create `src/providers/openai/openai-chat.ts` for Chat Completions API request/response format
    - Implement buildRequest, parseResponse, parseStreamChunk, mapThinkingLevel, listModels, validateApiKey
    - _Requirements: 4.1, 4.2, 2.5_

  - [x] 8.3 Implement Anthropic provider adapter
    - Create `src/providers/anthropic/anthropic-provider.ts` implementing IProvider
    - Format requests per Anthropic Messages API (x-api-key header, system as top-level param, anthropic-version header)
    - Handle Anthropic thinking blocks with budget_tokens
    - Implement buildRequest, parseResponse, parseStreamChunk, mapThinkingLevel, listModels, validateApiKey
    - _Requirements: 4.3, 7.4, 7.5, 7.6, 7.7, 7.8, 2.5_

  - [x] 8.4 Implement Custom provider adapter
    - Create `src/providers/custom/custom-provider.ts` implementing IProvider
    - Use OpenAI Chat Completions format with user-supplied base URL
    - _Requirements: 4.4_

  - [x] 8.5 Implement provider registry
    - Create `src/providers/registry.ts` as a factory that returns the appropriate IProvider instance based on ProviderType
    - Ensure adding new providers requires only implementing IProvider interface
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 8.6 Write property test for provider request format correctness
    - **Property 1: Provider request format correctness**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**

  - [x] 8.7 Write unit tests for provider adapters
    - Test request building for each provider type with various message configurations
    - Test response parsing for streaming and non-streaming
    - Test thinking level mapping per provider
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 9. Implement SSE streaming layer
  - [x] 9.1 Implement SSE manager and parsers
    - Create `src/providers/sse/sse-manager.ts` with createSSEStream function (fetch-based, ReadableStream, abort controller)
    - Create `src/providers/sse/openai-parser.ts` parsing OpenAI SSE format (data: lines, [DONE] terminator)
    - Create `src/providers/sse/anthropic-parser.ts` parsing Anthropic SSE format (event types: content_block_delta, message_delta, etc.)
    - Implement abort/cancel via AbortController
    - _Requirements: 4.5, 4.6, 8.1, 8.2, 8.3_

  - [x] 9.2 Write property test for SSE chunk parsing
    - **Property 3: SSE chunk parsing produces valid output**
    - **Validates: Requirements 4.5, 8.1**

- [x] 10. Implement navigation and root layout
  - [x] 10.1 Set up React Navigation structure
    - Create `src/navigation/RootNavigator.tsx` with Stack navigator (Drawer + Settings routes)
    - Create `src/navigation/DrawerNavigator.tsx` with drawer containing session list and chat screen
    - Create `src/navigation/SettingsNavigator.tsx` with stack for settings flow (ProviderList → ProviderDetail → ModelDetail, SystemPrompts, About)
    - _Requirements: 5.3, 6.1_

  - [x] 10.2 Set up root app layout with providers
    - Create `src/app/_layout.tsx` with ThemeProvider, NavigationContainer, i18n provider, database initialization
    - Wire up theme switching (dark/light/system)
    - Implement `src/hooks/useTheme.ts` connecting to settings store and system appearance
    - _Requirements: 17.1, 18.3_

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement common UI components
  - [x] 12.1 Build common reusable components
    - Create `src/components/common/Button.tsx` with accessibility labels, theme-aware styling
    - Create `src/components/common/Card.tsx` for list items
    - Create `src/components/common/ErrorBanner.tsx` with compact/expandable error display pattern
    - Create `src/components/common/LoadingSpinner.tsx`
    - Create `src/components/common/NetworkStatus.tsx` showing network unavailable indicator
    - All components must include accessibilityLabel props
    - _Requirements: 16.1, 16.2, 16.4, 17.3_

  - [x] 12.2 Implement network monitoring hook
    - Create `src/hooks/useNetwork.ts` using NetInfo to detect connectivity changes
    - Create `src/services/network-monitor.ts` for connectivity state management
    - _Requirements: 16.4, 19.2_

- [x] 13. Implement provider management screens
  - [x] 13.1 Build Provider List screen
    - Create `src/screens/ProviderListScreen.tsx` displaying all configured providers
    - Create `src/components/settings/ProviderCard.tsx` for provider list items
    - Include add provider button and navigation to detail
    - _Requirements: 1.1_

  - [x] 13.2 Build Provider Detail screen (create/edit)
    - Create `src/screens/ProviderDetailScreen.tsx` with form for provider type selection, name, API key, base URL
    - Default base URLs per type (OpenAI: `https://api.openai.com/v1`, Anthropic: `https://api.anthropic.com`)
    - OpenAI API mode selector (Responses/Chat Completions, default Responses)
    - Streaming toggle (default enabled)
    - Delete provider with confirmation
    - Prevent provider type change on edit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_

  - [x] 13.3 Build Model Detail screen
    - Create `src/screens/ModelDetailScreen.tsx` with model selection (from API list or manual entry)
    - Create `src/components/settings/ModelCard.tsx` for model list items
    - Integrate metadata service for prefilling context window and pricing
    - Allow user override of all prefilled values
    - API key validation on first model add (minimal request, max_tokens: 10)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 13.4 Implement metadata service
    - Create `src/services/metadata-service.ts` fetching remote metadata table JSON
    - Cache results in model_metadata SQLite table
    - Lookup by model ID for prefilling
    - _Requirements: 2.2, 2.3_

  - [x] 13.5 Write property test for metadata lookup correctness
    - **Property 11: Metadata lookup correctness**
    - **Validates: Requirements 2.2, 2.3**

- [ ] 14. Implement chat screen and messaging
  - [x] 14.1 Build Chat Screen with message list
    - Create `src/screens/ChatScreen.tsx` with FlatList of messages, auto-scroll, keyboard avoidance
    - Create `src/components/chat/MessageBubble.tsx` with role-based styling (user/assistant)
    - Implement markdown rendering in assistant messages (headings, bold, italic, links, lists, tables)
    - Create `src/components/chat/CodeBlock.tsx` with syntax highlighting and copy button
    - All interactive elements must have accessibility labels
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 17.3_

  - [-] 14.2 Build message input and send flow
    - Create `src/components/chat/MessageInput.tsx` with text input, send button, attachment options
    - Wire send flow: add user message → build request → send to provider → add assistant message
    - Handle streaming: update UI incrementally as chunks arrive, show stop button
    - Handle non-streaming: show loading, display full response on receipt
    - Disable input when offline
    - _Requirements: 4.5, 4.6, 8.1, 8.2, 8.3, 19.2_

  - [-] 14.3 Implement streaming indicators and controls
    - Create `src/components/chat/StreamingIndicator.tsx` for in-progress streaming
    - Create `src/components/chat/ThinkingIndicator.tsx` with blinking animation during thinking phase
    - Implement stop generation button that aborts the SSE connection and discards partial message
    - Implement thinking content expand/collapse after completion
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [-] 14.4 Implement model switcher and thinking level selector
    - Create `src/components/chat/ModelSwitcher.tsx` accessible from chat screen without navigation
    - Create `src/components/chat/ThinkingLevelSelector.tsx` with off/minimal/low/medium/high/xhigh options
    - Show/hide thinking selector based on model reasoning support
    - Record model switch in session metadata
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2_

  - [~] 14.5 Implement context usage bar and cost display
    - Create `src/components/chat/ContextUsageBar.tsx` showing percentage of context window used
    - Display per-message cost and running session total
    - Hide cost when prices not configured
    - _Requirements: 11.1, 11.2, 12.1, 12.2, 12.3_

- [ ] 15. Implement message actions
  - [~] 15.1 Implement regenerate, edit, and copy actions
    - Add regenerate action on last assistant message (resend context, replace response)
    - Add edit action on user messages (discard subsequent messages, resend with updated content)
    - Add copy action on messages (full text to clipboard)
    - Add copy action on code blocks (code content to clipboard)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [~] 16. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Implement session management screens
  - [~] 17.1 Build Session List (Drawer content)
    - Create `src/screens/SessionListScreen.tsx` as drawer content showing sessions ordered by last-modified
    - Implement new session creation button
    - Implement session rename (inline edit)
    - Implement session delete with confirmation
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [ ] 18. Implement system prompt management
  - [~] 18.1 Build System Prompts screen
    - Create `src/screens/SystemPromptsScreen.tsx` with list of prompts, create/edit/delete
    - Show built-in default system prompt (non-deletable)
    - Allow user to designate a prompt as default for new sessions
    - Apply default system prompt when creating new sessions
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [ ] 19. Implement multimodal input
  - [~] 19.1 Implement image and file attachments
    - Add image picker integration (photo library + camera) when model supports image input
    - Add file picker integration when model supports file input
    - Encode images as base64 content parts in message
    - Display generated images inline in chat when model supports image generation
    - _Requirements: 13.1, 13.2, 13.4_

  - [~] 19.2 Implement voice dictation
    - Add voice dictation button using on-device speech-to-text (expo-speech or platform native)
    - Transcribe spoken input into text field
    - _Requirements: 13.3_

- [ ] 20. Implement error handling and offline access
  - [~] 20.1 Implement error display and retry flow
    - Wire error handling in chat: compact inline error message, tap to expand full detail
    - Add retry button for transient errors (network, rate limit, server errors)
    - Show network unavailable indicator and prevent message sending when offline
    - Allow read-only access to all locally persisted sessions when offline
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 19.1, 19.2_

- [ ] 21. Implement settings and about screens
  - [~] 21.1 Build Settings screen
    - Create `src/screens/SettingsScreen.tsx` with navigation to providers, system prompts, about
    - Create `src/components/settings/ThemeSelector.tsx` with dark/light/system options
    - _Requirements: 17.1_

  - [~] 21.2 Build About screen
    - Create `src/screens/AboutScreen.tsx` with app version, open source license info, links
    - _Requirements: 21.3_

- [ ] 22. Implement cloud backup service
  - [~] 22.1 Implement backup and sync
    - Create `src/services/backup-service.ts` with export/import logic
    - Sync sessions, providers (excluding API keys), models, messages, system prompts, settings
    - Exclude file attachments and generated images from sync
    - Implement last-write-wins conflict resolution using updatedAt timestamps
    - Propagate session deletion to synced devices
    - Ensure API keys are excluded from backup payloads
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [~] 22.2 Write property test for sync conflict resolution
    - **Property 13: Sync conflict resolution (last-write-wins)**
    - **Validates: Requirements 15.5**

  - [~] 22.3 Write property test for API keys only in secure storage
    - **Property 10: API keys exist only in secure storage**
    - **Validates: Requirements 3.1, 3.2, 3.3, 15.6**

  - [~] 22.4 Write property test for context never auto-truncated
    - **Property 14: Context never auto-truncated**
    - **Validates: Requirements 11.4**

- [~] 23. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design
- Unit tests validate specific examples and edge cases
- UI mockups will be provided later — initial UI implementations should follow the navigation structure and be functional but visually minimal
- The provider adapter pattern means new LLM providers can be added by implementing IProvider without touching chat or session logic

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2"] },
    { "id": 2, "tasks": ["2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6"] },
    { "id": 5, "tasks": ["5.1", "5.4"] },
    { "id": 6, "tasks": ["5.2", "5.3", "6.1", "6.2", "6.3", "6.4"] },
    { "id": 7, "tasks": ["5.5", "5.6", "6.5", "6.6", "6.7", "6.8", "6.9"] },
    { "id": 8, "tasks": ["8.1"] },
    { "id": 9, "tasks": ["8.2", "8.3", "8.4", "8.5"] },
    { "id": 10, "tasks": ["8.6", "8.7", "9.1"] },
    { "id": 11, "tasks": ["9.2", "10.1", "10.2"] },
    { "id": 12, "tasks": ["12.1", "12.2"] },
    { "id": 13, "tasks": ["13.1", "13.2", "13.4"] },
    { "id": 14, "tasks": ["13.3", "13.5", "14.1"] },
    { "id": 15, "tasks": ["14.2", "14.3", "14.4", "14.5"] },
    { "id": 16, "tasks": ["15.1", "17.1", "18.1"] },
    { "id": 17, "tasks": ["19.1", "19.2", "20.1"] },
    { "id": 18, "tasks": ["21.1", "21.2", "22.1"] },
    { "id": 19, "tasks": ["22.2", "22.3", "22.4"] }
  ]
}
```
