# Requirements Document

## Introduction

Thinking Effort Control provides users with a complete lifecycle for managing and observing LLM reasoning/thinking behavior. The feature encompasses three concerns: (1) a thinking-level selector that lets users set reasoning effort before sending a message, gated by model capability; (2) real-time streaming integration that routes thinking chunks from the provider through the store into the UI; and (3) an animated, collapsible thinking disclosure component that communicates in-progress thinking state and allows users to expand/collapse the reasoning content.

## Glossary

- **App**: The Arlo Lite iOS application
- **ThinkingLevelSelector**: A brain icon button in the input area that opens a popover for selecting reasoning effort level
- **ThinkingLevelPopover**: The floating menu presented on tap of the brain icon, listing available reasoning effort levels with budget hints
- **ThinkingDisclosure**: The collapsible UI component that displays reasoning/thinking content during and after streaming
- **ChatStore**: The Zustand store managing ephemeral streaming state, including thinking content accumulation
- **StreamingMessage**: The component that renders the active streaming state of an assistant message
- **ThinkingLevel**: One of five reasoning effort levels: off, low, medium, high, max
- **ThinkingPhase**: The period during streaming when the model is producing reasoning/thinking tokens before emitting text output
- **TextPhase**: The period during streaming when the model is producing visible output text tokens
- **StreamChunk**: A typed chunk emitted during SSE streaming, with type field of 'thinking', 'text', 'done', or 'error'
- **ModelConfig**: Configuration object for a model, including the supportsReasoning capability flag
- **EqualiserAnimation**: An animated bar component indicating active generation

## Requirements

### Requirement 1: Thinking Level Selector Visibility

**User Story:** As a user, I want the thinking level selector to only appear when my active model supports reasoning, so that I am not confused by irrelevant controls.

#### Acceptance Criteria

1. WHILE the active model has supportsReasoning set to true, THE App SHALL display the ThinkingLevelSelector in the input area.
2. WHILE the active model has supportsReasoning set to false, THE App SHALL hide the ThinkingLevelSelector from the input area.
3. WHEN the user switches to a model that does not support reasoning, THE App SHALL hide the ThinkingLevelSelector within the same render cycle.
4. WHEN the user switches to a model that does not support reasoning, THE ChatStore SHALL reset the thinkingLevel to 'off'.

### Requirement 2: Thinking Level Selection

**User Story:** As a user, I want to tap the brain icon to open a popover and select a reasoning effort level, so that I can precisely choose how deeply the model should think.

#### Acceptance Criteria

1. WHEN the user taps the ThinkingLevelSelector brain icon, THE App SHALL present a popover menu listing all available reasoning effort levels: Off, Low, Medium, High, Max.
2. THE ThinkingLevelSelector brain icon SHALL render in accent color when the current level is any non-off value, and in muted gray when the level is off.
3. WHEN the user selects a level from the popover, THE App SHALL update the thinkingLevel in the ChatStore and dismiss the popover.
4. WHEN the thinking level changes, THE ThinkingLevelSelector SHALL announce the new level name to VoiceOver.
5. EACH popover option SHALL display the level name on the left and a budget hint on the right (e.g., "Max 2,048 tokens"), except Off which has no hint and Max which shows "Unlimited".
6. THE currently selected level SHALL be indicated with a checkmark icon and a highlighted row background.

### Requirement 3: Thinking Phase Streaming Integration

**User Story:** As a user, I want to see thinking content appear in real time as the model reasons, so that I understand the model is actively working on my request.

#### Acceptance Criteria

1. WHEN the streaming service receives a StreamChunk with type 'thinking', THE ChatStore SHALL append the chunk content to the thinkingContent state.
2. WHEN the streaming service receives a StreamChunk with type 'text', THE ChatStore SHALL append the chunk content to the streamContent state.
3. WHEN streaming begins, THE ChatStore SHALL clear both streamContent and thinkingContent to empty strings.
4. WHEN streaming ends with a 'done' chunk, THE ChatStore SHALL set isStreaming to false.
5. IF a StreamChunk with type 'error' is received, THEN THE ChatStore SHALL set isStreaming to false and preserve accumulated thinkingContent for display.

### Requirement 4: Thinking-In-Progress Animation

**User Story:** As a user, I want a clear visual indicator that the model is actively reasoning, so that I know the app is not frozen during long thinking periods.

#### Acceptance Criteria

1. WHILE the model is in the ThinkingPhase and thinkingContent is empty, THE StreamingMessage SHALL display a pulsing "Thinking" label with the EqualiserAnimation to indicate the model has entered reasoning mode.
2. WHILE the model is in the ThinkingPhase and thinkingContent has content, THE ThinkingDisclosure SHALL display with a blinking "Thinking" label animation at 600ms half-cycle duration.
3. WHEN the ThinkingPhase ends and the TextPhase begins, THE StreamingMessage SHALL transition the ThinkingDisclosure from active-thinking style to a static completed state within 300ms.
4. THE ThinkingDisclosure blinking label animation SHALL use an opacity range from 0.3 to 1.0 with ease-in-out easing.

### Requirement 5: Thinking Disclosure Expand/Collapse

**User Story:** As a user, I want to expand and collapse the thinking content block, so that I can inspect reasoning when curious without cluttering the chat view.

#### Acceptance Criteria

1. THE ThinkingDisclosure SHALL render in a collapsed state by default when thinking content is available.
2. WHEN the user taps the ThinkingDisclosure toggle, THE App SHALL expand the thinking content block to reveal the full reasoning text.
3. WHEN the user taps the ThinkingDisclosure toggle while expanded, THE App SHALL collapse the thinking content block.
4. THE ThinkingDisclosure SHALL display a chevron indicator rotated 90 degrees when expanded and 0 degrees when collapsed.
5. WHILE expanded, THE ThinkingDisclosure SHALL show the reasoning text with a left accent-colored border and secondary surface background.
6. THE ThinkingDisclosure SHALL preserve the expanded/collapsed state for the duration of the current session.

### Requirement 6: Thinking Phase Transition

**User Story:** As a user, I want a smooth visual transition when the model finishes thinking and starts producing text, so that the experience feels polished and responsive.

#### Acceptance Criteria

1. WHEN the first text StreamChunk arrives after one or more thinking StreamChunks, THE StreamingMessage SHALL transition from displaying the thinking-active state to the text-streaming state.
2. WHEN the ThinkingPhase ends, THE ThinkingDisclosure SHALL stop the blinking label animation and display "Thinking" at full opacity.
3. WHEN the ThinkingPhase ends, THE EqualiserAnimation associated with thinking state SHALL cease and the text-streaming cursor animation SHALL begin.

### Requirement 7: Accessibility for Thinking State

**User Story:** As a user relying on assistive technology, I want thinking state changes announced clearly, so that I can follow the model's progress without visual cues.

#### Acceptance Criteria

1. WHEN the ThinkingPhase begins, THE App SHALL post a VoiceOver accessibility announcement indicating the model has started thinking.
2. WHEN the ThinkingPhase ends and text generation begins, THE App SHALL post a VoiceOver accessibility announcement indicating the model is now generating a response.
3. THE ThinkingDisclosure toggle SHALL have an accessibilityRole of 'button' with an accessibilityState indicating expanded or collapsed.
4. THE ThinkingLevelSelector brain icon SHALL have an accessibilityHint describing that tapping opens the reasoning level picker.
5. THE ThinkingLevelPopover options SHALL each have accessibilityRole of 'menuitem' with accessibilityState indicating selected or not.

### Requirement 8: Thinking Content Persistence

**User Story:** As a user, I want thinking content saved with the message, so that I can review model reasoning in past conversations.

#### Acceptance Criteria

1. WHEN streaming completes successfully, THE App SHALL persist the thinkingContent alongside the assistant message content in the session database.
2. WHEN a past message with thinkingContent is loaded from the database, THE App SHALL render a ThinkingDisclosure for that message in collapsed state.
3. IF thinkingContent is empty or null for a message, THEN THE App SHALL omit the ThinkingDisclosure for that message entirely.
