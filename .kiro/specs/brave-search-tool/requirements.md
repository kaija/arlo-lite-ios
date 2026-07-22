# Requirements Document

## Introduction

This feature adds a Brave Search tool to Arlo Lite's agent loop. The tool enables the LLM to perform web searches during a conversation using the Brave LLM Context API. It is dynamically registered/unregistered based on whether the user has enabled the tool and provided a valid API key. Configuration is managed through a dedicated settings screen with secure key storage.

## Glossary

- **Tool_Registry**: The Map-based service (`src/services/tool-registry.ts`) that holds registered tool definitions and exposes schemas to the agent loop.
- **Agent_Loop**: The iterative tool-execution orchestrator that calls the provider, detects tool calls, executes them, and loops until a final response.
- **Brave_Search_Tool**: The tool definition that performs web searches via the Brave LLM Context API and returns grounding context to the LLM.
- **Settings_Store**: The Zustand-persisted store (`src/stores/settings-store.ts`) holding user preferences.
- **Secure_Store**: The expo-secure-store wrapper (`src/database/secure-store.ts`) that manages encrypted API key persistence.
- **Brave_Settings_Screen**: The dedicated settings detail screen for configuring the Brave Search tool (enable toggle + API key input).
- **Service_Key**: A secure storage key using the namespace pattern `arlo.service.{serviceId}.apiKey` to distinguish tool/service credentials from LLM provider credentials.

## Requirements

### Requirement 1: Tool Definition

**User Story:** As a developer, I want the Brave Search tool to have a well-defined schema so that the LLM can invoke it with appropriate parameters.

#### Acceptance Criteria

1. THE Brave_Search_Tool SHALL have the name `brave_web_search`.
2. THE Brave_Search_Tool SHALL have a description that instructs the LLM to use it for searching the web for current information.
3. THE Brave_Search_Tool SHALL accept a required `query` parameter of type string.
4. THE Brave_Search_Tool SHALL accept an optional `count` parameter of type integer with a minimum of 1 and maximum of 50, defaulting to 5.
5. THE Brave_Search_Tool SHALL conform to the ToolDefinition interface exported by Tool_Registry.

### Requirement 2: API Integration

**User Story:** As a user, I want the agent to fetch real-time web results from Brave so that it can answer questions about current information.

#### Acceptance Criteria

1. WHEN the Brave_Search_Tool handler is invoked, THE Brave_Search_Tool SHALL send a request to `https://api.search.brave.com/res/v1/llm/context` with the query and count parameters.
2. THE Brave_Search_Tool SHALL authenticate requests using the `X-Subscription-Token` header set to the stored Brave API key.
3. THE Brave_Search_Tool SHALL set a request timeout of 15 seconds.
4. THE Brave_Search_Tool SHALL respect the AbortSignal passed via ToolContext to allow cancellation.
5. IF the API returns a non-2xx status code, THEN THE Brave_Search_Tool SHALL return an error message containing the HTTP status code to the LLM.
6. IF the request times out or a network error occurs, THEN THE Brave_Search_Tool SHALL return a human-readable error message describing the failure.

### Requirement 3: Response Formatting

**User Story:** As a user, I want search results presented in a structured format so that the LLM can use them effectively for grounding its answers.

#### Acceptance Criteria

1. WHEN the API returns successfully, THE Brave_Search_Tool SHALL extract the `grounding.generic` array from the response.
2. THE Brave_Search_Tool SHALL format each result as a text block containing the title, URL, and concatenated snippet text.
3. IF the API returns an empty results array, THEN THE Brave_Search_Tool SHALL return a message indicating no results were found for the query.

### Requirement 4: Dynamic Registration

**User Story:** As a user, I want the search tool to appear and disappear from the agent's capabilities based on my settings so that I control which tools are available.

#### Acceptance Criteria

1. THE Tool_Registry SHALL expose an `unregisterTool(name: string)` function that removes a tool by name.
2. WHEN the Brave Search enabled setting is true and a Brave API key exists in Secure_Store, THE Brave_Search_Tool SHALL be registered in Tool_Registry.
3. WHEN the Brave Search enabled setting is changed to false, THE Brave_Search_Tool SHALL be unregistered from Tool_Registry.
4. WHEN the Brave API key is deleted from Secure_Store, THE Brave_Search_Tool SHALL be unregistered from Tool_Registry.
5. IF `unregisterTool` is called with a name that is not registered, THEN THE Tool_Registry SHALL return silently without error.

### Requirement 5: Startup Behavior

**User Story:** As a user, I want my Brave Search configuration to persist across app restarts so that I do not need to re-enable the tool each time.

#### Acceptance Criteria

1. WHEN the application starts and `braveSearchEnabled` is true in Settings_Store and a Brave API key exists in Secure_Store, THE Brave_Search_Tool SHALL be registered in Tool_Registry during initialization.
2. WHEN the application starts and `braveSearchEnabled` is false, THE Brave_Search_Tool SHALL remain unregistered.
3. WHEN the application starts and `braveSearchEnabled` is true but no Brave API key exists in Secure_Store, THE Brave_Search_Tool SHALL remain unregistered.

### Requirement 6: Settings Store

**User Story:** As a user, I want a persistent setting to enable or disable Brave Search so that my preference is remembered.

#### Acceptance Criteria

1. THE Settings_Store SHALL include a `braveSearchEnabled` boolean property defaulting to false.
2. THE Settings_Store SHALL persist the `braveSearchEnabled` value to AsyncStorage via the existing partialize configuration.
3. THE Settings_Store SHALL expose a `setBraveSearchEnabled(value: boolean)` action.

### Requirement 7: Secure Key Storage

**User Story:** As a user, I want my Brave API key stored securely so that it is protected by the platform's secure enclave.

#### Acceptance Criteria

1. THE Secure_Store SHALL expose a `buildServiceKey(serviceId: string)` function that returns the pattern `arlo.service.{serviceId}.apiKey`.
2. THE Secure_Store SHALL support storing, retrieving, and deleting service keys using the same SecureStore mechanism as provider keys.
3. THE Brave_Search_Tool configuration SHALL use the serviceId `brave_search` for key storage.

### Requirement 8: Settings UI

**User Story:** As a user, I want a dedicated screen to configure Brave Search so that I can enable the feature and enter my API key.

#### Acceptance Criteria

1. THE Brave_Settings_Screen SHALL be accessible from the main Settings screen.
2. THE Brave_Settings_Screen SHALL display a toggle to enable or disable Brave Search.
3. THE Brave_Settings_Screen SHALL display a secure text input for the Brave API key.
4. WHEN the user toggles Brave Search off, THE Brave_Settings_Screen SHALL trigger unregistration of the Brave_Search_Tool.
5. WHEN the user toggles Brave Search on and a valid API key is present, THE Brave_Settings_Screen SHALL trigger registration of the Brave_Search_Tool.
6. WHEN the user saves a new API key and Brave Search is enabled, THE Brave_Settings_Screen SHALL trigger registration of the Brave_Search_Tool.
7. WHEN the user clears the API key, THE Brave_Settings_Screen SHALL trigger unregistration of the Brave_Search_Tool and delete the key from Secure_Store.
8. THE Brave_Settings_Screen SHALL use i18next for all user-facing text.
