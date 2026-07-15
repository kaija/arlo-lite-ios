/**
 * Provider interface and types for the Arlo Lite provider abstraction layer.
 *
 * All provider adapters (OpenAI, Anthropic, Custom) implement the IProvider
 * interface defined here. This enables a uniform request/response pipeline
 * regardless of the underlying API differences.
 */

/** Supported provider types. */
export type ProviderType = 'openai' | 'anthropic' | 'custom';

/** OpenAI API mode selection — Responses API or Chat Completions API. */
export type OpenAIApiMode = 'responses' | 'chat-completions';

/** Abstract reasoning effort level mapped to provider-specific parameters. */
export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Configuration for a registered LLM provider.
 * Each provider has a type, a display name, a base URL, and streaming preference.
 */
export interface ProviderConfig {
  /** Unique identifier for this provider instance. */
  id: string;
  /** The type of provider (openai, anthropic, or custom). */
  type: ProviderType;
  /** User-facing display name for this provider. */
  name: string;
  /** Base URL for API requests (e.g. https://api.openai.com/v1). */
  baseUrl: string;
  /** API mode selection — only applicable for OpenAI-type providers. */
  apiMode?: OpenAIApiMode;
  /** Whether SSE streaming is enabled for this provider. */
  streamingEnabled: boolean;
  /** Unix timestamp (ms) when this provider was created. */
  createdAt: number;
  /** Unix timestamp (ms) when this provider was last updated. */
  updatedAt: number;
}

/**
 * Configuration for a specific model registered under a provider.
 * Contains metadata for pricing, capabilities, and context limits.
 */
export interface ModelConfig {
  /** Unique identifier for this model configuration. */
  id: string;
  /** The provider this model belongs to. */
  providerId: string;
  /** The model identifier as recognized by the provider API. */
  modelId: string;
  /** User-facing display name for this model. */
  displayName: string;
  /** Maximum context window size in tokens, or null if unknown. */
  contextWindow: number | null;
  /** Cost per million input tokens, or null if unknown. */
  inputPrice: number | null;
  /** Cost per million output tokens, or null if unknown. */
  outputPrice: number | null;
  /** Cost per million cached input tokens, or null if unknown. */
  cachedInputPrice: number | null;
  /** Cost per million cached output tokens, or null if unknown. */
  cachedOutputPrice: number | null;
  /** Whether this model supports extended reasoning/thinking. */
  supportsReasoning: boolean;
  /** Whether this model accepts image inputs. */
  supportsImageInput: boolean;
  /** Whether this model can generate images. */
  supportsImageGeneration: boolean;
  /** Whether this model accepts file inputs. */
  supportsFileInput: boolean;
}

/**
 * A single message in a chat conversation.
 * Content can be plain text or multimodal content parts.
 */
export interface ChatMessage {
  /** The role of the message sender. */
  role: 'system' | 'user' | 'assistant';
  /** Message content — plain text string or array of content parts for multimodal input. */
  content: string | ContentPart[];
  /** Optional reasoning/thinking content produced by the model. */
  thinkingContent?: string;
}

/** A content part within a multimodal message. */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

/**
 * A single chunk emitted during streaming.
 * The stream produces text, thinking, done, or error chunks.
 */
export interface StreamChunk {
  /** The type of this chunk. */
  type: 'text' | 'thinking' | 'done' | 'error';
  /** The content payload for this chunk. */
  content: string;
  /** Token usage data, typically present on the final 'done' chunk. */
  usage?: TokenUsage;
}

/**
 * Token usage statistics for a completion request.
 */
export interface TokenUsage {
  /** Number of tokens in the prompt/input. */
  promptTokens: number;
  /** Number of tokens in the completion/output. */
  completionTokens: number;
  /** Total tokens used (prompt + completion). */
  totalTokens: number;
  /** Number of tokens served from cache, if applicable. */
  cachedTokens?: number;
}

/**
 * A request to generate a completion from an LLM provider.
 */
export interface CompletionRequest {
  /** The conversation messages to send. */
  messages: ChatMessage[];
  /** The model identifier to use for this request. */
  model: string;
  /** The thinking/reasoning effort level for this request. */
  thinkingLevel: ThinkingLevel;
  /** Whether to stream the response via SSE. */
  stream: boolean;
  /** Optional maximum number of tokens to generate. */
  maxTokens?: number;
}

/**
 * A parsed completion response from an LLM provider.
 */
export interface CompletionResponse {
  /** The generated text content. */
  content: string;
  /** Optional reasoning/thinking content from the model. */
  thinkingContent?: string;
  /** Token usage statistics for this completion. */
  usage: TokenUsage;
  /** The reason the model stopped generating (e.g. 'stop', 'length'). */
  finishReason: string;
}

/**
 * Common Provider interface — all provider adapters implement this.
 *
 * Adding a new provider requires only implementing this interface.
 * The interface covers the full lifecycle: building requests, parsing
 * responses (streaming and non-streaming), thinking-level mapping,
 * model discovery, and API key validation.
 */
export interface IProvider {
  /** The provider type this adapter handles. */
  readonly type: ProviderType;

  /**
   * Build the HTTP request for a completion.
   *
   * @param config - The provider configuration (base URL, API mode, etc.)
   * @param request - The completion request parameters
   * @returns An object containing the full URL, headers, and JSON-serialized body
   */
  buildRequest(config: ProviderConfig, request: CompletionRequest): {
    url: string;
    headers: Record<string, string>;
    body: string;
  };

  /**
   * Parse a non-streaming response into a structured CompletionResponse.
   *
   * @param raw - The raw JSON response from the provider API
   * @returns A normalized CompletionResponse
   */
  parseResponse(raw: unknown): CompletionResponse;

  /**
   * Parse a single SSE line into a StreamChunk.
   *
   * @param line - A single line from the SSE stream (e.g. "data: {...}")
   * @returns A StreamChunk if the line contains parseable data, or null if it should be skipped
   */
  parseStreamChunk(line: string): StreamChunk | null;

  /**
   * Map an abstract ThinkingLevel to provider-specific request parameters.
   *
   * @param level - The abstract thinking effort level
   * @returns A record of provider-specific parameters to merge into the request body
   */
  mapThinkingLevel(level: ThinkingLevel): Record<string, unknown>;

  /**
   * List available models from the provider API.
   *
   * @param config - The provider configuration
   * @param apiKey - The API key to authenticate with
   * @returns A promise resolving to an array of model ID strings
   */
  listModels(config: ProviderConfig, apiKey: string): Promise<string[]>;

  /**
   * Validate an API key by sending a minimal request to the provider.
   *
   * @param config - The provider configuration
   * @param apiKey - The API key to validate
   * @returns A promise resolving to true if the key is valid, false otherwise
   */
  validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean>;
}
