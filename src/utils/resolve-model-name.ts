import type { ModelConfig } from '@/stores/provider-store';

/**
 * Resolve a modelId to its human-readable display name.
 * Falls back to the raw modelId string if not found in the models list.
 */
export function resolveModelName(
  modelId: string,
  models: ModelConfig[]
): string {
  const match = models.find((m) => m.modelId === modelId);
  return match?.displayName ?? modelId;
}
