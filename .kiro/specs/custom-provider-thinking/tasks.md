# Implementation Plan: Custom Provider Thinking Effort Control

## Overview

Wire up llama-server-aware thinking effort control in the Custom provider. The existing `mapThinkingLevelOpenAI` mapper (which produces `reasoning_effort` — a field llama-server ignores) is replaced with a new `mapThinkingLevelCustom` that supports multiple reasoning modes: `auto` (sends both mechanisms), `openai-reasoning-effort` (current behavior), `chat-template-kwargs` (llama-server native), and `none` (disable all).

Changes span: domain mapper, provider adapter, data model (ProviderConfig + DB migration), provider repository, and provider settings UI.

## Tasks

- [x] 1. Extend thinking-mapper with Custom provider logic
  - [x] 1.1 Add `CustomReasoningMode` type and `CustomThinkingParams` interface to `src/domain/thinking-mapper.ts`
    - Export type `CustomReasoningMode = 'auto' | 'openai-reasoning-effort' | 'chat-template-kwargs' | 'none'`
    - Export interface `CustomThinkingParams { reasoning_effort?: string; chat_template_kwargs?: Record<string, unknown> }`
    - _Requirements: 1.1, 6.1_

  - [x] 1.2 Implement `mapThinkingLevelCustom` function in `src/domain/thinking-mapper.ts`
    - Signature: `(level: ThinkingLevel, mode?: CustomReasoningMode, thinkingKwargs?: Record<string, unknown> | null) => CustomThinkingParams`
    - Mode `none`: return empty object
    - Mode `openai-reasoning-effort`: return `{ reasoning_effort }` for non-off levels, empty for off
    - Mode `chat-template-kwargs`: return `{ chat_template_kwargs }` with enable_thinking or custom kwargs
    - Mode `auto` (default): return both reasoning_effort (when non-off) AND chat_template_kwargs
    - Extract `mapReasoningEffortValue` helper: off→undefined, minimal/low→'low', medium→'medium', high/xhigh→'high'
    - Extract `buildChatTemplateKwargs` helper: handles default enable_thinking and custom kwargs with negation logic
    - _Requirements: 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 3.1, 3.2, 5.2, 5.4_

  - [x] 1.3 Update `mapThinkingLevel` router function
    - Change the `'custom'` case to call `mapThinkingLevelCustom(level, 'auto')` instead of `mapThinkingLevelOpenAI`
    - This maintains backward compat: callers using the generic router get auto mode by default
    - _Requirements: 6.3_

- [x] 2. Extend data model and database
  - [x] 2.1 Add `reasoningMode` and `thinkingKwargs` to `ProviderConfig` in `src/providers/types.ts`
    - Import `CustomReasoningMode` from `@/domain/thinking-mapper`
    - Add optional field `reasoningMode?: CustomReasoningMode | null` to ProviderConfig interface
    - Add optional field `thinkingKwargs?: Record<string, unknown> | null` to ProviderConfig interface
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Create database migration `src/database/migrations/004_reasoning_mode.ts`
    - Add `reasoning_mode TEXT DEFAULT NULL` column to providers table
    - Add `thinking_kwargs TEXT DEFAULT NULL` column to providers table
    - Register migration in the migrations index/runner
    - _Requirements: 6.4, 6.5_

  - [x] 2.3 Update provider repository to read/write new columns
    - Add `reasoning_mode` and `thinking_kwargs` to `ProviderRow` type
    - Update `mapRowToProvider` to deserialize: `reasoningMode: row.reasoning_mode as CustomReasoningMode | null`, `thinkingKwargs: row.thinking_kwargs ? JSON.parse(row.thinking_kwargs) : null`
    - Update `createProvider` to serialize: `reasoning_mode: data.reasoningMode ?? null`, `thinking_kwargs: data.thinkingKwargs ? JSON.stringify(data.thinkingKwargs) : null`
    - Update `updateProvider` similarly
    - Wrap `JSON.parse` in try/catch with null fallback for corrupted data
    - _Requirements: 6.2, 6.5_

- [x] 3. Update Custom provider adapter
  - [x] 3.1 Replace `mapThinkingLevelOpenAI` with `mapThinkingLevelCustom` in `src/providers/custom/custom-provider.ts`
    - Import `mapThinkingLevelCustom` instead of `mapThinkingLevelOpenAI`
    - In `complete()`: call `mapThinkingLevelCustom(request.thinkingLevel, config.reasoningMode ?? 'auto', config.thinkingKwargs)`
    - In `streamCompletion()`: same call
    - _Requirements: 1.3, 1.4, 1.5, 1.6_

  - [x] 3.2 Update request params merging in both `complete()` and `streamCompletion()`
    - Remove the existing `if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort)` block
    - Replace with: `if (thinkingParams.reasoning_effort) params.reasoning_effort = thinkingParams.reasoning_effort`
    - Add: `if (thinkingParams.chat_template_kwargs) params.chat_template_kwargs = thinkingParams.chat_template_kwargs`
    - _Requirements: 2.3, 3.3_

- [x] 4. Add provider settings UI for reasoning mode
  - [x] 4.1 Add Reasoning Mode picker to Custom provider settings form
    - In the provider add/edit screen, conditionally render a "Reasoning Mode" section when provider type is 'custom'
    - Render a segmented control or picker with options: Auto, OpenAI Effort, Template Kwargs, None
    - Bind selection to form state, persist via provider store on save
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Add optional thinkingKwargs JSON input field
    - Show a text input below the Reasoning Mode picker when mode is 'auto' or 'chat-template-kwargs'
    - Label: "Template kwargs (JSON, optional)"
    - Placeholder: `{"enable_thinking": true}`
    - Validate as JSON on blur/submit; show inline error for invalid JSON
    - Store as parsed object in provider config (serialized to JSON string in DB)
    - Hide this field when mode is 'openai-reasoning-effort' or 'none'
    - _Requirements: 5.1, 5.5_

  - [x] 4.3 Add i18n keys for reasoning mode UI
    - Add translation keys: `provider.reasoningMode.label`, `provider.reasoningMode.auto`, `provider.reasoningMode.openai`, `provider.reasoningMode.chatTemplate`, `provider.reasoningMode.none`, `provider.thinkingKwargs.label`, `provider.thinkingKwargs.placeholder`, `provider.thinkingKwargs.error`
    - _Requirements: (non-functional — i18n norm)_

- [x] 5. Verification and testing
  - [x] 5.1 Write unit tests for `mapThinkingLevelCustom`
    - Test all 4 modes x all 6 levels = 24 cases
    - Test custom kwargs with boolean values (negation on off)
    - Test custom kwargs with non-boolean values (omit on off)
    - Test null/undefined kwargs defaults to enable_thinking
    - **Property 1**: auto mode always includes chat_template_kwargs
    - **Property 2**: none mode always returns empty
    - **Property 3**: chat-template-kwargs mode never includes reasoning_effort
    - **Property 6**: reasoning_effort values constrained to low/medium/high/undefined
    - _Requirements: 1.3–1.6, 2.1, 2.2, 3.1, 3.2, 5.2, 5.4_

  - [x] 5.2 Write integration test for CustomProvider request building
    - Mock the OpenAI SDK client
    - Verify that `complete()` passes correct params for each reasoning mode
    - Verify that `streamCompletion()` passes correct params
    - Test backward compat: config with null reasoningMode uses auto
    - **Property 4**: null reasoningMode behaves as auto
    - _Requirements: 6.3, 6.5, 4.1, 4.2, 4.3_

  - [x] 5.3 Write migration test
    - Verify migration adds columns without affecting existing rows
    - Verify null defaults for both new columns
    - Verify round-trip: write thinking_kwargs JSON, read it back correctly
    - **Property 5**: custom kwargs override applies correctly
    - _Requirements: 6.4, 6.5_

  - [x] 5.4 Manual smoke test against live llama-server
    - Configure Custom provider with `chat-template-kwargs` mode pointing to llama-server
    - Verify thinking ON: response includes reasoning_content in stream
    - Verify thinking OFF: response has no reasoning_content
    - Verify auto mode: both fields sent, server responds correctly
    - Test with `none` mode: no thinking params sent, server uses its default
    - _Requirements: 2.1, 2.2, 4.1, 4.2, 4.3_

## Notes

- The streaming response parsing (delta.reasoning_content → thinking chunk) is already implemented and works correctly with llama-server. No changes needed there.
- The existing `mapThinkingLevelOpenAI` function is kept for the OpenAI provider — only the Custom provider's usage changes.
- The `thinkingKwargs` field supports any JSON object, making it future-proof for models that use different template parameter names (e.g., gpt-oss uses `reasoning_effort` as a template kwarg, not a top-level field).
- Migration numbering (004) assumes no other migrations have been added since the current schema. Verify before implementing.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "2.1"] },
    { "id": 1, "tasks": ["1.3", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.4"] }
  ]
}
```
