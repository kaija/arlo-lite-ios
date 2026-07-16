/**
 * useChat hook — orchestrates the message send flow.
 *
 * Handles:
 * - Adding user message to session store
 * - Streaming via CompletionService.streamCompletion (AsyncIterable)
 * - Non-streaming via CompletionService.complete
 * - Error handling with ProviderError → ChatError mapping
 * - Stop/abort support via AbortController
 */

import { useCallback, useRef, useState } from 'react';

import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { useSettingsStore } from '@/stores/settings-store';
import { streamCompletion, complete } from '@/services/completion-service';
import type { CompletionServiceOptions } from '@/services/completion-service';
import { ProviderError } from '@/providers/errors';
import { calculateMessageCost } from '@/domain/cost-calculator';
import type { ChatMessage, ContentPart, ProviderConfig, TokenUsage } from '@/providers/types';
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
 * Map a ProviderError into a ChatError for the ErrorBanner UI.
 */
function providerErrorToChatError(err: ProviderError): ChatError {
  let detail: string | undefined;
  if (err.category === 'rate_limit' && err.retryAfterSeconds != null) {
    detail = `Rate limited. Retry after ${err.retryAfterSeconds} seconds.`;
  } else if (err.category === 'authentication') {
    detail = 'Check your API key in provider settings.';
  }

  return {
    message: err.message,
    detail,
    isRetryable: err.isRetryable,
  };
}

/**
 * Hook providing the complete send message flow for the chat screen.
 *
 * Reads the active provider/model from the chat store, delegates to
 * CompletionService for streaming and non-streaming completions.
 * Errors are classified and surfaced for the ErrorBanner.
 */
export function useChat(): UseChatResult {
  const abortControllerRef = useRef<AbortController | null>(null);
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

  // Local error state (reactive so UI re-renders on error)
  const [error, setError] = useState<ChatError | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

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
   * Prepend the default system prompt (if configured) to the messages array.
   * Reads from the SettingsStore and inserts at index 0.
   */
  function prependSystemPrompt(chatMessages: ChatMessage[]): ChatMessage[] {
    const { defaultSystemPromptId, systemPrompts } = useSettingsStore.getState();
    if (!defaultSystemPromptId) return chatMessages;

    const prompt = systemPrompts.find((p) => p.id === defaultSystemPromptId);
    if (!prompt) return chatMessages;

    return [{ role: 'system', content: prompt.content }, ...chatMessages];
  }

  /**
   * Execute a streaming completion via CompletionService.
   */
  async function handleStreaming(
    chatMessages: ChatMessage[],
    options: CompletionServiceOptions,
    sessionId: string,
    modelConfig: { inputPrice: number | null; outputPrice: number | null }
  ) {
    clearStream();
    setStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';
    let accumulatedThinking = '';
    let finalUsage: TokenUsage | undefined;

    try {
      for await (const chunk of streamCompletion(chatMessages, options, controller.signal)) {
        switch (chunk.type) {
          case 'text':
            accumulatedContent += chunk.content;
            appendStreamContent(chunk.content);
            break;
          case 'thinking':
            accumulatedThinking += chunk.content;
            appendThinkingContent(chunk.content);
            break;
          case 'done':
            finalUsage = chunk.usage;
            break;
          case 'error':
            setError({
              message: chunk.content,
              isRetryable: true,
            });
            break;
        }
      }

      // If we got content, persist the assistant message
      if (accumulatedContent.length > 0 || accumulatedThinking.length > 0) {
        const cost =
          finalUsage && modelConfig.inputPrice !== null && modelConfig.outputPrice !== null
            ? calculateMessageCost(
                finalUsage.promptTokens,
                finalUsage.completionTokens,
                modelConfig.inputPrice,
                modelConfig.outputPrice
              )
            : null;

        await addMessage(sessionId, {
          sessionId,
          role: 'assistant',
          content: accumulatedContent,
          thinkingContent: accumulatedThinking || undefined,
          providerId: options.providerId,
          modelId: options.modelId,
          promptTokens: finalUsage?.promptTokens ?? null,
          completionTokens: finalUsage?.completionTokens ?? null,
          totalTokens: finalUsage?.totalTokens ?? null,
          cachedTokens: finalUsage?.cachedTokens ?? null,
          cost,
        });
      }
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        setError(providerErrorToChatError(err));
      } else {
        const caughtError = err instanceof Error ? err : new Error(String(err));
        setError({
          message: caughtError.message || 'Streaming failed',
          isRetryable: true,
        });
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      clearStream();
    }
  }

  /**
   * Execute a non-streaming completion via CompletionService.
   */
  async function handleNonStreaming(
    chatMessages: ChatMessage[],
    options: CompletionServiceOptions,
    sessionId: string,
    modelConfig: { inputPrice: number | null; outputPrice: number | null }
  ) {
    setStreaming(true);

    try {
      const response = await complete(chatMessages, options);

      // Calculate cost
      const cost = calculateMessageCost(
        response.usage.promptTokens,
        response.usage.completionTokens,
        modelConfig.inputPrice,
        modelConfig.outputPrice
      );

      // Add assistant message
      await addMessage(sessionId, {
        sessionId,
        role: 'assistant',
        content: response.content,
        thinkingContent: response.thinkingContent ?? undefined,
        providerId: options.providerId,
        modelId: options.modelId,
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.totalTokens,
        cachedTokens: response.usage.cachedTokens ?? null,
        cost,
      });
    } catch (err: unknown) {
      if (err instanceof ProviderError) {
        setError(providerErrorToChatError(err));
      } else {
        const caughtError = err instanceof Error ? err : new Error(String(err));
        setError({
          message: caughtError.message || 'Request failed',
          isRetryable: true,
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  /**
   * Core send flow implementation.
   */
  const sendMessage = useCallback(
    async (text: string, attachments?: ContentPart[]) => {
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      // Clear previous error
      setError(null);
      lastMessageRef.current = text;

      // Auto-create session if no active session exists
      let sessionId = activeSessionId;

      if (!sessionId) {
        if (!activeProviderId || !activeModelId) {
          setError({
            message: 'No provider configured',
            detail: 'Please configure a provider and model in settings.',
            isRetryable: false,
          });
          return;
        }
        sessionId = await useSessionStore.getState().createSession(
          activeProviderId,
          activeModelId
        );
        await useSessionStore.getState().setActiveSession(sessionId);
      }

      if (!activeProviderId || !activeModelId) {
        setError({
          message: 'No model selected',
          detail: 'Please select a model before sending a message.',
          isRetryable: false,
        });
        return;
      }

      // Find provider config and model config
      const providerConfig = providers.find((p) => p.id === activeProviderId);
      const modelConfig = models.find(
        (m) => m.providerId === activeProviderId && m.modelId === activeModelId
      );

      if (!providerConfig || !modelConfig) {
        setError({
          message: 'Provider or model not configured',
          detail: 'Please select a valid provider and model in settings.',
          isRetryable: false,
        });
        return;
      }

      // Build the content for the user message
      const messageContent = text.trim();

      // Add user message to session
      const userMessage = await addMessage(sessionId, {
        sessionId,
        role: 'user',
        content: messageContent,
        providerId: activeProviderId,
        modelId: activeModelId,
      });

      // Build conversation context from all session messages (including the one just added)
      const sessionMessages = useSessionStore.getState().messages[sessionId] ?? [];
      const currentMessages = [...sessionMessages.filter((m) => m.id !== userMessage.id), userMessage];
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

      // Build CompletionService options — map store Provider to ProviderConfig
      const providerConfigForService: ProviderConfig = {
        ...providerConfig,
        apiMode: providerConfig.apiMode ?? undefined,
      };

      const options: CompletionServiceOptions = {
        providerId: activeProviderId,
        providerConfig: providerConfigForService,
        modelId: activeModelId,
        thinkingLevel,
        maxTokens: providerConfig.generationParams.maxTokens,
      };

      if (providerConfig.streamingEnabled) {
        await handleStreaming(prependSystemPrompt(chatMessages), options, sessionId, modelConfig);
      } else {
        await handleNonStreaming(prependSystemPrompt(chatMessages), options, sessionId, modelConfig);
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
      setError(null);

      // Find provider config and model config
      const providerConfig = providers.find((p) => p.id === activeProviderId);
      const modelConfig = models.find(
        (m) => m.providerId === activeProviderId && m.modelId === activeModelId
      );

      if (!providerConfig || !modelConfig) {
        setError({
          message: 'Provider or model not configured',
          detail: 'Please select a valid provider and model in settings.',
          isRetryable: false,
        });
        return;
      }

      // Use existing messages as context (no new user message added)
      const chatMessages = buildChatMessages(currentMessages);

      // Build CompletionService options — map store Provider to ProviderConfig
      const providerConfigForService: ProviderConfig = {
        ...providerConfig,
        apiMode: providerConfig.apiMode ?? undefined,
      };

      const options: CompletionServiceOptions = {
        providerId: activeProviderId,
        providerConfig: providerConfigForService,
        modelId: activeModelId,
        thinkingLevel,
        maxTokens: providerConfig.generationParams.maxTokens,
      };

      if (providerConfig.streamingEnabled) {
        await handleStreaming(prependSystemPrompt(chatMessages), options, activeSessionId, modelConfig);
      } else {
        await handleNonStreaming(prependSystemPrompt(chatMessages), options, activeSessionId, modelConfig);
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
   * Abort the current streaming response and discard partial content.
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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
    error,
    retry,
    clearError,
  };
}
