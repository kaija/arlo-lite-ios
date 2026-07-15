import { getProvider, clearProviderCache } from '../registry';
import { OpenAIProvider } from '../openai/openai-provider';
import { AnthropicProvider } from '../anthropic/anthropic-provider';
import { CustomProvider } from '../custom/custom-provider';
import { ProviderType } from '../types';

describe('Provider Registry', () => {
  beforeEach(() => {
    clearProviderCache();
  });

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

  it('returns the same singleton instance on repeated calls', () => {
    const first = getProvider('openai');
    const second = getProvider('openai');
    expect(first).toBe(second);
  });

  it('returns fresh instances after cache is cleared', () => {
    const first = getProvider('anthropic');
    clearProviderCache();
    const second = getProvider('anthropic');
    expect(first).not.toBe(second);
    expect(second).toBeInstanceOf(AnthropicProvider);
  });

  it('throws an error for unrecognized provider types', () => {
    expect(() => getProvider('unknown' as ProviderType)).toThrow(
      'Unknown provider type: "unknown"',
    );
  });
});
