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
} from '../thinking-mapper';
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
        fc.constantFrom('openai' as const, 'custom' as const),
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
          } else {
            // openai and custom both use OpenAI mapper
            const direct = mapThinkingLevelOpenAI(level);
            expect(routed).toEqual(direct);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
