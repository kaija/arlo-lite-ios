/**
 * useScrollBehavior — encapsulates scroll-to-bottom decision logic and FAB visibility.
 *
 * Provides a pure `isNearBottom` function for threshold detection and a
 * `useScrollBehavior` hook that wires FlatList scroll events to auto-scroll
 * and floating action button visibility state.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, LayoutChangeEvent } from 'react-native';

/** Distance (in points) from the bottom considered "near bottom" */
const NEAR_BOTTOM_THRESHOLD = 100;

export interface ScrollBehavior {
  /** Ref to attach to the message FlatList */
  flatListRef: React.RefObject<FlatList>;
  /** Whether the scroll-to-bottom FAB should be visible */
  showFAB: boolean;
  /** Callback for FlatList onScroll */
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Callback for FlatList onContentSizeChange */
  onContentSizeChange: (w: number, h: number) => void;
  /** Callback for FlatList onLayout */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Scroll to bottom programmatically (for FAB tap) */
  scrollToBottom: () => void;
  /** Notify that a new message was sent (forces scroll to bottom) */
  onMessageSent: () => void;
}

/**
 * Determines whether the scroll position is near the bottom of the content.
 *
 * Returns `true` when the distance from the current viewport bottom edge to
 * the content bottom is within `threshold` points. Used to decide whether
 * auto-scroll should fire and whether the FAB should be hidden.
 *
 * @param contentHeight - Total height of the scrollable content
 * @param scrollOffset - Current vertical scroll offset (contentOffset.y)
 * @param layoutHeight - Height of the visible viewport
 * @param threshold - Maximum distance from bottom to be considered "near" (default 100)
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

/**
 * Hook providing scroll behavior management for a chat FlatList.
 *
 * Returns refs, state, and callbacks to wire into FlatList for:
 * - Auto-scrolling to bottom when near bottom and new content arrives
 * - Showing/hiding a scroll-to-bottom FAB when scrolled away
 * - Programmatic scroll-to-bottom on FAB press
 * - Force scroll on message sent
 *
 * @param messageCount - The current number of messages, used to trigger scroll on new messages
 */
export function useScrollBehavior(messageCount: number = 0): ScrollBehavior {
  const flatListRef = useRef<FlatList>(null);
  const [showFAB, setShowFAB] = useState(false);

  const contentHeightRef = useRef(0);
  const layoutHeightRef = useRef(0);
  const isNearBottomRef = useRef(true);
  const shouldForceScrollRef = useRef(false);

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
    const prevHeight = contentHeightRef.current;
    contentHeightRef.current = h;

    // Auto-scroll if user was near bottom or we're forcing (message just sent)
    if ((isNearBottomRef.current || shouldForceScrollRef.current) && flatListRef.current && h > prevHeight) {
      shouldForceScrollRef.current = false;
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 50);
    }
  }, []);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    layoutHeightRef.current = event.nativeEvent.layout.height;
  }, []);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
    setShowFAB(false);
  }, []);

  const onMessageSent = useCallback(() => {
    shouldForceScrollRef.current = true;
    isNearBottomRef.current = true;
  }, []);

  // Scroll to bottom when message count increases (new messages arrive)
  const prevMessageCountRef = useRef(messageCount);
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current) {
      // New message added — scroll to bottom if near bottom or if user just sent
      if (isNearBottomRef.current || shouldForceScrollRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
        shouldForceScrollRef.current = false;
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount]);

  return {
    flatListRef,
    showFAB,
    onScroll,
    onContentSizeChange,
    onLayout,
    scrollToBottom,
    onMessageSent,
  };
}
