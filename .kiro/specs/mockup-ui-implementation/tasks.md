# Implementation Plan: Mockup UI Implementation

## Overview

Rebuild the Arlo Lite UI layer to match the interactive HTML prototype. The implementation extends the existing theme system, adds new animation utilities, replaces the current chat-bubble message display with a full-width flowing layout, and introduces translucent chrome bars, a 3D page-turn sidebar, overlay screens, and gesture-driven interactions. The existing Zustand stores and SQLite persistence layer remain unchanged; changes are primarily in components, hooks, and theme extensions.

## Tasks

- [x] 1. Extend theme tokens and utilities
  - [x] 1.1 Add color palette extensions to `src/theme/colors.ts`
    - Add `contextWarning`, `contextCritical`, `codeBlockBackground`, `codeKeyword`, `codeString`, `codeType`, `codeComment` to both `lightColors` and `darkColors`
    - Use values from design: codeBlockBackground `#15151b`, contextWarning orange, contextCritical mapped to error
    - Update `ColorPalette` interface to include the new fields
    - _Requirements: 13.1, 2.4, 2.8, 6.7_

  - [x] 1.2 Add border radii extensions to `src/theme/spacing.ts`
    - Add `codeBlock: 10`, `input: 17`, `card: 12`, `groupedList: 26` to `BorderRadii` interface and `borderRadii` constant
    - The `groupedList` radius applies to sidebar session list containers and settings section containers (iOS 26 Liquid Glass style)
    - _Requirements: 13.4_

  - [x] 1.3 Add animation constants to `src/theme/animations.ts` (new file)
    - Export `SIDEBAR_EASING`, `DIALOG_EASING`, `TRANSITION_DURATION` (350ms), sidebar cubic-bezier(0.32, 0.72, 0, 1), settings slide duration (400ms), model picker fade duration (280ms)
    - _Requirements: 13.3_

  - [x] 1.4 Install `expo-haptics` dependency
    - Run `npx expo install expo-haptics` to add the package
    - Verify it resolves correctly in the project
    - Used for ambient haptic feedback on context ring threshold crossings and long-press recognition on session rows
    - _Requirements: 6.8, 14.3_

- [x] 2. Create utility functions
  - [x] 2.1 Create `src/utils/session-grouping.ts`
    - Implement `groupSessionsByDate(sessions: Session[]): SessionGroup[]`
    - Groups: "Today", "Yesterday", "This Week", "This Month", "Older"
    - Each session appears in exactly one group based on `updatedAt` timestamp
    - _Requirements: 7.6_

  - [x] 2.2 Create `src/utils/token-formatting.ts`
    - Implement `formatTokenMetadata(inputTokens, outputTokens, inputPrice?, outputPrice?): string`
    - Abbreviate counts ≥1000 as "X.Xk", cost to 3 decimal places
    - If no prices configured, return only token counts
    - _Requirements: 1.4_

  - [x] 2.3 Write property tests for session grouping
    - **Property 1: Session grouping date classification**
    - **Validates: Requirements 7.6**

  - [x] 2.4 Write property tests for token formatting
    - **Property 5: Token metadata formatting round-trip**
    - **Validates: Requirements 1.4**

- [x] 3. Create UI store for overlay state management
  - [x] 3.1 Create `src/stores/ui-store.ts`
    - Zustand store with state: `toastMessage`, `toastVisible`, `sidebarOpen`, `settingsVisible`, `providerDetailId`, `modelPickerVisible`, `renameSessionId`
    - Actions: `showToast(msg)`, `toggleSidebar()`, `openSettings()`, `closeSettings()`, `openModelPicker()`, `closeModelPicker()`, `openRename(sessionId)`, `closeRename()`, `openProviderDetail(id)`, `closeProviderDetail()`
    - _Requirements: 5.5, 5.6, 7.2, 8.1, 9.1, 10.1, 11.1_

- [x] 4. Implement toast system
  - [x] 4.1 Create `src/components/overlays/ToastProvider.tsx`
    - Global React context with `show(message: string)` method
    - Animated pill: bottom-positioned, capsule radius, translucent dark background, white caption2 text
    - Slide-up 10pt + fade-in over 0.25s; auto-dismiss after 1.8s with fade-out 0.2s
    - Replace existing toast if one is visible (restart timer)
    - `pointerEvents="none"` so taps pass through
    - Max 50 characters, truncate with ellipsis
    - VoiceOver announcement as non-interrupting notification
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

  - [x] 4.2 Write property test for toast replacement behavior
    - **Property 7: Toast replacement resets timer**
    - **Validates: Requirements 12.5**

- [x] 5. Implement input subcomponents
  - [x] 5.1 Create `src/components/input/ModelChip.tsx`
    - Pill button with accent tint background, model display name, disclosure chevron
    - VoiceOver label announcing active model name
    - _Requirements: 6.2, 6.3, 6.12_

  - [x] 5.2 Create `src/components/input/ThinkingLevelSelector.tsx`
    - 5 bars with increasing heights; filled bars = current level; unfilled = muted color
    - Tap cycles through Off → Minimal → Low → Medium → High → XHigh → Off
    - VoiceOver label announcing current level name
    - _Requirements: 6.4, 6.5, 6.12_

  - [x] 5.3 Write property test for thinking level cycle
    - **Property 2: Thinking level cycle is a closed rotation**
    - **Validates: Requirements 6.5**

  - [x] 5.4 Create `src/components/input/ContextRing.tsx`
    - SVG circle gauge using react-native-svg
    - Color: accent < 50%, orange 50-74%, red ≥ 75%
    - Scale animation (scale 1→1.3→1) on threshold crossing (50% and 75%)
    - Fire `expo-haptics impactAsync(Light)` on each threshold crossing alongside the scale pop animation
    - Toast on first 50% and 75% cross per session
    - VoiceOver label announcing usage percentage
    - _Requirements: 6.7, 6.8, 6.12_

  - [x] 5.5 Write property test for context ring colors
    - **Property 3: Context ring color thresholds**
    - **Validates: Requirements 6.7**

  - [x] 5.6 Create `src/components/input/SendStopButton.tsx`
    - Circular button: up-arrow (send) or square (stop)
    - Disabled state: fill-secondary bg, muted icon, no tap response
    - Send-ready state: accent bg, white up-arrow
    - Streaming state: accent bg, white stop square
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

  - [x] 5.7 Write property test for send button state derivation
    - **Property 4: Send button state derivation**
    - **Validates: Requirements 15.1, 15.2, 15.3**

  - [x] 5.8 Create `src/components/input/EqualiserAnimation.tsx`
    - 4 accent-colored bars with staggered vertical scale animation
    - Active during streaming; stops within 300ms on completion
    - _Requirements: 4.3, 4.6_

- [x] 6. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement animation hooks
  - [x] 7.1 Create `src/hooks/useSidebarTransition.ts`
    - Reanimated shared values: `progress` (0→1), `isOpen`
    - `chatAnimatedStyle`: perspective + rotateY(-76deg) + translateX(88%) + shadow + borderRadius at progress=1
    - `sidebarAnimatedStyle`: translateX(-42→0), scale(0.94→1), opacity(0.3→1)
    - Edge pan gesture (left 24px zone) mapped to progress over 240px drag
    - Snap: open if progress ≥ 0.4 (button) or ≥ 0.22 (gesture), close otherwise
    - Spring animation for snap; 0.5s cubic-bezier for button-triggered open/close
    - `open()`, `close()`, `toggle()` methods
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 14.1, 14.4, 14.5, 14.6_

  - [x] 7.2 Write property test for sidebar snap threshold
    - **Property 6: Sidebar snap threshold**
    - **Validates: Requirements 7.1, 14.5, 14.6**

  - [x] 7.3 Create `src/hooks/useSwipeToDelete.ts`
    - Reanimated translateX shared value
    - Pan gesture: reveal red delete button (72px) when swiped left > 40px
    - Spring return on release below threshold
    - `reset()` method to close reveal
    - _Requirements: 7.8, 14.2_

  - [x] 7.4 Create `src/hooks/useStreamingMetrics.ts`
    - Track token arrival timestamps
    - Compute rolling 2s window average, update every 500ms
    - `isStalled` flag when 0 tok/s for > 3s
    - _Requirements: 4.2, 4.8_

  - [x] 7.5 Write property test for streaming token rate
    - **Property 10: Streaming token rate rolling window**
    - **Validates: Requirements 4.2**

  - [x] 7.6 Create `src/hooks/usePressAnimation.ts`
    - Shared press-state micro-interaction hook for all tappable elements (buttons, cards, rows)
    - On press-in: animate to scale 0.97 + opacity 0.82
    - On press-out: revert to scale 1.0 + opacity 1.0 with spring timing
    - Returns `{ animatedStyle, onPressIn, onPressOut }` — apply `animatedStyle` to an `Animated.View` wrapping the pressable
    - Use react-native-reanimated `useSharedValue` + `useAnimatedStyle` + `withSpring`
    - _Requirements: 14.3 (gesture feedback)_

- [x] 8. Implement message components
  - [x] 8.1 Create `src/components/chat/MessageFlow.tsx`
    - Full-width flowing text layout (no bubbles)
    - User messages: gray avatar (23×23, 7px radius) + "You" label (13px, 600 weight, secondary color)
    - Assistant messages: accent-tinted avatar + model name label (13px, 600 weight, accent color)
    - Body text: 15px, 22px line-height, full-width, 18px edge padding
    - Token metadata right-aligned on sender row (11px monospace tertiary)
    - 26px vertical gap between message blocks
    - Action buttons below message: copy, regenerate (assistant), edit, delete — 16px gap, 44×44 tap target, tertiary color
    - Hide actions while streaming
    - New messages use react-native-reanimated `entering` prop with a custom fade-up animation: `translateY(10px) + scale(0.98) → identity` over 300ms (FadeIn.duration(300).withInitialValues({ transform: [{ translateY: 10 }, { scale: 0.98 }] }))
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

  - [x] 8.2 Create `src/components/chat/CodePanel.tsx`
    - Fixed dark background (#15151b), rounded corners (10pt), subtle inset border
    - Header: language label (monospace, left) + copy button (right) + bottom divider
    - Single-hue syntax highlighting from accent: keywords, strings, types, comments at distinct opacities
    - Monospace font respecting Dynamic Type, reduced opacity vs full white
    - Horizontal scroll for long lines
    - Copy button → clipboard + confirmation indicator (2s)
    - Hide language label if unrecognized/unspecified; plain-text render
    - Same fixed background in both light and dark mode
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 8.3 Write property test for code panel accent-derived colors
    - **Property 9: Code panel accent-derived color consistency**
    - **Validates: Requirements 2.4, 2.8**

  - [x] 8.4 Create `src/components/chat/StreamingMessage.tsx`
    - Blinking cursor (2.5px accent vertical bar, repeating on/off animation)
    - Token rate display (rolling average, updated every 500ms) on model name row
    - "stalled" label when 0 tok/s for > 3s
    - Remove cursor/rate/equalizer within 300ms on completion
    - _Requirements: 4.1, 4.2, 4.6, 4.8_

  - [x] 8.5 Create `src/components/chat/ThinkingDisclosure.tsx`
    - Blinking "Thinking" label with chevron toggle
    - Collapsed/expanded state for reasoning content
    - Left accent-colored border on expanded block
    - Omit entirely if no reasoning content
    - Retain toggle state for session duration
    - _Requirements: 4.4, 4.5, 4.7_

  - [x] 8.6 Update inline markdown rendering for code spans
    - Monospace font + distinct background + padding + rounded corners
    - Wrap with surrounding text, allow cross-line break if span exceeds width
    - Consistent spacing for adjacent spans and within list items
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 9. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement layout chrome components
  - [x] 10.1 Create `src/components/layout/NavigationChrome.tsx`
    - BlurView with `systemUltraThinMaterial` (expo-blur), saturation 180%, blur 20pt
    - Sidebar toggle button (leading), session title (center, semibold, single-line truncation), settings button (trailing)
    - 44×44pt tap targets, 0.5pt bottom border separator
    - Pinned top, full-width, below safe area insets, above scroll content
    - VoiceOver labels for all interactive elements
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 10.2 Create `src/components/layout/InputChrome.tsx`
    - BlurView bottom bar with translucent material, hairline top separator
    - Fixed above keyboard when visible
    - Compose layout: attachment/paperclip button (LEFT of textarea, always visible) + multiline text input (tertiary fill bg, auto-expand to 120pt max, then internal scroll) + SendStopButton
    - Above textarea row: ModelChip + ThinkingLevelSelector (hidden if model doesn't support reasoning) + ContextRing
    - Send on Enter (without Shift) when text has non-whitespace; no-op on empty
    - VoiceOver labels for chip, thinking selector, context ring
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12, 14.7, 14.8_

- [x] 11. Implement sidebar components
  - [x] 11.1 Create `src/components/sidebar/SessionRow.tsx`
    - Session title row with active highlight (12% accent tint bg, accent text, 600 weight)
    - Swipe-left > 40px reveals red delete button (72px wide)
    - Tap delete → immediate remove, animate row out, no confirmation
    - Long-press recognition at 550ms fires `expo-haptics impactAsync(Light)` haptic feedback, then opens rename dialog
    - VoiceOver custom actions for swipe-delete and long-press rename
    - _Requirements: 7.7, 7.8, 7.9, 14.2, 14.3, 14.9_

  - [x] 11.2 Create `src/components/sidebar/SessionSidebar.tsx`
    - Session list grouped by date (Today, Yesterday, This Week, This Month, Older)
    - 11px uppercase section headers in tertiary text
    - Empty state message when no sessions exist
    - "New Chat" button: 34px circle, tertiary fill, accent compose icon, top-right header
    - Tap new chat → create session, set active, close sidebar
    - Tap dimmed chat area → close sidebar
    - Semi-transparent overlay (opacity 0.3, black) over chat area while open
    - Footer hint text: "Swipe left to delete · hold to rename" rendered in caption2 size, tertiary color, at the bottom of the sidebar list
    - _Requirements: 7.6, 7.7, 7.8, 7.9, 7.10, 7.11, 7.12_

- [x] 12. Implement overlay components
  - [x] 12.1 Create `src/components/overlays/ModelPicker.tsx`
    - Dropdown anchored above input, fade-up animation (0.28s cubic-bezier)
    - Models grouped by provider (uppercase section headers)
    - Each row: model name + faint subline with context window size (e.g. "200K") — pricing intentionally omitted to keep the list scannable (full pricing lives in Provider Detail screen)
    - Active model checkmark in accent color
    - Card surface bg, 14px border-radius, drop shadow
    - Tap outside → dismiss without change
    - Select model → set active, update chip, dismiss
    - Empty state if no models configured
    - Scrollable if > 5 visible rows
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_

  - [x] 12.2 Create `src/components/overlays/RenameDialog.tsx`
    - Centered card (280pt wide, 14pt radius, card surface bg) over 32% black scrim
    - "Rename Chat" title (16pt, 600 weight, centered)
    - Text input: full-width, tertiary fill bg, 8pt radius, 15pt font, max 100 chars
    - Pre-populated with current title, cursor at end, keyboard presented
    - Fade-up animation (0.25s)
    - Cancel/scrim tap → dismiss, no save
    - Save (enabled only when trimmed input non-empty) → persist trimmed title, dismiss
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 12.3 Write property test for rename dialog validation
    - **Property 8: Rename dialog validation**
    - **Validates: Requirements 11.5, 11.6**

  - [x] 12.4 Create `src/components/overlays/SettingsScreen.tsx`
    - Slide from right (0.4s ease-out), overlay on chat
    - Back button "Chat" with left chevron (accent), centered "Settings" title
    - Provider cards: 34×34pt icon, name, model count, API type, masked key (•••• + last 4 monospace)
    - Tap provider → open provider detail
    - System prompts section: name, 60-char preview, edit button, default checkmark
    - "Add Prompt" action
    - Generation params: Temperature (0.0–2.0), Max Tokens (up to context window)
    - Empty state if no providers: centered text + "Add Provider" accent button
    - Grouped inset list, system-grouped background, translucent blur header pinned on scroll
    - Dismiss via back button or right-to-left swipe from left edge
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9, 9.10_

  - [x] 12.5 Create `src/components/overlays/ProviderDetailScreen.tsx`
    - Slide from right over settings (0.4s cubic-bezier)
    - API key section: masked bullets + last 4 chars (monospace 13.5px), eye toggle for reveal, keychain note (12px tertiary)
    - Configuration: Base URL field (max 2048 chars), Streaming toggle, API type selector (OpenAI only)
    - Models list: name (15px), context + pricing (12px tertiary), "Add Model" action
    - Back button "Settings" with left chevron (accent)
    - Empty models → "Add Model" as sole item
    - Swipe-left on model row → delete action with confirmation
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 13. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Compose the chat screen shell
  - [x] 14.1 Create `src/components/layout/ChatShell.tsx`
    - Wraps entire chat screen: sidebar (z=1) + chat layer (z=2) + overlays
    - Edge pan gesture zone (left 24px) wired to `useSidebarTransition`
    - Applies `chatAnimatedStyle` / `sidebarAnimatedStyle` transforms
    - Mounts NavigationChrome, MessageList (FlatList with MessageFlow items), InputChrome
    - Mounts ModelPicker, RenameDialog, SettingsScreen, ProviderDetailScreen, ToastView conditionally from UI store
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 14.1, 14.4_

  - [x] 14.2 Refactor `src/screens/ChatScreen.tsx` to use ChatShell
    - Replace existing FlatList + MessageBubble + MessageInput composition with ChatShell
    - Wire existing store hooks (session-store, chat-store, provider-store) into new component tree
    - Maintain KeyboardAvoidingView behavior for InputChrome
    - _Requirements: all (integration point)_

- [x] 15. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Integration and snapshot tests
  - [x] 16.1 Write snapshot tests for NavigationChrome (light + dark)
    - _Requirements: 5.1, 13.7_

  - [x] 16.2 Write snapshot tests for InputChrome states (empty, has text, streaming)
    - _Requirements: 6.1, 6.9, 6.10, 6.11_

  - [x] 16.3 Write snapshot tests for MessageFlow (user vs assistant)
    - _Requirements: 1.1, 1.2_

  - [x] 16.4 Write snapshot tests for CodePanel with syntax highlighting
    - _Requirements: 2.1, 2.4_

  - [x] 16.5 Write integration test for send message flow → streaming state → cursor
    - _Requirements: 4.1, 4.6, 15.4_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing stores (session-store, chat-store, provider-store) and database layer are NOT modified — only the component/hook/theme layer changes
- All animations use `react-native-reanimated` worklets for 60fps UI-thread performance
- `expo-blur` BlurView is used for translucent chrome; falls back to semi-transparent solid on Android
- `expo-haptics` provides ambient haptic feedback on context ring threshold crossings and session row long-press recognition
- `usePressAnimation` hook is applied to all tappable elements (buttons, cards, rows) for consistent press-state micro-interaction

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["2.3", "2.4", "4.1", "5.1", "5.2", "5.4", "5.6", "5.8"] },
    { "id": 3, "tasks": ["4.2", "5.3", "5.5", "5.7", "7.1", "7.3", "7.4", "7.6"] },
    { "id": 4, "tasks": ["7.2", "7.5", "8.1", "8.2", "8.4", "8.5", "8.6"] },
    { "id": 5, "tasks": ["8.3", "10.1", "10.2"] },
    { "id": 6, "tasks": ["11.1", "11.2", "12.1", "12.2"] },
    { "id": 7, "tasks": ["12.3", "12.4", "12.5"] },
    { "id": 8, "tasks": ["14.1"] },
    { "id": 9, "tasks": ["14.2"] },
    { "id": 10, "tasks": ["16.1", "16.2", "16.3", "16.4", "16.5"] }
  ]
}
```
