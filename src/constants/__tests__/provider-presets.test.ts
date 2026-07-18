import {
  PROVIDER_PRESETS,
  getPreset,
  presetToWireType,
  inferPresetFromType,
} from '@/constants/provider-presets';
import type { PresetId } from '@/constants/provider-presets';
import type { ProviderType } from '@/database/repositories/provider-repo';

describe('provider-presets registry', () => {
  const EXPECTED_ORDER: PresetId[] = [
    'openai',
    'anthropic',
    'openrouter',
    'llama-cpp',
    'ollama',
    'vllm',
    'google',
    'bedrock',
    'other',
  ];

  describe('PROVIDER_PRESETS', () => {
    it('has exactly 9 entries', () => {
      expect(PROVIDER_PRESETS).toHaveLength(9);
    });

    it('entries are in the specified order', () => {
      const ids = PROVIDER_PRESETS.map((p) => p.id);
      expect(ids).toEqual(EXPECTED_ORDER);
    });

    it.each([
      ['openai', 'openai'],
      ['anthropic', 'anthropic'],
      ['openrouter', 'custom'],
      ['llama-cpp', 'custom'],
      ['ollama', 'custom'],
      ['vllm', 'custom'],
      ['google', 'custom'],
      ['bedrock', 'custom'],
      ['other', 'custom'],
    ] as const)('%s has wireType "%s"', (presetId, expectedWireType) => {
      const preset = PROVIDER_PRESETS.find((p) => p.id === presetId);
      expect(preset).toBeDefined();
      expect(preset!.wireType).toBe(expectedWireType);
    });
  });

  describe('getPreset()', () => {
    it.each(EXPECTED_ORDER)('returns correct preset for "%s"', (id) => {
      const preset = getPreset(id);
      expect(preset.id).toBe(id);
    });

    it('falls back to "other" for unknown ID', () => {
      const preset = getPreset('nonexistent' as PresetId);
      expect(preset.id).toBe('other');
    });
  });

  describe('presetToWireType()', () => {
    it.each([
      ['openai', 'openai'],
      ['anthropic', 'anthropic'],
      ['openrouter', 'custom'],
      ['llama-cpp', 'custom'],
      ['ollama', 'custom'],
      ['vllm', 'custom'],
      ['google', 'custom'],
      ['bedrock', 'custom'],
      ['other', 'custom'],
    ] as const)('maps "%s" → "%s"', (presetId, expectedWireType) => {
      expect(presetToWireType(presetId)).toBe(expectedWireType);
    });
  });

  describe('inferPresetFromType()', () => {
    it.each([
      ['openai', 'openai'],
      ['anthropic', 'anthropic'],
      ['custom', 'other'],
    ] as const)('maps wire type "%s" → preset "%s"', (wireType, expectedPreset) => {
      expect(inferPresetFromType(wireType as ProviderType)).toBe(expectedPreset);
    });
  });
});
