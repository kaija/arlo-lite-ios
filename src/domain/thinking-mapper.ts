/**
 * Thinking level mapper — maps abstract ThinkingLevel to provider-specific parameters.
 *
 * Pure functions with no side effects. Each provider has distinct semantics:
 * - OpenAI: uses reasoning_effort string param (low, medium, high)
 * - Anthropic: uses thinking block with budget_tokens
 * - Custom: treated as OpenAI-compatible
 */

import type { ThinkingLevel } from '../stores/chat-store';

/**
 * Map ThinkingLevel to OpenAI reasoning_effort parameter.
 *
 * - off: omit param entirely (empty object)
 * - minimal/low: reasoning_effort 'low'
 * - medium: reasoning_effort 'medium'
 * - high: reasoning_effort 'high'
 * - xhigh: clamp to high
 */
export function mapThinkingLevelOpenAI(level: ThinkingLevel): Record<string, unknown> {
  switch (level) {
    case 'off':
      return {};
    case 'minimal':
    case 'low':
      return { reasoning_effort: 'low' };
    case 'medium':
      return { reasoning_effort: 'medium' };
    case 'high':
    case 'xhigh':
      return { reasoning_effort: 'high' };
  }
}

/**
 * Map ThinkingLevel to Anthropic thinking block parameter.
 *
 * - off: thinking disabled
 * - minimal: budget_tokens 1024
 * - low: budget_tokens 2048
 * - medium: budget_tokens 8192
 * - high: budget_tokens 16384
 * - xhigh: clamp to high (16384)
 */
export function mapThinkingLevelAnthropic(level: ThinkingLevel): Record<string, unknown> {
  switch (level) {
    case 'off':
      return { thinking: { type: 'disabled' } };
    case 'minimal':
      return { thinking: { type: 'enabled', budget_tokens: 1024 } };
    case 'low':
      return { thinking: { type: 'enabled', budget_tokens: 2048 } };
    case 'medium':
      return { thinking: { type: 'enabled', budget_tokens: 8192 } };
    case 'high':
    case 'xhigh':
      return { thinking: { type: 'enabled', budget_tokens: 16384 } };
  }
}

/**
 * Route to the appropriate mapper based on provider type.
 *
 * Custom providers use OpenAI-compatible format.
 */
export function mapThinkingLevel(
  providerType: 'openai' | 'anthropic' | 'custom',
  level: ThinkingLevel
): Record<string, unknown> {
  switch (providerType) {
    case 'openai':
    case 'custom':
      return mapThinkingLevelOpenAI(level);
    case 'anthropic':
      return mapThinkingLevelAnthropic(level);
  }
}
