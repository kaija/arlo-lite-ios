# Design Document: Agent Loop

## Architecture Overview

The Agent Loop adds an iterative tool-execution layer between the `useChat` hook and the `CompletionService`. When a provider response contains tool calls, the loop executes them locally, appends results to the conversation, and re-invokes the provider until a final text response arrives or the safety cap is reached.

```
useChat hook
  └── runAgentLoop()
        ├── CompletionService (existing)
        ├── executeToolCalls() — dispatches to handlers sequentially
        ├── toolRegistry (Map<string, ToolDefinition>)
        └── format helpers (inline, provider-branched)
```

## File Structure

```
src/services/
  agent-loop.ts          — runAgentLoop orchestrator + format helpers + parser
  tool-registry.ts       — Map-based registry + getSchemas(providerType)
  tool-executor.ts       — executeToolCalls with timeout + error wrapping
  tools/
    built-in.ts          — deviceInfoTool + datetimeTool definitions
```

## Components

### 1. runAgentLoop (orchestrator)

**Location:** `src/services/agent-loop.ts`

Single exported function. No class, no instance state between invocations. Each call manages its own iteration counter and accumulated usage.

```typescript
import type { ChatMessage, TokenUsage, ProviderType } from '@/providers/types';
import type { CompletionServiceOptions } from '@/services/completion-service';

export type TerminationReason = 'final_response' | 'safety_cap' | 'aborted' | 'error';

export interface AgentLoopResult {
  content: string;
  thinkingContent?: string;
  totalUsage: TokenUsage;
  terminationReason: TerminationReason;
  iterationCount: number;
}

export interface AgentLoopCallbacks {
  onToolCall: (msg: ToolCallMessage) => Promise<void>;
  onToolResult: (msg: ToolResultMessage) => Promise<void>;
  onStreamText?: (chunk: string) => void;
  onStreamThinking?: (chunk: string) => void;
  /** Called when an intermediate iteration emits text before tool calls.
   *  Caller persists the text and resets stream buffer for next iteration. */
  onIntermediateContent?: (content: string, thinkingContent?: string) => Promise<void>;
}

export interface AgentLoopOptions {
  safetyCap?: number;          // default: 10
  providerType: ProviderType;
  supportsToolUse: boolean;
  streaming: boolean;
}

export async function runAgentLoop(
  messages: ChatMessage[],
  completionOptions: CompletionServiceOptions,
  loopOptions: AgentLoopOptions,
  callbacks: AgentLoopCallbacks,
  signal: AbortSignal,
): Promise<AgentLoopResult>;
```

**Behavior:**
- If `supportsToolUse` is false → single-turn CompletionService call, no tools attached, return immediately.
- Attaches tool schemas (formatted for provider type) to each CompletionRequest.
- On each iteration: call CompletionService → parse response → if tool calls present, execute them, persist via callbacks, append results to context, loop. If no tool calls → return final response.
- Checks `signal.aborted` before each iteration.
- Accumulates TokenUsage from every iteration.

**Streaming + tool calls:** In streaming mode, `runAgentLoop` buffers the full response via `streamCompletion` before parsing tool calls. Text and thinking chunks are still forwarded progressively to callbacks during buffering — so the user sees partial text if the model emits text before/alongside tool calls (Anthropic does this). Once the stream ends, the accumulated response is checked for tool calls. This avoids implementing partial-delta tool call assembly.

**Inline helpers** (not exported, same file):

```typescript
// ~15 lines each, switch on providerType
function parseToolCalls(providerType: ProviderType, response: unknown): ToolCall[];
function hasToolCalls(providerType: ProviderType, response: unknown): boolean;
function formatToolCallMessage(providerType: ProviderType, toolCalls: ToolCall[]): ChatMessage;
function formatToolResultMessages(providerType: ProviderType, results: ToolResult[]): ChatMessage[];
```

**OpenAI/Custom parsing:** `response.choices[0].message.tool_calls[]` → map to `ToolCall`.
**Anthropic parsing:** `response.content[]` where `type === "tool_use"` → map to `ToolCall`.

**OpenAI/Custom result format:** One message per result, `{ role: "tool", tool_call_id, content }`.
**Anthropic result format:** Single user message with `tool_result` content blocks.

### 2. Tool Registry

**Location:** `src/services/tool-registry.ts`

A Map wrapper with schema formatting. No interface — one implementation is all we need.

```typescript
import type { ProviderType } from '@/providers/types';

/** Context passed to every tool handler. Extend as tools need more. */
export interface ToolContext {
  signal: AbortSignal;
  // Future: sessionId, messages, providerType, etc.
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema, minimum { type: "object" }
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const tools = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void;
  // Validates: non-empty name (alphanum + underscores, ≤64 chars), unique, non-empty description, parameters has type:"object"
  // Throws on validation failure.

export function getTool(name: string): ToolDefinition | undefined;

export function getToolSchemas(providerType: ProviderType): unknown[];
  // OpenAI/Custom → [{ type: "function", function: { name, description, parameters } }]
  // Anthropic → [{ name, description, input_schema: parameters }]

export function initBuiltInTools(): void;
  // Registers deviceInfoTool + datetimeTool. Called once at app startup.
```

### 3. Tool Executor

**Location:** `src/services/tool-executor.ts`

Sequential execution with per-call timeout. No concurrency infra — our built-in tools return in <1ms.

```typescript
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type ToolResultStatus = 'success' | 'error' | 'timeout' | 'not_found';

export interface ToolResult {
  toolCallId: string;
  name: string;
  status: ToolResultStatus;
  content: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Execute tool calls sequentially. Each call gets a 30s timeout.
 * Never throws — errors are captured as ToolResult with appropriate status.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  signal: AbortSignal,
  timeoutMs?: number,
): Promise<ToolResult[]>;
```

**Execution:**
- For each tool call: look up handler via `getTool(name)`.
- Not found → `{ status: 'not_found' }`.
- Found → run with `AbortSignal.timeout(timeoutMs)` passed as `ctx.signal`. If throws → `{ status: 'error' }`. If times out → `{ status: 'timeout' }`.
- If parent `signal` is aborted, stop processing remaining calls.
- Returns one ToolResult per input ToolCall, in order.

### 4. Built-in Tools

**Location:** `src/services/tools/built-in.ts`

Both tools in one file. ~30 lines total implementation.

```typescript
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type { ToolDefinition } from '@/services/tool-registry';

export const deviceInfoTool: ToolDefinition = {
  name: 'get_device_info',
  description: 'Returns device OS, model, locale, and timezone.',
  parameters: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string', enum: ['os', 'model', 'locale', 'timezone', 'all'] },
        description: 'Which fields to return. "all" for everything.',
      },
    },
    required: ['fields'],
  },
  handler: async (args, _ctx) => {
    const fields = (args.fields as string[]) ?? ['all'];
    const info: Record<string, string> = {};
    if (fields.includes('all') || fields.includes('os')) info.os = `${Platform.OS} ${Platform.Version}`;
    if (fields.includes('all') || fields.includes('model')) info.model = Device.modelName ?? 'Unknown';
    if (fields.includes('all') || fields.includes('locale')) info.locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (fields.includes('all') || fields.includes('timezone')) info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return JSON.stringify(info);
  },
};

export const datetimeTool: ToolDefinition = {
  name: 'get_current_datetime',
  description: 'Returns current date/time in the specified format.',
  parameters: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['iso', 'unix', 'human', 'date_only', 'time_only'] },
    },
    required: ['format'],
  },
  handler: async (args, _ctx) => {
    const now = new Date();
    switch (args.format) {
      case 'unix': return String(Math.floor(now.getTime() / 1000));
      case 'human': return now.toLocaleString();
      case 'date_only': return now.toLocaleDateString();
      case 'time_only': return now.toLocaleTimeString();
      default: return now.toISOString();
    }
  },
};
```

## Data Model Changes

### Extended types in `src/providers/types.ts`

```typescript
// Add to StreamChunk.type union:
type: 'text' | 'thinking' | 'done' | 'error' | 'tool_call';

// Add to StreamChunk:
toolCall?: ToolCall;

// Add to CompletionRequest:
tools?: unknown[];  // formatted schemas, provider-specific

// Add to ChatMessage:
role: 'user' | 'assistant' | 'system' | 'tool';
tool_call_id?: string;          // required on role:"tool" messages (OpenAI)
toolCalls?: ToolCall[];          // present on assistant messages that invoke tools (OpenAI requires this echoed back)

// Add to model config:
supportsToolUse?: boolean;  // default false
```

### Database

The `role` column is already freeform text — no schema migration needed. Add an index for filtering:

```sql
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role);
```

Tool messages store JSON in the existing `content` column. Parse with type assertion at read-time.

### Provider adapter changes

Each provider adapter (`openai-provider.ts`, `anthropic-provider.ts`, `custom-provider.ts`) needs a one-line addition: if `request.tools` is present and non-empty, include it in the params object sent to the API. This is a small but required change per provider.

## useChat Integration

Changes to `src/hooks/useChat.ts`:

1. When `supportsToolUse` is true for the active model, route `sendMessage` through `runAgentLoop()` instead of direct CompletionService calls.
2. Pass `AgentLoopCallbacks` that persist tool messages via existing `addMessage` and pipe streaming through existing buffer → batcher → `flushStreamBuffer` path.
3. Pass existing `AbortController.signal`.
4. On completion, compute cost from `AgentLoopResult.totalUsage`.
5. Keep `isStreaming = true` for the entire loop duration.
6. Map errors to `ChatError`.
7. Call `startBatcher()` before `runAgentLoop()`, `stopBatcher()` after it returns — batcher spans all iterations.

New state exposed:
```typescript
currentIteration: number;    // 0 if not in a loop
isToolExecuting: boolean;    // true while tools are running (vs streaming)
```

### Streaming buffer lifecycle across iterations

Between iterations, the stream buffer must be **flushed and reset** to prevent text bleed. The per-iteration flow:

```
Iteration N begins:
  streamCompletion() → chunks arrive → onStreamText pipes to textBuffer
  batcher flushes to UI every 32ms (user sees text appear)
  stream ends → stopBatcher-flush (drain remaining buffer)

  IF tool calls detected:
    persist pre-tool text + tool call as assistant message (via onToolCall)
    clearStream()  ← reset streamContent for next iteration
    set isToolExecuting = true
    executeToolCalls() → persist results (via onToolResult)
    set isToolExecuting = false
    startBatcher() again for next iteration

  IF final response (no tool calls):
    text stays in streamContent → persisted as final assistant message on return
```

This means `AgentLoopCallbacks` also needs:
```typescript
/** Called when an intermediate iteration produced text before tool calls.
 *  The caller should persist this text and clear the stream buffer. */
onIntermediateContent?: (content: string, thinkingContent?: string) => Promise<void>;
```

## Error Handling

| Scenario | Handling |
|---|---|
| Tool not found | ToolResult `status: 'not_found'`, loop continues |
| Tool handler throws | ToolResult `status: 'error'`, loop continues |
| Tool timeout | ToolResult `status: 'timeout'`, loop continues |
| CompletionService throws | Loop terminates, `terminationReason: 'error'`, propagated to useChat |
| Abort signal | Loop terminates, `terminationReason: 'aborted'`, partial content persisted |
| Safety cap reached | Loop terminates, `terminationReason: 'safety_cap'`, partial content returned |

Tool errors are non-fatal — the error is sent back to the model which decides how to proceed. Only provider errors and abort terminate the loop.
