/**
 * OpenAI Chat Completions API request/response format helpers.
 *
 * The Chat Completions API (POST /chat/completions) uses the standard
 * messages array format and returns content via choices[0].message.
 */

import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  ContentPart,
  ProviderConfig,
  TokenUsage,
} from '../types';

/**
 * Build a request body for the OpenAI Chat Completions API.
 *
 * @param config - Provider configuration
 * @param request - The completion request
 * @param thinkingParams - Provider-specific thinking parameters
 * @param apiKey - The API key for authorization
 * @returns The URL, headers, and serialized body
 */
export function buildChatCompletionsRequest(
  config: ProviderConfig,
  request: CompletionRequest,
  thinkingParams: Record<string, unknown>,
  apiKey: string
): { url: string; headers: Record<string, string>; body: string } {
  const url = `${config.baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Build messages array
  const messages = request.messages.map((msg) => ({
    role: msg.role,
    content: formatMessageContent(msg),
  }));

  const body: Record<string, unknown> = {
    model: request.model,
    messages,
    stream: request.stream,
  };

  // Add reasoning_effort if present (OpenAI's reasoning parameter for Chat Completions)
  if (thinkingParams.reasoning_effort) {
    body.reasoning_effort = thinkingParams.reasoning_effort;
  }

  if (request.maxTokens !== undefined) {
    body.max_tokens = request.maxTokens;
  }

  return {
    url,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * Parse a non-streaming response from the Chat Completions API.
 *
 * Response shape: { choices: [{ message: { content, ... }, finish_reason }], usage: {...} }
 */
export function parseChatCompletionsResponse(raw: unknown): CompletionResponse {
  const data = raw as Record<string, unknown>;
  const choices = data.choices as Array<Record<string, unknown>> | undefined;

  let content = '';
  let thinkingContent: string | undefined;
  let finishReason = 'stop';

  if (choices && choices.length > 0) {
    const choice = choices[0];
    const message = choice.message as Record<string, unknown> | undefined;

    if (message) {
      content = (message.content as string) || '';

      // Some models return reasoning content in a separate field
      if (message.reasoning_content) {
        thinkingContent = message.reasoning_content as string;
      }
    }

    finishReason = (choice.finish_reason as string) || 'stop';
  }

  const usage = parseChatCompletionsUsage(data.usage);

  return {
    content,
    thinkingContent,
    usage,
    finishReason,
  };
}

/**
 * Parse usage from a Chat Completions API response.
 */
function parseChatCompletionsUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const u = usage as Record<string, unknown>;
  const promptTokens = (u.prompt_tokens as number) || 0;
  const completionTokens = (u.completion_tokens as number) || 0;
  const totalTokens = (u.total_tokens as number) || (promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
    cachedTokens: (u.prompt_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
  };
}

/**
 * Format message content for the Chat Completions API messages array.
 */
function formatMessageContent(msg: ChatMessage): string | Array<Record<string, unknown>> {
  if (typeof msg.content === 'string') {
    return msg.content;
  }

  // Multimodal content parts
  return (msg.content as ContentPart[]).map((part) => {
    if (part.type === 'text') {
      return { type: 'text', text: part.text };
    }
    // image_url part
    return { type: 'image_url', image_url: { url: part.image_url.url } };
  });
}
