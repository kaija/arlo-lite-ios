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

import { useCallback, useEffect, useRef, useState } from 'react';

import { useSessionStore } from '@/stores/session-store';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';
import { useSettingsStore } from '@/stores/settings-store';
import { streamCompletion, complete } from '@/services/completion-service';
import type { CompletionServiceOptions } from '@/services/completion-service';
import { runAgentLoop } from '@/services/agent-loop';
import type { AgentLoopCallbacks, AgentLoopOptions } from '@/services/agent-loop';
import { ProviderError } from '@/providers/errors';
import { calculateMessageCost } from '@/domain/cost-calculator';
import { DEFAULT_SYSTEM_PROMPT } from '@/constants/defaults';
import { getTool } from '@/services/tool-registry';
import type { ChatMessage, ContentPart, ProviderConfig, ProviderType, TokenUsage } from '@/providers/types';
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
  /** Regenerate from a specific assistant message: delete it + subsequent, then resend context */
  regenerateFrom: (messageId: string) => Promise<void>;
  /** Abort the current streaming response */
  stopGeneration: () => void;
  /** Whether a send/stream is currently in progress */
  isStreaming: boolean;
  /** Current streaming text content (accumulates during stream) */
  streamContent: string;
  /** Current streaming thinking content */
  thinkingContent: string;
  /** Estimated tokens per second (rolling 2-second window) */
  tokenRate: number;
  /** Last error from send flow, or null */
  error: ChatError | null;
  /** Retry the last failed request */
  retry: () => Promise<void>;
  /** Clear the current error */
  clearError: () => void;
  /** Current agent loop iteration (0 if not in an agent loop) */
  currentIteration: number;
  /** Whether the agent loop is currently executing tools */
  isToolExecuting: boolean;
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

/** Flush interval for stream batching (~30fps) */
const FLUSH_INTERVAL_MS = 32;

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

  // Token rate tracking: rolling window of (timestamp, tokenCount) samples
  const tokenSamplesRef = useRef<Array<{ time: number; tokens: number }>>([]);
  const [tokenRate, setTokenRate] = useState(0);
  const streamStartRef = useRef<number>(0);
  const totalStreamTokensRef = useRef<number>(0);

  // Stream batching buffers
  const textBufferRef = useRef<string>('');
  const thinkingBufferRef = useRef<string>('');
  const bufferedChunkSizesRef = useRef<number>(0);
  const lastFlushTimeRef = useRef<number>(0);
  const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Flush accumulated buffer content to the store in a single set() call.
   * Also computes and updates the token rate from buffered chunk sizes.
   */
  function flushBuffer() {
    const textDelta = textBufferRef.current;
    const thinkingDelta = thinkingBufferRef.current;

    if (textDelta.length === 0 && thinkingDelta.length === 0) {
      return; // Skip — no-op flush
    }

    // Single store update for both text and thinking
    useChatStore.getState().flushStreamBuffer(textDelta, thinkingDelta);

    // Compute token rate from buffered data
    const now = Date.now();
    const elapsed = (now - lastFlushTimeRef.current) / 1000;
    if (elapsed > 0 && bufferedChunkSizesRef.current > 0) {
      const tokensThisFlush = Math.max(1, Math.ceil(bufferedChunkSizesRef.current / 4));
      totalStreamTokensRef.current += tokensThisFlush;

      // Update rolling window
      tokenSamplesRef.current.push({ time: now, tokens: tokensThisFlush });
      const windowStart = now - 2000;
      tokenSamplesRef.current = tokenSamplesRef.current.filter((s) => s.time >= windowStart);

      const samples = tokenSamplesRef.current;
      if (samples.length >= 2) {
        const windowTokens = samples.reduce((sum, s) => sum + s.tokens, 0);
        const windowDuration = (samples[samples.length - 1].time - samples[0].time) / 1000;
        if (windowDuration > 0) {
          setTokenRate(windowTokens / windowDuration);
        }
      } else {
        const totalElapsed = (now - streamStartRef.current) / 1000;
        if (totalElapsed > 0.1) {
          setTokenRate(totalStreamTokensRef.current / totalElapsed);
        }
      }
    }

    // Reset buffers
    textBufferRef.current = '';
    thinkingBufferRef.current = '';
    bufferedChunkSizesRef.current = 0;
    lastFlushTimeRef.current = now;
  }

  /**
   * Start the flush interval timer. Called at the beginning of streaming.
   */
  function startBatcher() {
    lastFlushTimeRef.current = Date.now();
    flushIntervalRef.current = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
  }

  /**
   * Stop the flush interval and perform a final flush of any remaining content.
   */
  function stopBatcher() {
    if (flushIntervalRef.current !== null) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    flushBuffer(); // Final flush of remaining content
  }

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

  // Agent loop state
  const [currentIteration, setCurrentIteration] = useState(0);
  const [isToolExecuting, setIsToolExecuting] = useState(false);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Estimate token count from a text chunk.
   * Heuristic: ~4 characters per token (GPT tokenizer average).
   */
  function estimateTokens(text: string): number {
    return Math.max(1, Math.ceil(text.length / 4));
  }

  /**
   * Record a token sample and recalculate the rolling rate (2-second window).
   */
  function recordTokenSample(chunkText: string) {
    const now = Date.now();
    const tokens = estimateTokens(chunkText);
    totalStreamTokensRef.current += tokens;

    tokenSamplesRef.current.push({ time: now, tokens });

    // Keep only samples within the last 2 seconds
    const windowStart = now - 2000;
    tokenSamplesRef.current = tokenSamplesRef.current.filter(
      (s) => s.time >= windowStart
    );

    // Calculate rate: total tokens in window / window duration
    const samples = tokenSamplesRef.current;
    if (samples.length < 2) {
      // Not enough data for a rate — use total average since stream start
      const elapsed = (now - streamStartRef.current) / 1000;
      if (elapsed > 0.1) {
        setTokenRate(totalStreamTokensRef.current / elapsed);
      }
      return;
    }

    const windowTokens = samples.reduce((sum, s) => sum + s.tokens, 0);
    const windowDuration = (samples[samples.length - 1].time - samples[0].time) / 1000;

    if (windowDuration > 0) {
      setTokenRate(windowTokens / windowDuration);
    }
  }

  /**
   * Reset token rate tracking for a new stream.
   */
  function resetTokenRate() {
    tokenSamplesRef.current = [];
    totalStreamTokensRef.current = 0;
    streamStartRef.current = Date.now();
    setTokenRate(0);
  }

  /**
   * Build ChatMessage array from session messages for the provider request.
   */
  function buildChatMessages(sessionMessages: Message[]): ChatMessage[] {
    return sessionMessages
      .filter((msg) => {
        // Skip tool results — they lack tool_call_id when loaded from DB
        if (msg.role === 'tool') return false;
        // Skip assistant messages that are just tool-call JSON (internal, not displayable)
        if (msg.role === 'assistant' && msg.content.startsWith('{"toolCalls"')) return false;
        return true;
      })
      .map((msg) => ({
        role: msg.role as ChatMessage['role'],
        content: msg.content,
        ...(msg.thinkingContent ? { thinkingContent: msg.thinkingContent } : {}),
      }));
  }

  /**
   * Resolve and prepend the system prompt to the messages array.
   *
   * Resolution order:
   * 1. Session-level system prompt (session.systemPromptId)
   * 2. Global default system prompt (settings.defaultSystemPromptId)
   * 3. Built-in DEFAULT_SYSTEM_PROMPT constant
   */
  function prependSystemPrompt(chatMessages: ChatMessage[], providerType?: ProviderType): ChatMessage[] {
    const { defaultSystemPromptId, systemPrompts } = useSettingsStore.getState();
    const sessions = useSessionStore.getState().sessions;
    const sessionId = useSessionStore.getState().activeSessionId;

    let content: string;

    // 1. Try session-level prompt
    const session = sessionId ? sessions.find((s) => s.id === sessionId) : null;
    if (session?.systemPromptId) {
      const sessionPrompt = systemPrompts.find((p) => p.id === session.systemPromptId);
      if (sessionPrompt) {
        content = sessionPrompt.content;
      } else {
        content = DEFAULT_SYSTEM_PROMPT;
      }
    } else if (defaultSystemPromptId) {
      // 2. Try global default prompt
      const globalPrompt = systemPrompts.find((p) => p.id === defaultSystemPromptId);
      content = globalPrompt ? globalPrompt.content : DEFAULT_SYSTEM_PROMPT;
    } else {
      // 3. Fallback to built-in default
      content = DEFAULT_SYSTEM_PROMPT;
    }

    // Append current date/time so the model knows "now"
    content += `\n\nCurrent date and time: ${new Date().toLocaleString()}.`;

    // Build tool-use instructions when any tools are registered
    const availableTools: string[] = [];
    if (getTool('brave_web_search')) {
      availableTools.push('- brave_web_search: Search the web for current information. Use when the user asks about current events, real-time data, or anything requiring up-to-date knowledge.');
    }
    if (getTool('web_fetch')) {
      availableTools.push('- web_fetch: Fetch a URL and return its content as Markdown. Use when you need to read a specific web page, documentation, or article.');
    }

    if (availableTools.length > 0) {
      content += '\n\n# Tools\n\nYou have access to the following tools:\n' + availableTools.join('\n');

      // Tool usage behavior instructions
      content += '\n\n## Tool Usage Rules';
      content += '\n- Always extract and summarize the relevant information from tool results. Never show raw tool output to the user.';
      content += '\n- After using web_fetch, summarize the key information and include a reference link: [Source title](URL).';
      content += '\n- After using brave_web_search, synthesize the results into a clear answer with source links.';
      content += '\n- If a tool returns an error, try an alternative approach or inform the user concisely.';
      content += '\n- For current data (prices, rates, scores), prefer brave_web_search first, then web_fetch for specific pages.';

      // Only custom/local models need explicit format instructions.
      // OpenAI and Anthropic use native function calling triggered by the tools param.
      if (providerType === 'custom') {
        content += '\n\nTo call a tool, output a tool_call block with JSON containing "name" and "arguments". Example:\n<tool_call>\n{"name": "web_fetch", "arguments": {"url": "https://example.com"}}\n</tool_call>\n\nAfter calling a tool, wait for the result before continuing. Do NOT output code blocks showing how to call a tool — actually call it using the format above.';
      }
    }

    return [{ role: 'system', content }, ...chatMessages];
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
    resetTokenRate();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedContent = '';
    let accumulatedThinking = '';
    let finalUsage: TokenUsage | undefined;

    // Start the batching interval
    startBatcher();

    try {
      for await (const chunk of streamCompletion(chatMessages, options, controller.signal)) {
        switch (chunk.type) {
          case 'text':
            accumulatedContent += chunk.content;
            textBufferRef.current += chunk.content;
            bufferedChunkSizesRef.current += chunk.content.length;
            break;
          case 'thinking':
            accumulatedThinking += chunk.content;
            thinkingBufferRef.current += chunk.content;
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

      // Stream completed normally — stop batcher (flushes remaining)
      stopBatcher();

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
      // Stop batcher on error too
      stopBatcher();

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
      setTokenRate(0);
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
   * Execute the agent loop for models that support tool use.
   * Routes through runAgentLoop() which handles iteration, tool execution,
   * and streaming internally.
   */
  async function handleAgentLoop(
    chatMessages: ChatMessage[],
    options: CompletionServiceOptions,
    sessionId: string,
    modelConfig: { inputPrice: number | null; outputPrice: number | null },
    providerConfig: ProviderConfig
  ) {
    clearStream();
    setStreaming(true);
    resetTokenRate();
    setCurrentIteration(0);
    setIsToolExecuting(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Serialize DB writes to avoid expo-sqlite "finalizeAsync" race condition
    let dbQueue: Promise<void> = Promise.resolve();
    const enqueueWrite = (fn: () => Promise<void>): Promise<void> => {
      dbQueue = dbQueue.then(fn, fn);
      return dbQueue;
    };

    startBatcher();

    const loopOptions: AgentLoopOptions = {
      providerType: providerConfig.type,
      supportsToolUse: true,
      streaming: providerConfig.streamingEnabled,
    };

    const callbacks: AgentLoopCallbacks = {
      onStreamText: (chunk: string) => {
        textBufferRef.current += chunk;
        bufferedChunkSizesRef.current += chunk.length;
      },
      onStreamThinking: (chunk: string) => {
        thinkingBufferRef.current += chunk;
      },
      onIntermediateContent: async (content: string, thinkingContent?: string) => {
        // Persist intermediate assistant text before tool calls — non-fatal
        stopBatcher();
        try {
          await enqueueWrite(() => addMessage(sessionId, {
            sessionId,
            role: 'assistant',
            content,
            thinkingContent: thinkingContent || undefined,
            providerId: options.providerId,
            modelId: options.modelId,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            cachedTokens: null,
            cost: null,
          }).then(() => {}));
        } catch (e) {
          console.warn('[AgentLoop] Failed to persist intermediate content:', e);
        }
        clearStream();
        startBatcher();
      },
      onToolCall: async (msg) => {
        setIsToolExecuting(true);
        setCurrentIteration((prev) => prev + 1);
        // Persist tool call as assistant message — non-fatal if DB write fails
        try {
          await enqueueWrite(() => addMessage(sessionId, {
            sessionId,
            role: 'assistant',
            content: JSON.stringify({ toolCalls: msg.toolCalls }),
            providerId: options.providerId,
            modelId: options.modelId,
            promptTokens: null,
            completionTokens: null,
            totalTokens: null,
            cachedTokens: null,
            cost: null,
          }).then(() => {}));
        } catch (e) {
          console.warn('[AgentLoop] Failed to persist tool call message:', e);
        }
      },
      onToolResult: async (msg) => {
        // Persist each tool result — non-fatal if DB write fails
        for (const result of msg.results) {
          try {
            await enqueueWrite(() => addMessage(sessionId, {
              sessionId,
              role: 'tool',
              content: result.content,
              providerId: options.providerId,
              modelId: options.modelId,
              promptTokens: null,
              completionTokens: null,
              totalTokens: null,
              cachedTokens: null,
              cost: null,
            }).then(() => {}));
          } catch (e) {
            console.warn('[AgentLoop] Failed to persist tool result message:', e);
          }
        }
        setIsToolExecuting(false);
      },
    };

    try {
      const result = await runAgentLoop(
        chatMessages,
        options,
        loopOptions,
        callbacks,
        controller.signal
      );

      stopBatcher();

      // Persist final assistant response
      if (result.content.length > 0 || result.thinkingContent) {
        const cost =
          modelConfig.inputPrice !== null && modelConfig.outputPrice !== null
            ? calculateMessageCost(
                result.totalUsage.promptTokens,
                result.totalUsage.completionTokens,
                modelConfig.inputPrice,
                modelConfig.outputPrice
              )
            : null;

        await addMessage(sessionId, {
          sessionId,
          role: 'assistant',
          content: result.content,
          thinkingContent: result.thinkingContent || undefined,
          providerId: options.providerId,
          modelId: options.modelId,
          promptTokens: result.totalUsage.promptTokens,
          completionTokens: result.totalUsage.completionTokens,
          totalTokens: result.totalUsage.totalTokens,
          cachedTokens: null,
          cost,
        });
      }
    } catch (err: unknown) {
      stopBatcher();

      if (err instanceof ProviderError) {
        setError(providerErrorToChatError(err));
      } else {
        const caughtError = err instanceof Error ? err : new Error(String(err));
        setError({
          message: caughtError.message || 'Agent loop failed',
          isRetryable: true,
        });
      }
    } finally {
      abortControllerRef.current = null;
      setStreaming(false);
      clearStream();
      setTokenRate(0);
      setCurrentIteration(0);
      setIsToolExecuting(false);
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
        ...(providerConfig.generationParams.maxTokensEnabled && providerConfig.generationParams.maxTokens !== undefined
          ? { maxTokens: providerConfig.generationParams.maxTokens }
          : {}),
      };

      // Check if model supports tool use → route through agent loop
      // OpenAI and Anthropic natively support function calling on all models;
      // only 'custom' providers need the explicit supportsToolUse flag.
      const providerAlwaysSupportsTools = providerConfigForService.type === 'openai' || providerConfigForService.type === 'anthropic';
      const modelSupportsTools = providerAlwaysSupportsTools || (modelConfig.supportsToolUse ?? false);
      if (modelSupportsTools) {
        await handleAgentLoop(prependSystemPrompt(chatMessages, providerConfigForService.type), options, sessionId, modelConfig, providerConfigForService);
        return;
      }

      if (providerConfig.streamingEnabled) {
        await handleStreaming(prependSystemPrompt(chatMessages, providerConfigForService.type), options, sessionId, modelConfig);
      } else {
        await handleNonStreaming(prependSystemPrompt(chatMessages, providerConfigForService.type), options, sessionId, modelConfig);
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
        ...(providerConfig.generationParams.maxTokensEnabled && providerConfig.generationParams.maxTokens !== undefined
          ? { maxTokens: providerConfig.generationParams.maxTokens }
          : {}),
      };

      // Check if model supports tool use → route through agent loop
      // OpenAI and Anthropic natively support function calling on all models;
      // only 'custom' providers need the explicit supportsToolUse flag.
      const providerAlwaysSupportsTools = providerConfigForService.type === 'openai' || providerConfigForService.type === 'anthropic';
      const modelSupportsTools = providerAlwaysSupportsTools || (modelConfig.supportsToolUse ?? false);
      if (modelSupportsTools) {
        await handleAgentLoop(prependSystemPrompt(chatMessages, providerConfigForService.type), options, activeSessionId, modelConfig, providerConfigForService);
        return;
      }

      if (providerConfig.streamingEnabled) {
        await handleStreaming(prependSystemPrompt(chatMessages, providerConfigForService.type), options, activeSessionId, modelConfig);
      } else {
        await handleNonStreaming(prependSystemPrompt(chatMessages, providerConfigForService.type), options, activeSessionId, modelConfig);
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
   * Regenerate from a specific assistant message: delete it and all subsequent
   * messages, then resend the remaining context to get a new completion from
   * the currently active model.
   */
  const regenerateFrom = useCallback(
    async (messageId: string) => {
      if (!activeSessionId) return;

      setError(null);

      try {
        await useSessionStore
          .getState()
          .deleteMessageAndSubsequent(activeSessionId, messageId);

        await resendContext();
      } catch (err: unknown) {
        if (err instanceof ProviderError) {
          setError(providerErrorToChatError(err));
        } else {
          const caughtError = err instanceof Error ? err : new Error(String(err));
          setError({
            message: caughtError.message || 'Regeneration failed',
            isRetryable: true,
          });
        }
      }
    },
    [activeSessionId, resendContext]
  );

  /**
   * Abort the current streaming response, flush remaining buffered content,
   * and persist partial assistant message if any content was received.
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop batcher — flushes remaining content to store
    stopBatcher();

    // Persist partial content if any was received
    const { streamContent } = useChatStore.getState();
    if (streamContent.length > 0 && activeSessionId) {
      addMessage(activeSessionId, {
        sessionId: activeSessionId,
        role: 'assistant',
        content: streamContent,
        thinkingContent: useChatStore.getState().thinkingContent || undefined,
        providerId: activeProviderId!,
        modelId: activeModelId!,
        promptTokens: null,
        completionTokens: null,
        totalTokens: null,
        cachedTokens: null,
        cost: null,
      }).catch(() => {
        // Best-effort persistence
      });
    }

    setStreaming(false);
    clearStream();
  }, [setStreaming, clearStream, activeSessionId, activeProviderId, activeModelId, addMessage]);

  /**
   * Retry the last failed message.
   */
  const retry = useCallback(async () => {
    if (lastMessageRef.current) {
      await sendMessage(lastMessageRef.current);
    }
  }, [sendMessage]);

  // Cleanup on unmount: clear flush interval and reset buffer refs to prevent timer leaks
  useEffect(() => {
    return () => {
      if (flushIntervalRef.current !== null) {
        clearInterval(flushIntervalRef.current);
        flushIntervalRef.current = null;
      }
      textBufferRef.current = '';
      thinkingBufferRef.current = '';
      bufferedChunkSizesRef.current = 0;
    };
  }, []);

  return {
    sendMessage,
    resendContext,
    regenerateFrom,
    stopGeneration,
    isStreaming,
    streamContent,
    thinkingContent,
    tokenRate,
    error,
    retry,
    clearError,
    currentIteration,
    isToolExecuting,
  };
}
