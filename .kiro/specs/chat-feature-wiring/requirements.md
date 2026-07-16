# Requirements Document

## Introduction

This specification covers wiring up three incomplete chat features in Arlo Lite: single-message deletion, auto-session creation on empty state, and scroll-to-bottom refinement. All underlying data layer functions and UI components exist — this work connects them to the store layer and composition shell so they function end-to-end.

## Glossary

- **Chat_Shell**: The top-level composition component (`ChatShell.tsx`) that orchestrates the chat screen layout, renders the FlatList of messages, and delegates to InputChrome and SessionSidebar.
- **Session_Store**: The Zustand store (`session-store.ts`) managing sessions, messages, and persistence via expo-sqlite.
- **Message_Repo**: The database repository (`message-repo.ts`) providing CRUD operations for messages including the existing `deleteMessage(db, id)` function.
- **Message_Flow**: The per-message rendered component (`MessageFlow.tsx`) displaying message content and action buttons including copy, edit, regenerate, and delete.
- **Scroll_FAB**: A floating action button overlaid on the message FlatList that jumps the list to the newest message when tapped.
- **Bootstrap**: The initialization sequence in `_layout.tsx` that opens the database, hydrates stores, and loads sessions before presenting the chat screen.
- **Active_Session**: The currently selected session tracked by `activeSessionId` in Session_Store, determining which messages are displayed.

## Requirements

### Requirement 1: Delete Single Message

**User Story:** As a user, I want to delete a specific message from a conversation so that I can remove unwanted content.

#### Acceptance Criteria

1. THE Session_Store SHALL expose a `deleteMessage` action that accepts a session ID and message ID and removes the specified message from both the database and the in-memory messages array.
2. WHEN the user triggers the delete action on a message in Message_Flow, THE Chat_Shell SHALL present a confirmation dialog with cancel and delete options before proceeding.
3. WHEN the user confirms the deletion in the dialog, THE Session_Store SHALL call Message_Repo `deleteMessage(db, id)` and remove the message from the session's in-memory messages array.
4. WHEN the user cancels the deletion confirmation, THE Chat_Shell SHALL dismiss the dialog and leave the message unchanged.
5. WHEN a message is successfully deleted, THE Chat_Shell SHALL re-render the FlatList without the deleted message with no additional user interaction required.

### Requirement 2: Auto-Create Session on Empty State

**User Story:** As a user, I want the app to automatically have a chat session ready so that I can start messaging immediately without manual setup.

#### Acceptance Criteria

1. WHEN Bootstrap completes and the sessions list is empty and a provider and model are configured, THE Session_Store SHALL automatically create a new session titled "New Chat" using the active provider and model.
2. WHEN a new session is auto-created during Bootstrap, THE Session_Store SHALL set the new session as the Active_Session.
3. WHEN the user attempts to send a message and no Active_Session exists, THE Chat_Shell SHALL create a new session using the active provider and model before sending the message.
4. WHEN a session is auto-created on first send, THE Chat_Shell SHALL proceed to send the message in the newly created session without requiring additional user interaction.
5. IF no provider or model is configured when a session auto-creation is needed, THEN THE Chat_Shell SHALL display an inline message prompting the user to configure a provider in settings.

### Requirement 3: Scroll-to-Bottom Refinement

**User Story:** As a user, I want the chat to smoothly auto-scroll during streaming and provide a jump-to-bottom button when I scroll up so that I never miss new messages.

#### Acceptance Criteria

1. WHILE the user is scrolled to within 100 points of the bottom of the message FlatList and new content arrives (new message or streaming update), THE Chat_Shell SHALL automatically scroll to the bottom using an `onContentSizeChange` callback.
2. WHILE the user has scrolled more than 100 points above the bottom, THE Chat_Shell SHALL NOT auto-scroll when new content arrives.
3. WHEN new content arrives while the user is scrolled more than 100 points above the bottom, THE Chat_Shell SHALL display a Scroll_FAB overlaid on the message FlatList.
4. WHEN the user taps the Scroll_FAB, THE Chat_Shell SHALL animate a scroll to the bottom and hide the Scroll_FAB.
5. WHEN the user manually scrolls to within 100 points of the bottom, THE Chat_Shell SHALL hide the Scroll_FAB.
6. THE Chat_Shell SHALL replace the current `setTimeout(100ms)` scroll approach with `onContentSizeChange` and `onScroll` callbacks on the FlatList to determine scroll position relative to the bottom.
