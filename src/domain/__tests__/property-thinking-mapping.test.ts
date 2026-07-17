/**
 * Property 2: Thinking level mapping correctness
 *
 * For any combination of ThinkingLevel value (off, minimal, low, medium, high, xhigh)
 * and provider type (OpenAI, Anthropic), the mapThinkingLevel function should produce
 * the exact provider-specific parameters: for OpenAI "off" omits reasoning_effort;
 * for Anthropic maps to the specified budget_tokens values (1024, 2048, 8192, 16384);
 * and for any provider "xhigh" produces identical output to "high".
 *
 * Feature: arlo-lite-app, Property 2: Thinking level mapping correctness
 * Validates: Requirements 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9
 */

import * as fc from 'fast-check';
import {
  mapThinkingLevel,
  mapThinkingLevelOpenAI,
  mapThinkingLevelAnthropic,
  mapThinkingLevelCustom,
} from '../thinking-mapper';
import type { CustomReasoningMode } from '../thinking-mapper';
import type { ThinkingLevel } from '../../stores/chat-store';

const allThinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
const allProviderTypes: Array<'openai' | 'anthropic' | 'custom'> = ['openai', 'anthropic', 'custom'];

describe('Property 2: Thinking level mapping correctness', () => {
  it('xhigh produces identical output to high for any provider', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allProviderTypes),
        (providerType) => {
          const xhighResult = mapThinkingLevel(providerType, 'xhigh');
          const highResult = mapThinkingLevel(providerType, 'high');
          expect(xhighResult).toEqual(highResult);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('OpenAI "off" produces empty object (no reasoning_effort key)', () => {
    fc.assert(
      fc.property(
        fc.constant('openai' as const),
        (providerType) => {
          const result = mapThinkingLevel(providerType, 'off');
          expect(result).toEqual({});
          expect(Object.keys(result)).not.toContain('reasoning_effort');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Anthropic maps each level to the exact budget_tokens value', () => {
    const expectedBudgets: Record<Exclude<ThinkingLevel, 'off'>, number> = {
      minimal: 1024,
      low: 2048,
      medium: 8192,
      high: 16384,
      xhigh: 16384,
    };

    fc.assert(
      fc.property(
        fc.constantFrom<Exclude<ThinkingLevel, 'off'>>('minimal', 'low', 'medium', 'high', 'xhigh'),
        (level) => {
          const result = mapThinkingLevelAnthropic(level);
          expect(result).toEqual({
            thinking: { type: 'enabled', budget_tokens: expectedBudgets[level] },
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('routing function delegates to the correct mapper for each provider type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allThinkingLevels),
        fc.constantFrom(...allProviderTypes),
        (level, providerType) => {
          const routed = mapThinkingLevel(providerType, level);

          if (providerType === 'anthropic') {
            const direct = mapThinkingLevelAnthropic(level);
            expect(routed).toEqual(direct);
          } else if (providerType === 'openai') {
            const direct = mapThinkingLevelOpenAI(level);
            expect(routed).toEqual(direct);
          } else {
            // custom uses mapThinkingLevelCustom with 'auto' mode
            const direct = mapThinkingLevelCustom(level, 'auto');
            expect(routed).toEqual(direct);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property tests for mapThinkingLevelCustom
 *
 * Validates: Requirements 1.3–1.6, 2.1, 2.2, 3.1, 3.2, 5.2, 5.4
 */
describe('Property tests: mapThinkingLevelCustom', () => {
  const allThinkingLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
  const allCustomModes: CustomReasoningMode[] = ['auto', 'openai-reasoning-effort', 'chat-template-kwargs', 'none'];

  /**
   * Property 1: Auto mode always includes chat_template_kwargs (never undefined)
   * Validates: Requirements 3.1, 3.2
   */
  it('Property 1: auto mode always includes chat_template_kwargs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allThinkingLevels),
        fc.option(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.boolean()),
          { nil: null },
        ),
        (level, kwargs) => {
          const result = mapThinkingLevelCustom(level, 'auto', kwargs);
          expect(result.chat_template_kwargs).toBeDefined();
          expect(result.chat_template_kwargs).not.toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 2: None mode always returns empty {}
   * Validates: Requirement 1.6
   */
  it('Property 2: none mode always returns empty object', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allThinkingLevels),
        fc.option(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.oneof(fc.boolean(), fc.string(), fc.integer())),
          { nil: null },
        ),
        (level, kwargs) => {
          const result = mapThinkingLevelCustom(level, 'none', kwargs);
          expect(result).toEqual({});
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 3: chat-template-kwargs mode never includes reasoning_effort
   * Validates: Requirement 1.5
   */
  it('Property 3: chat-template-kwargs mode never includes reasoning_effort', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allThinkingLevels),
        fc.option(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.boolean()),
          { nil: null },
        ),
        (level, kwargs) => {
          const result = mapThinkingLevelCustom(level, 'chat-template-kwargs', kwargs);
          expect(result.reasoning_effort).toBeUndefined();
          expect(Object.keys(result)).not.toContain('reasoning_effort');
        }
      ),
      { numRuns: 200 }
    );
  });

  /**
   * Property 6: reasoning_effort values constrained to 'low' | 'medium' | 'high' | undefined
   * Validates: Requirement 2 (existing behavior preserved)
   */
  it('Property 6: reasoning_effort values are constrained to low/medium/high/undefined', () => {
    const validValues = ['low', 'medium', 'high'];

    fc.assert(
      fc.property(
        fc.constantFrom(...allThinkingLevels),
        fc.constantFrom(...allCustomModes),
        (level, mode) => {
          const result = mapThinkingLevelCustom(level, mode);
          if (result.reasoning_effort !== undefined) {
            expect(validValues).toContain(result.reasoning_effort);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
