# Requirements Document

## Introduction

The Agent Loop feature adds multi-step tool-use capabilities to Arlo Lite. When a user sends a message and the LLM responds with tool calls, the Agent Loop Service executes those tools locally, appends the results to the conversation, and re-invokes the provider until the model produces a final text response or a safety iteration cap is reached. This enables agentic workflows where the model can gather information, perform calculations, or take actions across multiple reasoning steps before delivering a final answer. The agent loop sits between the useChat hook and the CompletionService, wrapping the existing single-turn completion flow with an iterative tool-execution loop.

## Glossary

- **Agent_Loop_Service**: The service module responsible for orchestrating multi-step tool-use iterations between the LLM provider and the Tool_Executor.
- **Tool_Executor**: The module responsible for dispatching tool call requests to the appropriate Tool_Handler and returning results.
- **Tool_Handler**: An individual function or module implementing a specific tool capability (e.g., web search, code execution).
- **Tool_Registry**: The registry that maps tool names to their Tool_Handler implementations and provides tool schemas for inclusion in LLM requests.
- **Tool_Call**: A structured request from the LLM to invoke a specific tool with given arguments.
- **Tool_Result**: The structured output returned after executing a Tool_Call, including success/failure status and content.
- **Safety_Cap**: The maximum number of agent loop iterations permitted before forced termination.
- **Iteration**: A single round-trip of sending messages to the provider, receiving a response, and optionally executing tool calls.
- **Final_Response**: A provider response that contains text content and no pending tool calls, signaling the end of the agent loop.
- **CompletionService**: The existing service that retrieves API keys, resolves provider adapters, and delegates completion requests to providers.
- **useChat_Hook**: The existing React hook that orchestrates message sending, streaming, error handling, and abort support.
- **Chat_Thread**: The visible sequence of messages in the active session's UI.
- **Tool_Message**: A message in the Chat_Thread representing either a tool call request or a tool execution result.

## Requirements

### Requirement 1: Agent Loop Orchestration

**User Story:** As a user, I want the app to automatically execute tool calls returned by the LLM and continue the conversation until a final answer is produced, so that I can leverage multi-step agentic capabilities without manual intervention.

#### Acceptance Criteria

1. WHEN the CompletionService returns a response containing one or more Tool_Calls, THE Agent_Loop_Service SHALL execute each Tool_Call via the Tool_Executor and append the Tool_Results to the conversation context.
2. WHEN all Tool_Results for a given Iteration have been appended, THE Agent_Loop_Service SHALL re-invoke the CompletionService with the updated conversation context.
3. WHEN the CompletionService returns a Final_Response (text content with no Tool_Calls), THE Agent_Loop_Service SHALL terminate the loop and return the Final_Response to the useChat_Hook.
4. THE Agent_Loop_Service SHALL pass the same provider configuration, model selection, and generation parameters to the CompletionService on each Iteration.
5. THE Agent_Loop_Service SHALL support both streaming and non-streaming completion modes across all Iterations.

### Requirement 2: Safety Cap Enforcement

**User Story:** As a user, I want the agent loop to stop after a configurable maximum number of iterations, so that runaway loops do not consume excessive API credits or hang the UI.

#### Acceptance Criteria

1. THE Agent_Loop_Service SHALL enforce a Safety_Cap that limits the maximum number of Iterations per invocation.
2. THE Agent_Loop_Service SHALL use a default Safety_Cap value of 10 Iterations.
3. WHEN the Agent_Loop_Service reaches the Safety_Cap without receiving a Final_Response, THE Agent_Loop_Service SHALL terminate the loop and return the last partial response content to the useChat_Hook along with a termination reason indicating the Safety_Cap was reached.
4. WHERE the Safety_Cap is configurable, THE Agent_Loop_Service SHALL accept a custom Safety_Cap value as a parameter.

### Requirement 3: Tool Registry and Schema Declaration

**User Story:** As a developer, I want a centralized tool registry that maps tool names to handlers and provides schemas to the LLM, so that tools are discoverable, validated, and easily extensible.

#### Acceptance Criteria

1. THE Tool_Registry SHALL maintain a mapping of tool names to Tool_Handler implementations.
2. THE Tool_Registry SHALL provide a method to retrieve all registered tool schemas in the format required by the active provider (OpenAI function calling format or Anthropic tool use format).
3. THE Tool_Registry SHALL validate that each registered Tool_Handler has a unique name, a JSON Schema for its parameters, and a human-readable description.
4. WHEN the Agent_Loop_Service initiates a completion request, THE Agent_Loop_Service SHALL include the tool schemas from the Tool_Registry in the CompletionRequest.
5. THE Tool_Registry SHALL support runtime registration of Tool_Handlers without requiring application restart.

### Requirement 4: Tool Execution

**User Story:** As a user, I want tool calls to be executed reliably and their results returned to the model, so that the agent can make informed decisions based on tool outputs.

#### Acceptance Criteria

1. WHEN the Tool_Executor receives a Tool_Call, THE Tool_Executor SHALL resolve the corresponding Tool_Handler from the Tool_Registry by tool name.
2. IF the Tool_Executor receives a Tool_Call for an unregistered tool name, THEN THE Tool_Executor SHALL return a Tool_Result with an error status indicating the tool is not available.
3. WHEN the Tool_Handler completes execution, THE Tool_Executor SHALL return a Tool_Result containing the handler output and a success status.
4. IF the Tool_Handler throws an exception during execution, THEN THE Tool_Executor SHALL catch the exception and return a Tool_Result with an error status and the error message.
5. THE Tool_Executor SHALL execute multiple Tool_Calls from a single response concurrently when possible.
6. THE Tool_Executor SHALL enforce a per-tool execution timeout of 30 seconds.
7. IF the Tool_Handler exceeds the per-tool execution timeout, THEN THE Tool_Executor SHALL abort the handler and return a Tool_Result with an error status indicating a timeout.

### Requirement 5: Chat Thread Visibility of Tool Steps

**User Story:** As a user, I want to see each tool call and its result as separate messages in the chat thread, so that I can follow the agent's reasoning and verify its actions.

#### Acceptance Criteria

1. WHEN the Agent_Loop_Service receives a response containing Tool_Calls, THE Agent_Loop_Service SHALL persist each Tool_Call as a Tool_Message with role "assistant" in the Chat_Thread.
2. WHEN the Tool_Executor returns a Tool_Result, THE Agent_Loop_Service SHALL persist the Tool_Result as a Tool_Message with role "tool" in the Chat_Thread.
3. THE Tool_Message for a Tool_Call SHALL include the tool name and the arguments passed to the tool.
4. THE Tool_Message for a Tool_Result SHALL include the tool name, execution status, and the output content.
5. THE Agent_Loop_Service SHALL persist Tool_Messages in chronological order matching the execution sequence.

### Requirement 6: Abort Support

**User Story:** As a user, I want to be able to stop the agent loop mid-execution, so that I can cancel requests that are taking too long or going in the wrong direction.

#### Acceptance Criteria

1. WHEN the user triggers stop generation during an active agent loop, THE Agent_Loop_Service SHALL abort the current Iteration and cease further Iterations.
2. WHEN abort is triggered during a Tool_Handler execution, THE Agent_Loop_Service SHALL cancel the in-progress Tool_Handler and discard its partial result.
3. WHEN abort is triggered during a provider completion request, THE Agent_Loop_Service SHALL propagate the abort signal to the CompletionService.
4. WHEN the agent loop is aborted, THE Agent_Loop_Service SHALL persist any content generated before the abort to the Chat_Thread.

### Requirement 7: Provider Type Compatibility

**User Story:** As a user, I want the agent loop to work with all supported providers (OpenAI, Anthropic, Custom), so that tool use is available regardless of which provider I configure.

#### Acceptance Criteria

1. THE Agent_Loop_Service SHALL format tool schemas according to the requirements of the active provider type (OpenAI function calling format for OpenAI and Custom providers, Anthropic tool use format for Anthropic provider).
2. THE Agent_Loop_Service SHALL parse tool call responses according to the response format of the active provider type.
3. THE Agent_Loop_Service SHALL format Tool_Results according to the message format expected by the active provider type when re-invoking the CompletionService.
4. IF the active provider or model does not support tool use, THEN THE Agent_Loop_Service SHALL bypass the agent loop and delegate directly to the CompletionService for a single-turn completion.

### Requirement 8: Integration with useChat Hook

**User Story:** As a developer, I want the agent loop to integrate cleanly with the existing useChat hook, so that the chat UI continues to work seamlessly with the added tool-use capability.

#### Acceptance Criteria

1. THE useChat_Hook SHALL delegate to the Agent_Loop_Service instead of directly calling the CompletionService when tool use is enabled for the active session.
2. WHILE the Agent_Loop_Service is iterating, THE useChat_Hook SHALL report isStreaming as true.
3. WHEN the Agent_Loop_Service emits streaming text content during the final Iteration, THE useChat_Hook SHALL update streamContent progressively.
4. WHEN the Agent_Loop_Service emits thinking content during any Iteration, THE useChat_Hook SHALL update thinkingContent progressively.
5. IF the Agent_Loop_Service throws an error during any Iteration, THEN THE useChat_Hook SHALL map the error to a ChatError and surface it to the UI.
6. THE useChat_Hook SHALL pass the existing AbortController signal to the Agent_Loop_Service for abort propagation.

### Requirement 9: Cost Tracking Across Iterations

**User Story:** As a user, I want the cost of the full agent loop (all iterations combined) to be tracked and displayed, so that I can monitor my API spend for multi-step requests.

#### Acceptance Criteria

1. THE Agent_Loop_Service SHALL accumulate TokenUsage across all Iterations of a single agent loop invocation.
2. WHEN the agent loop completes, THE Agent_Loop_Service SHALL report the total accumulated TokenUsage to the useChat_Hook.
3. THE useChat_Hook SHALL compute the total cost from the accumulated TokenUsage and persist the cost on the final assistant message.
4. THE Agent_Loop_Service SHALL include TokenUsage from both successful and failed Iterations in the accumulated total.

### Requirement 10: Built-in Tool Set

**User Story:** As a user, I want the app to ship with a set of useful built-in tools, so that I can immediately take advantage of agentic capabilities without configuration.

#### Acceptance Criteria

1. THE Tool_Registry SHALL include at minimum one built-in Tool_Handler upon application startup.
2. THE Tool_Registry SHALL register all built-in Tool_Handlers automatically during application initialization.
3. Each built-in Tool_Handler SHALL provide a JSON Schema describing its expected parameters.
4. Each built-in Tool_Handler SHALL provide a human-readable description suitable for inclusion in LLM prompts.
5. THE built-in Tool_Handlers SHALL operate entirely on-device without requiring additional network requests beyond those made by the LLM provider.
