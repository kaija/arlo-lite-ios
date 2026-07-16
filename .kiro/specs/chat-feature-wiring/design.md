# Design Document: Chat Feature Wiring

## Overview

This design covers wiring three existing but disconnected features into the chat experience: single-message deletion, auto-session creation on empty state, and scroll-to-bottom refinement. The data layer primitives already exist — this work connects them to the store layer and composition shell.

## Architecture

All three features follow the same layered pattern already established in the app:

```
UI Component → Store Action → Database Repository
```

No new stores, services, or providers are introduced. The changes are:

1. **session-store.ts** — Add `deleteMessage` action
2. **useChat.ts** — Add auto-session-creation guard before send
3. **_layout.tsx** — Add auto-session-creation in bootstrap sequence
4. **ChatShell.tsx** — Wire deletion confirmation dialog, replace setTimeout scroll, mount ScrollFAB
5. **useScrollBehavior.ts** (new) — Encapsulate scroll threshold logic
6. **ScrollFAB.tsx** (new) — Floating action button component

## Components

### 1. Session Store: `deleteMessage` Action

**File:** `src/stores/session-store.ts`

Add a new action to the existing `SessionStore` interface:

```typescript
/** Delete a single message from a session */
deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
```

**Implementation:**

```typescript
deleteMessage: async (sessionId: string, messageId: string) => {
  const { db } = get();
  if (!db) {
    throw new Error('Database not initialized. Call setDatabase first.');
  }

  await deleteMessageFromDb(db, messageId);

  set((state) => ({
    messages: {
      ...state.messages,
      [sessionId]: (state.messages[sessionId] ?? []).filter(
        (m) => m.id !== messageId
      ),
    },
  }));
},
```

Imports the existing `deleteMessage` from `message-repo.ts` (aliased to `deleteMessageFromDb` to avoid naming conflict with the store action).

### 2. Auto-Session Creation

Two trigger points share the same creation logic:

#### 2a. Bootstrap (`_layout.tsx`)

After `loadSessions()` completes, check if sessions are empty and a provider+model are configured. If so, create a session and set it active.

```typescript
// After all store hydration completes:
const sessions = useSessionStore.getState().sessions;
const providers = useProviderStore.getState().providers;
const models = useProviderStore.getState().models;

if (sessions.length === 0 && providers.length > 0 && models.length > 0) {
  const defaultProvider = providers[0];
  const defaultModel = models.find((m) => m.providerId === defaultProvider.id);
  if (defaultModel) {
    const sessionId = await useSessionStore.getState().createSession(
      defaultProvider.id,
      defaultModel.modelId
    );
    await useSessionStore.getState().setActiveSession(sessionId);
  }
}
```

#### 2b. Send Guard (`useChat.ts`)

Replace the early-return `if (!activeSessionId) return` with auto-creation logic:

```typescript
let sessionId = activeSessionId;

if (!sessionId) {
  if (!activeProviderId || !activeModelId) {
    errorRef.current = {
      message: 'No provider configured',
      detail: 'Please configure a provider and model in settings.',
      isRetryable: false,
    };
    return;
  }
  sessionId = await useSessionStore.getState().createSession(
    activeProviderId,
    activeModelId
  );
  await useSessionStore.getState().setActiveSession(sessionId);
}
```

The `useChatStore` also needs to initialize `activeProviderId`/`activeModelId` from the first available provider if not already set — this is handled by reading from provider-store during bootstrap.

### 3. Scroll Behavior

#### 3a. `useScrollBehavior` Hook

**File:** `src/hooks/useScrollBehavior.ts`

Encapsulates the scroll-to-bottom decision logic and FAB visibility state.

```typescript
import { useCallback, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';

const NEAR_BOTTOM_THRESHOLD = 100;

export interface ScrollBehavior {
  /** Ref to attach to FlatList */
  flatListRef: React.RefObject<FlatList>;
  /** Whether the FAB should be visible */
  showFAB: boolean;
  /** Callback for FlatList onScroll */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Callback for FlatList onContentSizeChange */
  onContentSizeChange: (w: number, h: number) => void;
  /** Callback for FlatList onLayout */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Scroll to bottom programmatically (for FAB tap) */
  scrollToBottom: () => void;
}

/**
 * Determines whether auto-scroll should fire based on distance from bottom.
 * Exported for testability.
 */
export function isNearBottom(
  contentHeight: number,
  scrollOffset: number,
  layoutHeight: number,
  threshold: number = NEAR_BOTTOM_THRESHOLD
): boolean {
  const distanceFromBottom = contentHeight - scrollOffset - layoutHeight;
  return distanceFromBottom <= threshold;
}

export function useScrollBehavior(): ScrollBehavior {
  const flatListRef = useRef<FlatList>(null);
  const [showFAB, setShowFAB] = useState(false);

  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const nearBottom = isNearBottom(
        contentSize.height,
        contentOffset.y,
        layoutMeasurement.height
      );
      isNearBottomRef.current = nearBottom;
      setShowFAB(!nearBottom);
    },
    []
  );

  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentHeightRef.current = h;
    // Auto-scroll only if user was already near bottom
    if (isNearBottomRef.current && flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    layoutHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowFAB(false);
  }, []);

  return {
    flatListRef,
    showFAB,
    onScroll,
    onContentSizeChange,
    onLayout,
    scrollToBottom,
  };
}
```

The key export for testing is `isNearBottom` — a pure function that encapsulates the threshold decision.

#### 3b. `ScrollFAB` Component

**File:** `src/components/chat/ScrollFAB.tsx`

A simple animated floating button positioned above the input chrome:

```typescript
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

export interface ScrollFABProps {
  visible: boolean;
  onPress: () => void;
}

export function ScrollFAB({ visible, onPress }: ScrollFABProps) {
  const { colors } = useTheme();

  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      <Pressable
        onPress={onPress}
        style={[styles.button, { backgroundColor: colors.surfaceElevated }]}
        accessibilityLabel="Scroll to bottom"
        accessibilityRole="button"
      >
        <Ionicons name="chevron-down" size={20} color={colors.text} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 80, // above InputChrome
    zIndex: 5,
  },
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
```

### 4. ChatShell Integration

**Deletion confirmation dialog:**

Add a state pair for the pending-delete message ID. When the `onDelete` callback fires from `MessageFlow`, set the pending ID and show an `Alert.alert` (React Native's built-in confirmation):

```typescript
import { Alert } from 'react-native';

const handleDeleteMessage = useCallback(
  (messageId: string) => {
    Alert.alert(
      t('chat.deleteMessage', 'Delete Message'),
      t('chat.deleteMessageConfirm', 'Are you sure you want to delete this message?'),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        {
          text: t('common.delete', 'Delete'),
          style: 'destructive',
          onPress: () => {
            if (activeSessionId) {
              deleteMessageAction(activeSessionId, messageId);
            }
          },
        },
      ]
    );
  },
  [activeSessionId, deleteMessageAction, t]
);
```

**Scroll integration:**

Replace the existing `flatListRef` + `useEffect` setTimeout pattern with `useScrollBehavior()`:

```typescript
const {
  flatListRef,
  showFAB,
  onScroll,
  onContentSizeChange,
  onLayout,
  scrollToBottom,
} = useScrollBehavior();
```

Wire these to the FlatList:

```typescript
<FlatList
  ref={flatListRef}
  onScroll={onScroll}
  onContentSizeChange={onContentSizeChange}
  onLayout={onLayout}
  scrollEventThrottle={16}
  // ... existing props
/>
```

Mount `ScrollFAB` inside the chat layer, positioned above the input:

```typescript
<ScrollFAB visible={showFAB} onPress={scrollToBottom} />
```

## Data Models

No new database tables or schema changes. The existing `messages` table and `Message` interface are sufficient. The only change is exposing the already-implemented `deleteMessage(db, id)` through the store layer.

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Delete fails (DB error) | Error propagates, message remains in UI; user can retry |
| Auto-create with no provider | Inline error message shown: "Configure a provider in settings" |
| Auto-create DB failure | Bootstrap error screen displayed (existing pattern) |
| Scroll FAB tap during stream | Scrolls to current bottom; stream continues appending |

## Interfaces

### Modified Interfaces

**SessionStore** (addition):
```typescript
deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
```

**useChat sendMessage** (behavior change):
```typescript
// Before: returns early if !activeSessionId
// After: auto-creates session if !activeSessionId but provider/model available
sendMessage: (text: string, attachments?: ContentPart[]) => Promise<void>;
```

### New Interfaces

```typescript
// useScrollBehavior.ts
export function isNearBottom(
  contentHeight: number,
  scrollOffset: number,
  layoutHeight: number,
  threshold?: number
): boolean;

export function useScrollBehavior(): ScrollBehavior;

// ScrollFAB.tsx
export interface ScrollFABProps {
  visible: boolean;
  onPress: () => void;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Message deletion removes exactly one message

*For any* session with N messages (N > 0) and any valid message ID within that session, calling `deleteMessage(sessionId, messageId)` SHALL result in the messages array having length N-1 and NOT containing any message with the deleted ID, while all other messages remain unchanged.

**Validates: Requirements 1.1, 1.3**

### Property 2: Auto-create session on empty bootstrap

*For any* valid provider configuration and model configuration, when the sessions list is empty after bootstrap, the store SHALL contain exactly one session with the given provider and model, and `activeSessionId` SHALL equal that session's ID.

**Validates: Requirements 2.1, 2.2**

### Property 3: Auto-create session on send with no active session

*For any* non-empty message text and valid provider/model configuration, when `activeSessionId` is null, calling `sendMessage(text)` SHALL result in a new session being created, set as active, and the user message appearing in that session's messages.

**Validates: Requirements 2.3, 2.4**

### Property 4: Scroll threshold determines auto-scroll and FAB visibility

*For any* `(contentHeight, scrollOffset, layoutHeight)` tuple where all values are non-negative and `contentHeight >= scrollOffset + layoutHeight`, `isNearBottom` SHALL return `true` if and only if `contentHeight - scrollOffset - layoutHeight <= 100`. When `isNearBottom` is true, the FAB SHALL be hidden; when false, the FAB SHALL be visible.

**Validates: Requirements 3.1, 3.2, 3.3, 3.5**
