// Mock dependencies before imports
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
  ]),
}));

jest.mock('@/database/repositories/system-prompt-repo', () => ({
  getAllSystemPrompts: jest.fn(() => Promise.resolve([])),
  createSystemPrompt: jest.fn(),
  updateSystemPrompt: jest.fn(),
  deleteSystemPrompt: jest.fn(),
}));

import { useSettingsStore } from '@/stores/settings-store';

describe('useAppTheme hook logic', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      theme: 'system',
      locale: 'en-US',
      defaultSystemPromptId: null,
      systemPrompts: [],
    });
  });

  it('should expose the current theme mode from settings store', () => {
    const mode = useSettingsStore.getState().theme;
    expect(mode).toBe('system');
  });

  it('should update mode when setTheme is called', () => {
    useSettingsStore.getState().setTheme('dark');
    expect(useSettingsStore.getState().theme).toBe('dark');

    useSettingsStore.getState().setTheme('light');
    expect(useSettingsStore.getState().theme).toBe('light');

    useSettingsStore.getState().setTheme('system');
    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('should only accept valid theme modes', () => {
    const validModes = ['light', 'dark', 'system'] as const;
    for (const mode of validModes) {
      useSettingsStore.getState().setTheme(mode);
      expect(useSettingsStore.getState().theme).toBe(mode);
    }
  });
});
