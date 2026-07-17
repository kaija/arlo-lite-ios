# Requirements Document

## Introduction

This specification addresses a UI blocking bug during LLM streaming in Arlo Lite. The root cause is that `appendStreamContent()` in the chat store is called on every SSE chunk (50–100+ per second), each triggering a Zustand `set()` call and a React re-render. Combined with per-chunk `setTokenRate()` state updates, this saturates the JavaScript thread, making the UI completely unresponsive during streaming.

The fix introduces a batching layer that accumulates stream chunks in a ref buffer and flushes them to the Zustand store at a fixed ~30fps interval (32ms), keeping the JS thread free to process user interactions.

## Glossary

- **Stream_Batcher**: The batching mechanism that accumulates incoming SSE chunks in memory and flushes them to the store at a fixed interval
- **Chat_Store**: The Zustand store (`chat-store.ts`) holding ephemeral streaming state including `streamContent` and `thinkingContent`
- **useChat_Hook**: The React hook (`useChat.ts`) that orchestrates the message send flow, streaming iteration, token rate tracking, and abort handling
- **Flush_Interval**: The timer period (32ms) at which accumulated chunks are written to the Chat_Store
- **Chunk_Buffer**: An in-memory ref that accumulates text and thinking content between flushes
- **Token_Rate**: The estimated tokens-per-second metric computed from chunk data and displayed in the UI
- **Stream_Completion**: The event signaling that the SSE stream has ended (via a `done` chunk or stream close)
- **Abort_Signal**: The `AbortController.signal` used to cancel an in-progress streaming request

## Requirements

### Requirement 1: Batched Stream Content Updates

**User Story:** As a user, I want the app to remain responsive while streaming LLM responses, so that I can interact with the sidebar, settings, and other controls without delay.

#### Acceptance Criteria

1. WHILE streaming is active, THE Stream_Batcher SHALL accumulate incoming text chunks in the Chunk_Buffer without writing to the Chat_Store.
2. WHILE streaming is active, THE Stream_Batcher SHALL flush the Chunk_Buffer contents to the Chat_Store at the Flush_Interval of 32 milliseconds.
3. WHEN the Flush_Interval elapses and the Chunk_Buffer is empty, THE Stream_Batcher SHALL skip the flush without calling set() on the Chat_Store.

### Requirement 2: Batched Thinking Content Updates

**User Story:** As a user, I want thinking/reasoning content to also stream without blocking the UI, so that models with extended thinking remain responsive.

#### Acceptance Criteria

1. WHILE streaming is active, THE Stream_Batcher SHALL accumulate incoming thinking chunks in a separate thinking section of the Chunk_Buffer.
2. WHILE streaming is active, THE Stream_Batcher SHALL flush thinking content to the Chat_Store at the same Flush_Interval as text content.
3. WHEN the Flush_Interval elapses, THE Stream_Batcher SHALL perform a single combined Chat_Store set() call for both text and thinking content.

### Requirement 3: Batched Token Rate Calculation

**User Story:** As a user, I want the tokens-per-second indicator to update smoothly without contributing to UI jank.

#### Acceptance Criteria

1. WHILE streaming is active, THE useChat_Hook SHALL compute the Token_Rate once per Flush_Interval rather than once per incoming chunk.
2. WHEN a flush occurs, THE useChat_Hook SHALL update the Token_Rate state based on all chunks accumulated since the previous flush.
3. WHEN a flush occurs, THE useChat_Hook SHALL perform a single state update combining Token_Rate with stream content rather than separate set() calls.

### Requirement 4: UI Responsiveness During Streaming

**User Story:** As a user, I want to tap navigation controls, toggle the sidebar, and switch sessions while a response is streaming.

#### Acceptance Criteria

1. WHILE streaming is active, THE useChat_Hook SHALL invoke the Chat_Store set() method no more than once per Flush_Interval.
2. WHILE streaming is active, THE useChat_Hook SHALL yield control to the JavaScript event loop between flush cycles so that touch events and navigation actions are processed.

### Requirement 5: Complete Content Delivery on Stream End

**User Story:** As a user, I want every character of the LLM response to appear in my session, with no dropped content at the end of a stream.

#### Acceptance Criteria

1. WHEN a Stream_Completion event is received, THE Stream_Batcher SHALL immediately flush all remaining Chunk_Buffer content to the Chat_Store.
2. WHEN a Stream_Completion event is received, THE Stream_Batcher SHALL cancel the interval timer before the final flush to prevent duplicate writes.
3. WHEN the final flush completes, THE Chunk_Buffer contents SHALL equal an empty string for both text and thinking sections.

### Requirement 6: Abort Behavior with Batching

**User Story:** As a user, I want the stop button to immediately halt streaming and display whatever content was received up to that point.

#### Acceptance Criteria

1. WHEN the Abort_Signal fires, THE Stream_Batcher SHALL immediately flush all remaining Chunk_Buffer content to the Chat_Store.
2. WHEN the Abort_Signal fires, THE Stream_Batcher SHALL cancel the interval timer.
3. WHEN the Abort_Signal fires and content exists in the Chat_Store streamContent, THE useChat_Hook SHALL persist the partial assistant message to the session before clearing stream state.

### Requirement 7: Visual Smoothness of Streamed Text

**User Story:** As a user, I want streamed text to appear smoothly and without visible stutter, despite the batching delay.

#### Acceptance Criteria

1. THE Stream_Batcher SHALL use a Flush_Interval of 32 milliseconds, producing a visual update rate of approximately 30 frames per second.
2. WHILE streaming is active, THE Chat_Store streamContent value SHALL reflect all chunks received up to the most recent flush boundary.
3. WHEN the streaming source delivers chunks faster than the Flush_Interval, THE Stream_Batcher SHALL concatenate multiple chunks into a single flush payload.

### Requirement 8: Cleanup on Unmount and Session Switch

**User Story:** As a user, I want switching sessions or leaving the chat screen during a stream to clean up timers and buffers without leaking resources.

#### Acceptance Criteria

1. WHEN the useChat_Hook unmounts while streaming is active, THE Stream_Batcher SHALL cancel the interval timer and clear the Chunk_Buffer.
2. WHEN the active session changes while streaming is active, THE Stream_Batcher SHALL cancel the interval timer, flush remaining content, and reset state for the new session.
