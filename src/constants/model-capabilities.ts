/**
 * Model capabilities lookup from the static catalog.
 *
 * Matches a user-provided model ID against model-catalog.json entries
 * (including aliases) and returns default capability flags + pricing.
 * Users can override any field after auto-population.
 */

import catalog from './model-catalog.json';

/** Shape of a single entry in model-catalog.json. */
interface CatalogEntry {
  id: string;
  provider: string;
  displayName: string;
  aliases: string[];
  contextWindow: number | null;
  maxOutputTokens: number | null;
  pricing: {
    input: number | null;
    output: number | null;
    cacheWrite: number | null;
    cacheRead: number | null;
    tieredNotes: string;
  };
  modalities: {
    textIn: boolean;
    textOut: boolean;
    imageIn: boolean;
    imageOut: boolean;
    audioIn: boolean;
    audioOut: boolean;
    videoIn: boolean;
    pdfIn: boolean | null;
  };
  features: {
    tools: boolean | null;
    structuredOutput: boolean | null;
    promptCaching: boolean | null;
    reasoning: boolean | null;
    realtimeVoice: boolean;
    streaming: boolean | null;
  };
  status: string;
  knowledgeCutoff: string | null;
  deprecationDate: string | null;
  sourceUrl: string;
}

/** Defaults returned from the catalog for a matched model. */
export interface ModelDefaults {
  displayName: string;
  contextWindow: number | null;
  inputPrice: number | null;
  outputPrice: number | null;
  cachedInputPrice: number | null;
  supportsReasoning: boolean;
  supportsImageInput: boolean;
  supportsImageGeneration: boolean;
  supportsFileInput: boolean;
  supportsToolUse: boolean;
}

// Build a lookup map: modelId/alias → catalog entry (case-insensitive)
const lookupMap = new Map<string, CatalogEntry>();
for (const entry of catalog as CatalogEntry[]) {
  lookupMap.set(entry.id.toLowerCase(), entry);
  for (const alias of entry.aliases) {
    lookupMap.set(alias.toLowerCase(), entry);
  }
}

/**
 * Look up default capabilities for a model ID.
 *
 * Matches against catalog IDs and aliases (case-insensitive).
 * Returns null if no match found — caller should fall back to
 * manual user input.
 */
export function getModelDefaults(modelId: string): ModelDefaults | null {
  const entry = lookupMap.get(modelId.toLowerCase());
  if (!entry) return null;

  return {
    displayName: entry.displayName,
    contextWindow: entry.contextWindow,
    inputPrice: entry.pricing.input != null ? entry.pricing.input / 1_000_000 : null,
    outputPrice: entry.pricing.output != null ? entry.pricing.output / 1_000_000 : null,
    cachedInputPrice: entry.pricing.cacheRead != null ? entry.pricing.cacheRead / 1_000_000 : null,
    supportsReasoning: entry.features.reasoning === true,
    supportsImageInput: entry.modalities.imageIn === true,
    supportsImageGeneration: entry.modalities.imageOut === true,
    supportsFileInput: entry.modalities.pdfIn === true,
    supportsToolUse: entry.features.tools === true,
  };
}
