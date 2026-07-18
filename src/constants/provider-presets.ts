/**
 * Provider Presets Registry — defines all supported provider presets with their
 * default configurations. Each preset carries sensible defaults (base URL,
 * reasoning mode, API key requirement) so users can configure services with
 * minimal manual entry.
 *
 * The key design principle is separation of identity from protocol: the `preset`
 * field records which service the user chose (for UI display and defaults),
 * while the existing `type` field selects the SDK adapter at runtime.
 */

import type { CustomReasoningMode } from '@/domain/thinking-mapper';
import type { ProviderType } from '@/database/repositories/provider-repo';

/** Unique identifier for a provider preset. */
export type PresetId =
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'llama-cpp'
  | 'ollama'
  | 'vllm'
  | 'google'
  | 'bedrock'
  | 'other';

/** Preset definition — immutable configuration for a provider service. */
export interface ProviderPreset {
  /** Unique preset identifier */
  id: PresetId;
  /** Underlying wire type for SDK adapter selection */
  wireType: ProviderType;
  /** i18n translation key for the display name */
  labelKey: string;
  /** i18n translation key for contextual help text */
  descriptionKey: string;
  /** Default base URL (empty string = user must provide) */
  defaultBaseUrl: string;
  /** Default reasoning mode for this backend */
  defaultReasoningMode: CustomReasoningMode;
  /** Whether an API key is required to connect */
  apiKeyRequired: boolean;
}

/** All supported provider presets in display order. */
export const PROVIDER_PRESETS: readonly ProviderPreset[] = [
  {
    id: 'openai',
    wireType: 'openai',
    labelKey: 'providers.presetOpenAI',
    descriptionKey: 'providers.presetOpenAIDesc',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultReasoningMode: 'auto',
    apiKeyRequired: true,
  },
  {
    id: 'anthropic',
    wireType: 'anthropic',
    labelKey: 'providers.presetAnthropic',
    descriptionKey: 'providers.presetAnthropicDesc',
    defaultBaseUrl: 'https://api.anthropic.com',
    defaultReasoningMode: 'auto',
    apiKeyRequired: true,
  },
  {
    id: 'openrouter',
    wireType: 'custom',
    labelKey: 'providers.presetOpenRouter',
    descriptionKey: 'providers.presetOpenRouterDesc',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultReasoningMode: 'openai-reasoning-effort',
    apiKeyRequired: true,
  },
  {
    id: 'llama-cpp',
    wireType: 'custom',
    labelKey: 'providers.presetLlamaCpp',
    descriptionKey: 'providers.presetLlamaCppDesc',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultReasoningMode: 'chat-template-kwargs',
    apiKeyRequired: false,
  },
  {
    id: 'ollama',
    wireType: 'custom',
    labelKey: 'providers.presetOllama',
    descriptionKey: 'providers.presetOllamaDesc',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultReasoningMode: 'chat-template-kwargs',
    apiKeyRequired: false,
  },
  {
    id: 'vllm',
    wireType: 'custom',
    labelKey: 'providers.presetVllm',
    descriptionKey: 'providers.presetVllmDesc',
    defaultBaseUrl: 'http://localhost:8000/v1',
    defaultReasoningMode: 'chat-template-kwargs',
    apiKeyRequired: false,
  },
  {
    id: 'google',
    wireType: 'custom',
    labelKey: 'providers.presetGoogle',
    descriptionKey: 'providers.presetGoogleDesc',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultReasoningMode: 'openai-reasoning-effort',
    apiKeyRequired: true,
  },
  {
    id: 'bedrock',
    wireType: 'custom',
    labelKey: 'providers.presetBedrock',
    descriptionKey: 'providers.presetBedrockDesc',
    defaultBaseUrl: '',
    defaultReasoningMode: 'openai-reasoning-effort',
    apiKeyRequired: true,
  },
  {
    id: 'other',
    wireType: 'custom',
    labelKey: 'providers.presetOther',
    descriptionKey: 'providers.presetOtherDesc',
    defaultBaseUrl: '',
    defaultReasoningMode: 'auto',
    apiKeyRequired: false,
  },
];

/**
 * Look up a preset by ID. Returns the 'other' preset as fallback for unknown IDs.
 *
 * @param id - The preset identifier to look up
 * @returns The matching ProviderPreset, or the 'other' preset if not found
 */
export function getPreset(id: PresetId): ProviderPreset {
  return PROVIDER_PRESETS.find((p) => p.id === id) ?? PROVIDER_PRESETS[PROVIDER_PRESETS.length - 1];
}

/**
 * Derive the wire type from a preset ID.
 *
 * @param presetId - The preset identifier
 * @returns The ProviderType used for SDK adapter selection
 */
export function presetToWireType(presetId: PresetId): ProviderType {
  return getPreset(presetId).wireType;
}

/**
 * Infer preset from wire type for legacy providers without a preset field.
 *
 * Mapping:
 * - 'openai' → 'openai'
 * - 'anthropic' → 'anthropic'
 * - 'custom' → 'other'
 *
 * @param wireType - The stored ProviderType from a legacy provider record
 * @returns The inferred PresetId
 */
export function inferPresetFromType(wireType: ProviderType): PresetId {
  switch (wireType) {
    case 'openai': return 'openai';
    case 'anthropic': return 'anthropic';
    case 'custom': return 'other';
  }
}
