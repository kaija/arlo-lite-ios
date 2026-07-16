/**
 * Completion service — orchestrates completion requests between the UI layer
 * and provider adapters.
 *
 * Responsibilities:
 * - Retrieve API key from secure store
 * - Select provider adapter via registry
 * - Build a CompletionRequest and delegate to the provider
 * - Surface authentication errors when no key is stored
 *
 * This module owns no network logic. All HTTP/SDK work is handled by
 * the provider adapters themselves.
 */

import { getApiKey } from '@/database/secure-store';
import { getProvider } from '@/providers/registry';
import { ProviderError } from '@/providers/errors';
import type {
  ChatMessage,
  CompletionRequest,
  CompletionResponse,
  ProviderConfig,
  StreamChunk,
  ThinkingLevel,
} from '@/providers/types';

/**
 * Options required to initiate a completion request.
 *
 * Combines provider identity, configuration, model selection,
 * and reasoning effort into a single parameter object.
 */
export interface CompletionServiceOptions {
  /** The unique identifier of the provider (used to retrieve the stored API key). */
  providerId: string;
  /** Full provider configuration (type, baseUrl, apiMode, etc.). */
  providerConfig: ProviderConfig;
  /** The model identifier to use for this completion. */
  modelId: string;
  /** The thinking/reasoning effort level for this request. */
  thinkingLevel: ThinkingLevel;
}

/**
 * Streams a completion response from the configured provider.
 *
 * Retrieves the API key from secure storage, resolves the provider adapter,
 * builds the request, and yields chunks as they arrive from the provider's
 * streaming endpoint.
 *
 * @param messages - The conversation messages to send.
 * @param options - Provider and model configuration.
 * @param signal - AbortSignal for cancellation support.
 * @yields StreamChunk objects as they arrive (text, thinking, done, or error).
 * @throws ProviderError with category 'authentication' if no API key is stored.
 * @throws ProviderError for network, rate-limit, or server failures from the provider.
 */
export async function* streamCompletion(
  messages: ChatMessage[],
  options: CompletionServiceOptions,
  signal: AbortSignal,
): AsyncGenerator<StreamChunk> {
  const apiKey = await getApiKey(options.providerId);
  if (!apiKey) throw new ProviderError('API key not found', 'authentication');

  const provider = getProvider(options.providerConfig.type);
  const request: CompletionRequest = {
    messages,
    model: options.modelId,
    thinkingLevel: options.thinkingLevel,
    stream: true,
  };

  yield* provider.streamCompletion(options.providerConfig, request, apiKey, signal);
}

/**
 * Executes a non-streaming completion request against the configured provider.
 *
 * Retrieves the API key from secure storage, resolves the provider adapter,
 * builds the request, and returns the full completion response.
 *
 * @param messages - The conversation messages to send.
 * @param options - Provider and model configuration.
 * @returns The parsed CompletionResponse with content, usage, and finish reason.
 * @throws ProviderError with category 'authentication' if no API key is stored.
 * @throws ProviderError for network, rate-limit, or server failures from the provider.
 */
export async function complete(
  messages: ChatMessage[],
  options: CompletionServiceOptions,
): Promise<CompletionResponse> {
  const apiKey = await getApiKey(options.providerId);
  if (!apiKey) throw new ProviderError('API key not found', 'authentication');

  const provider = getProvider(options.providerConfig.type);
  const request: CompletionRequest = {
    messages,
    model: options.modelId,
    thinkingLevel: options.thinkingLevel,
    stream: false,
  };

  return provider.complete(options.providerConfig, request, apiKey);
}

/**
 * Tests connectivity and API key validity for a provider.
 *
 * Retrieves the stored API key and delegates to the provider's
 * validateApiKey method, which makes a minimal API request to confirm
 * the key is accepted.
 *
 * @param providerId - The unique identifier of the provider.
 * @param providerConfig - The provider configuration (type, baseUrl, etc.).
 * @returns true if the API key is valid and the provider is reachable.
 * @throws ProviderError with category 'authentication' if no API key is stored.
 * @throws ProviderError for network or server failures during validation.
 */
export async function testConnection(
  providerId: string,
  providerConfig: ProviderConfig,
): Promise<boolean> {
  const apiKey = await getApiKey(providerId);
  if (!apiKey) throw new ProviderError('API key not found', 'authentication');

  const provider = getProvider(providerConfig.type);
  return provider.validateApiKey(providerConfig, apiKey);
}
