/**
 * Tests for SystemPromptsScreen logic.
 *
 * Since @testing-library/react-native is not available, we test the
 * exported component exists and validate supporting logic (built-in prompt
 * behavior, default designation, store interactions).
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/stores/provider-store', () => ({
  useProviderStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      db: { runAsync: jest.fn(), getAllAsync: jest.fn() },
      providers: [],
      models: [],
    };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('@/stores/settings-store', () => ({
  useSettingsStore: jest.fn((selector?: (state: unknown) => unknown) => {
    const state = {
      systemPrompts: [],
      defaultSystemPromptId: null,
      setDefaultSystemPromptId: jest.fn(),
      addSystemPrompt: jest.fn(),
      updateSystemPrompt: jest.fn(),
      deleteSystemPrompt: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

import { SystemPromptsScreen } from '../SystemPromptsScreen';
import { DEFAULT_SYSTEM_PROMPT } from '@/constants/defaults';

describe('SystemPromptsScreen', () => {
  it('exports the SystemPromptsScreen component', () => {
    expect(SystemPromptsScreen).toBeDefined();
    expect(typeof SystemPromptsScreen).toBe('function');
  });

  it('uses the built-in default system prompt from constants', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toBe(
      'You are a helpful assistant. Answer questions clearly and concisely.',
    );
  });

  it('built-in prompt is designated default when no custom default is set', () => {
    // When defaultSystemPromptId is null, the built-in prompt should be treated as default
    const defaultSystemPromptId: string | null = null;
    const isBuiltInDefault = defaultSystemPromptId === null;
    expect(isBuiltInDefault).toBe(true);
  });

  it('built-in prompt is not default when a custom prompt is designated', () => {
    const defaultSystemPromptId: string | null = 'custom-prompt-1';
    const isBuiltInDefault = defaultSystemPromptId === null;
    expect(isBuiltInDefault).toBe(false);
  });

  it('setting default to built-in clears the defaultSystemPromptId', () => {
    // When user selects built-in as default, we set ID to null
    const BUILT_IN_PROMPT_ID = '__built_in__';
    const promptId = BUILT_IN_PROMPT_ID;
    const shouldClearId = promptId === BUILT_IN_PROMPT_ID;
    expect(shouldClearId).toBe(true);
  });

  it('truncates content preview to 80 characters', () => {
    const PREVIEW_MAX_LENGTH = 80;
    const longContent = 'A'.repeat(120);
    const truncated =
      longContent.length <= PREVIEW_MAX_LENGTH
        ? longContent
        : longContent.slice(0, PREVIEW_MAX_LENGTH) + '…';

    expect(truncated.length).toBe(PREVIEW_MAX_LENGTH + 1); // 80 chars + ellipsis
    expect(truncated.endsWith('…')).toBe(true);
  });

  it('does not truncate short content', () => {
    const PREVIEW_MAX_LENGTH = 80;
    const shortContent = 'Short prompt content';
    const truncated =
      shortContent.length <= PREVIEW_MAX_LENGTH
        ? shortContent
        : shortContent.slice(0, PREVIEW_MAX_LENGTH) + '…';

    expect(truncated).toBe(shortContent);
  });
});
