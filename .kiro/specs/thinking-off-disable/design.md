# Thinking Off Disable Bugfix Design

## Overview

When the thinking level is 'off', `mapThinkingLevelCustom` in `src/domain/thinking-mapper.ts` still emits `chat_template_kwargs` for 'auto' and 'chat-template-kwargs' modes. Some backends (e.g. Qwen via llama.cpp) interpret the mere presence of that field as a signal to engage thinking, regardless of the boolean value inside. The fix is a one-line early return of `{}` when level is 'off', matching the OpenAI mapper's behavior.

## Glossary

- **Bug_Condition (C)**: `level === 'off'` AND `mode` is 'auto' or 'chat-template-kwargs' — cases where thinking params are still emitted despite the user disabling thinking
- **Property (P)**: When thinking is 'off', the function returns `{}` — no thinking-related fields in the request body
- **Preservation**: All behavior when `level !== 'off'` (or when `mode` is 'none' or 'openai-reasoning-effort') must remain identical
- **mapThinkingLevelCustom**: The function in `src/domain/thinking-mapper.ts` that maps a ThinkingLevel + CustomReasoningMode to request body fields for Custom providers
- **CustomReasoningMode**: Union type determining wire-format: 'auto' | 'openai-reasoning-effort' | 'chat-template-kwargs' | 'none'

## Bug Details

### Bug Condition

The bug manifests when a user sets thinking to 'off' and the provider's reasoning mode is 'auto' or 'chat-template-kwargs'. The function still returns `chat_template_kwargs` with `enable_thinking: false` (or negated custom kwargs), causing backends to engage their thinking template.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { level: ThinkingLevel, mode: CustomReasoningMode }
  OUTPUT: boolean

  RETURN input.level === 'off'
         AND input.mode IN ['auto', 'chat-template-kwargs']
END FUNCTION
```

### Examples

- `mapThinkingLevelCustom('off', 'auto')` returns `{ chat_template_kwargs: { enable_thinking: false } }` — should return `{}`
- `mapThinkingLevelCustom('off', 'chat-template-kwargs')` returns `{ chat_template_kwargs: { enable_thinking: false } }` — should return `{}`
- `mapThinkingLevelCustom('off', 'auto', { enable_thinking: true })` returns `{ chat_template_kwargs: { enable_thinking: false } }` — should return `{}`
- `mapThinkingLevelCustom('off', 'none')` already returns `{}` — correct, unchanged

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- All calls where `level !== 'off'` must produce identical output (reasoning_effort and/or chat_template_kwargs as before)
- `mapThinkingLevelCustom('off', 'none')` continues to return `{}`
- `mapThinkingLevelCustom('off', 'openai-reasoning-effort')` continues to return `{}`
- `mapThinkingLevelOpenAI` and `mapThinkingLevelAnthropic` are untouched
- The `mapThinkingLevel` router function behavior is unchanged for non-custom providers

**Scope:**
All inputs where `level !== 'off'` are completely unaffected. The fix adds an early return that only fires for the 'off' case.

## Hypothesized Root Cause

The `mapThinkingLevelCustom` function has an early return for `mode === 'none'` but no equivalent early return for `level === 'off'`. When level is 'off':

1. **'auto' mode**: The switch's default branch unconditionally assigns `result.chat_template_kwargs`, falling back to `{ enable_thinking: false }` when `buildChatTemplateKwargs` returns undefined. This means 'auto' mode always emits `chat_template_kwargs` regardless of the thinking level.

2. **'chat-template-kwargs' mode**: `buildChatTemplateKwargs(false, ...)` returns `{ enable_thinking: false }` (or negated booleans for custom kwargs), and the switch branch wraps it in `chat_template_kwargs`.

3. **'openai-reasoning-effort' mode**: Already correct — returns `{}` when `enableThinking` is false because `reasoningEffort` is undefined.

The root cause is a missing guard: the function should bail out early with `{}` when level is 'off', before any mode-specific logic runs.

## Correctness Properties

Property 1: Bug Condition - Off Level Returns Empty Object

_For any_ input where `level === 'off'` and `mode` is any value ('auto', 'chat-template-kwargs', 'openai-reasoning-effort', 'none'), the fixed `mapThinkingLevelCustom` function SHALL return an empty object `{}` with no `reasoning_effort` or `chat_template_kwargs` fields.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Off Levels Unchanged

_For any_ input where `level !== 'off'`, the fixed `mapThinkingLevelCustom` function SHALL produce the same result as the original function, preserving all reasoning_effort and chat_template_kwargs output for active thinking levels.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `src/domain/thinking-mapper.ts`

**Function**: `mapThinkingLevelCustom`

**Specific Changes**:
1. **Add early return for 'off'**: Insert `if (level === 'off') return {};` immediately after the existing `if (mode === 'none') return {};` guard. This ensures no thinking-related parameters are emitted for any mode when thinking is disabled.

That's the entire fix — one line.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, confirm the bug exists on unfixed code, then verify the one-line fix resolves it without regressing other cases.

### Exploratory Bug Condition Checking

**Goal**: Confirm that unfixed code emits `chat_template_kwargs` when level is 'off' for 'auto' and 'chat-template-kwargs' modes.

**Test Cases**:
1. `mapThinkingLevelCustom('off', 'auto')` — expect non-empty result (bug confirmed)
2. `mapThinkingLevelCustom('off', 'chat-template-kwargs')` — expect non-empty result (bug confirmed)
3. `mapThinkingLevelCustom('off', 'auto', { enable_thinking: true })` — expect non-empty result (bug confirmed)

**Expected Counterexamples**:
- All three return objects containing `chat_template_kwargs` instead of `{}`

### Fix Checking

**Goal**: Verify that for all inputs where level is 'off', the fixed function returns `{}`.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := mapThinkingLevelCustom_fixed(input.level, input.mode, input.kwargs)
  ASSERT result === {}
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where level is not 'off', the fixed function produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT mapThinkingLevelCustom_original(input) = mapThinkingLevelCustom_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because the input space (6 levels × 4 modes × optional kwargs) is small enough to exhaustively cover, and PBT will catch any edge case where the early return fires incorrectly.

**Test Cases**:
1. **Active levels preserved**: Verify 'low', 'medium', 'high', 'xhigh' in all modes produce identical output
2. **Custom kwargs preserved**: Verify custom thinkingKwargs still flow through correctly for active levels
3. **Mode 'none' preserved**: Verify 'none' mode still returns `{}` for all levels (including non-off)

### Unit Tests

- Assert `mapThinkingLevelCustom('off', mode)` returns `{}` for every mode
- Assert `mapThinkingLevelCustom('medium', 'auto')` still returns both fields
- Assert `mapThinkingLevelCustom('high', 'chat-template-kwargs')` still returns kwargs

### Property-Based Tests

- Generate random (level, mode, kwargs) tuples; for level 'off' assert empty, for level non-off assert deep-equal to original
- Generate random custom kwargs objects and verify 'off' still returns `{}` regardless of kwargs shape

### Integration Tests

- Verify end-to-end that `mapThinkingLevel('custom', 'off')` returns `{}` (the router function)
- Verify the request builder for Custom providers omits thinking fields when level is 'off'
