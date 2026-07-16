# Requirements Document

## Introduction

Replace the manual HTTP fetch and SSE line-parsing implementations in the Anthropic and OpenAI providers with their official TypeScript SDKs. The SDKs handle authentication, request construction, streaming iteration, error classification, and automatic retries — eliminating hand-rolled SSE parsing and improving long-term API compatibility. The Custom provider remains unchanged (raw fetch with OpenAI-compatible format for arbitrary endpoints). Additionally, integrate the provider management UI to align with mockup design patterns.

## Glossary

- **SDK_Client**: An instance of the official TypeScript SDK (`Anthropic` from `@anthropic-ai/sdk` or `OpenAI` from `openai`) configured with an API key and base URL.
- **Stream_Iterator**: The async iterable object returned by the SDK's streaming methods (e.g., `client.messages.stream()` or `client.chat.completions.create({ stream: true })`) that yields typed event objects.
- **IProvider**: The common interface (`src/providers/types.ts`) that all provider adapters implement, defining `buildRequest`, `parseResponse`, `parseStreamChunk`, `mapThinkingLevel`, `listModels`, and `validateApiKey`.
- **SSE_Manager**: The current `createSSEStream` function (`src/providers/sse/sse-manager.ts`) that performs raw `fetch` + `ReadableStream` text decoding + line splitting for SSE consumption.
- **Provider_Store**: The Zustand store (`src/stores/provider-store.ts`) managing provider and model configurations.
- **Completion_Service**: The service layer that orchestrates a completion request by selecting the provider, obtaining the API key, and invoking streaming or non-streaming paths.
- **Provider_Registry**: The singleton factory (`src/providers/registry.ts`) that maps a `ProviderType` to an `IProvider` instance.
- **Thinking_Mapper**: Domain function that translates an abstract `ThinkingLevel` to provider-specific parameters (reasoning_effort for OpenAI, budget_tokens for Anthropic).
- **Model_Switcher_Chip**: The UI element near the chat input that displays the active model and allows switching models inline.
- **Context_Usage_Ring**: A ring/gauge indicator near the input field displaying token context usage as a proportion of the model's context window.

## Requirements

### Requirement 1: Anthropic SDK Client Integration

**User Story:** As a developer, I want the Anthropic provider to use the official `@anthropic-ai/sdk` package, so that request construction, authentication, and response parsing are handled by a maintained SDK rather than hand-rolled code.

#### Acceptance Criteria

1. WHEN a completion request is initiated for an Anthropic provider, THE SDK_Client SHALL call `client.messages.create()` with the model from CompletionRequest, messages array excluding system-role messages, max_tokens defaulting to 4096 when CompletionRequest.maxTokens is undefined, stream set to CompletionRequest.stream, and thinking parameters produced by the existing thinking-level mapper.
2. WHEN the Anthropic SDK_Client is instantiated, THE AnthropicProvider SHALL pass the API key retrieved from expo-secure-store as the `apiKey` constructor option and the ProviderConfig.baseUrl as the `baseURL` constructor option to `new Anthropic(...)`.
3. WHEN a non-streaming completion is requested, THE AnthropicProvider SHALL return a CompletionResponse with content set to the concatenation of all `text`-type content blocks, thinkingContent set to the text of the first `thinking`-type content block (or undefined if absent), usage mapped from the SDK response's `usage.input_tokens` and `usage.output_tokens`, and finishReason set to the SDK response's `stop_reason`.
4. IF the Anthropic SDK returns an error, THEN THE AnthropicProvider SHALL propagate a typed error categorized as one of: authentication_error (HTTP 401/403), rate_limit_error (HTTP 429), or server_error (HTTP 5xx), so that callers can branch on the error category without inspecting HTTP status codes directly.
5. THE AnthropicProvider SHALL pass the `anthropic-version` header value (currently `2023-06-01`) through the SDK's `defaultHeaders` configuration option rather than manually attaching headers to each request.
6. WHEN the CompletionRequest contains one or more system-role messages, THE SDK_Client SHALL pass their concatenated text content as the top-level `system` parameter to `client.messages.create()` and exclude those messages from the messages array.
7. WHEN a streaming completion is requested, THE AnthropicProvider SHALL call `client.messages.create()` with `stream: true` and return an async iterable or callback-compatible stream whose chunks conform to the existing StreamChunk interface (types: text, thinking, done, error).

### Requirement 2: Anthropic SDK Streaming Integration

**User Story:** As a user, I want Anthropic streaming responses to use the SDK's native streaming iterator, so that I get reliable event handling without manual SSE line parsing.

#### Acceptance Criteria

1. WHEN a streaming completion is requested for an Anthropic provider, THE AnthropicProvider SHALL invoke the SDK's streaming method (`client.messages.stream()` or equivalent) and return an AsyncIterable<StreamChunk> that yields chunks as they arrive from the Stream_Iterator.
2. WHILE the Stream_Iterator yields events, THE AnthropicProvider SHALL map each event to a StreamChunk with the correct type (text, thinking, done, or error) and content, emitting each chunk within 50ms of receiving the corresponding SDK event.
3. WHEN a `content_block_delta` event with `type === 'text_delta'` is received from the Stream_Iterator, THE AnthropicProvider SHALL emit a StreamChunk of type 'text' with the `content` field set to the delta text string (empty string if delta text is absent).
4. WHEN a `content_block_delta` event with `type === 'thinking_delta'` is received from the Stream_Iterator, THE AnthropicProvider SHALL emit a StreamChunk of type 'thinking' with the `content` field set to the delta thinking text string (empty string if delta thinking text is absent).
5. WHEN the stream completes with a `message_stop` event, THE AnthropicProvider SHALL emit a final StreamChunk of type 'done' with `content` set to an empty string and `usage` populated with promptTokens, completionTokens, and totalTokens derived from the cumulative message usage (combining `message_start` input_tokens and `message_delta` output_tokens).
6. WHEN the user cancels a streaming request, THE AnthropicProvider SHALL signal abort via the AbortController passed to the SDK streaming call, causing the Stream_Iterator to terminate and the underlying HTTP connection to be released within 1 second of the abort signal.
7. IF a network error or timeout occurs during streaming, THEN THE AnthropicProvider SHALL emit a StreamChunk of type 'error' with a `content` field containing a message that identifies the failure type (network error or timeout) and ceasing further chunk emission from that stream.
8. IF the Stream_Iterator yields an event with an unrecognized `type` or `delta.type`, THEN THE AnthropicProvider SHALL skip that event without emitting a StreamChunk and without interrupting the processing of subsequent events.
9. WHEN the SDK streaming call is initiated, THE AnthropicProvider SHALL pass the AbortController signal and the request parameters (model, messages, max_tokens, thinking configuration, and stream:true) to the SDK method, using the same request-building logic as non-streaming completions for parameter construction.

### Requirement 3: OpenAI SDK Client Integration

**User Story:** As a developer, I want the OpenAI provider to use the official `openai` TypeScript SDK, so that both the Responses API and Chat Completions API modes are handled through a single maintained client.

#### Acceptance Criteria

1. WHEN a completion request is initiated for an OpenAI provider in chat-completions mode, THE SDK_Client SHALL call `client.chat.completions.create()` with model, messages, stream flag, and max_tokens from the CompletionRequest, and SHALL include `reasoning_effort` from the mapped ThinkingLevel only when the ThinkingLevel is not `off`.
2. WHEN a completion request is initiated for an OpenAI provider in responses mode, THE SDK_Client SHALL call `client.responses.create()` with model, input (converted from CompletionRequest messages), stream flag, max_output_tokens, and `reasoning.effort` from the mapped ThinkingLevel only when the ThinkingLevel is not `off`.
3. WHEN the OpenAI SDK_Client is instantiated, THE OpenAIProvider SHALL configure the client with the API key retrieved from expo-secure-store and the base URL from the ProviderConfig, and SHALL reuse this client instance for all subsequent requests until the API key or base URL changes.
4. WHEN a non-streaming completion is requested, THE OpenAIProvider SHALL return a CompletionResponse parsed from the SDK's typed response object including content, reasoning content (if present), token usage (prompt, completion, total, and cached tokens), and finish reason.
5. IF the OpenAI SDK returns an error, THEN THE OpenAIProvider SHALL propagate a typed error classifying the failure into exactly one of: authentication (HTTP 401/403), rate-limit (HTTP 429), or server error (HTTP 5xx or network failure), so that callers can distinguish the category without inspecting raw status codes.
6. WHEN a streaming completion is requested, THE SDK_Client SHALL use the SDK's built-in streaming iterator (the async iterable returned by `create()` with `stream: true`) and SHALL map each emitted event to the application's StreamChunk interface, bypassing raw SSE line parsing.
7. IF the SDK's streaming iterator emits an error event mid-stream, THEN THE OpenAIProvider SHALL yield a StreamChunk of type `error` containing the error category and a summary indication of the failure reason, and SHALL terminate the stream.

### Requirement 4: OpenAI SDK Streaming Integration

**User Story:** As a user, I want OpenAI streaming responses to use the SDK's native streaming, so that I get typed event handling for both Chat Completions and Responses API modes.

#### Acceptance Criteria

1. WHEN a streaming completion is requested in chat-completions mode, THE OpenAIProvider SHALL call `client.chat.completions.create({ stream: true })` with the AbortController signal option and iterate over the returned async iterable of ChatCompletionChunk objects.
2. WHEN a streaming completion is requested in responses mode, THE OpenAIProvider SHALL call the SDK's `client.responses.create({ stream: true })` with the AbortController signal option and iterate over the returned async iterable of response events.
3. WHILE the async iterable yields chunks containing a `delta.content` field (chat-completions) or `response.output_text.delta` event (responses), THE OpenAIProvider SHALL emit a StreamChunk of type 'text' with the delta string as content.
4. WHILE the async iterable yields chunks containing a `delta.reasoning_content` field (chat-completions) or `response.reasoning.delta` event (responses), THE OpenAIProvider SHALL emit a StreamChunk of type 'thinking' with the reasoning delta string as content.
5. WHEN the stream completes, THE OpenAIProvider SHALL emit a StreamChunk of type 'done' containing token usage mapped to the TokenUsage interface; IF usage data is absent from the final event, THEN the usage field SHALL be omitted from the done chunk.
6. WHEN the user cancels a streaming request, THE OpenAIProvider SHALL signal the AbortController, causing the async iterable to terminate, and SHALL emit no further StreamChunk objects after the abort signal is sent.
7. IF the SDK throws an error during streaming (including network failures, timeouts, or API errors), THEN THE OpenAIProvider SHALL emit a single StreamChunk of type 'error' with the content set to the SDK exception's message property, and SHALL emit no further chunks.
8. THE OpenAIProvider streamCompletion method SHALL return an AsyncIterable<StreamChunk> that conforms to the provider interface contract regardless of which API mode is active.
9. IF the AbortController signal is already aborted before iteration begins, THEN THE OpenAIProvider SHALL emit a single StreamChunk of type 'error' indicating the request was cancelled, and SHALL not initiate a network request.

### Requirement 5: IProvider Interface Refactoring

**User Story:** As a developer, I want the IProvider interface to accommodate SDK-based streaming (async iterables) alongside the existing raw-fetch path for the Custom provider, so that the architecture supports both approaches cleanly.

#### Acceptance Criteria

1. THE IProvider interface SHALL expose a `streamCompletion` method that accepts a ProviderConfig, CompletionRequest, API key (string), and AbortSignal and returns an AsyncIterable of StreamChunk objects.
2. THE IProvider interface SHALL expose a `complete` method that accepts a ProviderConfig, CompletionRequest, and API key (string) and returns a Promise of CompletionResponse.
3. THE IProvider interface SHALL expose `listModels` and `validateApiKey` methods with their existing signatures and SHALL NOT expose `buildRequest`, `parseResponse`, `parseStreamChunk`, or `mapThinkingLevel`.
4. THE CustomProvider SHALL implement `streamCompletion` by delegating to the existing SSE manager using fetch-based streaming, passing the AbortSignal to the underlying fetch call.
5. THE AnthropicProvider and OpenAIProvider SHALL implement `streamCompletion` by wrapping their respective SDK streaming iterators into an AsyncIterable of StreamChunk objects.
6. THE provider registry (`getProvider`) SHALL return the correct IProvider instance for each ProviderType as a lazy singleton, preserving its current function signature so that existing call sites require no modification.
7. IF the AbortSignal is triggered during an active `streamCompletion` iteration, THEN THE provider SHALL stop yielding chunks within 500ms and SHALL yield a final StreamChunk with type `done` and empty content before terminating the iterable.
8. IF a provider API returns an authentication error (HTTP 401 or 403) or a network error during `complete` or `streamCompletion`, THEN THE provider SHALL throw an error indicating the failure category (authentication, network, or provider-error) and SHALL NOT return a partial CompletionResponse.
9. IF a provider API returns a retriable error (HTTP 429 or 5xx) during `streamCompletion`, THEN THE provider SHALL yield a StreamChunk with type `error` containing a message indicating the failure reason, followed by a StreamChunk with type `done`.

### Requirement 6: SSE Manager Deprecation Path

**User Story:** As a developer, I want the SSE_Manager to remain available only for the Custom provider, so that SDK-based providers no longer depend on manual SSE parsing.

#### Acceptance Criteria

1. WHEN an Anthropic or OpenAI provider initiates a streaming request, THE Completion_Service SHALL invoke `streamCompletion` on the provider adapter without importing or calling any function from the SSE_Manager module.
2. WHEN a Custom provider initiates a streaming request, THE Completion_Service SHALL invoke `streamCompletion` on the CustomProvider adapter, which internally delegates to the SSE_Manager's `createSSEStream` function for fetch-based streaming.
3. THE SSE_Manager module SHALL continue to export the `createSSEStream` function and `SSECallbacks` type with their current signatures, available for import by the CustomProvider and any future OpenAI-compatible providers.
4. THE `buildRequest` and `parseStreamChunk` methods SHALL be removed from the IProvider interface, and the `streamCompletion` and `complete` methods (as defined in Requirement 5) SHALL serve as the sole request entry points on the interface.
5. WHEN the IProvider interface no longer exposes `buildRequest` or `parseStreamChunk`, THE `useChat` hook and any other modules that previously called these methods SHALL be migrated to invoke `streamCompletion` or `complete` on the provider adapter through the Completion_Service.

### Requirement 7: Error Classification and Retry

**User Story:** As a user, I want provider errors to be clearly categorized (auth, rate limit, network, server), so that the UI can display appropriate guidance and retry options.

#### Acceptance Criteria

1. THE AnthropicProvider SHALL classify errors into a ProviderError with a category field set to one of: authentication (HTTP 401 or 403), rate_limit (HTTP 429), overloaded (HTTP 529), network (DNS resolution failure, TCP connection refused, TLS handshake failure, or request timeout), or server (HTTP 500–599 excluding 529).
2. THE OpenAIProvider SHALL classify errors into a ProviderError with a category field set to one of: authentication (HTTP 401 or 403), rate_limit (HTTP 429), network (DNS resolution failure, TCP connection refused, TLS handshake failure, or request timeout), or server (HTTP 500–599).
3. WHEN a rate_limit error is received and the response includes a Retry-After header, THE provider SHALL set the retryAfterSeconds field on the ProviderError to the parsed header value in whole seconds; IF the Retry-After header is absent, THEN the retryAfterSeconds field SHALL be null.
4. IF a rate_limit error occurs during streaming, THEN THE provider SHALL emit an error StreamChunk whose content string contains the error category and the retryAfterSeconds value (or "unknown" when null) so the UI can display a wait duration to the user.
5. WHEN a transient server error (HTTP 500–599) occurs on a non-streaming request, THE SDK_Client SHALL retry up to 2 additional times with exponential backoff as configured in the SDK client options; IF all retry attempts are exhausted, THEN THE SDK_Client SHALL return a ProviderError with category server to the caller.
6. THE ProviderError type SHALL contain at minimum the fields: category (the error category enum), retryAfterSeconds (number or null), and message (a human-readable string indicating the failure reason without exposing raw API response bodies).

### Requirement 8: Provider Management UI Alignment

**User Story:** As a user, I want the provider configuration screens to match the mockup's minimal, cool-toned design patterns, so that provider setup feels cohesive with the rest of the app.

#### Acceptance Criteria

1. THE ProviderListScreen SHALL display each provider as a card showing the provider name, type badge (OpenAI, Anthropic, or Custom), model count, and a connection status indicator in one of three states: green dot for validated, red dot for failed validation, and gray dot for not yet tested.
2. WHEN a provider's API key validation succeeds, THE ProviderListScreen SHALL update that provider's connection status indicator to a green dot within 1 second of receiving the validation result.
3. IF a provider's API key validation fails, THEN THE ProviderListScreen SHALL update that provider's connection status indicator to a red dot and display a single-line error summary (maximum 80 characters) below the provider name within the card.
4. WHILE a provider has no models configured, THE ProviderListScreen SHALL display a tappable prompt within the provider card containing the text "Add models" that navigates to the ProviderDetailScreen's model section when tapped.
5. THE ProviderDetailScreen SHALL present form fields using the app's inputBackground color, borderRadii.md token for input corners, and spacing.md token for vertical field separation as defined in the theme system.
6. WHEN the user taps "Test Connection" on the ProviderDetailScreen, THE system SHALL display an inline loading indicator below the API key field, send a minimal validation request (max_tokens: 10) to the provider endpoint, and within 5 seconds display either a success message with the text "Connected" in the theme's accent color or an error message indicating the failure reason in the theme's error color.
7. IF the network is unreachable or the validation request times out when the user taps "Test Connection", THEN THE system SHALL display an error indication below the API key field stating that the connection could not be established, within 5 seconds of the tap.

### Requirement 9: Model Listing via SDK

**User Story:** As a user, I want to browse available models fetched via the SDK rather than a hardcoded list, so that new models appear automatically.

#### Acceptance Criteria

1. WHEN the user opens the model selection for an OpenAI provider, THE OpenAIProvider SHALL call the models listing endpoint and return the resulting model IDs sorted alphabetically.
2. WHEN the user opens the model selection for an Anthropic provider, THE AnthropicProvider SHALL request the models listing endpoint; IF the endpoint returns an HTTP 200 response with at least one model ID, THEN THE AnthropicProvider SHALL return those IDs, otherwise THE AnthropicProvider SHALL return the built-in curated model list.
3. IF model listing fails due to a network timeout (exceeding 15 seconds), connection refusal, or DNS resolution failure, THEN THE ModelDetailScreen SHALL display the list of models previously persisted in the local database for that provider, accompanied by a visible indicator stating the list is from cache.
4. THE ModelDetailScreen SHALL allow the user to manually enter a model ID between 1 and 256 characters regardless of whether the API model list loaded successfully.
5. IF model listing fails due to an authentication error (HTTP 401 or 403), THEN THE ModelDetailScreen SHALL display an error message indicating the API key is invalid and SHALL NOT fall back to cached models.
6. IF model listing succeeds but returns zero models and no previously cached models exist for that provider, THEN THE ModelDetailScreen SHALL display an empty state message and present only the manual model ID entry option.

### Requirement 10: SDK Package Installation and Compatibility

**User Story:** As a developer, I want the official SDKs installed with pinned versions compatible with React Native (Expo SDK 52), so that the build remains stable.

#### Acceptance Criteria

1. THE project SHALL include `@anthropic-ai/sdk` as a production dependency with an exact pinned version (no caret or tilde range) in package.json, installed without peer dependency warnings related to React Native or Expo.
2. THE project SHALL include `openai` as a production dependency with an exact pinned version (no caret or tilde range) in package.json, installed without peer dependency warnings related to React Native or Expo.
3. IF the SDK requires Node.js-specific APIs not available in React Native (e.g., node:stream, node:crypto), THEN THE integration SHALL configure the SDK to use fetch-based transport or provide polyfills that allow the Metro bundler to resolve all imports without errors.
4. THE SDK installations SHALL pass the project's TypeScript strict-mode compilation without type errors.
5. WHEN building the iOS app with `expo prebuild` and `xcodebuild`, THE SDK dependencies SHALL resolve without native module conflicts, and the Metro bundler SHALL produce a JavaScript bundle that includes all SDK modules without unresolved import errors.
6. WHEN the app launches on an iOS simulator, THE SDK clients SHALL initialize without runtime errors and complete a network request to their respective provider endpoints (given a valid API key and network connectivity) within 10 seconds.
