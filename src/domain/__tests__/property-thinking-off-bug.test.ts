/**
 * Property 1: Bug Condition — Off Level Emits Thinking Params
 *
 * When level is 'off' and mode is 'auto' or 'chat-template-kwargs',
 * mapThinkingLevelCustom SHOULD return {} (no thinking-related fields).
 *
 * On UNFIXED code this test is EXPECTED TO FAIL — failure confirms the bug exists.
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import * as fc from 'fast-check';
import { mapThinkingLevelCustom } from '../thinking-mapper';
import type { CustomReasoningMode } from '../thinking-mapper';

describe('Property 1: Bug Condition — Off Level Returns Empty Object', () => {
  const bugModes: CustomReasoningMode[] = ['auto', 'chat-template-kwargs'];

  it('mapThinkingLevelCustom("off", mode) returns {} for auto and chat-template-kwargs modes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bugModes),
        (mode) => {
          const result = mapThinkingLevelCustom('off', mode);
          expect(result).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });

  it('mapThinkingLevelCustom("off", mode, kwargs) returns {} regardless of kwargs', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...bugModes),
        fc.option(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 8 }), fc.boolean()),
          { nil: null }
        ),
        (mode, kwargs) => {
          const result = mapThinkingLevelCustom('off', mode, kwargs);
          expect(result).toEqual({});
        }
      ),
      { numRuns: 100 }
    );
  });
});
