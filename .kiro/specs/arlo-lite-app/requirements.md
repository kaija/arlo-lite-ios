# Requirements Document

## Introduction

Arlo Lite is a free, open-source, lightweight React Native mobile app that functions as a ChatGPT-like LLM client. Users bring their own API key and talk directly to LLM providers (OpenAI, Anthropic, or any OpenAI-compatible endpoint) without any middleman backend or subscription. The app persists all data locally on-device and supports cross-device backup.

## Glossary

- **App**: The Arlo Lite React Native application
- **Provider**: A configured LLM API endpoint (OpenAI, Anthropic, or Custom)
- **Model**: A specific LLM model registered under a Provider
- **Session**: A single chat conversation containing an ordered list of messages
- **Message**: A single turn (user or assistant) within a Session
- **Thinking_Level**: An abstract reasoning effort setting mapped to provider-specific parameters (off / minimal / low / medium / high / xhigh)
- **Metadata_Table**: A remotely hosted JSON file containing default token prices and context window sizes per known model
- **Secure_Storage**: The react-native-keychain secure storage mechanism for sensitive credentials
- **Local_Database**: The on-device SQLite/WatermelonDB persistence layer for sessions, messages, and configuration
- **SSE_Parser**: A provider-specific streaming parser that processes Server-Sent Events into displayable message chunks
- **Context_Window**: The maximum token capacity for a model's input plus output
- **System_Prompt**: A predefined instruction message prepended to every request in a Session

## Requirements

### Requirement 1: Provider Creation and Configuration

**User Story:** As a user, I want to create and configure LLM providers, so that I can connect the app to my preferred LLM services.

#### Acceptance Criteria

1. WHEN a user creates a new provider, THE App SHALL require selection of a provider type (OpenAI, Anthropic, or Custom)
2. WHEN a user creates a new provider, THE App SHALL require an API key and a display name
3. WHEN a user creates an OpenAI provider, THE App SHALL default the base URL to `https://api.openai.com/v1` and allow the user to override it
4. WHEN a user creates an Anthropic provider, THE App SHALL default the base URL to `https://api.anthropic.com` and allow the user to override it
5. WHEN a user creates a Custom provider, THE App SHALL require the user to supply a base URL
6. WHEN a user creates an OpenAI provider, THE App SHALL present a selection between Chat Completions API and Responses API, defaulting to Responses
7. THE App SHALL enable streaming by default for each provider, with an option to disable it per provider
8. WHEN a user edits a provider, THE App SHALL allow modification of all provider fields except provider type
9. WHEN a user deletes a provider, THE App SHALL remove the provider and all associated models from the Local_Database

### Requirement 2: Model Registration and Metadata

**User Story:** As a user, I want to register models under a provider and have pricing/context metadata prefilled, so that I can track costs and context usage accurately.

#### Acceptance Criteria

1. WHEN a user adds a model under a provider, THE App SHALL allow selection from the provider's models API list or manual entry of a model ID
2. WHEN a model ID matches an entry in the Metadata_Table, THE App SHALL prefill context window size and token prices (input, output, cached input, cached output)
3. WHEN a model ID does not match an entry in the Metadata_Table, THE App SHALL leave context window and price fields blank for user input
4. THE App SHALL allow the user to override any prefilled metadata value
5. WHEN the first model is added under a provider, THE App SHALL validate the API key by sending a minimal request (max_tokens: 10) and display a clear success or error result
6. WHEN a user deletes a model, THE App SHALL remove the model from the Local_Database

### Requirement 3: Secure API Key Storage

**User Story:** As a user, I want my API keys stored securely, so that they cannot be accessed by other apps or exposed in backups.

#### Acceptance Criteria

1. THE App SHALL store all API keys exclusively in Secure_Storage (react-native-keychain)
2. THE App SHALL never persist API keys in AsyncStorage, plain text files, or application state logs
3. THE App SHALL exclude API keys from any backup or sync mechanism
4. WHEN the app is uninstalled and reinstalled, THE App SHALL require the user to re-enter API keys

### Requirement 4: Provider API Communication

**User Story:** As a user, I want the app to communicate with different LLM providers using their native APIs, so that I get full provider feature support.

#### Acceptance Criteria

1. WHEN the active provider type is OpenAI with Responses API selected, THE App SHALL format requests according to the OpenAI Responses API specification
2. WHEN the active provider type is OpenAI with Chat Completions selected, THE App SHALL format requests according to the OpenAI Chat Completions API specification
3. WHEN the active provider type is Anthropic, THE App SHALL format requests according to the Anthropic Messages API specification
4. WHEN the active provider type is Custom, THE App SHALL format requests according to the OpenAI Chat Completions API specification using the user-supplied base URL
5. WHILE streaming is enabled for the active provider, THE App SHALL use the appropriate SSE_Parser to process streamed response chunks
6. WHILE streaming is disabled for the active provider, THE App SHALL send a non-streaming request and display the complete response upon receipt

### Requirement 5: Chat Session Management

**User Story:** As a user, I want to create, browse, rename, and delete chat sessions, so that I can organize my conversations.

#### Acceptance Criteria

1. WHEN a user creates a new session, THE App SHALL persist it to the Local_Database with a creation timestamp
2. WHEN the first user message is sent in a new session, THE App SHALL auto-generate a title by truncating the message text to 50 characters
3. THE App SHALL display a session list ordered by last-modified timestamp (most recent first)
4. WHEN a user renames a session, THE App SHALL update the title in the Local_Database
5. WHEN a user deletes a session, THE App SHALL remove the session and all associated messages from the Local_Database
6. THE App SHALL persist all messages within a session to the Local_Database immediately after each turn

### Requirement 6: Model Switching Within a Session

**User Story:** As a user, I want to switch models mid-conversation without leaving the chat screen, so that I can compare responses or continue with a different model.

#### Acceptance Criteria

1. THE App SHALL provide a model switcher accessible from the chat screen without navigating to settings
2. WHEN a user switches models mid-session, THE App SHALL record the new provider/model association in the session metadata
3. WHEN a user switches models mid-session, THE App SHALL use the new model for all subsequent messages in that session

### Requirement 7: Thinking/Reasoning Effort Control

**User Story:** As a user, I want to control the reasoning effort level for models that support it, so that I can balance response quality against cost and latency.

#### Acceptance Criteria

1. WHEN the active model supports reasoning, THE App SHALL display a Thinking_Level selector with options: off, minimal, low, medium, high, xhigh
2. WHEN the active model does not support reasoning, THE App SHALL hide the Thinking_Level selector
3. WHEN Thinking_Level is set to off for an OpenAI model, THE App SHALL omit the reasoning_effort parameter from the request
4. WHEN Thinking_Level is set to off for an Anthropic model, THE App SHALL send thinking with type "disabled"
5. WHEN Thinking_Level is set to minimal for an Anthropic model, THE App SHALL send a budget_tokens value of 1024
6. WHEN Thinking_Level is set to low for an Anthropic model, THE App SHALL send a budget_tokens value of 2048
7. WHEN Thinking_Level is set to medium for an Anthropic model, THE App SHALL send a budget_tokens value of 8192
8. WHEN Thinking_Level is set to high for an Anthropic model, THE App SHALL send a budget_tokens value of 16384
9. WHEN Thinking_Level is set to xhigh, THE App SHALL clamp the value to high for all providers

### Requirement 8: Streaming Response Display and Controls

**User Story:** As a user, I want to see responses streaming in real-time with the ability to stop generation, so that I get immediate feedback and can abort unwanted responses.

#### Acceptance Criteria

1. WHILE a streaming response is in progress, THE App SHALL render each received chunk incrementally in the chat view
2. WHILE a streaming response is in progress, THE App SHALL display a "Stop generation" button
3. WHEN the user presses "Stop generation", THE App SHALL abort the request and discard the partial message
4. WHILE a reasoning model is thinking, THE App SHALL display a blinking "thinking" indicator
5. WHEN the thinking phase completes, THE App SHALL allow the user to expand and read the thinking content

### Requirement 9: Message Actions (Regenerate, Edit, Copy)

**User Story:** As a user, I want to regenerate, edit, and copy messages, so that I can refine conversations and reuse content easily.

#### Acceptance Criteria

1. WHEN a user taps regenerate on the last assistant message, THE App SHALL resend the preceding context and replace the last assistant message with the new response
2. WHEN a user edits a previous user message, THE App SHALL discard all messages after the edited one and resend with the updated content
3. WHEN a user copies a message, THE App SHALL place the full message text in the system clipboard
4. WHEN a user taps copy on a code block, THE App SHALL place the code block content in the system clipboard

### Requirement 10: Markdown Rendering

**User Story:** As a user, I want assistant responses rendered with proper markdown formatting, so that code, tables, and lists are easy to read.

#### Acceptance Criteria

1. THE App SHALL render markdown formatting in assistant messages including headings, bold, italic, links, ordered lists, and unordered lists
2. THE App SHALL render fenced code blocks with syntax highlighting based on the specified language
3. THE App SHALL render markdown tables with visible borders and aligned columns
4. THE App SHALL render inline code with a distinct background style

### Requirement 11: Context Window Tracking

**User Story:** As a user, I want to see how much of the model's context window I have used, so that I know when to start a new session.

#### Acceptance Criteria

1. THE App SHALL display a context usage indicator (percentage) on the chat screen
2. THE App SHALL calculate context usage as (total tokens used in session / model context window size) × 100
3. WHEN token usage data is unavailable from the provider response, THE App SHALL estimate token count using a character-based approximation
4. THE App SHALL never automatically truncate messages to fit the context window

### Requirement 12: Cost Tracking

**User Story:** As a user, I want to see the cost of each message and session, so that I can monitor my API spending.

#### Acceptance Criteria

1. WHEN token usage is returned by the provider API and token prices are configured, THE App SHALL compute and display the cost for each assistant message
2. THE App SHALL display the running total cost for the current session
3. WHEN token prices are not configured for the active model, THE App SHALL hide cost information

### Requirement 13: Multimodal Input

**User Story:** As a user, I want to attach images and use voice dictation, so that I can interact with models beyond plain text.

#### Acceptance Criteria

1. WHEN the active model supports image input, THE App SHALL allow the user to attach images from the device photo library or camera
2. WHEN the active model supports file input, THE App SHALL allow the user to attach files from the device file system
3. THE App SHALL provide a voice dictation button that uses on-device speech-to-text to transcribe spoken input into the text field
4. WHEN the active model supports image generation, THE App SHALL display generated images inline in the chat

### Requirement 14: System Prompt Management

**User Story:** As a user, I want to manage system prompts and set a default, so that I can customize the assistant's behavior per session.

#### Acceptance Criteria

1. THE App SHALL include a built-in default system prompt
2. WHEN a user creates a custom system prompt, THE App SHALL persist it in the Local_Database
3. THE App SHALL allow the user to designate one system prompt as the default for new sessions
4. WHEN a new session is created, THE App SHALL apply the designated default system prompt
5. WHEN a user edits or deletes a custom system prompt, THE App SHALL update or remove it from the Local_Database

### Requirement 15: Cloud Backup and Sync

**User Story:** As a user, I want my chat history backed up to the cloud, so that I can restore it on a new device or after reinstalling the app.

#### Acceptance Criteria

1. THE App SHALL sync chat sessions and provider configurations (excluding API keys) to a cloud backup mechanism
2. THE App SHALL exclude file attachments and generated images from cloud sync
3. WHEN the app is installed on a new device signed into the same account, THE App SHALL restore synced data from cloud backup
4. WHEN a user deletes a session, THE App SHALL propagate the deletion to all synced devices
5. WHEN a sync conflict occurs, THE App SHALL resolve it using a last-write-wins strategy
6. THE App SHALL exclude API keys from cloud sync

### Requirement 16: Error Handling

**User Story:** As a user, I want clear error messages when API calls fail, so that I can understand and resolve issues quickly.

#### Acceptance Criteria

1. WHEN an API request fails, THE App SHALL display a concise one-line error message in the chat view
2. WHEN the user taps the error message, THE App SHALL expand to show the full error detail from the API response
3. WHEN an API request fails, THE App SHALL offer a retry action
4. IF the device has no network connectivity, THEN THE App SHALL display a network unavailable indicator and prevent sending new messages

### Requirement 17: Appearance and Accessibility

**User Story:** As a user, I want the app to support dark/light modes and accessibility features, so that I can use it comfortably in any environment.

#### Acceptance Criteria

1. THE App SHALL support dark mode, light mode, and a follow-system-setting option (default: follow system)
2. THE App SHALL support dynamic font sizing according to the device accessibility settings
3. THE App SHALL provide accessibility labels on all interactive elements for screen reader compatibility
4. THE App SHALL maintain a minimum color contrast ratio of 4.5:1 for all text elements

### Requirement 18: Localization

**User Story:** As a user, I want the app available in multiple languages, so that I can use it in my preferred language.

#### Acceptance Criteria

1. THE App SHALL use English as the base language for all UI strings
2. THE App SHALL support localization into additional languages via i18n resource files
3. THE App SHALL display UI text in the language matching the device locale when a translation is available

### Requirement 19: Offline Access

**User Story:** As a user, I want to read my past chat sessions when offline, so that I can reference previous conversations without network access.

#### Acceptance Criteria

1. WHILE the device has no network connectivity, THE App SHALL allow read-only access to all locally persisted sessions and messages
2. WHILE the device has no network connectivity, THE App SHALL disable the message input and send button

### Requirement 20: Extensible Provider Architecture

**User Story:** As a developer, I want the provider integration layer to follow a common interface, so that adding new providers requires no changes to chat or session logic.

#### Acceptance Criteria

1. THE App SHALL define a common Provider interface encompassing request building, response parsing, streaming parsing, thinking-effort mapping, and model listing
2. WHEN a new provider type is implemented, THE App SHALL require only implementation of the Provider interface with no modifications to session or chat logic
3. THE App SHALL isolate provider-specific logic within individual provider modules

### Requirement 21: No Backend Dependency

**User Story:** As a user, I want the app to function without any backend server, so that I retain full control over my data and API usage.

#### Acceptance Criteria

1. THE App SHALL send all LLM API requests directly from the device to the provider endpoint
2. THE App SHALL not route any user data or API keys through a third-party server
3. THE App SHALL not include telemetry or analytics collection by default
