import fc from 'fast-check';
import {
  PROVIDER_PRESETS,
  getPreset,
  presetToWireType,
  inferPresetFromType,
} from '@/constants/provider-presets';
import type { PresetId } from '@/constants/provider-presets';
import type { ProviderType } from '@/database/repositories/provider-repo';
import type { CustomReasoningMode } from '@/domain/thinking-mapper';

// Custom arbitrary for PresetId — draws from actual registry entries
const presetIdArb = fc.constantFrom(...PROVIDER_PRESETS.map((p) => p.id));

// Custom arbitrary for ProviderType
const providerTypeArb = fc.constantFrom<ProviderType>('openai', 'anthropic', 'custom');

// Valid reasoning modes per the domain type
const VALID_REASONING_MODES: CustomReasoningMode[] = [
  'auto',
  'openai-reasoning-effort',
  'chat-template-kwargs',
  'none',
];

/**
 * Pure function that computes whether the connection test button should be enabled.
 * Extracted from ProviderDetailScreen logic for testability.
 */
function isConnectionTestEnabled(presetId: PresetId, baseUrl: string, apiKey: string): boolean {
  const preset = getPreset(presetId);
  if (preset.wireType !== 'custom' || !baseUrl.trim()) return false;
  if (preset.apiKeyRequired && !apiKey.trim()) return false;
  return true;
}

describe('Feature: custom-provider-ux-improvements — Property Tests', () => {
  describe('Property 1: Preset-to-WireType mapping consistency', () => {
    /**
     * Validates: Requirements 3.2
     *
     * For any valid PresetId, presetToWireType returns 'openai' for 'openai',
     * 'anthropic' for 'anthropic', and 'custom' for all others.
     */
    it('maps openai→openai, anthropic→anthropic, all others→custom', () => {
      fc.assert(
        fc.property(presetIdArb, (presetId) => {
          const wireType = presetToWireType(presetId);
          if (presetId === 'openai') return wireType === 'openai';
          if (presetId === 'anthropic') return wireType === 'anthropic';
          return wireType === 'custom';
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Preset defaults resolution completeness', () => {
    /**
     * Validates: Requirements 2.1–2.9, 7.1
     *
     * For any valid PresetId, getPreset() returns a complete ProviderPreset
     * with non-undefined defaultBaseUrl (string), valid defaultReasoningMode,
     * and boolean apiKeyRequired.
     */
    it('getPreset() always returns complete defaults for any preset', () => {
      fc.assert(
        fc.property(presetIdArb, (presetId) => {
          const preset = getPreset(presetId);

          // defaultBaseUrl is a string (possibly empty, but not undefined)
          if (typeof preset.defaultBaseUrl !== 'string') return false;

          // defaultReasoningMode is a valid mode
          if (!VALID_REASONING_MODES.includes(preset.defaultReasoningMode)) return false;

          // apiKeyRequired is a boolean
          if (typeof preset.apiKeyRequired !== 'boolean') return false;

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 3: Legacy preset inference round-trip', () => {
    /**
     * Validates: Requirements 3.4
     *
     * For any ProviderType T, inferPresetFromType(T) produces a PresetId P
     * such that presetToWireType(P) === T. This ensures legacy providers
     * without a stored preset can be round-tripped correctly.
     */
    it('presetToWireType(inferPresetFromType(T)) === T for all wire types', () => {
      fc.assert(
        fc.property(providerTypeArb, (wireType) => {
          const inferredPreset = inferPresetFromType(wireType);
          const roundTripped = presetToWireType(inferredPreset);
          return roundTripped === wireType;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 4: API key requirement consistency', () => {
    /**
     * Validates: Requirements 2.11, 2.12, 6.2, 6.3
     *
     * For any PresetId where apiKeyRequired is false, the connection test button
     * is enabled when baseUrl is non-empty regardless of apiKey.
     * For any PresetId where apiKeyRequired is true, the button requires both
     * baseUrl and apiKey to be non-empty.
     */
    it('button enable logic respects apiKeyRequired for custom wire types', () => {
      // Generate non-empty base URLs (at least one non-whitespace char)
      const nonEmptyBaseUrlArb = fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0);
      // Generate arbitrary API key strings (possibly empty)
      const apiKeyArb = fc.string();

      fc.assert(
        fc.property(presetIdArb, nonEmptyBaseUrlArb, apiKeyArb, (presetId, baseUrl, apiKey) => {
          const preset = getPreset(presetId);

          // Only test custom wire types (connection test only applies to custom)
          if (preset.wireType !== 'custom') return true;

          const enabled = isConnectionTestEnabled(presetId, baseUrl, apiKey);

          if (!preset.apiKeyRequired) {
            // Button should be enabled when baseUrl is non-empty, regardless of apiKey
            return enabled === true;
          } else {
            // Button enabled only when both baseUrl and apiKey are non-empty
            const apiKeyNonEmpty = apiKey.trim().length > 0;
            return enabled === apiKeyNonEmpty;
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
