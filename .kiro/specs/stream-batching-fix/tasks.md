# Implementation Plan: Stream Batching Fix

## Overview

Replace per-chunk Zustand `set()` calls with a batching layer that accumulates SSE chunks in ref buffers and flushes to the store at a fixed 32ms interval (~30fps). Two files modified: `chat-store.ts` (new action) and `useChat.ts` (batching logic, modified streaming loop, abort handling, cleanup).

## Tasks

- [x] 1. Add `flushStreamBuffer` action to Chat Store
  - [x] 1.1 Add `flushStreamBuffer` to `ChatActions` interface and implement it in `chat-store.ts`
    - Add `flushStreamBuffer: (textDelta: string, thinkingDelta: string) => void` to `ChatActions`
    - Implement as a single `set()` call that appends both `textDelta` to `streamContent` and `thinkingDelta` to `thinkingContent`
    - Keep existing `appendStreamContent` and `appendThinkingContent` for backward compatibility
    - _Requirements: 2.3, 4.1_

  - [x] 1.2 Write unit tests for `flushStreamBuffer` action
    - Test that a single `set()` updates both `streamContent` and `thinkingContent` atomically
    - Test that empty strings do not alter existing content
    - Test concatenation of multiple sequential flushes
    - _Requirements: 2.3_

- [x] 2. Implement Stream Batcher in `useChat.ts`
  - [x] 2.1 Add buffer refs, interval ref, and `FLUSH_INTERVAL_MS` constant
    - Add `textBufferRef`, `thinkingBufferRef`, `bufferedChunkSizesRef`, `lastFlushTimeRef`, `flushIntervalRef` as `useRef` declarations
    - Define `FLUSH_INTERVAL_MS = 32` constant at module level
    - _Requirements: 1.1, 1.2, 7.1_

  - [x] 2.2 Implement `flushBuffer`, `startBatcher`, and `stopBatcher` functions
    - `flushBuffer`: check empty-buffer skip condition, call `useChatStore.getState().flushStreamBuffer()`, compute token rate from `bufferedChunkSizesRef` and elapsed time, reset buffers
    - `startBatcher`: record `lastFlushTimeRef`, start `setInterval(flushBuffer, FLUSH_INTERVAL_MS)`
    - `stopBatcher`: `clearInterval`, null the ref, call `flushBuffer()` for final flush
    - _Requirements: 1.2, 1.3, 3.1, 3.2, 5.1, 5.2, 5.3_

  - [x] 2.3 Modify `handleStreaming` to use the batcher instead of per-chunk store calls
    - Call `startBatcher()` before the `for await` loop
    - In the `text` case: append to `accumulatedContent`, append to `textBufferRef.current`, increment `bufferedChunkSizesRef`
    - In the `thinking` case: append to `accumulatedThinking`, append to `thinkingBufferRef.current`
    - Remove calls to `appendStreamContent()`, `appendThinkingContent()`, and `recordTokenSample()`
    - Call `stopBatcher()` after the loop (normal completion) and in the `catch` block (error)
    - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.2, 7.2, 7.3_

  - [x] 2.4 Modify `stopGeneration` to flush and persist partial content on abort
    - Call `stopBatcher()` after aborting the controller (flushes remaining buffer)
    - Read `streamContent` from store; if non-empty, persist a partial assistant message via `addMessage`
    - Then call `setStreaming(false)` and `clearStream()`
    - Update `useCallback` dependency array to include `addMessage`, `activeSessionId`, `activeProviderId`, `activeModelId`
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.5 Add `useEffect` cleanup for unmount during active stream
    - Return a cleanup function that clears the interval and resets buffer refs
    - Prevents timer leaks when navigating away mid-stream
    - _Requirements: 8.1, 8.2_

  - [x] 2.6 Write property test: Flush Frequency Bound
    - **Property 1: Flush Frequency Bound**
    - For N chunks arriving within a single 32ms window, verify store `set()` is called at most once
    - Mock `setInterval` and verify `flushStreamBuffer` call count per interval tick
    - **Validates: Requirements 1.1, 1.2, 4.1**

  - [x] 2.7 Write property test: Combined Flush Content Correctness
    - **Property 2: Combined Flush Content Correctness**
    - Generate random sequences of text and thinking chunks, accumulate in buffers, flush, and assert store state equals concatenation of all chunks
    - **Validates: Requirements 2.1, 2.2, 2.3, 7.2, 7.3**

  - [x] 2.8 Write property test: Terminal Flush Completeness
    - **Property 4: Terminal Flush Completeness**
    - Verify that `stopBatcher()` flushes all remaining buffer content so final store state matches total accumulated content
    - **Validates: Requirements 5.1, 5.3, 6.1, 6.2**

  - [x] 2.9 Write property test: Empty Buffer Skip
    - **Property 6: Empty Buffer Skip**
    - Verify that when both buffers are empty, `flushBuffer()` does not call `flushStreamBuffer` on the store
    - **Validates: Requirements 1.3**

- [x] 3. Checkpoint - Verify implementation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integration validation
  - [x] 4.1 Write integration test for abort behavior with partial content persistence
    - **Property 5: Abort Persists Partial Content**
    - Simulate a streaming session, trigger abort after some chunks, verify partial message is persisted to session store
    - **Validates: Requirements 6.3**

  - [x] 4.2 Write integration test for cleanup on unmount
    - Render the hook, start streaming, unmount, verify interval is cleared and no buffer refs leak
    - _Requirements: 8.1_

- [x] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Only two source files are modified: `src/stores/chat-store.ts` and `src/hooks/useChat.ts`
- The existing `appendStreamContent` and `appendThinkingContent` actions are preserved for backward compatibility (other consumers may use them)
- The `recordTokenSample` function is replaced by inline token rate logic inside `flushBuffer`
- Property tests validate universal correctness properties from the design document
- The fix is purely additive — no breaking changes to the public API of either module

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4", "2.5"] },
    { "id": 4, "tasks": ["2.6", "2.7", "2.8", "2.9"] },
    { "id": 5, "tasks": ["4.1", "4.2"] }
  ]
}
```
