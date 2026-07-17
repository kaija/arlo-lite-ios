# Requirements Document

## Introduction

This feature enhances the chat interface with per-message model identification and reworked message action buttons. Each message displays the model that generated it, the Edit action is removed entirely, and the Regenerate action is extended to work on any assistant message (not just the last one). Regenerating a mid-conversation message deletes it and all subsequent messages before producing a new response from the current model.

## Glossary

- **MessageFlow**: The full-width flowing message component that renders individual chat messages with sender labels, content, metadata, and action buttons.
- **MessageActions**: The row of contextual action buttons displayed beneath each message.
- **Message**: A persisted record in the local SQLite database containing role, content, providerId, modelId, token counts, cost, and timestamps.
- **ModelLabel**: A text element displayed on each message indicating the model name that produced or was active when the message was sent.
- **RegenerateFlow**: The sequence of operations triggered when a user requests regeneration of an assistant message: delete target message and all subsequent messages, then send the remaining context to the current model for a new completion.
- **SessionStore**: The Zustand store managing active session state including message lists and CRUD operations.
- **ProviderStore**: The Zustand store holding provider configurations and model metadata (names, pricing, context sizes).

## Requirements

### Requirement 1: Per-Message Model Display

**User Story:** As a user, I want to see which model generated each message, so that I can track model usage when switching models mid-conversation.

#### Acceptance Criteria

1. THE MessageFlow SHALL display a ModelLabel showing the human-readable model name for each assistant message.
2. THE MessageFlow SHALL display a ModelLabel showing the active model name for each user message.
3. WHEN a Message has a modelId stored in the database, THE MessageFlow SHALL resolve the modelId to the model display name from the ProviderStore.
4. IF a Message has a modelId that does not match any model in the ProviderStore, THEN THE MessageFlow SHALL display the raw modelId string as the ModelLabel.
5. THE ModelLabel SHALL be positioned in the sender row alongside the sender label, using the existing assistantLabel style for assistant messages.

### Requirement 2: Message Action Buttons for Assistant Messages

**User Story:** As a user, I want Copy, Regenerate, and Delete actions on every assistant message, so that I can manage responses at any point in the conversation.

#### Acceptance Criteria

1. THE MessageActions SHALL display a Copy button on every assistant message.
2. THE MessageActions SHALL display a Regenerate button on every assistant message, regardless of message position in the conversation.
3. THE MessageActions SHALL display a Delete button on every assistant message.
4. THE MessageActions SHALL NOT display an Edit button on assistant messages.

### Requirement 3: Message Action Buttons for User Messages

**User Story:** As a user, I want Copy and Delete actions on my messages without an Edit option, so that I have a simplified and consistent action set.

#### Acceptance Criteria

1. THE MessageActions SHALL display a Copy button on every user message.
2. THE MessageActions SHALL display a Delete button on every user message.
3. THE MessageActions SHALL NOT display an Edit button on user messages.
4. THE MessageActions SHALL NOT display a Regenerate button on user messages.

### Requirement 4: Remove Edit Action Entirely

**User Story:** As a user, I want the Edit action removed from the interface, so that the message actions are streamlined and unambiguous.

#### Acceptance Criteria

1. THE MessageActions SHALL NOT render an Edit button for any message role.
2. THE MessageFlow SHALL NOT accept or invoke an onEdit callback.
3. THE MessageActions component interface SHALL NOT include an onEdit property.

### Requirement 5: Regenerate From Any Assistant Message

**User Story:** As a user, I want to regenerate any assistant message in the conversation (not just the last one), so that I can explore alternative responses at any point.

#### Acceptance Criteria

1. WHEN the user activates Regenerate on an assistant message, THE RegenerateFlow SHALL delete that assistant message from the session.
2. WHEN the user activates Regenerate on an assistant message, THE RegenerateFlow SHALL delete all messages created after the target assistant message in the same session.
3. WHEN the target message and subsequent messages have been deleted, THE RegenerateFlow SHALL send the remaining conversation context to the completion service to generate a new assistant response.
4. THE RegenerateFlow SHALL use the currently active model and provider for the new completion, not the model that generated the original message.
5. WHILE regeneration is in progress, THE MessageFlow SHALL display the streaming state (streaming content and thinking content) for the new response.

### Requirement 6: Regenerate Database Operations

**User Story:** As a developer, I want regeneration to cleanly remove the target and subsequent messages from persistence, so that the conversation history remains consistent.

#### Acceptance Criteria

1. WHEN regeneration is triggered for a message, THE SessionStore SHALL delete the target message from the database.
2. WHEN regeneration is triggered for a message, THE SessionStore SHALL delete all messages in the session with a createdAt timestamp greater than or equal to the target message createdAt.
3. WHEN the database deletions complete, THE SessionStore SHALL update the in-memory message list to reflect the deletions before triggering the new completion.
4. IF the deletion or regeneration fails, THEN THE SessionStore SHALL surface the error via the existing ChatError mechanism.

### Requirement 7: Action Buttons Hidden During Streaming

**User Story:** As a user, I want action buttons hidden while a response is streaming, so that I do not accidentally trigger actions on incomplete messages.

#### Acceptance Criteria

1. WHILE a completion is streaming in the active session, THE MessageFlow SHALL NOT display action buttons on any message.
2. WHEN streaming completes or is stopped, THE MessageFlow SHALL display action buttons on all messages.

### Requirement 8: Accessibility for Model Label and Actions

**User Story:** As a user relying on assistive technology, I want the model label and action buttons to be properly labeled, so that I can navigate and interact with them using VoiceOver.

#### Acceptance Criteria

1. THE ModelLabel SHALL include an accessibilityLabel describing the model name (e.g., "Model: GPT-4o").
2. THE Regenerate button SHALL include an accessibilityLabel describing its action (e.g., "Regenerate response").
3. THE Delete button SHALL include an accessibilityLabel describing its action (e.g., "Delete message").
4. THE Copy button SHALL include an accessibilityLabel describing its action (e.g., "Copy message").
