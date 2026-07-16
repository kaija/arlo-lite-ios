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
  /** Sampling temperature (0.0–2.0). */
  temperature?: number;
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
 * Common provider interface — SDK-based and raw-fetch providers
 * both implement this contract.
 *
 * Adding a new provider requires only implementing this interface.
 * The interface covers completions (streaming and non-streaming),
 * model discovery, and API key validation.
 */
export interface IProvider {
  /** The provider type this adapter handles. */
  readonly type: ProviderType;

  /**
   * Execute a non-streaming completion request.
   *
   * @param config - Provider configuration (baseUrl, apiMode, etc.)
   * @param request - The completion request parameters
   * @param apiKey - API key for authentication
   * @returns Parsed CompletionResponse
   * @throws ProviderError on auth, network, or server failures
   */
  complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse>;

  /**
   * Execute a streaming completion request.
   *
   * Returns an AsyncIterable that yields StreamChunks as they arrive.
   * The iterable terminates with a 'done' chunk on success or an 'error'
   * chunk on failure.
   *
   * @param config - Provider configuration
   * @param request - The completion request parameters
   * @param apiKey - API key for authentication
   * @param signal - AbortSignal for cancellation
   * @returns AsyncIterable of StreamChunk objects
   */
  streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk>;

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
