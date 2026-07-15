/**
 * OpenAI Responses API request/response format helpers.
 *
 * The Responses API (POST /responses) uses a different request shape
 * than Chat Completions: messages go in an `input` array, and the
 * response content comes from an `output` array.
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
 * Build a request body for the OpenAI Responses API.
 *
 * @param config - Provider configuration
 * @param request - The completion request
 * @param thinkingParams - Provider-specific thinking parameters
 * @returns The URL, headers, and serialized body
 */
export function buildResponsesRequest(
  config: ProviderConfig,
  request: CompletionRequest,
  thinkingParams: Record<string, unknown>,
  apiKey: string
): { url: string; headers: Record<string, string>; body: string } {
  const url = `${config.baseUrl}/responses`;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  // Build input array from messages
  const input = request.messages.map((msg) => ({
    role: msg.role,
    content: formatMessageContent(msg),
  }));

  const body: Record<string, unknown> = {
    model: request.model,
    input,
    stream: request.stream,
  };

  // Add reasoning parameters if present
  if (thinkingParams.reasoning_effort) {
    body.reasoning = { effort: thinkingParams.reasoning_effort };
  }

  if (request.maxTokens !== undefined) {
    body.max_output_tokens = request.maxTokens;
  }

  return {
    url,
    headers,
    body: JSON.stringify(body),
  };
}

/**
 * Parse a non-streaming response from the Responses API.
 *
 * The response shape has an `output` array containing content blocks.
 */
export function parseResponsesResponse(raw: unknown): CompletionResponse {
  const data = raw as Record<string, unknown>;

  let content = '';
  let thinkingContent: string | undefined;

  const output = data.output as Array<Record<string, unknown>> | undefined;
  if (output) {
    for (const block of output) {
      if (block.type === 'message') {
        const messageContent = block.content as Array<Record<string, unknown>> | undefined;
        if (messageContent) {
          for (const part of messageContent) {
            if (part.type === 'output_text') {
              content += (part.text as string) || '';
            }
          }
        }
      } else if (block.type === 'reasoning') {
        const summary = block.summary as Array<Record<string, unknown>> | undefined;
        if (summary) {
          thinkingContent = summary.map((s) => (s.text as string) || '').join('');
        }
      }
    }
  }

  const usage = parseResponsesUsage(data.usage);

  return {
    content,
    thinkingContent,
    usage,
    finishReason: (data.status as string) || 'stop',
  };
}

/**
 * Parse usage from a Responses API response.
 */
function parseResponsesUsage(usage: unknown): TokenUsage {
  if (!usage || typeof usage !== 'object') {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  const u = usage as Record<string, unknown>;
  const promptTokens = (u.input_tokens as number) || 0;
  const completionTokens = (u.output_tokens as number) || 0;

  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cachedTokens: (u.input_tokens_details as Record<string, unknown>)?.cached_tokens as number | undefined,
  };
}

/**
 * Format message content for the Responses API input array.
 */
function formatMessageContent(msg: ChatMessage): string | Array<Record<string, unknown>> {
  if (typeof msg.content === 'string') {
    return msg.content;
  }

  // Multimodal content parts
  return (msg.content as ContentPart[]).map((part) => {
    if (part.type === 'text') {
      return { type: 'input_text', text: part.text };
    }
    // image_url part
    return { type: 'input_image', image_url: part.image_url.url };
  });
}
