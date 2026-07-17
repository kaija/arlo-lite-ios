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
