import { IProvider, ProviderType } from './types';
import { OpenAIProvider } from './openai/openai-provider';
import { AnthropicProvider } from './anthropic/anthropic-provider';
import { CustomProvider } from './custom/custom-provider';

// ponytail: eager instances — adapters are stateless (no constructors), lazy cache was dead weight
const providers: Record<ProviderType, IProvider> = {
  openai: new OpenAIProvider(),
  anthropic: new AnthropicProvider(),
  custom: new CustomProvider(),
};

export function getProvider(type: ProviderType): IProvider {
  const provider = providers[type];
  if (!provider) throw new Error(`Unknown provider type: "${type}"`);
  return provider;
}
