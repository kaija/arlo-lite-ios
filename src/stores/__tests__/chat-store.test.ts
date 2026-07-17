import { useChatStore } from '../chat-store';
import type { ThinkingLevel } from '../chat-store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetStore() {
  useChatStore.setState({
    isStreaming: false,
    streamContent: '',
    thinkingContent: '',
    activeProviderId: null,
    activeModelId: null,
    thinkingLevel: 'off',
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('chat-store', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('should have isStreaming false by default', () => {
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('should have empty streamContent by default', () => {
      expect(useChatStore.getState().streamContent).toBe('');
    });

    it('should have empty thinkingContent by default', () => {
      expect(useChatStore.getState().thinkingContent).toBe('');
    });

    it('should have null activeProviderId by default', () => {
      expect(useChatStore.getState().activeProviderId).toBeNull();
    });

    it('should have null activeModelId by default', () => {
      expect(useChatStore.getState().activeModelId).toBeNull();
    });

    it('should have thinkingLevel off by default', () => {
      expect(useChatStore.getState().thinkingLevel).toBe('off');
    });
  });

  describe('setStreaming', () => {
    it('should set streaming to true', () => {
      useChatStore.getState().setStreaming(true);
      expect(useChatStore.getState().isStreaming).toBe(true);
    });

    it('should set streaming to false', () => {
      useChatStore.getState().setStreaming(true);
      useChatStore.getState().setStreaming(false);
      expect(useChatStore.getState().isStreaming).toBe(false);
    });
  });

  describe('appendStreamContent', () => {
    it('should append text to empty stream content', () => {
      useChatStore.getState().appendStreamContent('Hello');
      expect(useChatStore.getState().streamContent).toBe('Hello');
    });

    it('should append text incrementally', () => {
      useChatStore.getState().appendStreamContent('Hello');
      useChatStore.getState().appendStreamContent(' world');
      expect(useChatStore.getState().streamContent).toBe('Hello world');
    });

    it('should handle empty string append', () => {
      useChatStore.getState().appendStreamContent('Hello');
      useChatStore.getState().appendStreamContent('');
      expect(useChatStore.getState().streamContent).toBe('Hello');
    });
  });

  describe('appendThinkingContent', () => {
    it('should append text to empty thinking content', () => {
      useChatStore.getState().appendThinkingContent('Thinking...');
      expect(useChatStore.getState().thinkingContent).toBe('Thinking...');
    });

    it('should append text incrementally', () => {
      useChatStore.getState().appendThinkingContent('Step 1.');
      useChatStore.getState().appendThinkingContent(' Step 2.');
      expect(useChatStore.getState().thinkingContent).toBe('Step 1. Step 2.');
    });
  });

  describe('flushStreamBuffer', () => {
    it('should append text and thinking content in a single call', () => {
      useChatStore.getState().flushStreamBuffer('Hello', 'Thinking...');
      expect(useChatStore.getState().streamContent).toBe('Hello');
      expect(useChatStore.getState().thinkingContent).toBe('Thinking...');
    });

    it('should update both streamContent and thinkingContent atomically in one set()', () => {
      // Subscribe and track how many state change notifications we receive
      const snapshots: Array<{ streamContent: string; thinkingContent: string }> = [];
      const unsub = useChatStore.subscribe((state) => {
        snapshots.push({
          streamContent: state.streamContent,
          thinkingContent: state.thinkingContent,
        });
      });

      useChatStore.getState().flushStreamBuffer('text chunk', 'thinking chunk');

      unsub();

      // Atomic: single notification with both fields updated together
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].streamContent).toBe('text chunk');
      expect(snapshots[0].thinkingContent).toBe('thinking chunk');
    });

    it('should not alter existing content when both deltas are empty strings', () => {
      // Set up existing content
      useChatStore.getState().flushStreamBuffer('existing text', 'existing thinking');

      // Flush with empty strings
      useChatStore.getState().flushStreamBuffer('', '');

      // Content remains unchanged
      expect(useChatStore.getState().streamContent).toBe('existing text');
      expect(useChatStore.getState().thinkingContent).toBe('existing thinking');
    });

    it('should not alter streamContent when textDelta is empty', () => {
      useChatStore.getState().flushStreamBuffer('preserved', '');
      useChatStore.getState().flushStreamBuffer('', 'new thinking');

      expect(useChatStore.getState().streamContent).toBe('preserved');
      expect(useChatStore.getState().thinkingContent).toBe('new thinking');
    });

    it('should not alter thinkingContent when thinkingDelta is empty', () => {
      useChatStore.getState().flushStreamBuffer('', 'preserved');
      useChatStore.getState().flushStreamBuffer('new text', '');

      expect(useChatStore.getState().streamContent).toBe('new text');
      expect(useChatStore.getState().thinkingContent).toBe('preserved');
    });

    it('should concatenate content correctly across multiple sequential flushes', () => {
      useChatStore.getState().flushStreamBuffer('Hello', 'Step 1.');
      useChatStore.getState().flushStreamBuffer(' world', ' Step 2.');
      useChatStore.getState().flushStreamBuffer('!', ' Done.');

      expect(useChatStore.getState().streamContent).toBe('Hello world!');
      expect(useChatStore.getState().thinkingContent).toBe('Step 1. Step 2. Done.');
    });

    it('should append incrementally across multiple flushes', () => {
      useChatStore.getState().flushStreamBuffer('Hello', 'Step 1.');
      useChatStore.getState().flushStreamBuffer(' world', ' Step 2.');
      expect(useChatStore.getState().streamContent).toBe('Hello world');
      expect(useChatStore.getState().thinkingContent).toBe('Step 1. Step 2.');
    });

    it('should handle empty text delta with non-empty thinking delta', () => {
      useChatStore.getState().flushStreamBuffer('', 'Only thinking');
      expect(useChatStore.getState().streamContent).toBe('');
      expect(useChatStore.getState().thinkingContent).toBe('Only thinking');
    });

    it('should handle non-empty text delta with empty thinking delta', () => {
      useChatStore.getState().flushStreamBuffer('Only text', '');
      expect(useChatStore.getState().streamContent).toBe('Only text');
      expect(useChatStore.getState().thinkingContent).toBe('');
    });

    it('should handle both deltas empty', () => {
      useChatStore.getState().flushStreamBuffer('Initial', 'Init think');
      useChatStore.getState().flushStreamBuffer('', '');
      expect(useChatStore.getState().streamContent).toBe('Initial');
      expect(useChatStore.getState().thinkingContent).toBe('Init think');
    });
  });

  describe('clearStream', () => {
    it('should reset streamContent to empty string', () => {
      useChatStore.getState().appendStreamContent('Some content');
      useChatStore.getState().clearStream();
      expect(useChatStore.getState().streamContent).toBe('');
    });

    it('should reset thinkingContent to empty string', () => {
      useChatStore.getState().appendThinkingContent('Some thinking');
      useChatStore.getState().clearStream();
      expect(useChatStore.getState().thinkingContent).toBe('');
    });

    it('should reset both streamContent and thinkingContent together', () => {
      useChatStore.getState().appendStreamContent('Response text');
      useChatStore.getState().appendThinkingContent('Reasoning text');
      useChatStore.getState().clearStream();
      expect(useChatStore.getState().streamContent).toBe('');
      expect(useChatStore.getState().thinkingContent).toBe('');
    });
  });

  describe('setThinkingLevel', () => {
    const levels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];

    it.each(levels)('should set thinking level to %s', (level) => {
      useChatStore.getState().setThinkingLevel(level);
      expect(useChatStore.getState().thinkingLevel).toBe(level);
    });

    it('should update from one level to another', () => {
      useChatStore.getState().setThinkingLevel('high');
      useChatStore.getState().setThinkingLevel('low');
      expect(useChatStore.getState().thinkingLevel).toBe('low');
    });
  });

  describe('switchModel', () => {
    it('should set activeProviderId and activeModelId', () => {
      useChatStore.getState().switchModel('provider-1', 'model-1');
      expect(useChatStore.getState().activeProviderId).toBe('provider-1');
      expect(useChatStore.getState().activeModelId).toBe('model-1');
    });

    it('should update when switching to a different model', () => {
      useChatStore.getState().switchModel('provider-1', 'model-1');
      useChatStore.getState().switchModel('provider-2', 'model-2');
      expect(useChatStore.getState().activeProviderId).toBe('provider-2');
      expect(useChatStore.getState().activeModelId).toBe('model-2');
    });

    it('should allow switching model within the same provider', () => {
      useChatStore.getState().switchModel('provider-1', 'model-a');
      useChatStore.getState().switchModel('provider-1', 'model-b');
      expect(useChatStore.getState().activeProviderId).toBe('provider-1');
      expect(useChatStore.getState().activeModelId).toBe('model-b');
    });
  });

  describe('state transitions', () => {
    it('should handle a full streaming lifecycle', () => {
      const store = useChatStore;

      // Switch to a model
      store.getState().switchModel('openai', 'gpt-4');
      store.getState().setThinkingLevel('medium');

      // Start streaming
      store.getState().setStreaming(true);
      expect(store.getState().isStreaming).toBe(true);

      // Receive thinking content
      store.getState().appendThinkingContent('Analyzing the question...');
      store.getState().appendThinkingContent(' Breaking it down.');
      expect(store.getState().thinkingContent).toBe('Analyzing the question... Breaking it down.');

      // Receive stream content
      store.getState().appendStreamContent('The answer');
      store.getState().appendStreamContent(' is 42.');
      expect(store.getState().streamContent).toBe('The answer is 42.');

      // End streaming
      store.getState().setStreaming(false);
      expect(store.getState().isStreaming).toBe(false);

      // Content is still available after streaming ends
      expect(store.getState().streamContent).toBe('The answer is 42.');
      expect(store.getState().thinkingContent).toBe('Analyzing the question... Breaking it down.');

      // Clear for next message
      store.getState().clearStream();
      expect(store.getState().streamContent).toBe('');
      expect(store.getState().thinkingContent).toBe('');

      // Model selection persists
      expect(store.getState().activeProviderId).toBe('openai');
      expect(store.getState().activeModelId).toBe('gpt-4');
      expect(store.getState().thinkingLevel).toBe('medium');
    });
  });
});
