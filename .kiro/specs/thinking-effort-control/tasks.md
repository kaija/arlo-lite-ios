# Implementation Plan: Thinking Effort Control

## Overview

Wire up the full thinking-effort lifecycle: phase detection utility, ThinkingDisclosure active/static state, phase-aware StreamingMessage rendering, ThinkingLevelSelector visibility gating by model capability, model-switch reset logic, and VoiceOver accessibility announcements at phase transitions. All streaming chunk routing and persistence paths already exist — this plan connects the remaining dots.

## Tasks

- [x] 1. Create streaming phase utility and add isActive prop to ThinkingDisclosure
  - [x] 1.1 Create `src/domain/streaming-phase.ts` with `deriveStreamingPhase` utility
    - Export a pure function `deriveStreamingPhase` that accepts `{ isStreaming, thinkingContent, streamContent }` and returns `'idle' | 'thinking-pending' | 'thinking-active' | 'text-streaming'`
    - Logic: if not streaming → idle; if streamContent has length → text-streaming; if thinkingContent has length → thinking-active; else → thinking-pending
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 6.1_

  - [x] 1.2 Add `isActive` prop to ThinkingDisclosure component
    - Add optional `isActive?: boolean` prop to `ThinkingDisclosureProps` (default `true`)
    - When `isActive` is true, run the blinking label animation as today
    - When `isActive` is false, cancel the blink animation and set label opacity to 1.0 with a 300ms wind-down timing
    - Ensure the `accessibilityLabel` remains constant ("Thinking") regardless of blink state
    - _Requirements: 4.2, 4.3, 4.4, 6.2, 7.5_

  - [ ]* 1.3 Write property test for `deriveStreamingPhase`
    - **Property 3: Stream chunk accumulation preserves all content**
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 1.4 Write unit tests for ThinkingDisclosure `isActive` prop
    - Test that `isActive={false}` renders the label without animation (opacity 1.0)
    - Test that component returns null when content is empty
    - _Requirements: 4.3, 8.3_

- [x] 2. Implement phase-aware StreamingMessage rendering
  - [x] 2.1 Refactor StreamingMessage to use `deriveStreamingPhase` for state management
    - Import `deriveStreamingPhase` from `@/domain/streaming-phase`
    - Compute phase from props: `{ isStreaming: true, thinkingContent, streamContent: content }`
    - Replace inline `isThinking` condition checks with phase-based rendering logic
    - _Requirements: 4.1, 4.2, 6.1_

  - [x] 2.2 Add thinking-pending state rendering (pulsing label + equaliser)
    - When phase is `thinking-pending`: show pulsing "Thinking" label text and EqualiserAnimation, hide cursor
    - Ensure cursor animation only runs during `text-streaming` phase
    - _Requirements: 4.1_

  - [x] 2.3 Add thinking-active state rendering (ThinkingDisclosure blinking + equaliser)
    - When phase is `thinking-active`: render ThinkingDisclosure with `isActive={true}`, show EqualiserAnimation, hide cursor
    - _Requirements: 4.2_

  - [x] 2.4 Add text-streaming state rendering (ThinkingDisclosure static + cursor)
    - When phase is `text-streaming`: render ThinkingDisclosure with `isActive={false}` (if thinkingContent exists), show text with blinking cursor, stop EqualiserAnimation for thinking
    - Ensure EqualiserAnimation `isActive` is set to false once text-streaming begins so it winds down in 300ms
    - _Requirements: 4.3, 6.1, 6.2, 6.3_

  - [x] 2.5 Add VoiceOver accessibility announcements at phase transitions
    - Import `AccessibilityInfo` from React Native
    - When phase transitions from idle/thinking-pending to thinking-active: announce "Model is thinking"
    - When phase transitions from thinking-active to text-streaming: announce "Generating response"
    - Use a `useEffect` watching the derived phase to trigger announcements
    - _Requirements: 7.1, 7.2_

  - [ ]* 2.6 Write unit tests for StreamingMessage phase rendering
    - Test thinking-pending renders pulsing label and equaliser, no cursor
    - Test thinking-active renders ThinkingDisclosure with isActive=true
    - Test text-streaming renders ThinkingDisclosure with isActive=false and cursor
    - Test VoiceOver announcements fire on phase transitions
    - _Requirements: 4.1, 4.2, 4.3, 7.1, 7.2_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Gate ThinkingLevelSelector visibility and implement model-switch reset
  - [x] 4.1 Gate ThinkingLevelSelector rendering on model's `supportsReasoning` capability
    - In the input area component that renders ThinkingLevelSelector, read the active model config from store/provider registry
    - Conditionally render ThinkingLevelSelector only when `modelConfig.supportsReasoning === true`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.2 Reset thinkingLevel to 'off' on switch to non-reasoning model
    - In the model-switch handler (or as a reactive effect watching `activeModelId`), check if the new model's `supportsReasoning` is false
    - If so, call `chatStore.setThinkingLevel('off')`
    - Ensure the selector disappears in the same render cycle via the conditional rendering from 4.1
    - _Requirements: 1.3, 1.4_

  - [ ]* 4.3 Write property test for thinking level reset on non-reasoning model switch
    - **Property 1: Thinking level resets on non-reasoning model switch**
    - **Validates: Requirements 1.4**

  - [ ]* 4.4 Write unit tests for ThinkingLevelSelector conditional rendering
    - Test selector is rendered when `supportsReasoning=true`
    - Test selector is hidden when `supportsReasoning=false`
    - Test thinking level resets to 'off' on non-reasoning model switch
    - _Requirements: 1.1, 1.2, 1.4_

- [x] 5. Wire streaming loop chunk routing and persistence
  - [x] 5.1 Ensure streaming loop routes thinking/text chunks through ChatStore correctly
    - In the streaming completion hook/service, verify the chunk handling switch matches the design:
      - `chunk.type === 'thinking'` → `chatStore.appendThinkingContent(chunk.content)`
      - `chunk.type === 'text'` → `chatStore.appendStreamContent(chunk.content)`
      - `chunk.type === 'done'` → `chatStore.setStreaming(false)` + persist message with `thinkingContent`
      - `chunk.type === 'error'` → `chatStore.setStreaming(false)`, preserve thinkingContent
    - Ensure `chatStore.clearStream()` is called before starting a new stream
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 5.2 Persist thinkingContent alongside message content on stream completion
    - In the message creation call at stream done, pass `thinkingContent: chatStore.thinkingContent || null` to the message repository
    - Verify the `CreateMessageData` interface accepts `thinkingContent` field (already exists per design)
    - _Requirements: 8.1_

  - [x] 5.3 Render ThinkingDisclosure for persisted messages loaded from database
    - In the message list/item component that renders historical messages, check if `message.thinkingContent` is non-null and non-empty
    - If present, render ThinkingDisclosure with `isActive={false}` and `isExpanded={false}` (collapsed by default)
    - If absent/null/empty, omit ThinkingDisclosure entirely
    - _Requirements: 8.2, 8.3_

  - [ ]* 5.4 Write property tests for stream chunk accumulation and persistence
    - **Property 3: Stream chunk accumulation preserves all content**
    - **Property 5: Error chunk preserves accumulated thinking content**
    - **Property 6: Thinking content persistence round-trip**
    - **Validates: Requirements 3.1, 3.2, 3.5, 8.1**

- [x] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The `thinking_content` DB column already exists — no migration needed
- ThinkingLevelSelector and EqualiserAnimation already exist with full functionality — this plan only wires visibility gating and phase coordination
- The `cycleThinkingLevel` pure function and `mapThinkingLevel` mapper are already implemented
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "2.5"] },
    { "id": 3, "tasks": ["2.6", "4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "5.2", "5.3"] },
    { "id": 5, "tasks": ["4.3", "4.4", "5.4"] }
  ]
}
```
