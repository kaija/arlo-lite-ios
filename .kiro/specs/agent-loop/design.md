# Design Document: Agent Loop

## Architecture Overview

The Agent Loop introduces an iterative tool-execution layer between the `useChat` hook and the `CompletionService`. When a provider response contains tool calls, the Agent Loop Service executes them locally via the Tool Executor, appends results to the conversation context, and re-invokes the provider until a final text response is received or the safety cap is reached.

```
┌──────────────┐       ┌────────────────────┐       ┌───────────────────┐       ┌──────────┐
│  useChat     │──────▶│  AgentLoopService   │──────▶│ CompletionService │──────▶│ Provider │
│  Hook        │◀──────│                     │◀──────│                   │◀──────│ Adapter  │
└──────────────┘       │                     │       └───────────────────┘       └──────────┘
                       │    ┌─────────────┐  │
                       │    │ToolExecutor │  │
                       │    └──────┬──────┘  │
                       │           │         │
                       │    ┌──────▼──────┐  │
                       │    │ToolRegistry │  │
                       │    └─────────────┘  │
                       └────────────────────┘
```

### Iteration Cycle (Data Flow)

```
1. useChat calls AgentLoopService.run(messages, options, signal)
2. AgentLoopService attaches tool schemas from ToolRegistry to CompletionRequest
3. AgentLoopService invokes CompletionService (streaming or non-streaming)
4. IF response contains tool_calls:
   a. Persist tool call messages to chat thread (role: "assistant")
   b. ToolExecutor dispatches calls concurrently via ToolRegistry
   c. Persist tool result messages to chat thread (role: "tool")
   d. Accumulate TokenUsage
   e. Append tool results to conversation context
   f. IF iteration < safetyCap → GOTO step 3
   g. ELSE → terminate with cap-reached reason
5. IF response is Final_Response (text, no tool_calls):
   a. Accumulate TokenUsage
   b. Return final content + total usage to useChat
```

## Components

### 1. AgentLoopService

The core orchestrator. Stateless service module (no class instance state between invocations). Each call to `run()` manages its own iteration state.

**Location:** `src/services/agent-loop-service.ts`

```typescript
import type { ChatMessage, CompletionResponse, StreamChunk, TokenUsage, ProviderType } from '@/providers/types';
import type { CompletionServiceOptions } from '@/services/completion-service';

/** Reason the agent loop terminated. */
export type TerminationReason = 'final_response' | 'safety_cap' | 'aborted' | 'error';

/** Result returned from the agent loop to the caller. */
export interface AgentLoopResult {
  /** Final text content (may be partial if cap hit or aborted). */
  content: string;
  /** Optional thinking content from the final iteration. */
  thinkingContent?: string;
  /** Accumulated token usage across all iterations. */
  totalUsage: TokenUsage;
  /** Reason the loop terminated. */
  terminationReason: TerminationReason;
  /** Number of iterations executed. */
  iterationCount: number;
}

/** Callback for progressive UI updates during the loop. */
export interface AgentLoopCallbacks {
  /** Called when a tool call message should be persisted. */
  onToolCall: (toolCall: ToolCallMessage) => Promise<void>;
  /** Called when a tool result message should be persisted. */
  onToolResult: (toolResult: ToolResultMessage) => Promise<void>;
  /** Called with streaming text chunks during the final response. */
  onStreamText?: (chunk: string) => void;
  /** Called with thinking chunks during any iteration. */
  onStreamThinking?: (chunk: string) => void;
}

/** Options for configuring an agent loop invocation. */
export interface AgentLoopOptions {
  /** Maximum iterations before forced termination. Default: 10. */
  safetyCap?: number;
  /** Provider type for schema/response formatting. */
  providerType: ProviderType;
  /** Whether the provider/model supports tool use. */
  supportsToolUse: boolean;
  /** Whether to use streaming mode. */
  streaming: boolean;
}

/**
 * Run the agent loop.
 *
 * Iterates between CompletionService calls and tool execution until
 * a final response is received or the safety cap is reached.
 */
export async function runAgentLoop(
  messages: ChatMessage[],
  completionOptions: CompletionServiceOptions,
  loopOptions: AgentLoopOptions,
  callbacks: AgentLoopCallbacks,
  signal: AbortSignal,
): Promise<AgentLoopResult>;
```

**Key behaviors:**
- If `supportsToolUse` is false, bypasses the loop entirely and delegates to CompletionService for a single-turn completion.
- Passes the same `completionOptions` on every iteration — no mutation.
- Checks `signal.aborted` before each iteration and after tool execution.
- Accumulates `TokenUsage` from every iteration (successful or failed).

### 2. ToolRegistry

Centralized registry mapping tool names to handlers and providing formatted schemas per provider type.

**Location:** `src/services/tool-registry.ts`

```typescript
import type { ProviderType } from '@/providers/types';

/** JSON Schema object for tool parameters. */
export type ToolParameterSchema = Record<string, unknown>;

/** Definition of a tool that can be registered. */
export interface ToolDefinition {
  /** Unique tool name (alphanumeric + underscores). */
  name: string;
  /** Human-readable description for the LLM prompt. */
  description: string;
  /** JSON Schema describing the tool's expected parameters. */
  parameters: ToolParameterSchema;
  /** The handler function that executes this tool. */
  handler: ToolHandler;
}

/** A tool handler function. Receives parsed arguments, returns string content. */
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

/** OpenAI function calling format. */
export interface OpenAIToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

/** Anthropic tool use format. */
export interface AnthropicToolSchema {
  name: string;
  description: string;
  input_schema: ToolParameterSchema;
}

export type FormattedToolSchema = OpenAIToolSchema | AnthropicToolSchema;

export interface IToolRegistry {
  /**
   * Register a tool handler.
   * @throws if name is duplicate, schema is missing, or description is empty.
   */
  register(definition: ToolDefinition): void;

  /**
   * Unregister a tool by name. No-op if not registered.
   */
  unregister(name: string): void;

  /**
   * Retrieve a tool handler by name, or undefined if not registered.
   */
  getHandler(name: string): ToolHandler | undefined;

  /**
   * Get the definition of a specific tool by name.
   */
  getDefinition(name: string): ToolDefinition | undefined;

  /**
   * Get all tool schemas formatted for the specified provider type.
   */
  getSchemas(providerType: ProviderType): FormattedToolSchema[];

  /**
   * Get the count of registered tools.
   */
  size(): number;

  /**
   * Check if a tool is registered.
   */
  has(name: string): boolean;
}

/**
 * Create a new ToolRegistry instance.
 * Built-in tools are registered automatically during creation.
 */
export function createToolRegistry(): IToolRegistry;
```

**Validation rules on `register()`:**
- `name` must be non-empty, alphanumeric + underscores, max 64 chars.
- `name` must be unique (no duplicates).
- `description` must be non-empty string.
- `parameters` must be a valid JSON Schema object (at minimum, `{ type: "object" }`).

**Schema formatting by provider type:**
- `openai` / `custom` → `OpenAIToolSchema` format (function calling)
- `anthropic` → `AnthropicToolSchema` format (tool use)

### 3. ToolExecutor

Dispatches tool calls to handlers with concurrency, timeout, and error isolation.

**Location:** `src/services/tool-executor.ts`

```typescript
import type { IToolRegistry } from '@/services/tool-registry';

/** A tool call request parsed from a provider response. */
export interface ToolCall {
  /** Provider-assigned ID for this tool call (used to match results). */
  id: string;
  /** The tool name to invoke. */
  name: string;
  /** Parsed arguments object. */
  arguments: Record<string, unknown>;
}

/** Status of a tool execution. */
export type ToolResultStatus = 'success' | 'error' | 'timeout' | 'not_found';

/** Result of executing a single tool call. */
export interface ToolResult {
  /** The tool call ID this result corresponds to. */
  toolCallId: string;
  /** The tool name that was invoked. */
  name: string;
  /** Execution status. */
  status: ToolResultStatus;
  /** Output content (tool output on success, error message on failure). */
  content: string;
}

/** Options for the tool executor. */
export interface ToolExecutorOptions {
  /** Per-tool timeout in milliseconds. Default: 30000 (30 seconds). */
  timeoutMs?: number;
}

/**
 * Execute a batch of tool calls concurrently.
 *
 * Each call is dispatched to its handler via the registry.
 * Failed calls (not found, exception, timeout) produce error ToolResults
 * rather than throwing — the caller always receives one ToolResult per ToolCall.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  registry: IToolRegistry,
  signal: AbortSignal,
  options?: ToolExecutorOptions,
): Promise<ToolResult[]>;
```

**Execution semantics:**
- All tool calls from a single response are dispatched via `Promise.allSettled` for concurrent execution.
- Each call is individually wrapped with `AbortSignal.timeout(timeoutMs)` combined with the parent signal via `AbortSignal.any()`.
- If a handler throws, the error is caught and wrapped as a `ToolResult` with `status: 'error'`.
- If a handler times out, the result has `status: 'timeout'`.
- If the tool name is not in the registry, the result has `status: 'not_found'`.
- Results are returned in the same order as the input `toolCalls` array.

### 4. Provider-Specific Tool Call Parsing

Each provider returns tool calls in a different response format. The Agent Loop needs adapters to parse these.

**Location:** `src/services/tool-call-parser.ts`

```typescript
import type { ProviderType } from '@/providers/types';
import type { ToolCall } from '@/services/tool-executor';

/**
 * Parse tool calls from a provider's completion response.
 *
 * Each provider encodes tool calls differently:
 * - OpenAI: response.choices[0].message.tool_calls[]
 * - Anthropic: response.content[] with type "tool_use"
 *
 * @param providerType - The provider that produced the response.
 * @param responsePayload - The raw response payload from the provider.
 * @returns Array of parsed ToolCall objects, empty if none present.
 */
export function parseToolCalls(
  providerType: ProviderType,
  responsePayload: unknown,
): ToolCall[];

/**
 * Determine if a response contains tool calls (i.e., is not a final response).
 */
export function hasToolCalls(
  providerType: ProviderType,
  responsePayload: unknown,
): boolean;
```

**OpenAI format (Chat Completions):**
```typescript
// Response contains:
{
  choices: [{
    message: {
      tool_calls: [{
        id: "call_abc123",
        type: "function",
        function: { name: "get_weather", arguments: "{\"city\":\"Tokyo\"}" }
      }]
    },
    finish_reason: "tool_calls"
  }]
}
```

**Anthropic format (Messages API):**
```typescript
// Response contains:
{
  content: [
    { type: "text", text: "Let me check..." },
    { type: "tool_use", id: "toolu_abc123", name: "get_weather", input: { city: "Tokyo" } }
  ],
  stop_reason: "tool_use"
}
```

### 5. Tool Result Message Formatting

When re-invoking the provider after tool execution, results must be formatted per provider expectations.

**Location:** `src/services/tool-result-formatter.ts`

```typescript
import type { ProviderType, ChatMessage } from '@/providers/types';
import type { ToolCall } from '@/services/tool-executor';
import type { ToolResult } from '@/services/tool-executor';

/**
 * Format the assistant's tool call message for the conversation context.
 * Produces a ChatMessage compatible with the target provider's format.
 */
export function formatToolCallMessage(
  providerType: ProviderType,
  toolCalls: ToolCall[],
): ChatMessage;

/**
 * Format tool results as messages for the conversation context.
 * Produces ChatMessage(s) compatible with the target provider's format.
 *
 * OpenAI: One message per tool result with role "tool" and tool_call_id.
 * Anthropic: One message with role "user" containing tool_result content blocks.
 */
export function formatToolResultMessages(
  providerType: ProviderType,
  results: ToolResult[],
): ChatMessage[];
```

**OpenAI format for tool results:**
```typescript
// One message per result:
{ role: "tool", tool_call_id: "call_abc123", content: "Weather in Tokyo: 22°C, sunny" }
```

**Anthropic format for tool results:**
```typescript
// Single user message with tool_result blocks:
{
  role: "user",
  content: [
    { type: "tool_result", tool_use_id: "toolu_abc123", content: "Weather in Tokyo: 22°C, sunny" }
  ]
}
```

### 6. Chat Thread Message Types

The existing `MessageRole` type needs extension to support tool messages in the persisted chat thread.

**Extension to:** `src/database/repositories/message-repo.ts`

```typescript
/** Extended message role to include tool messages. */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/** Metadata stored as JSON in the message content for tool messages. */
export interface ToolCallMessageContent {
  type: 'tool_call';
  toolCalls: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export interface ToolResultMessageContent {
  type: 'tool_result';
  toolCallId: string;
  name: string;
  status: 'success' | 'error' | 'timeout' | 'not_found';
  content: string;
}
```

**Persistence strategy:**
- Tool call messages: role `'assistant'`, content is JSON-serialized `ToolCallMessageContent`.
- Tool result messages: role `'tool'`, content is JSON-serialized `ToolResultMessageContent`.
- The UI layer parses the content JSON to render tool-specific UI (collapsible tool cards, status badges).

### 7. useChat Hook Integration

The `useChat` hook gains awareness of tool-use sessions and delegates to `AgentLoopService` accordingly.

**Changes to:** `src/hooks/useChat.ts`

```typescript
// New state exposed by the hook:
export interface UseChatResult {
  // ... existing fields ...
  /** Current agent loop iteration (0 if not in a loop). */
  currentIteration: number;
  /** Whether the agent loop is actively executing tools (vs streaming final). */
  isToolExecuting: boolean;
}
```

**Integration points:**
1. When `sendMessage` is called and tool use is enabled for the active model, route to `runAgentLoop()` instead of `streamCompletion()`/`complete()` directly.
2. Pass the existing `AbortController.signal` to the agent loop for abort propagation.
3. Use `AgentLoopCallbacks` to:
   - Persist tool call/result messages via `addMessage`.
   - Update `streamContent` / `thinkingContent` during the final iteration.
4. On completion, compute cost from `AgentLoopResult.totalUsage` and persist on the final assistant message.
5. Keep `isStreaming = true` for the entire duration of the agent loop (all iterations).

### 8. Built-in Tool: Device Info

A simple on-device tool that returns information about the user's device. Requires no network requests.

**Location:** `src/services/tools/device-info-tool.ts`

```typescript
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type { ToolDefinition } from '@/services/tool-registry';

export const deviceInfoTool: ToolDefinition = {
  name: 'get_device_info',
  description: 'Returns information about the user\'s device including OS, model, and locale. Useful for context-aware responses.',
  parameters: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string', enum: ['os', 'model', 'locale', 'timezone', 'all'] },
        description: 'Which device info fields to return. Use "all" for everything.',
      },
    },
    required: ['fields'],
  },
  handler: async (args: Record<string, unknown>): Promise<string> => {
    const fields = (args.fields as string[]) ?? ['all'];
    const info: Record<string, string> = {};

    if (fields.includes('all') || fields.includes('os')) {
      info.os = `${Platform.OS} ${Platform.Version}`;
    }
    if (fields.includes('all') || fields.includes('model')) {
      info.model = Device.modelName ?? 'Unknown';
    }
    if (fields.includes('all') || fields.includes('locale')) {
      info.locale = Platform.select({ ios: 'en-US', default: 'en-US' }); // simplified
    }
    if (fields.includes('all') || fields.includes('timezone')) {
      info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    return JSON.stringify(info, null, 2);
  },
};
```

### 9. Built-in Tool: Date/Time

Returns the current date, time, or performs simple date calculations.

**Location:** `src/services/tools/datetime-tool.ts`

```typescript
import type { ToolDefinition } from '@/services/tool-registry';

export const datetimeTool: ToolDefinition = {
  name: 'get_current_datetime',
  description: 'Returns the current date and time in the user\'s timezone. Useful when the user asks about the current time, date, or day of the week.',
  parameters: {
    type: 'object',
    properties: {
      format: {
        type: 'string',
        enum: ['iso', 'unix', 'human', 'date_only', 'time_only'],
        description: 'The format to return the datetime in.',
      },
    },
    required: ['format'],
  },
  handler: async (args: Record<string, unknown>): Promise<string> => {
    const format = args.format as string;
    const now = new Date();

    switch (format) {
      case 'iso':
        return now.toISOString();
      case 'unix':
        return String(Math.floor(now.getTime() / 1000));
      case 'human':
        return now.toLocaleString();
      case 'date_only':
        return now.toLocaleDateString();
      case 'time_only':
        return now.toLocaleTimeString();
      default:
        return now.toISOString();
    }
  },
};
```

## Data Model Changes

### Database Migration

A new migration adds support for the `'tool'` role in messages. Since the existing `role` column is a text field (not an enum enforced at the DB level), no schema change is strictly required. However, we add an index for efficient filtering:

```sql
-- Migration: add_tool_message_support
CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role);
```

### Extended CompletionRequest

The `CompletionRequest` type gains an optional `tools` field:

```typescript
export interface CompletionRequest {
  // ... existing fields ...
  /** Tool schemas to include in the request. Provider adapters format these as needed. */
  tools?: FormattedToolSchema[];
}
```

### Extended CompletionResponse

The `CompletionResponse` type gains an optional field for raw tool calls:

```typescript
export interface CompletionResponse {
  // ... existing fields ...
  /** Raw tool calls from the provider, if present. */
  toolCalls?: ToolCall[];
}
```

### Extended StreamChunk

A new chunk type for streaming tool calls:

```typescript
export interface StreamChunk {
  type: 'text' | 'thinking' | 'done' | 'error' | 'tool_call';
  content: string;
  usage?: TokenUsage;
  /** Present when type is 'tool_call'. */
  toolCall?: ToolCall;
}
```

## Error Handling

| Error Scenario | Handling |
|---|---|
| Tool not found in registry | Return `ToolResult` with `status: 'not_found'`, continue loop |
| Tool handler throws | Catch, return `ToolResult` with `status: 'error'`, continue loop |
| Tool handler timeout | Abort handler, return `ToolResult` with `status: 'timeout'`, continue loop |
| CompletionService throws ProviderError | Propagate to useChat, loop terminates with `terminationReason: 'error'` |
| AbortSignal fires | Stop iteration, persist partial content, return with `terminationReason: 'aborted'` |
| Safety cap reached | Return last partial content with `terminationReason: 'safety_cap'` |
| Invalid tool call arguments (malformed JSON) | Return `ToolResult` with `status: 'error'`, message: "Invalid arguments" |

Tool execution errors are **non-fatal to the loop** — the error result is sent back to the model, which can decide how to proceed. Only provider errors and abort signals terminate the loop.

## Module Dependency Graph

```
useChat (hook)
  └── AgentLoopService
        ├── CompletionService (existing)
        ├── ToolExecutor
        │     └── ToolRegistry
        │           └── ToolHandler implementations
        ├── ToolCallParser
        └── ToolResultFormatter
```

## Configuration

| Parameter | Default | Source |
|---|---|---|
| Safety cap | 10 | `AgentLoopOptions.safetyCap` (overridable per-session) |
| Tool timeout | 30,000 ms | `ToolExecutorOptions.timeoutMs` |
| Tool use enabled | per-model | `ModelConfig.supportsToolUse` (new field) |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Safety cap enforcement

*For any* positive integer N used as the safety cap and *for any* CompletionService mock that always returns tool calls (never a final response), the Agent Loop Service SHALL execute exactly N iterations and then terminate with `terminationReason: 'safety_cap'`.

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 2: Configuration immutability across iterations

*For any* agent loop invocation with K iterations (1 ≤ K ≤ safety cap), every call to CompletionService SHALL use identical provider configuration, model ID, and generation parameters (temperature, maxTokens, thinkingLevel).

**Validates: Requirements 1.4**

### Property 3: Tool call execution completeness

*For any* set of N tool calls in a single provider response, the Tool Executor SHALL return exactly N Tool Results, one per input tool call, regardless of individual handler success or failure.

**Validates: Requirements 1.1, 4.3, 4.4**

### Property 4: Unregistered tool produces error result

*For any* tool call whose name is not present in the Tool Registry, the Tool Executor SHALL return a Tool Result with `status: 'not_found'` and never throw an exception.

**Validates: Requirements 4.2**

### Property 5: Handler exception isolation

*For any* tool handler that throws an exception, the Tool Executor SHALL catch the exception and return a Tool Result with `status: 'error'` containing the error message, without affecting the execution of other concurrent tool calls.

**Validates: Requirements 4.4**

### Property 6: Tool registry round-trip

*For any* valid ToolDefinition that is registered in the Tool Registry, retrieving the handler by the same name SHALL return the original handler function, and `has(name)` SHALL return true.

**Validates: Requirements 3.1**

### Property 7: Tool registry validation rejects invalid definitions

*For any* ToolDefinition with a duplicate name, empty description, or missing parameters schema, the Tool Registry SHALL throw a validation error and not modify the registry state.

**Validates: Requirements 3.3**

### Property 8: Schema formatting correctness

*For any* set of registered tools and *for any* provider type, `getSchemas(providerType)` SHALL return schemas where: OpenAI/Custom types produce objects with `{ type: 'function', function: { name, description, parameters } }` structure, and Anthropic type produces objects with `{ name, description, input_schema }` structure.

**Validates: Requirements 3.2, 7.1**

### Property 9: Tool message persistence ordering and completeness

*For any* agent loop execution with K iterations and T total tool calls across all iterations, the Chat Thread SHALL contain exactly T tool call messages (role: "assistant") and T tool result messages (role: "tool"), persisted in chronological order matching the execution sequence, with each message containing the tool name.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 10: Token usage accumulation

*For any* sequence of N iterations where iteration i reports token usage U_i (regardless of success or failure), the total TokenUsage reported by the Agent Loop Service SHALL have `promptTokens = Σ U_i.promptTokens` and `completionTokens = Σ U_i.completionTokens`.

**Validates: Requirements 9.1, 9.2, 9.4**

### Property 11: Final response terminates loop

*For any* CompletionService response that contains text content and zero tool calls, the Agent Loop Service SHALL terminate immediately without executing any tool calls, and return with `terminationReason: 'final_response'`.

**Validates: Requirements 1.3**

### Property 12: Abort halts iteration and preserves prior content

*For any* agent loop execution, if the AbortSignal fires after K complete iterations (K ≥ 0), the loop SHALL not execute iteration K+1, SHALL persist all tool messages from iterations 1..K to the Chat Thread, and SHALL return with `terminationReason: 'aborted'`.

**Validates: Requirements 6.1, 6.4**

### Property 13: Tool use bypass for unsupported models

*For any* model/provider configuration where `supportsToolUse` is false, the Agent Loop Service SHALL perform exactly one CompletionService call with no tool schemas attached, and return the result directly without entering the iteration loop.

**Validates: Requirements 7.4**

### Property 14: Conversation context growth across iterations

*For any* agent loop execution with K iterations, the messages array passed to CompletionService on iteration i+1 SHALL contain all messages from iteration i plus the tool call and tool result messages from iteration i (strictly growing context).

**Validates: Requirements 1.2**

### Property 15: Tool result formatting per provider type

*For any* set of Tool Results and *for any* provider type, `formatToolResultMessages()` SHALL produce messages where: OpenAI/Custom produces messages with `role: "tool"` and a `tool_call_id` field, and Anthropic produces a single user message containing `tool_result` content blocks with `tool_use_id` fields.

**Validates: Requirements 7.3**

### Property 16: Error mapping to ChatError

*For any* error thrown by the Agent Loop Service (ProviderError or generic Error), the useChat hook SHALL produce a ChatError with a non-empty `message` field and appropriate `isRetryable` flag.

**Validates: Requirements 8.5**
