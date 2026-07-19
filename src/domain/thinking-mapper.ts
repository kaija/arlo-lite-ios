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
 * Reasoning mode for Custom providers — determines wire-format mechanism.
 */
export type CustomReasoningMode =
  | 'auto'
  | 'openai-reasoning-effort'
  | 'chat-template-kwargs'
  | 'none';

/**
 * Result of mapping ThinkingLevel for a Custom provider.
 * Contains the fields to merge into the request body.
 */
export interface CustomThinkingParams {
  /** OpenAI-standard reasoning_effort field, or undefined to omit. */
  reasoning_effort?: string;
  /** llama-server chat_template_kwargs object, or undefined to omit. */
  chat_template_kwargs?: Record<string, unknown>;
}

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
 * Map ThinkingLevel to the reasoning_effort string value.
 * Returns undefined for 'off' (field should be omitted).
 */
function mapReasoningEffortValue(level: ThinkingLevel): string | undefined {
  switch (level) {
    case 'off':
      return undefined;
    case 'minimal':
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
      return 'high';
  }
}

/**
 * Build the chat_template_kwargs object.
 *
 * If custom thinkingKwargs are provided, use them when enabling thinking,
 * and negate boolean values when disabling. If negation semantics are unclear
 * (non-boolean values present), return undefined to omit the field entirely.
 *
 * Default (no custom kwargs) covers both major template families in one
 * object: Qwen templates read enable_thinking, gpt-oss templates read
 * reasoning_effort — each ignores the key it doesn't know.
 */
function buildChatTemplateKwargs(
  enableThinking: boolean,
  thinkingKwargs?: Record<string, unknown> | null,
  reasoningEffort?: string,
): Record<string, unknown> | undefined {
  if (!thinkingKwargs) {
    return enableThinking && reasoningEffort
      ? { enable_thinking: true, reasoning_effort: reasoningEffort }
      : { enable_thinking: enableThinking };
  }

  if (enableThinking) {
    // Use kwargs as-is when thinking is enabled
    return { ...thinkingKwargs };
  }

  // For 'off': only negate if all values are boolean; otherwise omit entirely
  const allBoolean = Object.values(thinkingKwargs).every(
    (v) => typeof v === 'boolean',
  );
  if (allBoolean) {
    const negated: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(thinkingKwargs)) {
      negated[key] = !(value as boolean);
    }
    return negated;
  }

  // Non-boolean kwargs: omit chat_template_kwargs when thinking is off
  return undefined;
}

/**
 * Map ThinkingLevel to Custom provider parameters based on reasoning mode.
 *
 * @param level - The abstract thinking level from the UI
 * @param mode - The configured reasoning mode for this provider instance
 * @param thinkingKwargs - Optional custom kwargs (overrides default enable_thinking)
 * @returns Object with fields to spread into the request body
 */
export function mapThinkingLevelCustom(
  level: ThinkingLevel,
  mode: CustomReasoningMode = 'auto',
  thinkingKwargs?: Record<string, unknown> | null,
): CustomThinkingParams {
  if (mode === 'none') return {};

  const enableThinking = level !== 'off';
  const reasoningEffort = mapReasoningEffortValue(level);
  const kwargs = buildChatTemplateKwargs(enableThinking, thinkingKwargs, reasoningEffort);

  switch (mode) {
    case 'openai-reasoning-effort':
      return enableThinking && reasoningEffort
        ? { reasoning_effort: reasoningEffort }
        : {};

    case 'chat-template-kwargs':
      return kwargs !== undefined ? { chat_template_kwargs: kwargs } : {};

    case 'auto':
    default: {
      const result: CustomThinkingParams = {};

      if (enableThinking && reasoningEffort) {
        result.reasoning_effort = reasoningEffort;
      }

      // Auto mode always includes chat_template_kwargs (Property 1).
      // If buildChatTemplateKwargs returns undefined (non-boolean negation case),
      // fall back to the default {enable_thinking: false}.
      result.chat_template_kwargs =
        kwargs !== undefined ? kwargs : { enable_thinking: false };

      return result;
    }
  }
}

/**
 * Route to the appropriate mapper based on provider type.
 *
 * Custom providers use mapThinkingLevelCustom with 'auto' mode by default,
 * which sends both reasoning_effort and chat_template_kwargs.
 */
export function mapThinkingLevel(
  providerType: 'openai' | 'anthropic' | 'custom',
  level: ThinkingLevel
): Record<string, unknown> {
  switch (providerType) {
    case 'openai':
      return mapThinkingLevelOpenAI(level);
    case 'custom':
      return mapThinkingLevelCustom(level, 'auto') as Record<string, unknown>;
    case 'anthropic':
      return mapThinkingLevelAnthropic(level);
  }
}
