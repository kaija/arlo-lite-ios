# Requirements Document

## Introduction

Full implementation of the Arlo Lite React Native/Expo app UI to match the interactive HTML prototype in the `mockup/` folder. The prototype uses Apple Design System with iOS 26 Liquid Glass styling and defines a specific visual language: no chat bubbles, full-width flowing text, monochrome + accent palette, and expressive motion. This spec covers rebuilding all UI components to match the mockup's exact visual output and interaction patterns.

## Glossary

- **Chat_Screen**: The primary view displaying the message list, navigation chrome, and input chrome
- **Message_Flow**: The full-width flowing text layout for messages, differentiated by sender label and optional avatar rather than chat bubbles
- **Navigation_Chrome**: The top bar overlay with blur backdrop containing the sidebar toggle, session title, and settings button
- **Input_Chrome**: The bottom bar overlay with blur backdrop containing the model switcher, thinking selector, context ring, attachment button, text input, and send/stop button
- **Sidebar**: The session list panel revealed via left-edge swipe gesture or button tap, using a page-turn transition
- **Page_Turn_Transition**: The 3D animation where the chat layer rotates on the Y axis (rotateY -76deg) while the sidebar slides in from the left
- **Model_Picker**: A dropdown overlay anchored above the input area showing available models grouped by provider
- **Settings_Screen**: A full-screen overlay sliding from the right containing provider, prompt, and generation configuration
- **Provider_Detail_Screen**: A secondary screen sliding over settings showing API key, configuration, and models for a single provider
- **Rename_Dialog**: A modal overlay with a centered card for renaming chat sessions
- **Toast_System**: A bottom-positioned floating pill notification that auto-dismisses
- **Context_Ring**: An SVG circle gauge in the input chrome showing context window usage percentage
- **Thinking_Level_Selector**: A 5-bar equalizer icon where filled bars indicate the active thinking effort level
- **Equalizer_Animation**: Four accent-colored bars with staggered CSS animation indicating active generation
- **Streaming_Cursor**: A blinking vertical bar (2.5px wide, accent color) shown after streaming text
- **Code_Panel**: A code block with fixed dark background (#15151b), language header with copy button, and single-hue accent-derived syntax highlighting

## Requirements

### Requirement 1: Message Flow Layout

**User Story:** As a user, I want messages displayed as full-width flowing text with sender labels and avatars, so that the chat feels clean and readable without bubble clutter.

#### Acceptance Criteria

1. THE Message_Flow SHALL render user messages with a gray fill-secondary background avatar (23×23px, 7px radius) and a "You" label in secondary text color at 13px font-weight-600
2. THE Message_Flow SHALL render assistant messages with an accent-tinted avatar (14% accent color mix with transparent) and the active model name label in accent color at 13px font-weight-600
3. THE Message_Flow SHALL display message text at 15px with 22px line height, full-width with no horizontal padding beyond the container's 18px edge padding
4. IF token prices are configured for the active model, THEN THE Message_Flow SHALL show token usage and cost metadata (formatted as "Xk in / Yk out · $Z.ZZZ" with token counts abbreviated at ≥1,000 and cost shown to 3 decimal places) right-aligned on the sender label row in 11px monospace tertiary text; IF token prices are not configured, THEN THE Message_Flow SHALL hide the cost portion and display only the token counts
5. THE Message_Flow SHALL space messages with 26px vertical gap between message blocks
6. WHEN an assistant message is complete, THE Message_Flow SHALL display action buttons (copy, regenerate, edit, delete) as a row of icon buttons below the message with 16px gap, tertiary color, and a minimum tap target of 44×44 points per button
7. WHILE an assistant message is streaming, THE Message_Flow SHALL hide action buttons for that message until streaming completes or is stopped
8. WHEN a user message is displayed, THE Message_Flow SHALL provide action buttons (copy, edit, delete) as a row of icon buttons below the message with 16px gap, tertiary color, and a minimum tap target of 44×44 points per button

### Requirement 2: Code Block Rendering

**User Story:** As a user, I want code blocks styled with a fixed dark background and accent-hue syntax highlighting, so that code is readable regardless of the app's theme mode.

#### Acceptance Criteria

1. THE Code_Panel SHALL render with a fixed dark background, rounded corners, and a subtle inset border visible against both light and dark app themes
2. THE Code_Panel SHALL display a header row with the detected language label in a monospace font on the left and a copy button on the right, separated by a subtle bottom divider
3. IF the code block does not specify a language or the language is unrecognized, THEN THE Code_Panel SHALL hide the language label and render all code text in the default plain-text style without syntax highlighting
4. THE Code_Panel SHALL apply single-hue syntax highlighting derived from the app accent color, differentiating at minimum four token categories: keywords, strings, types, and comments, each at a distinct opacity or mix level from the base text color
5. THE Code_Panel SHALL render code text in a monospace font that respects the system accessibility text-size category, with line height proportional to the font size, at reduced opacity relative to full white
6. THE Code_Panel SHALL support horizontal scrolling for lines exceeding the panel width without wrapping or truncating code content
7. WHEN the copy button is tapped, THE Code_Panel SHALL copy the raw plain-text code content (excluding the header and language label) to the system clipboard and display a confirmation indicator for 2 seconds
8. WHILE the app appearance is set to light mode or dark mode, THE Code_Panel SHALL maintain the same fixed dark background color, ensuring code readability is independent of the app theme

### Requirement 3: Inline Markdown Elements

**User Story:** As a user, I want inline code spans styled consistently within message text, so that inline references are visually distinct without breaking text flow.

#### Acceptance Criteria

1. WHEN assistant message content contains text enclosed in single backticks, THE Message_Flow SHALL render those spans with a monospace font, a visually distinct background fill, padding that separates the code text from the background edges, and rounded corners
2. THE Message_Flow SHALL wrap inline code spans with the surrounding body text such that no horizontal overflow or clipping occurs, and line breaks may occur before or after an inline code span but never within the span if the span fits on a single line
3. IF an inline code span exceeds the available line width, THEN THE Message_Flow SHALL allow the span to break across lines rather than causing horizontal scroll or truncation
4. WHEN multiple inline code spans appear adjacent to each other or inline code appears within list items, THE Message_Flow SHALL maintain consistent spacing and styling for each span without merging or collision

### Requirement 4: Streaming State Display

**User Story:** As a user, I want visual feedback during response generation including a blinking cursor and token rate, so that I know the model is actively generating.

#### Acceptance Criteria

1. WHILE the model is generating output, THE Chat_Screen SHALL display a blinking cursor (vertical bar in accent color with a repeating on/off animation) positioned immediately after the last streamed character
2. WHILE the model is generating output, THE Chat_Screen SHALL display the streaming token rate as tokens per second, calculated as a rolling average over the most recent 2-second window, updated every 500 milliseconds, and positioned on the model name row
3. WHILE the model is generating, THE Input_Chrome SHALL display an animated equalizer indicator in accent color to signal active generation
4. WHILE the model is in the thinking phase (from receipt of the first thinking-content event until receipt of the first output-content event), THE Chat_Screen SHALL display a blinking "Thinking" label with a chevron control that toggles visibility of the reasoning content
5. WHEN the user taps the thinking chevron control, THE Chat_Screen SHALL toggle the reasoning content block between collapsed (hidden) and expanded (visible with scrollable content and a left accent-colored border), retaining the toggle state for the duration of the session
6. WHEN generation completes or the user stops generation, THE Chat_Screen SHALL remove the blinking cursor, hide the token rate counter, and stop the equalizer animation within 300 milliseconds
7. IF the model's response includes no reasoning content, THEN THE Chat_Screen SHALL omit the "Thinking" label and chevron control entirely for that response
8. WHILE the model is generating and the token rate drops to 0 tokens per second for more than 3 seconds, THE Chat_Screen SHALL continue displaying the blinking cursor and equalizer animation but display "stalled" in place of the numeric token rate

### Requirement 5: Navigation Chrome

**User Story:** As a user, I want a translucent top bar with quick access to the sidebar, session title, and settings, so that navigation controls are always accessible without covering content.

#### Acceptance Criteria

1. THE Navigation_Chrome SHALL render with a translucent material background (system ultra-thin material or equivalent vibrancy blur) that allows underlying content to remain partially visible
2. THE Navigation_Chrome SHALL contain a sidebar toggle button on the leading edge, the current session title (subheadline weight semibold, truncated to a single line with trailing ellipsis when exceeding the available width) in the center, and a settings button on the trailing edge, where each interactive element provides a minimum tap target of 44×44 points
3. THE Navigation_Chrome SHALL be pinned to the top of the screen, spanning the full width, positioned below the device safe area insets, and rendered above scrollable chat content
4. THE Navigation_Chrome SHALL display a hairline (0.5 point) bottom border using the system separator color
5. WHEN the user taps the sidebar toggle button, THE Navigation_Chrome SHALL trigger the session list to appear
6. WHEN the user taps the settings button, THE Navigation_Chrome SHALL present the settings screen
7. THE Navigation_Chrome SHALL provide VoiceOver accessibility labels for the sidebar toggle button, the session title, and the settings button

### Requirement 6: Input Chrome

**User Story:** As a user, I want the bottom input area to show the active model, thinking level, context usage, and compose controls, so that key information and actions are within thumb reach.

#### Acceptance Criteria

1. THE Input_Chrome SHALL render as a bottom-anchored bar with a translucent blurred background material, a hairline top separator, and fixed positioning above the keyboard when the keyboard is visible
2. THE Input_Chrome SHALL display a model switcher chip showing the active model's display name and a disclosure chevron indicator
3. WHEN the user taps the model switcher chip, THE Input_Chrome SHALL present the model selection interface allowing the user to switch the active model without navigating to settings
4. THE Thinking_Level_Selector SHALL render as a row of 5 bars with increasing heights, where filled bars represent the current thinking level intensity and unfilled bars use a muted foreground color
5. WHEN the user taps the Thinking_Level_Selector, THE Input_Chrome SHALL cycle forward through the 6 levels in order (Off → Minimal → Low → Medium → High → XHigh → Off) and persist the selected level to the current session
6. IF the active model does not support reasoning, THEN THE Input_Chrome SHALL hide the Thinking_Level_Selector
7. THE Context_Ring SHALL render as a circular progress indicator displaying the current session's token usage as a percentage of the active model's context window size, using an accent color below 50% usage, an orange color at 50–74% usage, and a red color at 75%+ usage
8. WHEN the session's context usage first crosses the 50% or 75% threshold within a session, THE Context_Ring SHALL play a brief scale animation and display a toast notification for 3 seconds indicating the current usage percentage — firing at most once per threshold per session
9. THE Input_Chrome SHALL display a multiline text input field with a tertiary fill background that auto-expands vertically with content up to a maximum height of 120 points, after which the content scrolls internally
10. THE Input_Chrome SHALL display a circular send button that shows an up-arrow icon when the text field contains at least one non-whitespace character, and shows a square stop icon while response generation is active
11. WHEN the text field contains at least one non-whitespace character or generation is active, THE send button SHALL use an accent-colored background with a white foreground icon; otherwise THE send button SHALL use a secondary fill background with a muted foreground icon
12. THE Input_Chrome SHALL provide VoiceOver accessibility labels for the model switcher chip (announcing the active model name), the Thinking_Level_Selector (announcing the current level name), and the Context_Ring (announcing usage as a percentage value)

### Requirement 7: Session Sidebar

**User Story:** As a user, I want a session list that slides in with an expressive page-turn animation and supports gesture-based management, so that switching between conversations feels fluid and native.

#### Acceptance Criteria

1. WHEN the user drags from the left 24px edge zone, THE Sidebar SHALL reveal with progress mapped 0→1 over 240px of horizontal drag distance, snapping fully open if released at progress ≥ 0.4 or snapping closed if released below 0.4, animated with a spring timing curve
2. WHEN the user taps the sidebar toggle button, THE Sidebar SHALL open or close with the Page_Turn_Transition animation
3. THE Page_Turn_Transition SHALL rotate the chat layer on the Y axis to -76deg with translateX(88%) while applying a box-shadow of (-38px 0 70px rgba(0,0,0,0.35)) and 20px border-radius to the chat layer
4. THE Page_Turn_Transition SHALL slide the sidebar from translateX(-42px) scale(0.94) opacity(0.3) to translateX(0) scale(1) opacity(1)
5. THE Page_Turn_Transition SHALL use a 0.5s cubic-bezier(0.32, 0.72, 0, 1) easing curve for non-drag transitions
6. THE Sidebar SHALL group sessions by time period ("Today", "Yesterday", "This Week", "This Month", "Older") with 11px uppercase section headers in tertiary text, and SHALL display an empty-state message indicating no sessions exist when the session list is empty
7. THE Sidebar SHALL highlight the active session with a 12% accent color tint background and accent-colored text at font-weight-600
8. WHEN the user swipes a session row left beyond 40px, THE Sidebar SHALL reveal a red delete button (72px wide, sys-red background); WHEN the user taps the delete button, THE Sidebar SHALL immediately delete the session without a confirmation dialog and animate the row out
9. WHEN the user long-presses a session row for 550ms, THE Sidebar SHALL open the Rename_Dialog pre-filled with the current session title, containing a single-line text field (maximum 100 characters), a Cancel button that dismisses without changes, and a Save button that persists the new title
10. THE Sidebar SHALL display a "New Chat" button as a 34px circle button with tertiary fill background and accent-colored compose icon in the top-right header area; WHEN the user taps the New Chat button, THE Sidebar SHALL create a new empty session, set it as active, and close the sidebar
11. WHEN the user taps the dimmed chat area while the sidebar is open, THE Sidebar SHALL close
12. WHILE the Sidebar is open, THE app SHALL display a semi-transparent overlay (opacity 0.3, black) over the chat area to indicate it is inactive

### Requirement 8: Model Picker Overlay

**User Story:** As a user, I want a quick model switcher dropdown above the input area, so that I can switch models without navigating to settings.

#### Acceptance Criteria

1. WHEN the user taps the model switcher chip, THE Model_Picker SHALL appear as a dropdown overlay anchored above the input area with a fade-up animation (0.28s cubic-bezier(0.32,0.72,0,1))
2. THE Model_Picker SHALL display models grouped by provider, with each group headed by an uppercase section header showing the provider display name
3. THE Model_Picker SHALL show each model row with its name, context window size, and per-token pricing; IF a model has no pricing data configured, THEN THE Model_Picker SHALL omit the pricing field from that row
4. THE Model_Picker SHALL indicate the currently active model with a checkmark icon in accent color
5. THE Model_Picker SHALL render with card surface background, 14px border-radius, and a drop shadow
6. WHEN the user taps outside the picker, THE Model_Picker SHALL dismiss with a fade transition without changing the active model
7. WHEN the user selects a model from the picker, THE Model_Picker SHALL dismiss, set the selected model as the active model for the current session, and update the model switcher chip label to reflect the newly selected model
8. IF no models are configured across any provider, THEN THE Model_Picker SHALL display an empty state message directing the user to add a provider and model in settings
9. IF the list of models exceeds the available overlay height (maximum 5 visible rows), THEN THE Model_Picker SHALL enable vertical scrolling within the overlay while keeping the overlay anchored to the input area

### Requirement 9: Settings Screen

**User Story:** As a user, I want a settings screen that slides in from the right with provider cards, prompt management, and generation parameters, so that I can configure the app without leaving the chat context.

#### Acceptance Criteria

1. WHEN the user taps the settings gear button, THE Settings_Screen SHALL slide in from the right edge with a 0.4-second ease-out transition, overlaying the chat screen
2. WHEN the user taps the "Chat" back button or swipes right from the left edge of the Settings_Screen, THE Settings_Screen SHALL dismiss with a reverse slide animation back to the right edge within 0.4 seconds
3. THE Settings_Screen SHALL display a navigation header containing a back button labeled "Chat" with a left chevron in the app accent color, and a centered "Settings" title
4. THE Settings_Screen SHALL display one provider card per configured provider showing: a 34×34pt initial icon with rounded corners, provider name, model count label (e.g. "3 models"), API type label (e.g. "Responses API"), and the API key masked as "••••" followed by the last 4 characters in monospace font
5. WHEN the user taps a provider card, THE Settings_Screen SHALL navigate to the provider detail/edit screen for that provider
6. THE Settings_Screen SHALL display a system prompts section showing each saved prompt with: prompt name, a single-line snippet preview truncated with ellipsis after 60 characters, an edit button, and a checkmark indicator on the prompt currently set as default
7. WHEN the user taps "Add Prompt" in the system prompts section, THE Settings_Screen SHALL navigate to the prompt creation screen
8. THE Settings_Screen SHALL display generation parameters (Temperature and Max Tokens) each as a tappable row with the parameter label on the left and the current value on the right, allowing the user to adjust Temperature in the range 0.0–2.0 and Max Tokens as a positive integer up to the active model's context window size
9. IF no providers are configured, THEN THE Settings_Screen SHALL show a centered empty state with "No providers configured" text and an "Add Provider" button in the app accent color that navigates to the provider creation flow
10. THE Settings_Screen SHALL use a grouped inset list layout with a system-grouped background and a translucent blur material header that remains fixed at the top during scrolling

### Requirement 10: Provider Detail Screen

**User Story:** As a user, I want to view and manage a provider's API key, configuration, and models in a dedicated detail view.

#### Acceptance Criteria

1. WHEN the user taps a provider card, THE Provider_Detail_Screen SHALL slide in from the right over the settings screen with a 0.4s cubic-bezier(0.32,0.72,0,1) transition
2. THE Provider_Detail_Screen SHALL display the API key section with the key masked as bullet characters showing only the last 4 characters by default (monospace 13.5px), an eye toggle button to reveal the full key while pressed, and a note "Stored in the iOS Keychain. Never synced to iCloud." (12px tertiary)
3. THE Provider_Detail_Screen SHALL display a configuration section with Base URL (editable text field, maximum 2048 characters), a Streaming toggle switch, and for OpenAI-type providers only an API type selector showing Chat Completions or Responses
4. THE Provider_Detail_Screen SHALL display a models list showing each model's name (15px), context window size in tokens and per-token input/output prices (12px tertiary), and an "Add Model" action in accent color at the bottom of the list
5. THE Provider_Detail_Screen SHALL display a back button labeled "Settings" with a left chevron in accent color
6. IF the provider has zero models, THEN THE Provider_Detail_Screen SHALL display the "Add Model" action as the sole item in the models section
7. WHEN the user swipes left on a model row, THE Provider_Detail_Screen SHALL reveal a delete action that removes the model from the provider upon confirmation

### Requirement 11: Rename Dialog

**User Story:** As a user, I want a clean modal dialog for renaming sessions, so that renaming feels deliberate and focused.

#### Acceptance Criteria

1. WHEN the Rename_Dialog opens, THE Rename_Dialog SHALL display a centered card (280pt wide, 14pt radius, card surface background) over a 32% opacity black scrim with the text input pre-populated with the current session title and the keyboard presented with the cursor positioned at the end of the text
2. THE Rename_Dialog SHALL contain a "Rename Chat" title (16pt weight-600, centered), a text input (full-width, tertiary fill background, 8pt radius, 15pt font, maximum 100 characters), and Cancel/Save buttons
3. THE Rename_Dialog SHALL animate in with a fade-up animation (0.25s cubic-bezier(0.32,0.72,0,1))
4. WHEN the user taps Cancel or the scrim, THE Rename_Dialog SHALL dismiss without saving and preserve the original session title
5. WHEN the user taps Save and the text input contains at least one non-whitespace character, THE Rename_Dialog SHALL update the session title to the trimmed input value and dismiss
6. IF the text input is empty or contains only whitespace, THEN THE Rename_Dialog SHALL disable the Save button and prevent dismissal via Save

### Requirement 12: Toast Notifications

**User Story:** As a user, I want brief non-intrusive feedback for actions like copy and delete, so that I know my action succeeded without blocking workflow.

#### Acceptance Criteria

1. THE Toast_System SHALL render as a bottom-positioned floating pill (centered horizontally, 170pt from the bottom safe area edge) with a translucent dark background, white text at the caption2 Dynamic Type size, 8pt vertical and 15pt horizontal padding, and a fully rounded (capsule) border-radius
2. WHEN a toast-triggering action occurs (message copied, code block copied, or session deleted), THE Toast_System SHALL animate in with a vertical slide-up of 10pt combined with a fade from 0 to full opacity over 0.25 seconds using an ease-out curve
3. WHEN a toast is visible and its display duration of 1.8 seconds elapses (measured from full appearance), THE Toast_System SHALL auto-dismiss with a fade-out animation over 0.2 seconds
4. THE Toast_System SHALL not intercept touch events, allowing the user to interact with content beneath the toast
5. IF a new toast is triggered while an existing toast is displayed, THEN THE Toast_System SHALL immediately replace the current toast content and restart the 1.8-second dismiss timer
6. THE Toast_System SHALL announce the toast message to VoiceOver as a non-interrupting accessibility notification so that assistive technology users receive equivalent feedback
7. THE Toast_System SHALL display a single line of text with a maximum length of 50 characters, truncating with an ellipsis if exceeded

### Requirement 13: Theme and Design Tokens

**User Story:** As a user, I want the app to follow precise design tokens matching the prototype, so that the visual output is consistent between light and dark modes.

#### Acceptance Criteria

1. THE App SHALL use accent color #5856D6 for interactive controls, links, and active-state indicators in light mode, and #5E5CE6 for the same elements in dark mode
2. THE App SHALL use the iOS system font (SF Pro) for all UI text and SF Mono for code blocks and metadata labels, scaled according to Dynamic Type size categories
3. THE App SHALL apply the animation curve cubic-bezier(0.32, 0.72, 0, 1) with a duration of 350ms for sidebar reveal, settings sheet, model picker, and dialog transitions
4. THE App SHALL use consistent corner radius values measured in points: pill shapes (9999pt), cards (12pt), inputs (17pt), code blocks (10pt)
5. THE App SHALL render 0.5pt separators using the system separator color (opaque gray in light mode, opaque gray adapted for dark backgrounds in dark mode) between list rows and section boundaries
6. THE App SHALL apply a background material effect combining saturation increase of 180% and Gaussian blur of 20pt to the navigation bar area and the message input bar area
7. WHEN the system appearance changes at runtime, THE App SHALL update all color tokens and material effects to the corresponding light or dark values without requiring a restart

### Requirement 14: Gesture Interactions

**User Story:** As a user, I want native-feeling gesture interactions for sidebar reveal and session management, so that the app feels responsive and platform-appropriate.

#### Acceptance Criteria

1. WHEN the user initiates a right-swipe gesture originating within 24pt of the left screen edge, THE Sidebar SHALL begin revealing in sync with the gesture position, capturing the pointer so no other gesture recognizer acts on that touch
2. WHEN the user performs a left-swipe on a Sidebar session row exceeding 40pt horizontal displacement, THE Sidebar session row SHALL reveal a destructive-styled delete action button by translating the row content leftward to expose it
3. WHEN the user long-presses a Sidebar session row for 550ms or more, THE Sidebar session row SHALL provide a haptic feedback tap at recognition and present the rename text field for that session
4. WHILE a sidebar-reveal drag gesture is active, THE Page_Turn_Transition SHALL update its visual position on every frame (within 16ms of gesture input) with no CSS/animation transition delay applied
5. WHEN a sidebar-reveal drag gesture ends with progress below 22% of full reveal distance, THE Sidebar SHALL animate closed using a spring animation with duration no greater than 400ms
6. WHEN a sidebar-reveal drag gesture ends with progress at or above 22% of full reveal distance, THE Sidebar SHALL animate open using a spring animation with duration no greater than 400ms
7. WHEN the user presses the Enter key (without Shift held) while the Input_Chrome text area contains at least 1 non-whitespace character, THE Input_Chrome SHALL trigger the send action
8. IF the user presses Enter (without Shift) while the Input_Chrome text area is empty or contains only whitespace, THEN THE Input_Chrome SHALL not trigger the send action and SHALL remain focused
9. THE App SHALL provide VoiceOver-accessible alternatives for all gesture-based actions: a button or menu item for sidebar reveal, swipe actions exposed as accessibility custom actions on session rows, and a context menu alternative for long-press rename

### Requirement 15: Send and Stop Button States

**User Story:** As a user, I want the send button to clearly communicate whether I can send a message or stop generation, so that the available action is always obvious.

#### Acceptance Criteria

1. WHILE the text input contains only whitespace or is empty and no generation is active, THE send button SHALL display a non-interactive up-arrow icon with fill-secondary background that does not respond to taps
2. WHILE the text input contains at least one non-whitespace character and no generation is active, THE send button SHALL display an up-arrow icon with accent background and white foreground
3. WHILE generation is active, THE send button SHALL display a square stop icon with accent background and white foreground regardless of input text content
4. WHEN the user taps the send button while at least one non-whitespace character is present in the input, THE Chat_Screen SHALL send the message and clear the input field within 100ms of the tap
5. WHEN the user taps the stop button during generation, THE Chat_Screen SHALL cancel the in-flight request, discard the partial response from the message list, and display a toast indicating generation was stopped for 3 seconds
6. WHEN the generation completes or is stopped, THE send button SHALL transition back to the state determined by the current text input content within 200ms
