# Design: Custom Provider Thinking Effort Control

## Architecture Overview

This feature modifies a single vertical slice of the app: the Custom provider's request-building pipeline. No UI streaming logic, no new components, no store changes — just how the Custom provider translates the already-existing `ThinkingLevel` into wire-format parameters appropriate for llama-server and similar backends.

The change touches three layers:

1. **Data model** — extend `ProviderConfig` with `reasoningMode` and `thinkingKwargs`
2. **Domain logic** — new mapper function `mapThinkingLevelCustom` that produces the correct request params based on reasoning mode
3. **Provider adapter** — `CustomProvider` uses the new mapper instead of `mapThinkingLevelOpenAI`

```
┌──────────────────┐     ThinkingLevel      ┌─────────────────────┐
│    ChatStore      │ ────────────────────▶ │  CompletionService   │
│  thinkingLevel    │                       │  builds request      │
└──────────────────┘                       └──────────┬───────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────┐
                                            │   CustomProvider      │
                                            │                       │
                                            │  reads config.        │
                                            │  reasoningMode        │
                                            │         │             │
                                            │         ▼             │
                                            │  mapThinkingLevel-    │
                                            │  Custom(level, mode,  │
                                            │         kwargs)       │
                                            │         │             │
                                            │         ▼             │
                                            │  merges into request  │
                                            │  params object        │
                                            └──────────┬───────────┘
                                                       │
                                                       ▼
                                            ┌─────────────────────┐
                                            │  OpenAI SDK          │
                                            │  chat.completions.   │
                                            │  create(params)      │
                                            └─────────────────────┘
```

## Reasoning Mode Strategy

The `reasoningMode` field determines which wire-format mechanism the provider uses:

| Mode | reasoning_effort | chat_template_kwargs | Use case |
|------|-----------------|---------------------|----------|
| `auto` (default) | Yes (when level != off) | Yes (always) | Works with any backend; safe fallback |
| `openai-reasoning-effort` | Yes | No | Real OpenAI-compat servers (Ollama with reasoning_effort, OpenRouter) |
| `chat-template-kwargs` | No | Yes | llama-server, vLLM with Jinja templates |
| `none` | No | No | Models without thinking support; skip all params |

### Auto Mode Logic

Auto sends both mechanisms simultaneously. This is safe because:
- llama-server ignores unknown top-level fields like `reasoning_effort`
- OpenAI-compat servers that read `reasoning_effort` ignore unknown fields like `chat_template_kwargs`
- No server we've tested errors on the presence of both

The one semantic overlap: if a server reads both, `chat_template_kwargs` typically wins because it's processed at template render time (before generation), while `reasoning_effort` would be a higher-level hint. For Qwen3.6 on llama-server, only `chat_template_kwargs` has any effect.

## Component Design

### mapThinkingLevelCustom (new — `src/domain/thinking-mapper.ts`)

New exported function added alongside the existing `mapThinkingLevelOpenAI` and `mapThinkingLevelAnthropic`:

```typescript
/**
 * Reasoning mode for Custom providers — determines wire-format mechanism.
 */
export type CustomReasoningMode =
  | 'auto'
  | 'openai-reasoning-effort'
  | 'chat-template-kwargs'
  | 'none';

/**
 * Result of mapping ThinkingLevel for a Custom provider.
 * Contains the fields to merge into the request body.
 */
export interface CustomThinkingParams {
  /** OpenAI-standard reasoning_effort field, or undefined to omit. */
  reasoning_effort?: string;
  /** llama-server chat_template_kwargs object, or undefined to omit. */
  chat_template_kwargs?: Record<string, unknown>;
}

/**
 * Map ThinkingLevel to Custom provider parameters based on reasoning mode.
 *
 * @param level - The abstract thinking level from the UI
 * @param mode - The configured reasoning mode for this provider instance
 * @param thinkingKwargs - Optional custom kwargs (overrides default enable_thinking)
 * @returns Object with fields to spread into the request body
 */
export function mapThinkingLevelCustom(
  level: ThinkingLevel,
  mode: CustomReasoningMode = 'auto',
  thinkingKwargs?: Record<string, unknown> | null,
): CustomThinkingParams {
  if (mode === 'none') return {};

  const enableThinking = level !== 'off';
  const reasoningEffort = mapReasoningEffortValue(level);

  // Determine chat_template_kwargs value
  const kwargs = buildChatTemplateKwargs(enableThinking, thinkingKwargs);

  switch (mode) {
    case 'openai-reasoning-effort':
      return enableThinking && reasoningEffort
        ? { reasoning_effort: reasoningEffort }
        : {};

    case 'chat-template-kwargs':
      return { chat_template_kwargs: kwargs };

    case 'auto':
    default:
      return {
        ...(enableThinking && reasoningEffort
          ? { reasoning_effort: reasoningEffort }
          : {}),
        chat_template_kwargs: kwargs,
      };
  }
}

/**
 * Map ThinkingLevel to the reasoning_effort string value.
 * Returns undefined for 'off' (field should be omitted).
 */
function mapReasoningEffortValue(level: ThinkingLevel): string | undefined {
  switch (level) {
    case 'off': return undefined;
    case 'minimal':
    case 'low': return 'low';
    case 'medium': return 'medium';
    case 'high':
    case 'xhigh': return 'high';
  }
}

/**
 * Build the chat_template_kwargs object.
 *
 * If custom thinkingKwargs are provided, use them when enabling thinking,
 * and negate boolean values when disabling. Otherwise use the Qwen-standard
 * {"enable_thinking": true/false} default.
 */
function buildChatTemplateKwargs(
  enableThinking: boolean,
  thinkingKwargs?: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!thinkingKwargs) {
    // Default: Qwen-family format
    return { enable_thinking: enableThinking };
  }

  if (enableThinking) {
    // Use kwargs as-is when thinking is enabled
    return { ...thinkingKwargs };
  }

  // Negate: flip all boolean values to false
  const negated: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(thinkingKwargs)) {
    negated[key] = typeof value === 'boolean' ? false : value;
  }
  return negated;
}
```

### CustomProvider Request Building (modified — `src/providers/custom/custom-provider.ts`)

The `complete()` and `streamCompletion()` methods change from:

```typescript
const thinkingParams = mapThinkingLevelOpenAI(request.thinkingLevel);
// ...
if (request.thinkingLevel !== 'off' && thinkingParams.reasoning_effort) {
  params.reasoning_effort = thinkingParams.reasoning_effort;
}
```

To:

```typescript
const thinkingParams = mapThinkingLevelCustom(
  request.thinkingLevel,
  config.reasoningMode ?? 'auto',
  config.thinkingKwargs,
);

// Merge thinking params into request body
if (thinkingParams.reasoning_effort) {
  params.reasoning_effort = thinkingParams.reasoning_effort;
}
if (thinkingParams.chat_template_kwargs) {
  params.chat_template_kwargs = thinkingParams.chat_template_kwargs;
}
```

No other changes to the provider — streaming response parsing (`delta.reasoning_content` → thinking chunk) already works correctly.

### ProviderConfig Extension (modified — `src/providers/types.ts`)

```typescript
export interface ProviderConfig {
  // ... existing fields ...

  /**
   * How thinking effort is communicated to the backend.
   * Only applicable for 'custom' provider type.
   * null/undefined = 'auto' (send both mechanisms).
   */
  reasoningMode?: CustomReasoningMode | null;

  /**
   * Custom chat_template_kwargs to send when thinking is enabled.
   * Only used when reasoningMode includes chat-template-kwargs.
   * null/undefined = use default {"enable_thinking": true/false}.
   *
   * Example for gpt-oss models: {"reasoning_effort": "high"}
   * Example for Qwen models: {"enable_thinking": true}
   */
  thinkingKwargs?: Record<string, unknown> | null;
}
```

### Database Migration (new — `src/database/migrations/004_reasoning_mode.ts`)

```sql
ALTER TABLE providers ADD COLUMN reasoning_mode TEXT DEFAULT NULL;
ALTER TABLE providers ADD COLUMN thinking_kwargs TEXT DEFAULT NULL;
```

The `thinking_kwargs` column stores JSON-serialized kwargs. The provider repository layer deserializes it on read and serializes on write, same pattern as the existing `generation_params` JSON column.

### Provider Repository Changes (modified — `src/database/repositories/provider-repo.ts`)

Add to `ProviderRow`:
```typescript
reasoning_mode: string | null;
thinking_kwargs: string | null;  // JSON string
```

Add to `CreateProviderData` and `UpdateProviderData`:
```typescript
reasoningMode?: CustomReasoningMode | null;
thinkingKwargs?: Record<string, unknown> | null;
```

Mapping in `mapRowToProvider`:
```typescript
reasoningMode: row.reasoning_mode as CustomReasoningMode | null,
thinkingKwargs: row.thinking_kwargs ? JSON.parse(row.thinking_kwargs) : null,
```

## Data Flow

### Request Building (Happy Path)

```
User taps send
  → useChatStore.thinkingLevel = 'medium'
  → CompletionService builds CompletionRequest { thinkingLevel: 'medium' }
  → CustomProvider.streamCompletion(config, request, ...)
  → mapThinkingLevelCustom('medium', 'auto', null)
      returns { reasoning_effort: 'medium', chat_template_kwargs: { enable_thinking: true } }
  → SDK request body:
      { model: "...", messages: [...], stream: true,
        reasoning_effort: "medium",
        chat_template_kwargs: { enable_thinking: true } }
  → Server responds with reasoning_content + content chunks
  → Existing streaming logic handles it correctly
```

### Request Building (Thinking Off)

```
User sets thinkingLevel = 'off'
  → mapThinkingLevelCustom('off', 'auto', null)
      returns { chat_template_kwargs: { enable_thinking: false } }
      (reasoning_effort omitted because level is off)
  → SDK request body:
      { model: "...", messages: [...], stream: true,
        chat_template_kwargs: { enable_thinking: false } }
  → Server produces no reasoning_content, only content chunks
  → Only text StreamChunks emitted
```

### Custom Kwargs (gpt-oss Example)

```
Provider config:
  reasoningMode: 'chat-template-kwargs'
  thinkingKwargs: { "reasoning_effort": "high" }

User sets thinkingLevel = 'high'
  → mapThinkingLevelCustom('high', 'chat-template-kwargs', { reasoning_effort: "high" })
      returns { chat_template_kwargs: { reasoning_effort: "high" } }

User sets thinkingLevel = 'off'
  → mapThinkingLevelCustom('off', 'chat-template-kwargs', { reasoning_effort: "high" })
      negation: reasoning_effort is not boolean → passed through as-is
      → Hmm, this doesn't work cleanly for string kwargs.
```

**Design decision for negation:** For non-boolean kwargs values, the `off` state omits `chat_template_kwargs` entirely rather than trying to negate unknown types. This is safer — if the field is absent, llama-server uses its default behavior (which for most templates means "use server-level --reasoning flag").

Revised negation logic:
```typescript
function buildChatTemplateKwargs(
  enableThinking: boolean,
  thinkingKwargs?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!thinkingKwargs) {
    return { enable_thinking: enableThinking };
  }

  if (enableThinking) {
    return { ...thinkingKwargs };
  }

  // For 'off': only negate if all values are boolean; otherwise omit entirely
  const allBoolean = Object.values(thinkingKwargs).every(v => typeof v === 'boolean');
  if (allBoolean) {
    const negated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(thinkingKwargs)) {
      negated[key] = !value;
    }
    return negated;
  }

  // Non-boolean kwargs: omit chat_template_kwargs when thinking is off
  return undefined;
}
```

And in the caller:
```typescript
const kwargs = buildChatTemplateKwargs(enableThinking, thinkingKwargs);
// Only include chat_template_kwargs if kwargs is defined
if (kwargs !== undefined) {
  result.chat_template_kwargs = kwargs;
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Server rejects `chat_template_kwargs` as unknown field | Should not happen — llama-server and OpenAI-compat servers ignore unknown fields. If it does, the standard SDK error classification handles it as a server error. |
| `thinkingKwargs` contains invalid JSON in DB | JSON.parse wrapped in try/catch in repository; falls back to null (default behavior). |
| User configures `reasoning_mode` but model doesn't support thinking | The `supportsReasoning` flag gates UI visibility; if user sends anyway via API, extra fields are harmless no-ops. |
| Migration fails on existing DB | ALTERs are additive nullable columns — SQLite handles these safely even with existing data. |

## UI Considerations (Provider Settings Screen)

The Reasoning Mode picker should appear **only** for Custom providers in the provider settings form:

```
┌─────────────────────────────────────────────┐
│ Provider Settings                            │
├─────────────────────────────────────────────┤
│ Name: [My llama-server          ]           │
│ Type: Custom                                 │
│ Base URL: [http://100.68.20.95:30000/v1  ]  │
│ API Key: [••••••••••]                        │
│                                              │
│ ─── Reasoning ───────────────────────────── │
│ Mode: [Auto ▾]                               │
│   • Auto — send both mechanisms              │
│   • OpenAI reasoning_effort only             │
│   • Chat template kwargs only                │
│   • None — disable thinking params           │
│                                              │
│ Template kwargs (JSON, optional):            │
│ [{"enable_thinking": true}              ]    │
│ ↳ Override for non-Qwen models               │
└─────────────────────────────────────────────┘
```

The `thinkingKwargs` field is shown only when mode is `auto` or `chat-template-kwargs`. It's validated as JSON on blur/submit.

## Correctness Properties

### Property 1: Auto mode always sends chat_template_kwargs

*For any* ThinkingLevel and a Custom provider with `reasoningMode === 'auto'`, calling `mapThinkingLevelCustom` SHALL always include a `chat_template_kwargs` field in the result (it may be `{enable_thinking: false}` for off, `{enable_thinking: true}` for non-off).

**Validates: Requirements 3.1, 3.2**

### Property 2: None mode produces empty params

*For any* ThinkingLevel and a Custom provider with `reasoningMode === 'none'`, calling `mapThinkingLevelCustom` SHALL return an empty object `{}` with no reasoning_effort and no chat_template_kwargs.

**Validates: Requirement 1.6**

### Property 3: chat-template-kwargs mode never sends reasoning_effort

*For any* ThinkingLevel and a Custom provider with `reasoningMode === 'chat-template-kwargs'`, calling `mapThinkingLevelCustom` SHALL never include a `reasoning_effort` field in the result.

**Validates: Requirement 1.5**

### Property 4: Backward compatibility — null reasoningMode behaves as auto

*For any* existing provider row where `reasoning_mode` is null (pre-migration data), the Custom provider SHALL behave identically to `reasoningMode === 'auto'`.

**Validates: Requirement 6.3, 6.5**

### Property 5: Custom kwargs override applies only when thinking is enabled

*For any* non-null `thinkingKwargs` configuration, when `ThinkingLevel !== 'off'`, the `chat_template_kwargs` in the result SHALL contain the exact key-value pairs from `thinkingKwargs`. When `ThinkingLevel === 'off'` and all kwargs values are boolean, the result SHALL contain negated values.

**Validates: Requirements 5.2, 5.4**

### Property 6: reasoning_effort values are constrained

*For any* ThinkingLevel mapped through `mapReasoningEffortValue`, the result SHALL be one of: `undefined`, `'low'`, `'medium'`, or `'high'`. No other string values are produced.

**Validates: Requirement 2 (existing behavior preserved)**
