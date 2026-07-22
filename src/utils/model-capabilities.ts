/**
 * Infers whether a model supports extended reasoning/thinking based on
 * the provider type and model identifier.
 *
 * Heuristic patterns:
 * - Anthropic: All Claude models support reasoning (claude-3, claude-3.5, claude-4, etc.)
 * - OpenAI: Models with "o1", "o3", "o4" prefix support reasoning
 * - Custom: Assume reasoning support if model name contains "reasoning" or known reasoning model patterns
 */
export function inferSupportsReasoning(providerType: string, modelId: string): boolean {
  const id = modelId.toLowerCase();

  switch (providerType) {
    case 'anthropic':
      // All Claude models support extended thinking
      return true;
    case 'openai':
      // OpenAI reasoning models: o1, o3, o4 series
      return /^o[134]/.test(id) || id.includes('o1') || id.includes('o3') || id.includes('o4');
    case 'custom':
      // Heuristic: check for common reasoning model patterns
      return /^o[134]/.test(id) || id.includes('claude') || id.includes('reasoning');
    default:
      return false;
  }
}

/**
 * Infers whether a model supports image/vision input based on
 * the provider type and model identifier.
 *
 * Most modern LLMs support vision. Only known text-only models return false.
 * Defaults to true for unknown models since false-negative (blocking images
 * on a capable model) is worse UX than false-positive (the API will reject).
 */
export function inferSupportsImageInput(providerType: string, modelId: string): boolean {
  const id = modelId.toLowerCase();

  // Known text-only models that do NOT support image input
  const textOnlyPatterns = [
    /^gpt-3\.5/,        // GPT-3.5 series
    /^text-/,           // text-davinci, text-ada, etc.
    /^davinci/,         // legacy completions models
    /^babbage/,
    /^ada/,
    /^curie/,
  ];

  if (textOnlyPatterns.some(p => p.test(id))) return false;

  // All Anthropic Claude 3+ models support vision
  // All OpenAI GPT-4+ models support vision
  // Custom endpoints: default to true (API rejects if unsupported)
  return true;
}
