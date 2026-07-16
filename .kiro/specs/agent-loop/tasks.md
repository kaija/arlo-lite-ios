# Implementation Plan: Agent Loop

## Overview

Implement the multi-step tool-use agent loop for Arlo Lite. The approach is bottom-up: define types and interfaces first, then implement leaf services (registry, executor, parser, formatter), then the orchestrator (AgentLoopService), and finally wire into the existing useChat hook. Built-in tools and database migration are integrated last.

## Tasks

- [ ] 1. Extend provider types and define tool-related interfaces
  - [ ] 1.1 Extend `src/providers/types.ts` with tool-related types
    - Add `tool_call` to `StreamChunk.type` union
    - Add optional `toolCall` field to `StreamChunk`
    - Add optional `tools` field to `CompletionRequest` (typed as `FormattedToolSchema[]`)
    - Add optional `toolCalls` field to `CompletionResponse`
    - Extend `ChatMessage.role` to include `'tool'`
    - Add optional `tool_call_id` field to `ChatMessage`
    - Add optional `toolCalls` metadata field to `ChatMessage` for assistant tool call messages
    - _Requirements: 7.1, 7.2, 7.3_

  - [ ] 1.2 Create `src/services/tool-registry.ts` with `IToolRegistry` interface and implementation
    - Define `ToolParameterSchema`, `ToolDefinition`, `ToolHandler` types
    - Define `OpenAIToolSchema`, `AnthropicToolSchema`, `FormattedToolSchema` types
    - Define `IToolRegistry` interface with register, unregister, getHandler, getDefinition, getSchemas, size, has methods
    - Implement `createToolRegistry()` factory with validation rules (unique name, alphanumeric + underscores max 64 chars, non-empty description, valid JSON Schema object)
    - Implement `getSchemas()` with provider-specific formatting (OpenAI/Custom → function calling format, Anthropic → tool use format)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

  - [ ]* 1.3 Write property tests for ToolRegistry
    - **Property 6: Tool registry round-trip** — registering a valid ToolDefinition and then calling `getHandler(name)` returns the original handler, `has(name)` returns true
    - **Property 7: Tool registry validation rejects invalid definitions** — duplicate name, empty description, or missing parameters schema causes a thrown error with no registry state change
    - **Property 8: Schema formatting correctness** — getSchemas produces correct structure per provider type
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 2. Implement ToolExecutor
  - [ ] 2.1 Create `src/services/tool-executor.ts`
    - Define `ToolCall`, `ToolResultStatus`, `ToolResult`, `ToolExecutorOptions` types
    - Implement `executeToolCalls()` function
    - Use `Promise.allSettled` for concurrent dispatch
    - Combine per-call `AbortSignal.timeout(timeoutMs)` with parent signal via `AbortSignal.any()`
    - Map not-found → `status: 'not_found'`, thrown exception → `status: 'error'`, timeout → `status: 'timeout'`, success → `status: 'success'`
    - Return results in same order as input toolCalls array
    - Default timeout: 30000ms
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 2.2 Write property tests for ToolExecutor
    - **Property 3: Tool call execution completeness** — for N input tool calls, always returns exactly N results
    - **Property 4: Unregistered tool produces error result** — unknown tool name returns `status: 'not_found'` without throwing
    - **Property 5: Handler exception isolation** — a throwing handler produces `status: 'error'` without affecting sibling calls
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

- [ ] 3. Implement provider-specific parsing and formatting
  - [ ] 3.1 Create `src/services/tool-call-parser.ts`
    - Implement `parseToolCalls(providerType, responsePayload)` for OpenAI (choices[0].message.tool_calls), Anthropic (content[] with type "tool_use"), and Custom (same as OpenAI)
    - Implement `hasToolCalls(providerType, responsePayload)` — returns boolean for whether response contains tool calls
    - Handle malformed JSON in arguments gracefully (return empty arguments with error note)
    - _Requirements: 7.2_

  - [ ] 3.2 Create `src/services/tool-result-formatter.ts`
    - Implement `formatToolCallMessage(providerType, toolCalls)` — produces assistant ChatMessage with tool call metadata
    - Implement `formatToolResultMessages(providerType, results)` — OpenAI/Custom: one message per result with role "tool" and tool_call_id; Anthropic: single user message with tool_result content blocks
    - _Requirements: 7.1, 7.3_

  - [ ]* 3.3 Write property tests for tool result formatting
    - **Property 15: Tool result formatting per provider type** — OpenAI/Custom produces `role: "tool"` messages with `tool_call_id`, Anthropic produces single user message with `tool_result` blocks
    - **Validates: Requirements 7.3**

- [ ] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement AgentLoopService
  - [ ] 5.1 Create `src/services/agent-loop-service.ts`
    - Define `TerminationReason`, `AgentLoopResult`, `AgentLoopCallbacks`, `AgentLoopOptions` types
    - Implement `runAgentLoop()` function:
      - If `supportsToolUse` is false, delegate to single-turn CompletionService call (no tools attached)
      - Attach tool schemas from registry to CompletionRequest
      - On each iteration: invoke CompletionService, parse response for tool calls
      - If tool calls present: persist via callbacks, execute via ToolExecutor, format results, append to context, loop
      - If final response (no tool calls): return content with `terminationReason: 'final_response'`
      - Accumulate TokenUsage across all iterations
      - Check `signal.aborted` before each iteration and after tool execution
      - Terminate with `terminationReason: 'safety_cap'` when iteration count reaches cap
      - Terminate with `terminationReason: 'aborted'` on abort signal
      - Terminate with `terminationReason: 'error'` on CompletionService/ProviderError
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3, 6.4, 7.4, 9.1, 9.2, 9.4_

  - [ ]* 5.2 Write property tests for AgentLoopService
    - **Property 1: Safety cap enforcement** — mock that always returns tool calls, loop executes exactly N iterations then terminates with `safety_cap`
    - **Property 2: Configuration immutability** — every CompletionService call uses identical config across iterations
    - **Property 9: Tool message persistence ordering** — callbacks called in correct chronological order with correct content
    - **Property 10: Token usage accumulation** — total equals sum of all per-iteration usages
    - **Property 11: Final response terminates loop** — response with no tool calls terminates immediately
    - **Property 12: Abort halts iteration** — abort signal prevents next iteration, preserves prior content
    - **Property 13: Tool use bypass** — `supportsToolUse: false` results in single CompletionService call with no tools
    - **Property 14: Conversation context growth** — messages array grows strictly across iterations
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 2.1, 2.3, 2.4, 5.1, 5.2, 6.1, 6.4, 7.4, 9.1, 9.2**

- [ ] 6. Implement built-in tools
  - [ ] 6.1 Create `src/services/tools/device-info-tool.ts`
    - Implement `deviceInfoTool` ToolDefinition with handler that returns device info (os, model, locale, timezone)
    - Uses `react-native` Platform and `expo-device` for on-device data
    - Parameters schema: fields array with enum ['os', 'model', 'locale', 'timezone', 'all']
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [ ] 6.2 Create `src/services/tools/datetime-tool.ts`
    - Implement `datetimeTool` ToolDefinition with handler for current datetime
    - Supports formats: iso, unix, human, date_only, time_only
    - Entirely on-device, no network required
    - _Requirements: 10.1, 10.3, 10.4, 10.5_

  - [ ] 6.3 Register built-in tools in `createToolRegistry()`
    - Import and register `deviceInfoTool` and `datetimeTool` during registry creation
    - _Requirements: 10.2_

- [ ] 7. Database migration and message type extensions
  - [ ] 7.1 Create `src/database/migrations/v3.ts` for tool message support
    - Add index: `CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(session_id, role)`
    - Register migration in the migration runner
    - _Requirements: 5.1, 5.2_

  - [ ] 7.2 Extend message repository types in `src/database/repositories/message-repo.ts`
    - Extend `MessageRole` type to include `'tool'`
    - Define `ToolCallMessageContent` and `ToolResultMessageContent` interfaces for JSON-serialized content
    - Ensure existing CRUD operations handle the new role correctly
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Integrate with useChat hook
  - [ ] 9.1 Update `src/hooks/useChat.ts` to use AgentLoopService
    - Import `runAgentLoop` and `createToolRegistry`
    - When `supportsToolUse` is true for the active model, route sendMessage flow through `runAgentLoop()` instead of directly calling `streamCompletion()`/`complete()`
    - Create and pass `AgentLoopCallbacks` that persist tool call/result messages via `addMessage`, and pipe streaming text/thinking through existing `appendStreamContent`/`appendThinkingContent`
    - Pass existing `AbortController.signal` to agent loop
    - On completion, compute cost from `AgentLoopResult.totalUsage` and persist on the final assistant message
    - Keep `isStreaming = true` for entire agent loop duration
    - Add `currentIteration` and `isToolExecuting` state to `UseChatResult`
    - Handle `terminationReason` appropriately (error → ChatError, aborted → cleanup, safety_cap → persist partial)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 9.3_

  - [ ]* 9.2 Write unit tests for useChat agent loop integration
    - Test that tool-use enabled models route to AgentLoopService
    - Test that non-tool-use models bypass agent loop
    - Test abort propagation
    - Test error mapping from AgentLoopService errors to ChatError
    - **Property 16: Error mapping to ChatError** — any error thrown by agent loop produces ChatError with non-empty message and appropriate isRetryable
    - **Validates: Requirements 8.1, 8.5, 8.6**

- [ ] 10. Add `supportsToolUse` field to ModelConfig
  - [ ] 10.1 Add `supportsToolUse` boolean field to `ModelConfig` in `src/providers/types.ts`
    - Default to `false` for existing models
    - Update any model initialization code to include the new field
    - _Requirements: 7.4_

- [ ] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design specifies no Correctness Properties that require formal verification tools — all are testable with Jest + mocks
- Built-in tools (`device-info-tool`, `datetime-tool`) operate entirely on-device per requirement 10.5
- The `ToolRegistry` is created fresh per hook mount; built-in tools auto-register in `createToolRegistry()`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "3.1", "3.2", "6.1", "6.2", "10.1"] },
    { "id": 2, "tasks": ["2.2", "3.3", "6.3"] },
    { "id": 3, "tasks": ["5.1", "7.1", "7.2"] },
    { "id": 4, "tasks": ["5.2"] },
    { "id": 5, "tasks": ["9.1"] },
    { "id": 6, "tasks": ["9.2"] }
  ]
}
```
