/**
 * Provider registry — factory that returns the appropriate IProvider
 * instance based on ProviderType.
 *
 * Adding a new provider requires only:
 * 1. Implementing the IProvider interface
 * 2. Registering the instance in the providers map below
 *
 * Instances are lazy singletons: created on first request, then reused.
 */

import { IProvider, ProviderType } from './types';
import { OpenAIProvider } from './openai/openai-provider';
import { AnthropicProvider } from './anthropic/anthropic-provider';
import { CustomProvider } from './custom/custom-provider';

/** Lazy singleton cache for provider instances. */
const instances = new Map<ProviderType, IProvider>();

/** Factory functions for each supported provider type. */
const factories: Record<ProviderType, () => IProvider> = {
  openai: () => new OpenAIProvider(),
  anthropic: () => new AnthropicProvider(),
  custom: () => new CustomProvider(),
};

/**
 * Returns the IProvider instance for the given provider type.
 *
 * Uses lazy singletons — the adapter is instantiated on first call
 * and reused for all subsequent calls with the same type.
 *
 * @param type - The provider type to retrieve
 * @returns The IProvider adapter for the given type
 * @throws Error if the provider type is not recognized
 */
export function getProvider(type: ProviderType): IProvider {
  const cached = instances.get(type);
  if (cached) return cached;

  const factory = factories[type];
  if (!factory) {
    throw new Error(`Unknown provider type: "${type}"`);
  }

  const instance = factory();
  instances.set(type, instance);
  return instance;
}

/**
 * Clears the singleton cache. Primarily useful for testing.
 */
export function clearProviderCache(): void {
  instances.clear();
}
