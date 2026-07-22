/**
 * Agent loop — iterative tool-execution orchestrator.
 *
 * Calls the provider, detects tool calls, executes them, appends results,
 * and loops until the model produces a final text response or a cap is hit.
 */

import { getApiKey } from '@/database/secure-store';
import { getProvider } from '@/providers/registry';
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  ProviderType,
  StreamChunk,
  TokenUsage,
  ToolCall,
} from '@/providers/types';
import type { CompletionServiceOptions } from '@/services/completion-service';
import { executeToolCalls, ToolResult } from '@/services/tool-executor';
import { getToolSchemas } from '@/services/tool-registry';

// ─── Public types ───────────────────────────────────────────────────────────

export type TerminationReason = 'final_response' | 'safety_cap' | 'aborted' | 'error';

export interface AgentLoopResult {
  content: string;
  thinkingContent?: string;
  totalUsage: TokenUsage;
  terminationReason: TerminationReason;
  iterationCount: number;
}

export interface ToolCallMessage {
  toolCalls: ToolCall[];
  content?: string;
  thinkingContent?: string;
}

export interface ToolResultMessage {
  results: ToolResult[];
}

export interface AgentLoopCallbacks {
  onToolCall: (msg: ToolCallMessage) => Promise<void>;
  onToolResult: (msg: ToolResultMessage) => Promise<void>;
  onStreamText?: (chunk: string) => void;
  onStreamThinking?: (chunk: string) => void;
  onIntermediateContent?: (content: string, thinkingContent?: string) => Promise<void>;
}

export interface AgentLoopOptions {
  safetyCap?: number;
  providerType: ProviderType;
  supportsToolUse: boolean;
  streaming: boolean;
}

// ─── Main loop ──────────────────────────────────────────────────────────────

const DEFAULT_SAFETY_CAP = 10;

export async function runAgentLoop(
  messages: ChatMessage[],
  completionOptions: CompletionServiceOptions,
  loopOptions: AgentLoopOptions,
  callbacks: AgentLoopCallbacks,
  signal: AbortSignal,
): Promise<AgentLoopResult> {
  const { providerType, supportsToolUse, streaming } = loopOptions;
  const safetyCap = loopOptions.safetyCap ?? DEFAULT_SAFETY_CAP;

  const totalUsage: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  let iterationCount = 0;

  // Non-tool model bypass: single-turn, no tools attached.
  if (!supportsToolUse) {
    const res = streaming
      ? await streamOnce(messages, completionOptions, undefined, callbacks, signal, totalUsage)
      : await completeOnce(messages, completionOptions, undefined, totalUsage);
    return { content: res.content, thinkingContent: res.thinking, totalUsage, terminationReason: 'final_response', iterationCount: 1 };
  }

  const tools = getToolSchemas(providerType, completionOptions.providerConfig.apiMode);
  const context = [...messages]; // mutable working copy

  while (iterationCount < safetyCap) {
    if (signal.aborted) return { content: '', totalUsage, terminationReason: 'aborted', iterationCount };

    iterationCount++;

    const res = streaming
      ? await streamOnce(context, completionOptions, tools, callbacks, signal, totalUsage)
      : await completeOnce(context, completionOptions, tools, totalUsage);

    if (res.toolCalls.length === 0) {
      return { content: res.content, thinkingContent: res.thinking, totalUsage, terminationReason: 'final_response', iterationCount };
    }

    // Intermediate text before tool calls
    if (res.content && callbacks.onIntermediateContent) {
      await callbacks.onIntermediateContent(res.content, res.thinking);
    }

    await callbacks.onToolCall({ toolCalls: res.toolCalls, content: res.content || undefined, thinkingContent: res.thinking || undefined });

    // Append assistant message with tool calls to context
    context.push(formatAssistantToolCall(res.toolCalls, res.content, res.thinking));

    // Execute tools
    const results = await executeToolCalls(res.toolCalls, signal);
    await callbacks.onToolResult({ results });

    // Append tool result messages
    for (const msg of formatToolResults(results)) {
      context.push(msg);
    }
  }

  return { content: '', totalUsage, terminationReason: 'safety_cap', iterationCount };
}

// ─── Internal helpers ───────────────────────────────────────────────────────

interface IterationResult {
  content: string;
  thinking: string;
  toolCalls: ToolCall[];
}

/** Stream a single completion turn, forwarding chunks to callbacks and collecting tool calls. */
async function streamOnce(
  messages: ChatMessage[],
  opts: CompletionServiceOptions,
  tools: unknown[] | undefined,
  callbacks: AgentLoopCallbacks,
  signal: AbortSignal,
  usage: TokenUsage,
): Promise<IterationResult> {
  const request = buildRequest(messages, opts, true, tools);
  const apiKey = await getApiKey(opts.providerId) ?? 'sk-no-key-required';
  const provider = getProvider(opts.providerConfig.type);

  let content = '';
  let thinking = '';
  const toolCalls: ToolCall[] = [];

  for await (const chunk of provider.streamCompletion(opts.providerConfig, request, apiKey, signal)) {
    switch (chunk.type) {
      case 'text':
        content += chunk.content;
        callbacks.onStreamText?.(chunk.content);
        break;
      case 'thinking':
        thinking += chunk.content;
        callbacks.onStreamThinking?.(chunk.content);
        break;
      case 'tool_call':
        if (chunk.toolCall) toolCalls.push(chunk.toolCall);
        break;
      case 'done':
        if (chunk.usage) addUsage(usage, chunk.usage);
        break;
      // error chunks are thrown by the provider iterable, not handled here
    }
  }

  return { content, thinking, toolCalls };
}

/** Non-streaming single completion turn. */
async function completeOnce(
  messages: ChatMessage[],
  opts: CompletionServiceOptions,
  tools: unknown[] | undefined,
  usage: TokenUsage,
): Promise<IterationResult> {
  const request = buildRequest(messages, opts, false, tools);
  const apiKey = await getApiKey(opts.providerId) ?? 'sk-no-key-required';
  const provider = getProvider(opts.providerConfig.type);

  const res: CompletionResponse = await provider.complete(opts.providerConfig, request, apiKey);
  addUsage(usage, res.usage);

  // ponytail: non-streaming tool call detection is limited — providers return toolCalls
  // via finishReason hints but CompletionResponse doesn't carry them yet.
  // For now non-streaming returns as final response. Upgrade path: add toolCalls to CompletionResponse.
  return { content: res.content, thinking: res.thinkingContent ?? '', toolCalls: [] };
}

function buildRequest(
  messages: ChatMessage[],
  opts: CompletionServiceOptions,
  stream: boolean,
  tools: unknown[] | undefined,
): CompletionRequest {
  return {
    messages,
    model: opts.modelId,
    thinkingLevel: opts.thinkingLevel,
    stream,
    maxTokens: opts.maxTokens,
    ...(tools?.length ? { tools } : {}),
  };
}

function addUsage(acc: TokenUsage, iter: TokenUsage): void {
  acc.promptTokens += iter.promptTokens;
  acc.completionTokens += iter.completionTokens;
  acc.totalTokens += iter.totalTokens;
}

function formatAssistantToolCall(toolCalls: ToolCall[], content: string, thinking: string): ChatMessage {
  return {
    role: 'assistant',
    content: content || '',
    ...(thinking ? { thinkingContent: thinking } : {}),
    toolCalls,
  };
}

function formatToolResults(results: ToolResult[]): ChatMessage[] {
  // OpenAI/Custom format: one tool message per result.
  // Anthropic adapters handle the API-specific wrapping themselves.
  return results.map((r) => ({
    role: 'tool' as const,
    content: r.content,
    tool_call_id: r.toolCallId,
  }));
}
