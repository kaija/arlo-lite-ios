# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Off Level Emits Thinking Params
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: Demonstrate that `mapThinkingLevelCustom('off', mode)` returns non-empty objects for 'auto' and 'chat-template-kwargs' modes
  - **Scoped PBT Approach**: Scope to `level === 'off'` with mode in `['auto', 'chat-template-kwargs']`
  - Test that `mapThinkingLevelCustom('off', mode)` returns `{}` for all modes (from Bug Condition in design: `isBugCondition(input) where level === 'off' AND mode IN ['auto', 'chat-template-kwargs']`)
  - Run test on UNFIXED code — expect FAILURE (this confirms the bug exists)
  - Document counterexamples: e.g. `mapThinkingLevelCustom('off', 'auto')` returns `{ chat_template_kwargs: { enable_thinking: false } }` instead of `{}`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Implement the one-line fix
  - Add `if (level === 'off') return {};` after the existing `if (mode === 'none') return {};` guard in `mapThinkingLevelCustom`
  - File: `src/domain/thinking-mapper.ts`
  - _Bug_Condition: isBugCondition(input) where level === 'off' AND mode IN ['auto', 'chat-template-kwargs']_
  - _Expected_Behavior: return {} for all modes when level is 'off'_
  - _Preservation: All behavior when level !== 'off' must remain identical_
  - _Requirements: 2.1, 2.2, 2.3_

  - [x] 2.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Off Level Returns Empty Object
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Write preservation property tests
  - **Property 2: Preservation** - Non-Off Levels Unchanged
  - **IMPORTANT**: Verify non-off levels still produce correct output after fix
  - Observe: `mapThinkingLevelCustom('medium', 'auto')` returns `{ reasoning_effort: 'medium', chat_template_kwargs: { enable_thinking: true, reasoning_effort: 'medium' } }`
  - Observe: `mapThinkingLevelCustom('high', 'chat-template-kwargs')` returns `{ chat_template_kwargs: { enable_thinking: true, reasoning_effort: 'high' } }`
  - Observe: `mapThinkingLevelCustom('low', 'openai-reasoning-effort')` returns `{ reasoning_effort: 'low' }`
  - Write property-based test: for all levels !== 'off' and all modes, output matches expected mapping logic
  - Also verify `mapThinkingLevelCustom('off', 'none')` and `mapThinkingLevelCustom('off', 'openai-reasoning-effort')` still return `{}`
  - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full test suite, confirm no regressions
  - Ensure both Property 1 and Property 2 tests pass on fixed code
