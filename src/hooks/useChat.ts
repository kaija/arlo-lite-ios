/**
 * useChat hook — orchestrates the message send flow.
 *
 * Handles:
 * - Adding user message to session store
 * - Building and sending requests to the active provider
 * - Streaming: updates UI incrementally via chat store
 * - Non-streaming: awaits full response then adds assistant message
 * - Error handling with classification (auth, rate-limit, server, network, stream)
 * - Stop/abort support for in-flight streaming requests
 */

import { useCallback, useRef } from 'react';

import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { getProvider } from '@/providers/registry';
import { createSSEStream, SSEConnection } from '@/providers/sse/sse-manager';
import { getApiKey } from '@/database/secure-store';
import { calculateMessageCost } from '@/domain/cost-calculator';
import {
  classifyHttpError,
  classifyNetworkError,
  classifyStreamError,
  type ClassifiedError,
} from '@/domain/error-classifier';
import type { ChatMessage, ContentPart, CompletionRequest, ProviderConfig, StreamChunk, TokenUsage } from '@/providers/types';
import type { Message } from '@/database/repositories/message-repo';

/** Stable empty array to avoid infinite re-render loops in selectors */
const EMPTY_MESSAGES: Message[] = [];

export interface ChatError {
  /** Short user-facing error message */
  message: string;
  /** Full detail for expanded view */
  detail?: string;
  /** Whether this error is retryable (show retry button) */
  isRetryable: boolean;
}

export interface UseChatResult {
  /** Send a message in the active session, optionally with attachments */
  sendMessage: (text: string, attachments?: ContentPart[]) => Promise<void>;
  /** Resend the current session context to generate a new assistant response (no new user message added) */
  resendContext: () => Promise<void>;
  /** Abort the current streaming response */
  stopGeneration: () => void;
  /** Whether a send/stream is currently in progress */
  isStreaming: boolean;
  /** Current streaming text content (accumulates during stream) */
  streamContent: string;
  /** Current streaming thinking content */
  thinkingContent: string;
  /** Last error from send flow, or null */
  error: ChatError | null;
  /** Retry the last failed request */
  retry: () => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
}

/**
 * Hook providing the complete send message flow for the chat screen.
 *
 * Reads the active provider/model from the chat store, builds the request
 * through the provider adapter, and handles both streaming and non-streaming
 * responses. Errors are classified and surfaced for the ErrorBanner.
 */
export function useChat(): UseChatResult {
  const sseConnectionRef = useRef<SSEConnection | null>(null);
  const lastMessageRef = useRef<string>('');

  // Store selectors
  const activeSessionId = useSessionStore((s) => s.activeSessionId);
  const addMessage = useSessionStore((s) => s.addMessage);
  const messagesMap = useSessionStore((s) => s.messages);
  const messages = (activeSessionId ? messagesMap[activeSessionId] : undefined) ?? EMPTY_MESSAGES;

  const {
    isStreaming,
    streamContent,
    thinkingContent,
    activeProviderId,
    activeModelId,
    thinkingLevel,
    setStreaming,
    appendStreamContent,
    appendThinkingContent,
    clearStream,
  } = useChatStore();

  const providers = useProviderStore((s) => s.providers);
  const models = useProviderStore((s) => s.models);

  // Local error state
  const errorRef = useRef<ChatError | null>(null);

  const clearError = useCallback(() => {
    errorRef.current = null;
  }, []);

  /**
   * Convert a ClassifiedError into a ChatError for the UI.
   */
  function toChatError(classified: ClassifiedError): ChatError {
    return {
      message: classified.message,
      detail: classified.detail,
      isRetryable: classified.isRetryable,
    };
  }

  /**
   * Build ChatMessage array from session messages for the provider request.
   */
  function buildChatMessages(sessionMessages: Message[]): ChatMessage[] {
    return sessionMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      ...(msg.thinkingContent ? { thinkingContent: msg.thinkingContent } : {}),
    }));
  }

  /**
   * Core send flow implementation.
   */
  const sendMessage = useCallback(
    async (text: string, attachments?: ContentPart[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;
      if (!activeSessionId || !activeProviderId || !activeModelId) return;

      // Clear previous error
      errorRef.current = null;
      lastMessageRef.current = text;

      // Find provider config and model config
      const providerConfig = providers.find((p) => p.id === activeProviderId);
      const modelConfig = models.find(
        (m) => m.providerId === activeProviderId && m.modelId === activeModelId
      );

      if (!providerConfig || !modelConfig) {
        errorRef.current = {
          message: 'Provider or model not configured',
          detail: 'Please select a valid provider and model in settings.',
          isRetryable: false,
        };
        return;
      }

      // Get API key from secure storage
      const apiKey = await getApiKey(activeProviderId);
      if (!apiKey) {
        errorRef.current = {
          message: 'API key not found',
          detail: 'Please add an API key for this provider in settings.',
          isRetryable: false,
        };
        return;
      }

      // Build the content for the user message — plain text or multimodal ContentPart[]
      let messageContent: string;
      if (attachments && attachments.length > 0) {
        // Content stored as text in DB; attachments encoded inline in the message content
        // for the API request we build proper ContentPart[] in buildChatMessages
        messageContent = text.trim();
      } else {
        messageContent = text.trim();
      }

      // Add user message to session
      const userMessage = await addMessage(activeSessionId, {
        sessionId: activeSessionId,
        role: 'user',
        content: messageContent,
        providerId: activeProviderId,
        modelId: activeModelId,
      });

      // Build conversation context from all session messages (including the one just added)
      const currentMessages = [
        ...messages,
        userMessage,
      ];
      const chatMessages = buildChatMessages(currentMessages);

      // If there are attachments, modify the last user message to include multimodal content
      if (attachments && attachments.length > 0 && chatMessages.length > 0) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg.role === 'user') {
          const parts: ContentPart[] = [];
          if (typeof lastMsg.content === 'string' && lastMsg.content.length > 0) {
            parts.push({ type: 'text', text: lastMsg.content });
          }
          parts.push(...attachments);
          lastMsg.content = parts;
        }
      }

      // Get the provider adapter
      const provider = getProvider(providerConfig.type);

      // Build the completion request
      const completionRequest: CompletionRequest = {
        messages: chatMessages,
        model: activeModelId,
        thinkingLevel,
        stream: providerConfig.streamingEnabled,
      };

      // Build HTTP request via provider adapter
      const config = {
        ...providerConfig,
        apiMode: providerConfig.apiMode ?? undefined,
      };
      const { url, headers, body } = provider.buildRequest(config, completionRequest);

      // Inject API key into headers based on provider type
      const authHeaders = getAuthHeaders(providerConfig.type, apiKey);
      const mergedHeaders = { ...headers, ...authHeaders };

      if (providerConfig.streamingEnabled) {
        await handleStreaming(url, mergedHeaders, body, provider, activeSessionId, modelConfig);
      } else {
        await handleNonStreaming(url, mergedHeaders, body, provider, activeSessionId, modelConfig);
      }
    },
    [
      activeSessionId,
      activeProviderId,
      activeModelId,
      providers,
      models,
      messages,
      thinkingLevel,
      addMessage,
      setStreaming,
      appendStreamContent,
      appendThinkingContent,
      clearStream,
    ]
  );

  /**
   * Resend the current session context (all existing messages) to generate a new response.
   * Used for regeneration — does NOT add a new user message.
   * Reads messages fresh from the store to avoid stale closure data.
   */
  const resendContext = useCallback(
    async () => {
      if (!activeSessionId || !activeProviderId || !activeModelId) return;

      // Read messages fresh from the store (avoids stale closure after editMessage)
      const currentMessages = useSessionStore.getState().messages[activeSessionId] ?? [];
      if (currentMessages.length === 0) return;

      // Clear previous error
      errorRef.current = null;

      // Find provider config and model config
      const providerConfig = providers.find((p) => p.id === activeProviderId);
      const modelConfig = models.find(
        (m) => m.providerId === activeProviderId && m.modelId === activeModelId
      );

      if (!providerConfig || !modelConfig) {
        errorRef.current = {
          message: 'Provider or model not configured',
          detail: 'Please select a valid provider and model in settings.',
          isRetryable: false,
        };
        return;
      }

      // Get API key from secure storage
      const apiKey = await getApiKey(activeProviderId);
      if (!apiKey) {
        errorRef.current = {
          message: 'API key not found',
          detail: 'Please add an API key for this provider in settings.',
          isRetryable: false,
        };
        return;
      }

      // Use existing messages as context (no new user message added)
      const chatMessages = buildChatMessages(currentMessages);

      // Get the provider adapter
      const provider = getProvider(providerConfig.type);

      // Build the completion request
      const completionRequest: CompletionRequest = {
        messages: chatMessages,
        model: activeModelId,
        thinkingLevel,
        stream: providerConfig.streamingEnabled,
      };

      const config = {
        ...providerConfig,
        apiMode: providerConfig.apiMode ?? undefined,
      };
      const { url, headers, body } = provider.buildRequest(config, completionRequest);

      const authHeaders = getAuthHeaders(providerConfig.type, apiKey);
      const mergedHeaders = { ...headers, ...authHeaders };

      if (providerConfig.streamingEnabled) {
        await handleStreaming(url, mergedHeaders, body, provider, activeSessionId, modelConfig);
      } else {
        await handleNonStreaming(url, mergedHeaders, body, provider, activeSessionId, modelConfig);
      }
    },
    [
      activeSessionId,
      activeProviderId,
      activeModelId,
      providers,
      models,
      messages,
      thinkingLevel,
      addMessage,
      setStreaming,
      appendStreamContent,
      appendThinkingContent,
      clearStream,
    ]
  );

  /**
   * Handle streaming response via SSE.
   */
  async function handleStreaming(
    url: string,
    headers: Record<string, string>,
    body: string,
    provider: ReturnType<typeof getProvider>,
    sessionId: string,
    modelConfig: { inputPrice: number | null; outputPrice: number | null }
  ) {
    clearStream();
    setStreaming(true);

    return new Promise<void>((resolve) => {
      let accumulatedContent = '';
      let accumulatedThinking = '';

      const connection = createSSEStream(url, headers, body, provider, {
        onChunk: (chunk: StreamChunk) => {
          if (chunk.type === 'text') {
            accumulatedContent += chunk.content;
            appendStreamContent(chunk.content);
          } else if (chunk.type === 'thinking') {
            accumulatedThinking += chunk.content;
            appendThinkingContent(chunk.content);
          }
        },

        onComplete: async (usage?: TokenUsage) => {
          sseConnectionRef.current = null;
          setStreaming(false);

          // Calculate cost if we have usage data and pricing
          const cost =
            usage && modelConfig.inputPrice !== null && modelConfig.outputPrice !== null
              ? calculateMessageCost(
                  usage.promptTokens,
                  usage.completionTokens,
                  modelConfig.inputPrice,
                  modelConfig.outputPrice
                )
              : null;

          // Add assistant message to session store
          await addMessage(sessionId, {
            sessionId,
            role: 'assistant',
            content: accumulatedContent,
            thinkingContent: accumulatedThinking || undefined,
            providerId: activeProviderId!,
            modelId: activeModelId!,
            promptTokens: usage?.promptTokens ?? null,
            completionTokens: usage?.completionTokens ?? null,
            totalTokens: usage?.totalTokens ?? null,
            cachedTokens: usage?.cachedTokens ?? null,
            cost,
          });

          clearStream();
          resolve();
        },

        onError: (error: Error) => {
          sseConnectionRef.current = null;
          setStreaming(false);
          clearStream();

          // Classify the streaming error for appropriate UI display
          const classified = classifyStreamError(error);
          errorRef.current = toChatError(classified);
          resolve();
        },
      });

      sseConnectionRef.current = connection;
    });
  }

  /**
   * Handle non-streaming response (regular fetch).
   */
  async function handleNonStreaming(
    url: string,
    headers: Record<string, string>,
    body: string,
    provider: ReturnType<typeof getProvider>,
    sessionId: string,
    modelConfig: { inputPrice: number | null; outputPrice: number | null }
  ) {
    setStreaming(true);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
      });

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          // ignore
        }
        // Classify the HTTP error for appropriate UI display
        const classified = classifyHttpError(response.status, errorBody, response.statusText);
        errorRef.current = toChatError(classified);
        setStreaming(false);
        return;
      }

      const raw = await response.json();
      const parsed = provider.parseResponse(raw);

      // Calculate cost
      const cost = calculateMessageCost(
        parsed.usage.promptTokens,
        parsed.usage.completionTokens,
        modelConfig.inputPrice,
        modelConfig.outputPrice
      );

      // Add assistant message
      await addMessage(sessionId, {
        sessionId,
        role: 'assistant',
        content: parsed.content,
        thinkingContent: parsed.thinkingContent ?? undefined,
        providerId: activeProviderId!,
        modelId: activeModelId!,
        promptTokens: parsed.usage.promptTokens,
        completionTokens: parsed.usage.completionTokens,
        totalTokens: parsed.usage.totalTokens,
        cachedTokens: parsed.usage.cachedTokens ?? null,
        cost,
      });
    } catch (err: unknown) {
      // Classify the network/fetch error
      const error = err instanceof Error ? err : new Error(String(err));
      const classified = classifyNetworkError(error);
      errorRef.current = toChatError(classified);
    } finally {
      setStreaming(false);
    }
  }

  /**
   * Abort the current streaming response and discard partial content.
   */
  const stopGeneration = useCallback(() => {
    if (sseConnectionRef.current) {
      sseConnectionRef.current.abort();
      sseConnectionRef.current = null;
    }
    setStreaming(false);
    clearStream();
  }, [setStreaming, clearStream]);

  /**
   * Retry the last failed message.
   */
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      await sendMessage(lastMessageRef.current);
    }
  }, [sendMessage]);

  return {
    sendMessage,
    resendContext,
    stopGeneration,
    isStreaming,
    streamContent,
    thinkingContent,
    error: errorRef.current,
    retry,
    clearError,
  };
}

/**
 * Get authentication headers based on provider type.
 * Provider buildRequest may already include these, but this ensures the key is injected.
 */
function getAuthHeaders(
  providerType: string,
  apiKey: string
): Record<string, string> {
  switch (providerType) {
    case 'anthropic':
      return { 'x-api-key': apiKey };
    case 'openai':
    case 'custom':
    default:
      return { Authorization: `Bearer ${apiKey}` };
  }
}
