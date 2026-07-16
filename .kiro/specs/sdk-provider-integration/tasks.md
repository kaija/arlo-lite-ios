# Implementation Plan: SDK Provider Integration

## Overview

Replace manual HTTP fetch + SSE line-parsing in AnthropicProvider and OpenAIProvider with their official TypeScript SDKs. Refactor the IProvider interface to expose `complete` and `streamCompletion` as sole entry points, introduce structured `ProviderError` classification, create a `CompletionService` orchestration layer, update UI screens with connection status indicators and test connection flows, and migrate the `useChat` hook to use the new service layer.

## Tasks

- [x] 1. Install SDK packages and configure Metro bundler
  - [x] 1.1 Install @anthropic-ai/sdk and openai with pinned versions
    - Run `npx expo install @anthropic-ai/sdk openai` then pin exact versions in package.json (remove ^ or ~)
    - Configure `dangerouslyAllowBrowser: true` for OpenAI SDK (required for React Native non-Node environment)
    - Verify Metro bundler resolves all SDK imports without errors
    - Add any necessary polyfills in metro.config.js if SDKs require Node-specific APIs (e.g., shims for `node:stream`)
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [x] 1.2 Verify TypeScript compilation and build compatibility
    - Run `npx tsc --noEmit` to confirm SDK types compile under strict mode
    - Fix any type errors introduced by SDK package type declarations
    - _Requirements: 10.4_

- [x] 2. Refactor IProvider interface and create ProviderError type
  - [x] 2.1 Define ProviderError class and error categories in `src/providers/errors.ts`
    - Create `ProviderErrorCategory` type: 'authentication' | 'rate_limit' | 'overloaded' | 'network' | 'server'
    - Create `ProviderError` class extending Error with `category`, `retryAfterSeconds`, and `isRetryable` getter
    - _Requirements: 7.1, 7.2, 7.6_

  - [x] 2.2 Refactor IProvider interface in `src/providers/types.ts`
    - Remove `buildRequest`, `parseResponse`, `parseStreamChunk`, `mapThinkingLevel` from IProvider
    - Add `complete(config, request, apiKey): Promise<CompletionResponse>`
    - Add `streamCompletion(config, request, apiKey, signal): AsyncIterable<StreamChunk>`
    - Keep `listModels` and `validateApiKey` unchanged
    - _Requirements: 5.1, 5.2, 5.3, 6.4_

- [x] 3. Implement SDK-based AnthropicProvider
  - [x] 3.1 Rewrite AnthropicProvider with @anthropic-ai/sdk in `src/providers/anthropic/anthropic-provider.ts`
    - Implement lazy SDK client construction with cache keyed by (apiKey, baseUrl)
    - Implement `complete()`: extract system messages, map thinking level, call `client.messages.create({ stream: false })`, map response to CompletionResponse
    - Implement `streamCompletion()`: call `client.messages.stream()`, iterate async events, map to StreamChunk, handle abort via signal
    - Implement error classification: map SDK errors to ProviderError with correct categories (401/403→authentication, 429→rate_limit, 529→overloaded, 5xx→server, network→network)
    - Extract Retry-After from rate-limit errors into `retryAfterSeconds`
    - Update `listModels()` to attempt SDK models endpoint with fallback to curated list
    - Update `validateApiKey()` to use SDK client for validation
    - Remove old `buildRequest`, `parseResponse`, `parseStreamChunk`, `mapThinkingLevel` methods
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 7.1, 7.3, 7.4, 9.2_

  - [x] 3.2 Write property tests for Anthropic request parameter mapping
    - **Property 1: Anthropic request parameter mapping**
    - **Validates: Requirements 1.1, 1.6**
    - Use fast-check to generate arbitrary CompletionRequest objects and verify SDK parameters are correctly mapped

  - [x] 3.3 Write property tests for Anthropic response mapping
    - **Property 2: Anthropic non-streaming response mapping**
    - **Validates: Requirements 1.3**
    - Generate random SDK response objects with N text blocks, 0-1 thinking blocks, arbitrary usage

  - [x] 3.4 Write property tests for Anthropic stream event mapping
    - **Property 3: Anthropic stream event-to-chunk mapping**
    - **Property 4: Anthropic stream usage accumulation**
    - **Property 5: Unrecognized stream events are silently skipped**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.8**

  - [x] 3.5 Write property tests for Anthropic error classification
    - **Property 7: Anthropic error classification**
    - **Validates: Requirements 1.4, 7.1**
    - Generate random HTTP status codes and verify correct ProviderError category assignment

- [x] 4. Implement SDK-based OpenAIProvider
  - [x] 4.1 Rewrite OpenAIProvider with openai SDK in `src/providers/openai/openai-provider.ts`
    - Implement lazy SDK client construction with cache keyed by (apiKey, baseUrl), configured with `maxRetries: 2`, `dangerouslyAllowBrowser: true`
    - Implement `complete()` for both chat-completions and responses modes
    - Implement `streamCompletion()` for both modes: iterate SDK async iterables, map events to StreamChunk, handle abort via signal
    - Implement error classification: map SDK errors to ProviderError (401/403→authentication, 429→rate_limit, 5xx→server, network→network)
    - Extract Retry-After from rate-limit errors into `retryAfterSeconds`
    - Update `listModels()` to use SDK client, sort results alphabetically
    - Update `validateApiKey()` to use SDK client
    - Remove old `buildRequest`, `parseResponse`, `parseStreamChunk`, `mapThinkingLevel` methods
    - Remove helper modules `openai-chat.ts` and `openai-responses.ts` if fully absorbed into SDK calls (or keep shared formatters if CustomProvider still needs them)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 7.2, 7.3, 7.4, 7.5, 9.1_

  - [x] 4.2 Write property tests for OpenAI request parameter mapping
    - **Property 8: OpenAI request parameter mapping**
    - **Validates: Requirements 3.1, 3.2**
    - Verify reasoning_effort/reasoning.effort only included when ThinkingLevel is not 'off'

  - [x] 4.3 Write property tests for OpenAI response and stream mapping
    - **Property 9: OpenAI non-streaming response mapping**
    - **Property 10: OpenAI stream event-to-chunk mapping**
    - **Property 11: OpenAI stream completion with optional usage**
    - **Validates: Requirements 3.4, 4.3, 4.4, 4.5**

  - [x] 4.4 Write property tests for OpenAI error classification
    - **Property 12: OpenAI error classification**
    - **Validates: Requirements 3.5, 7.2**

- [x] 5. Checkpoint - Verify SDK providers compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update CustomProvider to implement new IProvider interface
  - [x] 6.1 Rewrite CustomProvider in `src/providers/custom/custom-provider.ts`
    - Implement `complete()` using existing `buildChatCompletionsRequest` helper + raw fetch
    - Implement `streamCompletion()` bridging SSE_Manager callbacks to AsyncIterable<StreamChunk> using a queue pattern
    - Implement error classification for HTTP errors using `classifyHttpError` helper
    - Pass AbortSignal to the SSE connection for cancellation
    - Remove old `buildRequest`, `parseResponse`, `parseStreamChunk`, `mapThinkingLevel`, `setApiKey` methods
    - Keep `listModels()` and `validateApiKey()` logic as-is
    - _Requirements: 5.4, 6.1, 6.2, 6.3_

- [x] 7. Create CompletionService orchestration layer
  - [x] 7.1 Create `src/services/completion-service.ts`
    - Implement `streamCompletion` async generator: retrieve API key from secure store, get provider from registry, build CompletionRequest, yield from provider.streamCompletion()
    - Implement `complete` function: retrieve API key, get provider, invoke provider.complete()
    - Implement `testConnection` function: retrieve API key, invoke provider.validateApiKey()
    - Export `CompletionServiceOptions` interface
    - _Requirements: 5.1, 5.2, 6.1, 6.5_

- [x] 8. Update provider store with ConnectionStatus
  - [x] 8.1 Add connection status state to provider store in `src/stores/provider-store.ts`
    - Add `ConnectionStatus` type ('untested' | 'connected' | 'failed')
    - Add `ProviderConnectionState` interface with status, error, lastTestedAt fields
    - Add `connectionStatuses: Record<string, ProviderConnectionState>` to store state
    - Add `testConnection(providerId)` action that calls CompletionService.testConnection and updates status
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 9. Migrate useChat hook to use CompletionService
  - [x] 9.1 Refactor `src/hooks/useChat.ts` to use CompletionService
    - Replace direct SSE_Manager usage with CompletionService.streamCompletion() async iterable consumption
    - Replace direct fetch + provider.parseResponse with CompletionService.complete()
    - Remove `buildRequest`, auth header injection, and direct `createSSEStream` calls
    - Map ProviderError to ChatError for the ErrorBanner
    - Support abort via AbortController passed to streamCompletion
    - _Requirements: 6.5, 5.7, 5.8, 5.9_

- [x] 10. Checkpoint - Verify end-to-end completion flow
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update ProviderListScreen with connection status indicators
  - [x] 11.1 Update `src/components/settings/ProviderCard.tsx` and `src/screens/ProviderListScreen.tsx`
    - Add connection status dot (green/red/gray) to ProviderCard component
    - Pass connection status from provider store to each card
    - Display single-line error summary (max 80 chars) below provider name when status is 'failed'
    - Add "Add models" tappable prompt when provider has zero models
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 12. Update ProviderDetailScreen with Test Connection
  - [x] 12.1 Add "Test Connection" flow to `src/screens/ProviderDetailScreen.tsx`
    - Add "Test Connection" button below API key field
    - Show inline loading indicator during validation
    - Display "Connected" in accent color or error message in error color below API key field
    - Handle network timeout (5 second limit) with appropriate error message
    - Use theme tokens: inputBackground, borderRadii.md, spacing.md for form styling
    - _Requirements: 8.5, 8.6, 8.7_

- [x] 13. Update ModelDetailScreen with SDK model listing and cache fallback
  - [x] 13.1 Update `src/screens/ModelDetailScreen.tsx` for SDK-powered model listing
    - Call provider.listModels() via CompletionService when screen opens
    - Cache successful model list in expo-sqlite (models_cache table)
    - On network failure: display cached models with "from cache" indicator
    - On auth error (401/403): display error message, do NOT fall back to cache
    - On empty result with no cache: show empty state with manual entry only
    - Allow manual model ID entry (1-256 characters) regardless of list success
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 13.2 Write property test for model ID length validation
    - **Property 18: Model ID length validation**
    - **Validates: Requirements 9.4**

- [x] 14. Checkpoint - Verify UI screens render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Shared error handling and retry property tests
  - [x] 15.1 Write property tests for ProviderError retry behavior
    - **Property 13: Rate-limit Retry-After handling**
    - **Property 14: Auth/network errors throw with correct category**
    - **Property 15: Retriable errors emit error+done chunk sequence**
    - **Property 16: Network errors during streaming emit error chunk**
    - **Validates: Requirements 7.3, 7.4, 5.8, 5.9, 2.7**
    - Place tests in `src/providers/__tests__/provider-error.property.test.ts`

  - [x] 15.2 Write property test for model list sorting
    - **Property 17: Model list alphabetical sorting**
    - **Validates: Requirements 9.1**
    - Place test in `src/providers/__tests__/openai-provider.property.test.ts`

  - [x] 15.3 Write property test for streaming/non-streaming parameter consistency
    - **Property 6: Streaming and non-streaming parameter consistency**
    - **Validates: Requirements 2.9**

- [x] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `openai-chat.ts` and `openai-responses.ts` helper modules may be retained if CustomProvider still needs `buildChatCompletionsRequest` — otherwise remove them
- The SSE_Manager module (`src/providers/sse/sse-manager.ts`) remains for CustomProvider use only
- SDK clients use `dangerouslyAllowBrowser: true` (OpenAI) since React Native is not a Node environment
- Both SDK clients configured with `maxRetries: 2` for automatic exponential backoff on server errors

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["3.1", "4.1", "6.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4", "3.5", "4.2", "4.3", "4.4", "7.1"] },
    { "id": 5, "tasks": ["8.1", "9.1"] },
    { "id": 6, "tasks": ["11.1", "12.1", "13.1", "13.2"] },
    { "id": 7, "tasks": ["15.1", "15.2", "15.3"] }
  ]
}
```
