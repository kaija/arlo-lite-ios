import { create } from 'zustand';
import { useSessionStore } from '@/stores/session-store';
import { updateSession } from '@/database/repositories/session-repo';

/**
 * Abstract reasoning effort level.
 * Maps to provider-specific parameters in the thinking-mapper domain module.
 */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Chat store state — ephemeral streaming state and active model tracking.
 * This store does NOT use persist middleware because streaming state is transient.
 */
export interface ChatState {
  /** Whether a streaming response is currently in progress */
  isStreaming: boolean;
  /** Accumulated text content from the current stream */
  streamContent: string;
  /** Accumulated thinking/reasoning content from the current stream */
  thinkingContent: string;
  /** Currently active provider ID for the chat */
  activeProviderId: string | null;
  /** Currently active model ID for the chat */
  activeModelId: string | null;
  /** Current thinking/reasoning effort level */
  thinkingLevel: ThinkingLevel;
}

export interface ChatActions {
  /** Set the streaming state (true = start, false = end) */
  setStreaming: (streaming: boolean) => void;
  /** Append text to the current stream content */
  appendStreamContent: (text: string) => void;
  /** Append text to the current thinking content */
  appendThinkingContent: (text: string) => void;
  /** Reset stream content and thinking content to empty strings */
  clearStream: () => void;
  /** Update the thinking/reasoning effort level */
  setThinkingLevel: (level: ThinkingLevel) => void;
  /** Switch the active provider and model, persisting to the active session */
  switchModel: (providerId: string, modelId: string) => void;
}

export type ChatStore = ChatState & ChatActions;

export const useChatStore = create<ChatStore>((set) => ({
  // State
  isStreaming: false,
  streamContent: '',
  thinkingContent: '',
  activeProviderId: null,
  activeModelId: null,
  thinkingLevel: 'off',

  // Actions
  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },

  appendStreamContent: (text: string) => {
    set((state) => ({ streamContent: state.streamContent + text }));
  },

  appendThinkingContent: (text: string) => {
    set((state) => ({ thinkingContent: state.thinkingContent + text }));
  },

  clearStream: () => {
    set({ streamContent: '', thinkingContent: '' });
  },

  setThinkingLevel: (level: ThinkingLevel) => {
    set({ thinkingLevel: level });
  },

  switchModel: (providerId: string, modelId: string) => {
    set({ activeProviderId: providerId, activeModelId: modelId });

    // Persist model selection to the active session
    const { activeSessionId, db } = useSessionStore.getState();
    if (activeSessionId && db) {
      updateSession(db, activeSessionId, { providerId, modelId }).catch(() => {
        // Persistence is best-effort — UI state is already updated
      });
    }
  },
}));
