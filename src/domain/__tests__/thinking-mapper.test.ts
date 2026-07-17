import {
  mapThinkingLevelOpenAI,
  mapThinkingLevelAnthropic,
  mapThinkingLevelCustom,
  mapThinkingLevel,
} from '../thinking-mapper';
import type { CustomReasoningMode, CustomThinkingParams } from '../thinking-mapper';
import type { ThinkingLevel } from '../../stores/chat-store';

describe('thinking-mapper', () => {
  describe('mapThinkingLevelOpenAI', () => {
    it('returns empty object for off (omit reasoning_effort)', () => {
      expect(mapThinkingLevelOpenAI('off')).toEqual({});
    });

    it('maps minimal to reasoning_effort low', () => {
      expect(mapThinkingLevelOpenAI('minimal')).toEqual({ reasoning_effort: 'low' });
    });

    it('maps low to reasoning_effort low', () => {
      expect(mapThinkingLevelOpenAI('low')).toEqual({ reasoning_effort: 'low' });
    });

    it('maps medium to reasoning_effort medium', () => {
      expect(mapThinkingLevelOpenAI('medium')).toEqual({ reasoning_effort: 'medium' });
    });

    it('maps high to reasoning_effort high', () => {
      expect(mapThinkingLevelOpenAI('high')).toEqual({ reasoning_effort: 'high' });
    });

    it('clamps xhigh to reasoning_effort high', () => {
      expect(mapThinkingLevelOpenAI('xhigh')).toEqual({ reasoning_effort: 'high' });
    });

    it('xhigh produces identical output to high', () => {
      expect(mapThinkingLevelOpenAI('xhigh')).toEqual(mapThinkingLevelOpenAI('high'));
    });
  });

  describe('mapThinkingLevelAnthropic', () => {
    it('returns thinking disabled for off', () => {
      expect(mapThinkingLevelAnthropic('off')).toEqual({
        thinking: { type: 'disabled' },
      });
    });

    it('maps minimal to budget_tokens 1024', () => {
      expect(mapThinkingLevelAnthropic('minimal')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 1024 },
      });
    });

    it('maps low to budget_tokens 2048', () => {
      expect(mapThinkingLevelAnthropic('low')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 2048 },
      });
    });

    it('maps medium to budget_tokens 8192', () => {
      expect(mapThinkingLevelAnthropic('medium')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 8192 },
      });
    });

    it('maps high to budget_tokens 16384', () => {
      expect(mapThinkingLevelAnthropic('high')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 16384 },
      });
    });

    it('clamps xhigh to budget_tokens 16384', () => {
      expect(mapThinkingLevelAnthropic('xhigh')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 16384 },
      });
    });

    it('xhigh produces identical output to high', () => {
      expect(mapThinkingLevelAnthropic('xhigh')).toEqual(mapThinkingLevelAnthropic('high'));
    });
  });

  describe('mapThinkingLevel (routing)', () => {
    it('routes openai provider to OpenAI mapper', () => {
      expect(mapThinkingLevel('openai', 'medium')).toEqual({ reasoning_effort: 'medium' });
    });

    it('routes anthropic provider to Anthropic mapper', () => {
      expect(mapThinkingLevel('anthropic', 'medium')).toEqual({
        thinking: { type: 'enabled', budget_tokens: 8192 },
      });
    });

    it('routes custom provider to mapThinkingLevelCustom with auto mode', () => {
      expect(mapThinkingLevel('custom', 'medium')).toEqual(
        mapThinkingLevelCustom('medium', 'auto')
      );
    });

    it('routes openai off correctly', () => {
      expect(mapThinkingLevel('openai', 'off')).toEqual({});
    });

    it('routes anthropic off correctly', () => {
      expect(mapThinkingLevel('anthropic', 'off')).toEqual({
        thinking: { type: 'disabled' },
      });
    });

    it('routes custom off correctly (auto mode with enable_thinking false)', () => {
      expect(mapThinkingLevel('custom', 'off')).toEqual(
        mapThinkingLevelCustom('off', 'auto')
      );
    });

    it('xhigh clamps for all provider types', () => {
      expect(mapThinkingLevel('openai', 'xhigh')).toEqual(mapThinkingLevel('openai', 'high'));
      expect(mapThinkingLevel('anthropic', 'xhigh')).toEqual(mapThinkingLevel('anthropic', 'high'));
      expect(mapThinkingLevel('custom', 'xhigh')).toEqual(mapThinkingLevel('custom', 'high'));
    });
  });

  describe('mapThinkingLevelCustom', () => {
    const allLevels: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
    const allModes: CustomReasoningMode[] = ['auto', 'openai-reasoning-effort', 'chat-template-kwargs', 'none'];

    // Expected reasoning_effort values for each level
    const expectedEffort: Record<ThinkingLevel, string | undefined> = {
      off: undefined,
      minimal: 'low',
      low: 'low',
      medium: 'medium',
      high: 'high',
      xhigh: 'high',
    };

    describe('all 4 modes × all 6 levels (24 cases)', () => {
      describe('auto mode', () => {
        it.each(allLevels)('level=%s — includes chat_template_kwargs and reasoning_effort when non-off', (level) => {
          const result = mapThinkingLevelCustom(level, 'auto');
          // Auto always includes chat_template_kwargs (Property 1)
          expect(result.chat_template_kwargs).toBeDefined();

          if (level === 'off') {
            expect(result.reasoning_effort).toBeUndefined();
            expect(result.chat_template_kwargs).toEqual({ enable_thinking: false });
          } else {
            expect(result.reasoning_effort).toBe(expectedEffort[level]);
            expect(result.chat_template_kwargs).toEqual({ enable_thinking: true });
          }
        });
      });

      describe('openai-reasoning-effort mode', () => {
        it.each(allLevels)('level=%s — only reasoning_effort, no chat_template_kwargs', (level) => {
          const result = mapThinkingLevelCustom(level, 'openai-reasoning-effort');
          expect(result.chat_template_kwargs).toBeUndefined();

          if (level === 'off') {
            expect(result).toEqual({});
          } else {
            expect(result).toEqual({ reasoning_effort: expectedEffort[level] });
          }
        });
      });

      describe('chat-template-kwargs mode', () => {
        it.each(allLevels)('level=%s — only chat_template_kwargs, no reasoning_effort', (level) => {
          const result = mapThinkingLevelCustom(level, 'chat-template-kwargs');
          // Property 3: never includes reasoning_effort
          expect(result.reasoning_effort).toBeUndefined();

          if (level === 'off') {
            expect(result.chat_template_kwargs).toEqual({ enable_thinking: false });
          } else {
            expect(result.chat_template_kwargs).toEqual({ enable_thinking: true });
          }
        });
      });

      describe('none mode', () => {
        it.each(allLevels)('level=%s — returns empty object', (level) => {
          const result = mapThinkingLevelCustom(level, 'none');
          // Property 2: always empty
          expect(result).toEqual({});
        });
      });
    });

    describe('custom kwargs with boolean values', () => {
      const boolKwargs = { enable_thinking: true, verbose: true };

      it('uses kwargs as-is when thinking is enabled', () => {
        const result = mapThinkingLevelCustom('high', 'auto', boolKwargs);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: true, verbose: true });
      });

      it('negates boolean values when thinking is off', () => {
        const result = mapThinkingLevelCustom('off', 'auto', boolKwargs);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: false, verbose: false });
      });

      it('negates booleans in chat-template-kwargs mode too', () => {
        const result = mapThinkingLevelCustom('off', 'chat-template-kwargs', boolKwargs);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: false, verbose: false });
      });
    });

    describe('custom kwargs with non-boolean values', () => {
      const mixedKwargs = { reasoning_effort: 'high', temperature: 0.7 };

      it('uses kwargs as-is when thinking is enabled', () => {
        const result = mapThinkingLevelCustom('high', 'auto', mixedKwargs);
        expect(result.chat_template_kwargs).toEqual({ reasoning_effort: 'high', temperature: 0.7 });
      });

      it('omits chat_template_kwargs when thinking is off (non-boolean cannot be negated)', () => {
        const result = mapThinkingLevelCustom('off', 'auto', mixedKwargs);
        // Auto mode falls back to { enable_thinking: false } when kwargs can't be negated
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: false });
      });

      it('omits chat_template_kwargs in chat-template-kwargs mode when off with non-boolean kwargs', () => {
        const result = mapThinkingLevelCustom('off', 'chat-template-kwargs', mixedKwargs);
        // chat_template_kwargs mode returns empty when kwargs is undefined
        expect(result).toEqual({});
      });
    });

    describe('null/undefined kwargs defaults to enable_thinking', () => {
      it('null kwargs defaults to { enable_thinking: true } for non-off', () => {
        const result = mapThinkingLevelCustom('medium', 'auto', null);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: true });
      });

      it('null kwargs defaults to { enable_thinking: false } for off', () => {
        const result = mapThinkingLevelCustom('off', 'auto', null);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: false });
      });

      it('undefined kwargs defaults to { enable_thinking: true } for non-off', () => {
        const result = mapThinkingLevelCustom('medium', 'auto', undefined);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: true });
      });

      it('undefined kwargs defaults to { enable_thinking: false } for off', () => {
        const result = mapThinkingLevelCustom('off', 'auto', undefined);
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: false });
      });

      it('omitted kwargs (default param) works the same as undefined', () => {
        const result = mapThinkingLevelCustom('high', 'auto');
        expect(result.chat_template_kwargs).toEqual({ enable_thinking: true });
      });
    });

    describe('reasoning_effort value constraints (Property 6)', () => {
      const validEffortValues = ['low', 'medium', 'high'];

      it.each(allLevels)('level=%s — reasoning_effort is low, medium, high, or undefined', (level) => {
        const result = mapThinkingLevelCustom(level, 'openai-reasoning-effort');
        if (result.reasoning_effort !== undefined) {
          expect(validEffortValues).toContain(result.reasoning_effort);
        }
      });
    });
  });
});
