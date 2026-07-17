# Design Document: Thinking Effort Control

## Architecture Overview

The Thinking Effort Control feature spans three layers of the Arlo Lite architecture:

1. **Input layer** — ThinkingLevelSelector (brain icon + popover) gated by model capability (`supportsReasoning`)
2. **Streaming layer** — chunk routing through ChatStore, phase detection, and buffered accumulation
3. **Presentation layer** — ThinkingDisclosure with animated states and expand/collapse behavior

Data flows unidirectionally: provider emits `StreamChunk` → `ChatStore` accumulates state → React components subscribe and render. Persistence writes occur only at stream completion, with `thinkingContent` stored alongside message content in the `messages` table.

```
┌─────────────────┐     StreamChunk      ┌────────────┐     Zustand     ┌───────────────────┐
│ Provider Adapter │ ──────────────────▶ │  ChatStore  │ ──subscribe──▶ │ StreamingMessage   │
│  (Anthropic/OAI) │   type: thinking    │             │                │  └─ThinkingDisc.  │
└─────────────────┘   type: text         │ thinkingContent              │  └─EqualiserAnim. │
                      type: done/error   │ streamContent│                └───────────────────┘
                                         │ isStreaming  │
                                         └──────┬──────┘
                                                │ on 'done'
                                                ▼
                                         ┌────────────┐
                                         │ MessageRepo │  (expo-sqlite)
                                         │ thinking_content column       │
                                         └────────────┘
```

## Component Design

### ThinkingLevelSelector (redesign — `src/components/input/ThinkingLevelSelector.tsx`)

A brain icon button that opens a popover/dropdown menu for level selection.

**Visual design:**
- **Idle state (off):** Brain icon rendered in muted gray (`colors.textTertiary`), indicating reasoning is disabled
- **Active state (any non-off level):** Brain icon rendered in accent color (`colors.accent` / indigo), indicating reasoning is enabled
- **Tap interaction:** Single tap opens a floating popover anchored below/above the icon (depending on available space)

**Popover menu (ThinkingLevelPopover):**

```
┌─────────────────────────────────────────┐
│  Reasoning effort                        │
├─────────────────────────────────────────┤
│  ✓  Off                                 │
│     Low               Max 512 tokens     │
│     Medium          Max 2,048 tokens     │
│  ●  High            Max 8,192 tokens     │
│     Max                   Unlimited  ⓘ  │
└─────────────────────────────────────────┘
```

**Level options (reduced from 6 to 5 for simplicity):**

| Level | Label | Budget hint | Mapping |
|-------|-------|-------------|---------|
| `off` | Off | — | No thinking params sent |
| `low` | Low | Max 512 tokens | Anthropic: budget_tokens 512; OpenAI: reasoning_effort 'low' |
| `medium` | Medium | Max 2,048 tokens | Anthropic: budget_tokens 2048; OpenAI: reasoning_effort 'medium' |
| `high` | High | Max 8,192 tokens | Anthropic: budget_tokens 8192; OpenAI: reasoning_effort 'high' |
| `max` | Max | Unlimited | Anthropic: budget_tokens 32768; OpenAI: reasoning_effort 'high' |

**Note:** The `minimal` and `xhigh` levels from the original 6-level enum are removed. The `ThinkingLevel` type is simplified to `'off' | 'low' | 'medium' | 'high' | 'max'`. The `max` level replaces `xhigh` and has no token cap (unlimited reasoning).

**Interaction behavior:**
- Tapping a level option immediately selects it, updates the store, and dismisses the popover
- The checkmark (✓) indicates the currently selected level
- The popover dismisses on outside tap or level selection
- The info icon (ⓘ) on "Max" can show a tooltip explaining unlimited reasoning has higher latency and cost

**Visibility gating:** The brain icon is rendered conditionally — only when `ModelConfig.supportsReasoning === true`. When the model changes to one without reasoning support, the icon disappears and `thinkingLevel` resets to `'off'`.

**VoiceOver:**
- Brain icon: `accessibilityRole="button"`, `accessibilityLabel="Reasoning effort: {currentLevel}"`, `accessibilityHint="Double tap to change reasoning level"`
- Popover menu items: each is a button with `accessibilityLabel="{level name}, {budget hint}"`, `accessibilityState={{ selected: isCurrentLevel }}`

**Integration point:** The parent input area component reads `activeModelId` from ChatStore, looks up the ModelConfig, and conditionally renders the brain icon. When switching to a non-reasoning model, the parent must also call `setThinkingLevel('off')`.

### ThinkingLevelPopover (new — `src/components/input/ThinkingLevelPopover.tsx`)

A floating menu presented when the user taps the brain icon. Rendered as a Modal or absolutely-positioned view anchored to the brain icon's position.

**Props:**
```typescript
export interface ThinkingLevelPopoverProps {
  /** Whether the popover is currently visible. */
  visible: boolean;
  /** The currently selected thinking level. */
  currentLevel: ThinkingLevel;
  /** Callback when user selects a level. */
  onSelectLevel: (level: ThinkingLevel) => void;
  /** Callback when the popover is dismissed (outside tap or selection). */
  onDismiss: () => void;
  /** Anchor position for the popover (measured from brain icon). */
  anchorPosition: { x: number; y: number };
}
```

**Visual structure:**
- Dark semi-transparent background overlay (tap to dismiss)
- Rounded card with `colors.surfaceElevated` background
- Title: "Reasoning effort" in `typography.headline` weight
- List of 5 options, each showing:
  - Left: checkmark icon (only for selected level) or empty space
  - Center: level label in `typography.body`
  - Right: budget hint in `typography.caption` / `colors.textSecondary`
- Selected item has a highlighted background row (`colors.surfaceTertiary`)
- The "Max" row includes an info icon (ⓘ) after "Unlimited" — tapping shows a brief tooltip about cost/latency

**Animations:**
- Popover entrance: scale from 0.95 → 1.0 + opacity 0 → 1 over 200ms (spring)
- Popover exit: opacity 1 → 0 over 150ms (ease-out)

**Level data model:**
```typescript
export const THINKING_LEVELS = [
  { key: 'off', label: 'Off', budgetHint: null },
  { key: 'low', label: 'Low', budgetHint: 'Max 512 tokens' },
  { key: 'medium', label: 'Medium', budgetHint: 'Max 2,048 tokens' },
  { key: 'high', label: 'High', budgetHint: 'Max 8,192 tokens' },
  { key: 'max', label: 'Max', budgetHint: 'Unlimited' },
] as const;
```

### ChatStore Streaming State (existing — `src/stores/chat-store.ts`)

The store manages ephemeral streaming state with these relevant fields and actions:

```typescript
interface ChatState {
  isStreaming: boolean;
  streamContent: string;       // accumulated text chunks
  thinkingContent: string;     // accumulated thinking chunks
  thinkingLevel: ThinkingLevel; // 'off' | 'low' | 'medium' | 'high' | 'max'
}

interface ChatActions {
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (text: string) => void;
  appendThinkingContent: (text: string) => void;
  flushStreamBuffer: (textDelta: string, thinkingDelta: string) => void;
  clearStream: () => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
}
```

**Stream orchestration logic** (in the completion service consumer / hook):

```typescript
// Pseudocode for the streaming loop
chatStore.clearStream();
chatStore.setStreaming(true);

for await (const chunk of streamCompletion(messages, options, signal)) {
  switch (chunk.type) {
    case 'thinking':
      chatStore.appendThinkingContent(chunk.content);
      break;
    case 'text':
      chatStore.appendStreamContent(chunk.content);
      break;
    case 'done':
      chatStore.setStreaming(false);
      // Persist message with thinkingContent
      await messageRepo.createMessage(db, {
        sessionId,
        role: 'assistant',
        content: chatStore.streamContent,
        thinkingContent: chatStore.thinkingContent || null,
        providerId,
        modelId,
        ...chunk.usage,
      });
      break;
    case 'error':
      chatStore.setStreaming(false);
      // thinkingContent preserved for display; error rendered inline
      break;
  }
}
```

### StreamingMessage (existing — `src/components/chat/StreamingMessage.tsx`)

Renders the active streaming response. Receives `isThinking`, `thinkingContent`, and `content` as props from the parent (which derives `isThinking` from `thinkingContent.length > 0 && content.length === 0`).

**Phase states:**

| State | Condition | UI |
|-------|-----------|-----|
| Thinking (initial) | `isThinking && thinkingContent === ''` | Pulsing "Thinking" label + EqualiserAnimation |
| Thinking (content) | `isThinking && thinkingContent.length > 0` | ThinkingDisclosure (blinking label) + EqualiserAnimation |
| Text streaming | `!isThinking && content.length > 0` | ThinkingDisclosure (static) + text + blinking cursor |
| Complete | parent unmounts or isStreaming=false | — |

**Transition (thinking → text):** When `isThinking` flips to false:
1. ThinkingDisclosure label stops blinking (opacity → 1.0, 300ms wind-down)
2. EqualiserAnimation winds down (300ms via its existing `isActive` prop)
3. Cursor animation begins

### ThinkingDisclosure (existing — `src/components/chat/ThinkingDisclosure.tsx`)

Renders reasoning content in a collapsible block. Key parameters:
- `content: string` — the thinking text
- `isExpanded: boolean` — controlled by parent
- `onToggle: () => void` — parent manages state

**Animation:**
- Blinking label: opacity oscillates 0.3 ↔ 1.0 with 600ms half-cycle, ease-in-out
- Chevron: 0° (collapsed) ↔ 90° (expanded)
- Returns `null` when content is empty/falsy (fulfills Req 8.3)

**Active vs Static modes:**
The component currently always blinks. To support the "static completed" state after thinking ends, the component needs an `isActive` prop (or the parent stops rendering it and re-renders a static variant). The cleaner approach: add an `isActive` prop that controls whether the blink animation runs.

### EqualiserAnimation (existing — `src/components/input/EqualiserAnimation.tsx`)

4-bar staggered scale animation. Already supports `isActive` prop — winds down to rest in 300ms when deactivated.

### ThinkingMapper (existing — `src/domain/thinking-mapper.ts`)

Pure function mapping `ThinkingLevel` → provider-specific parameters.

The 5-level scheme maps as follows:

| Level | OpenAI | Anthropic | Custom (llama-server) |
|-------|--------|-----------|----------------------|
| `off` | omit param | `thinking: { type: 'disabled' }` | `chat_template_kwargs: { enable_thinking: false }` |
| `low` | `reasoning_effort: 'low'` | `thinking: { type: 'enabled', budget_tokens: 512 }` | `chat_template_kwargs: { enable_thinking: true }` |
| `medium` | `reasoning_effort: 'medium'` | `thinking: { type: 'enabled', budget_tokens: 2048 }` | `chat_template_kwargs: { enable_thinking: true }` |
| `high` | `reasoning_effort: 'high'` | `thinking: { type: 'enabled', budget_tokens: 8192 }` | `chat_template_kwargs: { enable_thinking: true }` |
| `max` | `reasoning_effort: 'high'` | `thinking: { type: 'enabled', budget_tokens: 32768 }` | `chat_template_kwargs: { enable_thinking: true }` |

**Note:** The Custom provider's llama-server mapping only supports on/off via `enable_thinking`. Token budget control on the OpenAI-compat endpoint is not supported per-request — only the Anthropic-compat endpoint of llama-server supports `budget_tokens`. See the `custom-provider-thinking` spec for the full custom provider reasoning mode architecture.

## Data Model

### Messages table (existing schema — v1 migration)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  thinking_content TEXT,          -- nullable; stores reasoning content
  provider_id TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cached_tokens INTEGER,
  cost REAL,
  created_at INTEGER NOT NULL
);
```

The `thinking_content` column already exists. The repository layer's `CreateMessageData` interface accepts `thinkingContent?: string | null` and maps it to the column.

### Sessions table (relevant fields)

```sql
thinking_level TEXT DEFAULT NULL  -- persisted per-session thinking level preference
```

## Interfaces

### ThinkingDisclosure Props (enhanced)

```typescript
export interface ThinkingDisclosureProps {
  /** The reasoning/thinking content to display when expanded. */
  content: string;
  /** Whether the disclosure block is currently expanded. */
  isExpanded: boolean;
  /** Callback fired when the user toggles the expanded/collapsed state. */
  onToggle: () => void;
  /** Whether the thinking phase is still active (controls blinking animation). */
  isActive?: boolean;  // NEW — defaults to true for backward compat
}
```

### StreamingMessage Props (existing)

```typescript
export interface StreamingMessageProps {
  content: string;
  thinkingContent: string;
  isThinking: boolean;
  modelName: string;
  tokenRate: number;
  showAvatars: boolean;
}
```

### Phase Detection Logic

```typescript
/**
 * Derives the current streaming phase from ChatStore state.
 * Pure function — no side effects.
 */
export function deriveStreamingPhase(state: {
  isStreaming: boolean;
  thinkingContent: string;
  streamContent: string;
}): 'idle' | 'thinking-pending' | 'thinking-active' | 'text-streaming' {
  if (!state.isStreaming) return 'idle';
  if (state.streamContent.length > 0) return 'text-streaming';
  if (state.thinkingContent.length > 0) return 'thinking-active';
  return 'thinking-pending';
}
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| `StreamChunk.type === 'error'` during thinking phase | `isStreaming` → false; thinkingContent preserved; error message rendered inline below thinking disclosure |
| `StreamChunk.type === 'error'` during text phase | `isStreaming` → false; both streamContent and thinkingContent preserved; error inline |
| Abort signal fired (user taps stop) | Provider stream terminates; `isStreaming` → false; partial content persisted as-is |
| Model switch during streaming | Not permitted — send button replaced by stop button while streaming |
| Non-reasoning model selected | thinkingLevel reset to 'off'; thinking params omitted from CompletionRequest |

## Accessibility

- **VoiceOver announcements** at phase transitions: `AccessibilityInfo.announceForAccessibility()` on React Native posts a live announcement without focus change.
- **ThinkingDisclosure toggle**: `accessibilityRole="button"`, `accessibilityState={{ expanded }}`. Label is static "Expand thinking" / "Collapse thinking" — does not blink.
- **ThinkingLevelSelector (brain icon)**: `accessibilityRole="button"`, `accessibilityLabel` includes "Reasoning effort" and current level name, `accessibilityHint="Double tap to change reasoning level"`.
- **ThinkingLevelPopover items**: Each option has `accessibilityRole="menuitem"`, `accessibilityLabel="{level name}"`, `accessibilityState={{ selected: isCurrentLevel }}`. The budget hint is included in the label for screen readers.
- **During blink animation**: The animated opacity is purely visual. The `accessibilityLabel` on the Thinking text remains constant ("Thinking") so VoiceOver doesn't re-announce on each opacity change.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Thinking level resets on non-reasoning model switch

*For any* initial ThinkingLevel and any model switch where the target model has `supportsReasoning === false`, after the switch completes the ChatStore's `thinkingLevel` SHALL equal `'off'`.

**Validates: Requirements 1.4**

### Property 2: Thinking level selection is a closed 5-element set

*For any* ThinkingLevel value selected via the popover, it SHALL be one of: `off`, `low`, `medium`, `high`, `max`. The popover SHALL display exactly these 5 options, and selecting any option SHALL update the ChatStore's `thinkingLevel` to the selected value.

**Validates: Requirements 2.1**

### Property 3: Stream chunk accumulation preserves all content

*For any* sequence of StreamChunk objects, applying each chunk to the ChatStore (via `appendThinkingContent` for thinking chunks, `appendStreamContent` for text chunks) SHALL result in `thinkingContent` equaling the concatenation of all thinking chunk contents in order, and `streamContent` equaling the concatenation of all text chunk contents in order.

**Validates: Requirements 3.1, 3.2**

### Property 4: Clear stream resets to empty regardless of prior state

*For any* prior values of `streamContent` and `thinkingContent` in the ChatStore, calling `clearStream()` SHALL result in both fields being empty strings.

**Validates: Requirements 3.3**

### Property 5: Error chunk preserves accumulated thinking content

*For any* accumulated `thinkingContent` string in the ChatStore at the time an error occurs, setting `isStreaming` to false (as the error handler does) SHALL leave `thinkingContent` unchanged from its pre-error value.

**Validates: Requirements 3.5**

### Property 6: Thinking content persistence round-trip

*For any* non-empty `thinkingContent` string, persisting a message via `createMessage` with that content and subsequently reading it back via `getMessagesBySession` SHALL return a message whose `thinkingContent` field equals the original string.

**Validates: Requirements 8.1**

### Property 7: Thinking level mapper produces valid provider parameters

*For any* ThinkingLevel in {off, low, medium, high, max} and any provider type (openai, anthropic, custom), `mapThinkingLevel(providerType, level)` SHALL return an object. When level is `'off'` and provider is OpenAI/custom, the result SHALL be an empty object (or contain only `chat_template_kwargs: {enable_thinking: false}` for custom). When level is `'off'` and provider is Anthropic, the result SHALL contain `thinking.type === 'disabled'`. For all non-off levels with Anthropic, the result SHALL contain `thinking.type === 'enabled'` with a positive `budget_tokens` value. For `max` level, the `budget_tokens` SHALL be 32768 (unlimited intent).

**Validates: Requirements 2.1, 3.1**
