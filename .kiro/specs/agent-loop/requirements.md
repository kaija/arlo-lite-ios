# Requirements Document

## Introduction

The Agent Loop feature adds multi-step tool-use capabilities to Arlo Lite. When the LLM responds with tool calls, the app executes those tools locally, appends results to the conversation, and re-invokes the provider until the model produces a final text response or a safety cap is reached.

The implementation integrates with the existing provider system (IProvider interface) and sits between the useChat hook and the CompletionService. Advanced features like context compaction, guardrails, sub-agents, HITL approval, and custom user-defined tools are out of scope for this initial version.

## Requirements

### Requirement 1: Agent Loop Orchestration

**User Story:** As a user, I want the app to automatically execute tool calls returned by the LLM and continue the conversation until a final answer is produced, so that I can leverage multi-step agentic capabilities without manual intervention.

#### Acceptance Criteria

1. WHEN the CompletionService returns a response containing one or more tool calls, the agent loop SHALL execute each tool call and append results to the conversation context.
2. WHEN all tool results for a given iteration have been appended, the agent loop SHALL re-invoke the CompletionService with the updated conversation context.
3. WHEN the CompletionService returns a final response (text content with no tool calls), the agent loop SHALL terminate and return the final response to the useChat hook.
4. The agent loop SHALL pass the same provider configuration, model selection, and generation parameters to the CompletionService on each iteration.
5. The agent loop SHALL support both streaming and non-streaming completion modes across all iterations.

### Requirement 2: Safety Cap Enforcement

**User Story:** As a user, I want the agent loop to stop after a maximum number of iterations, so that runaway loops do not consume excessive API credits or hang the UI.

#### Acceptance Criteria

1. The agent loop SHALL enforce a safety cap that limits the maximum number of iterations per invocation (default: 10).
2. WHEN the safety cap is reached without a final response, the agent loop SHALL terminate and return the last partial response along with a termination reason.
3. The safety cap SHALL be configurable per invocation.

### Requirement 3: Tool Registry

**User Story:** As a developer, I want a centralized place to register tools with their schemas, so that tools are discoverable by the LLM and easily extensible.

#### Acceptance Criteria

1. The tool registry SHALL maintain a mapping of tool names to handler implementations.
2. The tool registry SHALL provide tool schemas formatted for the active provider type (OpenAI function calling or Anthropic tool use format).
3. Each registered tool SHALL have a unique name, a JSON Schema for its parameters, and a human-readable description.
4. The agent loop SHALL include tool schemas from the registry in completion requests.

### Requirement 4: Tool Execution

**User Story:** As a user, I want tool calls to be executed reliably and their results returned to the model, so that the agent can make informed decisions based on tool outputs.

#### Acceptance Criteria

1. The tool executor SHALL resolve the corresponding handler from the registry by tool name.
2. IF a tool call references an unregistered tool name, the executor SHALL return an error result (not throw).
3. IF a tool handler throws an exception, the executor SHALL catch it and return an error result.
4. The tool executor SHALL enforce a per-tool execution timeout of 30 seconds.

### Requirement 5: Chat Thread Visibility of Tool Steps

**User Story:** As a user, I want to see each tool call and its result in the chat thread, so that I can follow the agent's reasoning.

#### Acceptance Criteria

1. Each tool call SHALL be persisted as a message in the chat thread (role: "assistant") with the tool name and arguments.
2. Each tool result SHALL be persisted as a message in the chat thread (role: "tool") with the tool name, status, and output.
3. Tool messages SHALL be persisted in chronological order matching execution sequence.

### Requirement 6: Abort Support

**User Story:** As a user, I want to stop the agent loop mid-execution, so that I can cancel requests that are taking too long.

#### Acceptance Criteria

1. WHEN the user triggers stop generation, the agent loop SHALL abort the current iteration and cease further iterations.
2. WHEN abort is triggered, any in-progress tool handler or provider request SHALL be cancelled.
3. Any content generated before the abort SHALL be persisted to the chat thread.

### Requirement 7: Provider Compatibility

**User Story:** As a user, I want the agent loop to work with all supported providers (OpenAI, Anthropic, Custom).

#### Acceptance Criteria

1. The agent loop SHALL format tool schemas according to the active provider type.
2. The agent loop SHALL parse tool call responses according to the active provider type.
3. The agent loop SHALL format tool results according to the active provider type when re-invoking the CompletionService.
4. IF the active provider/model does not support tool use, the agent loop SHALL bypass and delegate directly to CompletionService for a single-turn completion.

### Requirement 8: Integration with useChat Hook

**User Story:** As a developer, I want the agent loop to integrate cleanly with the existing useChat hook.

#### Acceptance Criteria

1. The useChat hook SHALL delegate to the agent loop when tool use is enabled for the active model.
2. WHILE the agent loop is iterating, isStreaming SHALL be true.
3. Streaming text/thinking content from the final iteration SHALL update progressively.
4. Errors from the agent loop SHALL be mapped to ChatError and surfaced to the UI.
5. The existing AbortController signal SHALL be passed through for abort propagation.

### Requirement 9: Cost Tracking Across Iterations

**User Story:** As a user, I want the cost of the full agent loop to be tracked, so I can monitor API spend.

#### Acceptance Criteria

1. The agent loop SHALL accumulate TokenUsage across all iterations.
2. On completion, the total TokenUsage SHALL be used to compute and persist cost on the final assistant message.
3. TokenUsage from both successful and failed iterations SHALL be included in the total.

### Requirement 10: Built-in Tools

**User Story:** As a user, I want useful built-in tools available out of the box so the agent has basic capabilities.

#### Acceptance Criteria

1. The tool registry SHALL include `get_device_info` and `get_current_datetime` tools on startup.
2. `get_device_info` SHALL return device OS, model, locale, and timezone.
3. `get_current_datetime` SHALL return the current date/time in configurable formats (iso, unix, human, date_only, time_only).
4. Both tools SHALL operate entirely on-device with no network requests.

## Out of Scope

- Context compaction or conversation summarization
- Sub-agent spawning or hierarchical delegation
- Guardrails (input/output content filtering)
- Transient retries or mid-stream error recovery
- MCP server integration
- Custom user-defined tools via UI
- Human-in-the-loop tool approval (add when tools touch network/write data)
- Persistent tool state across sessions
