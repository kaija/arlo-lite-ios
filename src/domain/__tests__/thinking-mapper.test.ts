import {
  mapThinkingLevelOpenAI,
  mapThinkingLevelAnthropic,
  mapThinkingLevel,
} from '../thinking-mapper';

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

    it('routes custom provider to OpenAI mapper (OpenAI-compatible)', () => {
      expect(mapThinkingLevel('custom', 'medium')).toEqual({ reasoning_effort: 'medium' });
    });

    it('routes openai off correctly', () => {
      expect(mapThinkingLevel('openai', 'off')).toEqual({});
    });

    it('routes anthropic off correctly', () => {
      expect(mapThinkingLevel('anthropic', 'off')).toEqual({
        thinking: { type: 'disabled' },
      });
    });

    it('routes custom off correctly (same as OpenAI)', () => {
      expect(mapThinkingLevel('custom', 'off')).toEqual({});
    });

    it('xhigh clamps for all provider types', () => {
      expect(mapThinkingLevel('openai', 'xhigh')).toEqual(mapThinkingLevel('openai', 'high'));
      expect(mapThinkingLevel('anthropic', 'xhigh')).toEqual(mapThinkingLevel('anthropic', 'high'));
      expect(mapThinkingLevel('custom', 'xhigh')).toEqual(mapThinkingLevel('custom', 'high'));
    });
  });
});
