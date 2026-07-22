import { inferSupportsReasoning, inferSupportsImageInput } from '../model-capabilities';

describe('inferSupportsImageInput', () => {
  it('returns false for GPT-3.5 models', () => {
    expect(inferSupportsImageInput('openai', 'gpt-3.5-turbo')).toBe(false);
    expect(inferSupportsImageInput('openai', 'GPT-3.5-turbo-16k')).toBe(false);
  });

  it('returns false for legacy text/davinci/ada/babbage/curie models', () => {
    expect(inferSupportsImageInput('openai', 'text-davinci-003')).toBe(false);
    expect(inferSupportsImageInput('openai', 'davinci-002')).toBe(false);
    expect(inferSupportsImageInput('openai', 'babbage-002')).toBe(false);
    expect(inferSupportsImageInput('openai', 'ada-002')).toBe(false);
    expect(inferSupportsImageInput('openai', 'curie-001')).toBe(false);
  });

  it('returns true for GPT-4 and newer models', () => {
    expect(inferSupportsImageInput('openai', 'gpt-4o')).toBe(true);
    expect(inferSupportsImageInput('openai', 'gpt-4-turbo')).toBe(true);
    expect(inferSupportsImageInput('openai', 'gpt-4.1')).toBe(true);
  });

  it('returns true for Claude models', () => {
    expect(inferSupportsImageInput('anthropic', 'claude-3-5-sonnet-20241022')).toBe(true);
    expect(inferSupportsImageInput('anthropic', 'claude-4-opus')).toBe(true);
  });

  it('defaults to true for custom/unknown models', () => {
    expect(inferSupportsImageInput('custom', 'my-local-llm')).toBe(true);
    expect(inferSupportsImageInput('unknown', 'whatever')).toBe(true);
  });
});

describe('inferSupportsReasoning', () => {
  it('returns true for Anthropic models', () => {
    expect(inferSupportsReasoning('anthropic', 'claude-3-5-sonnet')).toBe(true);
  });

  it('returns true for OpenAI o-series', () => {
    expect(inferSupportsReasoning('openai', 'o1-preview')).toBe(true);
    expect(inferSupportsReasoning('openai', 'o3-mini')).toBe(true);
  });

  it('returns false for OpenAI GPT models', () => {
    expect(inferSupportsReasoning('openai', 'gpt-4o')).toBe(false);
  });
});
