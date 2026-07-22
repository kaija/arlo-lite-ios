# Implementation Plan: Agent Loop

## Tasks

- [x] 1. Extend provider types
  - Add `'tool'` to ChatMessage role, `tool_call_id?`, `toolCalls?: ToolCall[]`
  - Add `tools?: unknown[]` to CompletionRequest
  - Add `'tool_call'` to StreamChunk type union + `toolCall?` field
  - Add `supportsToolUse?: boolean` to ModelConfig
  - **File:** `src/providers/types.ts`

- [x] 2. Tool Registry + Built-in Tools
  - Create `src/services/tool-registry.ts` — `ToolContext`, `ToolDefinition`, `registerTool()`, `getTool()`, `getToolSchemas(providerType)`, `initBuiltInTools()`
  - Create `src/services/tools/built-in.ts` — `deviceInfoTool` + `datetimeTool`
  - **Files:** `src/services/tool-registry.ts`, `src/services/tools/built-in.ts`

- [x] 3. Tool Executor
  - Create `src/services/tool-executor.ts` — `executeToolCalls()`, sequential dispatch, 30s timeout, error wrapping, abort respect
  - **File:** `src/services/tool-executor.ts`

- [x] 4. Agent Loop Service
  - Create `src/services/agent-loop.ts` — `runAgentLoop()` + inline parse/format helpers
  - Streaming: buffer full response while forwarding text/thinking to callbacks progressively; parse tool calls after stream ends
  - Iteration lifecycle: detect tool calls → `onIntermediateContent` → `onToolCall` → execute → `onToolResult` → append to context → loop
  - Safety cap, abort checking, token usage accumulation, bypass for non-tool models
  - **File:** `src/services/agent-loop.ts`

- [x] 5. Provider adapter passthrough
  - Update `openai-provider.ts`, `anthropic-provider.ts`, `custom-provider.ts` — pass `request.tools` to API params when present
  - **Files:** `src/providers/openai/openai-provider.ts`, `src/providers/anthropic/anthropic-provider.ts`, `src/providers/custom/custom-provider.ts`

- [x] 6. DB migration
  - Add index: `CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role)`
  - **File:** `src/database/migrations/` (new migration file)

- [x] 7. useChat integration
  - Route through `runAgentLoop()` when `supportsToolUse` is true
  - Wire `AgentLoopCallbacks`: `onStreamText` → textBuffer, `onIntermediateContent` → persist + clearStream, `onToolCall`/`onToolResult` → addMessage
  - Batcher lifecycle: `startBatcher()` before loop, `stopBatcher()` after
  - Expose `currentIteration`, `isToolExecuting` state
  - Cost computation from `totalUsage`, error mapping to ChatError
  - **File:** `src/hooks/useChat.ts`

- [x] 8. Smoke test
  - One test file covering: safety cap terminates, final response exits immediately, tool errors don't crash loop, abort stops iteration
  - **File:** `src/services/__tests__/agent-loop.test.ts`

## Dependency Table

| Task | Depends On | Rationale |
|------|-----------|-----------|
| 1. Types | — | Foundation: all other tasks import these types |
| 2. Registry + Tools | 1 | Uses `ToolContext`, `ToolCall` types from providers/types |
| 3. Executor | 1, 2 | Calls `getTool()` from registry, uses `ToolCall`/`ToolResult` types |
| 4. Agent Loop | 1, 2, 3 | Orchestrates registry (schemas), executor (dispatch), CompletionService |
| 5. Provider passthrough | 1 | Reads `request.tools` field added in task 1 |
| 6. DB migration | — | Independent, no code dependency |
| 7. useChat integration | 4, 5, 6 | Calls `runAgentLoop`, needs providers to accept tools, needs DB index |
| 8. Smoke test | 4 | Tests `runAgentLoop` with mocked CompletionService |

## Execution Waves (parallelizable groups)

```
Wave 0:  [1. Types]  [6. DB migration]
Wave 1:  [2. Registry + Tools]  [5. Provider passthrough]
Wave 2:  [3. Executor]
Wave 3:  [4. Agent Loop]
Wave 4:  [7. useChat integration]  [8. Smoke test]
```
