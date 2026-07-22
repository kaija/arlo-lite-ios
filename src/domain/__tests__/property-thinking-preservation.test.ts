/**
 * Property 2: Preservation — Non-Off Levels Unchanged
 *
 * Verifies that all active thinking levels (not 'off') still produce
 * correct output after the bugfix, and that 'off' with 'none' and
 * 'openai-reasoning-effort' modes still return {}.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import { mapThinkingLevelCustom } from '../thinking-mapper';
import type { CustomReasoningMode } from '../thinking-mapper';
import type { ThinkingLevel } from '../../stores/chat-store';

const activeLevels: ThinkingLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh'];
const allModes: CustomReasoningMode[] = ['auto', 'openai-reasoning-effort', 'chat-template-kwargs', 'none'];

/** Expected reasoning_effort string for each active level */
function expectedEffort(level: ThinkingLevel): string {
  switch (level) {
    case 'minimal':
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
    case 'xhigh':
      return 'high';
    default:
      return '';
  }
}

describe('Property 2: Preservation — Non-Off Levels Unchanged', () => {
  it('active levels in "auto" mode return both reasoning_effort and chat_template_kwargs', () => {
    fc.assert(
      fc.property(fc.constantFrom(...activeLevels), (level) => {
        const result = mapThinkingLevelCustom(level, 'auto');
        const effort = expectedEffort(level);
        expect(result).toEqual({
          reasoning_effort: effort,
          chat_template_kwargs: { enable_thinking: true, reasoning_effort: effort },
        });
      }),
      { numRuns: 100 },
    );
  });

  it('active levels in "chat-template-kwargs" mode return only chat_template_kwargs', () => {
    fc.assert(
      fc.property(fc.constantFrom(...activeLevels), (level) => {
        const result = mapThinkingLevelCustom(level, 'chat-template-kwargs');
        const effort = expectedEffort(level);
        expect(result).toEqual({
          chat_template_kwargs: { enable_thinking: true, reasoning_effort: effort },
        });
      }),
      { numRuns: 100 },
    );
  });

  it('active levels in "openai-reasoning-effort" mode return only reasoning_effort', () => {
    fc.assert(
      fc.property(fc.constantFrom(...activeLevels), (level) => {
        const result = mapThinkingLevelCustom(level, 'openai-reasoning-effort');
        expect(result).toEqual({ reasoning_effort: expectedEffort(level) });
      }),
      { numRuns: 100 },
    );
  });

  it('active levels in "none" mode return empty object', () => {
    fc.assert(
      fc.property(fc.constantFrom(...activeLevels), (level) => {
        const result = mapThinkingLevelCustom(level, 'none');
        expect(result).toEqual({});
      }),
      { numRuns: 100 },
    );
  });

  it('"off" with "none" mode returns empty object', () => {
    expect(mapThinkingLevelCustom('off', 'none')).toEqual({});
  });

  it('"off" with "openai-reasoning-effort" mode returns empty object', () => {
    expect(mapThinkingLevelCustom('off', 'openai-reasoning-effort')).toEqual({});
  });

  it('for all non-off levels and all modes, output contains no unexpected fields', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...activeLevels),
        fc.constantFrom(...allModes),
        (level, mode) => {
          const result = mapThinkingLevelCustom(level, mode);
          const keys = Object.keys(result);
          // Only allowed keys
          for (const k of keys) {
            expect(['reasoning_effort', 'chat_template_kwargs']).toContain(k);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
