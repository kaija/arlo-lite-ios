import { getProvider } from '../registry';
import { OpenAIProvider } from '../openai/openai-provider';
import { AnthropicProvider } from '../anthropic/anthropic-provider';
import { CustomProvider } from '../custom/custom-provider';
import { ProviderType } from '../types';

describe('Provider Registry', () => {
  it('returns an OpenAIProvider for "openai" type', () => {
    const provider = getProvider('openai');
    expect(provider).toBeInstanceOf(OpenAIProvider);
    expect(provider.type).toBe('openai');
  });

  it('returns an AnthropicProvider for "anthropic" type', () => {
    const provider = getProvider('anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.type).toBe('anthropic');
  });

  it('returns a CustomProvider for "custom" type', () => {
    const provider = getProvider('custom');
    expect(provider).toBeInstanceOf(CustomProvider);
    expect(provider.type).toBe('custom');
  });

  it('returns the same instance on repeated calls', () => {
    const first = getProvider('openai');
    const second = getProvider('openai');
    expect(first).toBe(second);
  });

  it('throws an error for unrecognized provider types', () => {
    expect(() => getProvider('unknown' as ProviderType)).toThrow(
      'Unknown provider type: "unknown"',
    );
  });
});
