# Requirements: Custom Provider Thinking Effort Control

## Introduction

The Custom provider (OpenAI-compatible endpoints) currently maps ThinkingLevel to the `reasoning_effort` field — a parameter that real OpenAI models handle internally but that llama-server (and similar local inference servers) ignores entirely. Testing against a live llama-server instance (Qwen3.6-35B-A3B) confirmed that the only working mechanism for thinking control is `chat_template_kwargs: {"enable_thinking": true/false}` passed in the request body.

This feature adds llama-server-aware thinking effort control to the Custom provider, enabling users to toggle and adjust reasoning depth when using local LLM servers. The solution must coexist with the existing OpenAI-compatible mapping for providers that do honor `reasoning_effort` (e.g., Ollama with reasoning_effort→Think mapping, OpenRouter proxies).

## Glossary

- **Custom Provider**: The OpenAI-compatible provider adapter that connects to user-supplied base URLs (llama-server, Ollama, vLLM, OpenRouter, etc.)
- **chat_template_kwargs**: A llama-server-specific JSON field in the request body that passes parameters into the model's Jinja chat template at render time
- **ThinkingLevel**: The app's abstract 6-level enum: off, minimal, low, medium, high, xhigh
- **reasoning_effort**: The OpenAI-standard top-level field that OpenAI models read internally; ignored by llama-server
- **enable_thinking**: The Qwen-family Jinja template boolean kwarg that toggles thinking on or off
- **Reasoning Mode**: A per-provider-instance configuration specifying how thinking effort is communicated to the backend
- **budget_tokens**: Anthropic-style numeric token cap for thinking; supported on llama-server's Anthropic-compatible endpoint

## Requirements

### Requirement 1: Reasoning Mode Configuration

**User Story:** As a user configuring a Custom provider, I want to select how thinking effort is communicated to the backend, so that the app uses the correct mechanism for my inference server.

#### Acceptance Criteria

1. WHEN the user adds or edits a Custom provider, THE App SHALL present a "Reasoning Mode" picker with the following options: `auto` (default), `openai-reasoning-effort`, `chat-template-kwargs`, `none`.
2. THE App SHALL persist the selected Reasoning Mode as part of the provider configuration in the database.
3. WHEN Reasoning Mode is set to `auto`, THE Custom Provider SHALL send both `reasoning_effort` (top-level) AND `chat_template_kwargs: {"enable_thinking": ...}` in each request, allowing backends that support either mechanism to respond correctly.
4. WHEN Reasoning Mode is set to `openai-reasoning-effort`, THE Custom Provider SHALL only send the `reasoning_effort` top-level field (current behavior).
5. WHEN Reasoning Mode is set to `chat-template-kwargs`, THE Custom Provider SHALL only send `chat_template_kwargs` with the appropriate template parameters.
6. WHEN Reasoning Mode is set to `none`, THE Custom Provider SHALL omit all thinking-related parameters from requests regardless of ThinkingLevel.

### Requirement 2: chat_template_kwargs Mapping

**User Story:** As a user running a local model with thinking support, I want my thinking level selection to translate into the correct chat template kwargs, so that the model actually respects my reasoning effort preference.

#### Acceptance Criteria

1. WHEN ThinkingLevel is `off`, THE Custom Provider SHALL include `chat_template_kwargs: {"enable_thinking": false}` in the request body.
2. WHEN ThinkingLevel is any value other than `off` (minimal, low, medium, high, xhigh), THE Custom Provider SHALL include `chat_template_kwargs: {"enable_thinking": true}` in the request body.
3. THE `chat_template_kwargs` field SHALL be a JSON object placed at the top level of the chat completions request body, as a sibling to `model`, `messages`, and `stream`.
4. WHEN the reasoning mode includes chat_template_kwargs, THE Custom Provider SHALL NOT set `chat_template_kwargs` to an empty object — it SHALL either include the full kwargs object or omit the field entirely.

### Requirement 3: Combined Mode (Auto) Behavior

**User Story:** As a user who may switch between different backends without reconfiguring, I want the auto mode to cover both OpenAI-style and llama-server-style backends, so that thinking control works regardless of which server is currently running.

#### Acceptance Criteria

1. WHEN Reasoning Mode is `auto` and ThinkingLevel is `off`, THE Custom Provider SHALL include `chat_template_kwargs: {"enable_thinking": false}` AND omit the `reasoning_effort` field.
2. WHEN Reasoning Mode is `auto` and ThinkingLevel is non-off, THE Custom Provider SHALL include both `reasoning_effort` (mapped as today: low/medium/high) AND `chat_template_kwargs: {"enable_thinking": true}`.
3. THE presence of both fields in the same request SHALL NOT cause errors — llama-server ignores unknown top-level fields, and the template kwargs take precedence for models that support them.

### Requirement 4: Streaming Response Parsing Consistency

**User Story:** As a user, I want thinking content streamed correctly regardless of the reasoning mode I select, so that the ThinkingDisclosure UI works the same way for all backends.

#### Acceptance Criteria

1. WHEN the server streams `delta.reasoning_content` chunks (OpenAI-compatible format), THE Custom Provider SHALL yield them as `StreamChunk` with `type: 'thinking'`.
2. WHEN the server streams `delta.content` chunks, THE Custom Provider SHALL yield them as `StreamChunk` with `type: 'text'`.
3. WHEN thinking is disabled (ThinkingLevel `off`) and the server returns no `reasoning_content`, THE Custom Provider SHALL yield only text chunks without any thinking chunks.
4. THE streaming chunk routing logic SHALL remain unchanged — the existing implementation already handles `delta.reasoning_content` correctly.

### Requirement 5: Custom Template Kwargs Override

**User Story:** As a power user running a non-Qwen model that uses a different template kwarg name, I want to specify a custom kwargs key-value pair, so that I can control thinking on any model template.

#### Acceptance Criteria

1. THE provider configuration SHALL support an optional `thinkingKwargs` field: a JSON object specifying the template kwargs to send when thinking is enabled.
2. WHEN `thinkingKwargs` is configured, THE Custom Provider SHALL use it as the value of `chat_template_kwargs` when ThinkingLevel is non-off.
3. WHEN `thinkingKwargs` is not configured (null/undefined), THE Custom Provider SHALL use the default `{"enable_thinking": true/false}` mapping.
4. WHEN ThinkingLevel is `off`, THE Custom Provider SHALL negate the configured kwargs by setting boolean values to false (for the default `enable_thinking` case) or omit kwargs entirely if negation semantics are unclear.
5. THE `thinkingKwargs` field SHALL be editable in the provider configuration UI as an optional JSON text field.

### Requirement 6: Provider Config Schema Extension

**User Story:** As a developer, I want the provider configuration schema to cleanly accommodate reasoning mode and custom kwargs, so that the data model supports future provider-specific options.

#### Acceptance Criteria

1. THE `ProviderConfig` interface SHALL be extended with an optional `reasoningMode` field of type `'auto' | 'openai-reasoning-effort' | 'chat-template-kwargs' | 'none'`.
2. THE `ProviderConfig` interface SHALL be extended with an optional `thinkingKwargs` field of type `Record<string, unknown> | null`.
3. WHEN `reasoningMode` is undefined or null, THE Custom Provider SHALL treat it as `'auto'` (backward compatible default).
4. A database migration SHALL add `reasoning_mode` and `thinking_kwargs` columns to the providers table, both nullable with no default value (null = auto).
5. Existing provider rows SHALL continue to work without modification — null reasoning_mode implies auto behavior.

### Requirement 7: Anthropic-Endpoint Mode (Future Consideration)

**User Story:** As a user who has configured their llama-server's base URL to use the Anthropic-compatible endpoint, I want thinking budget control to work via the standard Anthropic thinking block format.

#### Acceptance Criteria

1. THIS requirement is deferred — the current Custom provider only targets the OpenAI-compatible `/v1/chat/completions` endpoint.
2. IF a future `anthropic-compat` reasoning mode is added, IT SHALL map ThinkingLevel to `thinking.budget_tokens` using the same scale as `mapThinkingLevelAnthropic`.
3. THE architecture SHALL NOT preclude adding this mode later — the reasoning mode enum is extensible.
