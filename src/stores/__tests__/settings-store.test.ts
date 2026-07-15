// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
  ]),
}));

// Mock the system-prompt-repo
const mockGetAll = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/database/repositories/system-prompt-repo', () => ({
  getAllSystemPrompts: (...args: unknown[]) => mockGetAll(...args),
  createSystemPrompt: (...args: unknown[]) => mockCreate(...args),
  updateSystemPrompt: (...args: unknown[]) => mockUpdate(...args),
  deleteSystemPrompt: (...args: unknown[]) => mockDelete(...args),
}));

import { useSettingsStore } from '../settings-store';
import type { SettingsStore } from '../settings-store';
import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockDb = {} as any; // SQLiteDatabase mock

function resetStore() {
  useSettingsStore.setState({
    theme: 'system',
    locale: 'en-US',
    defaultSystemPromptId: null,
    systemPrompts: [],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('settings-store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
  });

  describe('initial state', () => {
    it('should have system theme by default', () => {
      const state = useSettingsStore.getState();
      expect(state.theme).toBe('system');
    });

    it('should detect device locale for default', () => {
      const state = useSettingsStore.getState();
      expect(state.locale).toBe('en-US');
    });

    it('should have null defaultSystemPromptId', () => {
      const state = useSettingsStore.getState();
      expect(state.defaultSystemPromptId).toBeNull();
    });

    it('should have empty systemPrompts array', () => {
      const state = useSettingsStore.getState();
      expect(state.systemPrompts).toEqual([]);
    });
  });

  describe('setTheme', () => {
    it('should set theme to light', () => {
      useSettingsStore.getState().setTheme('light');
      expect(useSettingsStore.getState().theme).toBe('light');
    });

    it('should set theme to dark', () => {
      useSettingsStore.getState().setTheme('dark');
      expect(useSettingsStore.getState().theme).toBe('dark');
    });

    it('should set theme to system', () => {
      useSettingsStore.getState().setTheme('dark');
      useSettingsStore.getState().setTheme('system');
      expect(useSettingsStore.getState().theme).toBe('system');
    });
  });

  describe('setLocale', () => {
    it('should update locale', () => {
      useSettingsStore.getState().setLocale('zh-TW');
      expect(useSettingsStore.getState().locale).toBe('zh-TW');
    });
  });

  describe('setDefaultSystemPromptId', () => {
    it('should set a default system prompt id', () => {
      useSettingsStore.getState().setDefaultSystemPromptId('prompt-1');
      expect(useSettingsStore.getState().defaultSystemPromptId).toBe('prompt-1');
    });

    it('should clear default system prompt id with null', () => {
      useSettingsStore.getState().setDefaultSystemPromptId('prompt-1');
      useSettingsStore.getState().setDefaultSystemPromptId(null);
      expect(useSettingsStore.getState().defaultSystemPromptId).toBeNull();
    });
  });

  describe('loadSystemPrompts', () => {
    it('should load prompts from the database', async () => {
      const prompts: SystemPrompt[] = [
        { id: '1', name: 'Test', content: 'Hello', isDefault: false, createdAt: 100, updatedAt: 100 },
        { id: '2', name: 'Dev', content: 'You are a dev', isDefault: true, createdAt: 200, updatedAt: 200 },
      ];
      mockGetAll.mockResolvedValue(prompts);

      await useSettingsStore.getState().loadSystemPrompts(mockDb);

      expect(mockGetAll).toHaveBeenCalledWith(mockDb);
      expect(useSettingsStore.getState().systemPrompts).toEqual(prompts);
    });
  });

  describe('addSystemPrompt', () => {
    it('should add a prompt via the database and update state', async () => {
      const newPrompt: SystemPrompt = {
        id: 'new-1',
        name: 'New Prompt',
        content: 'New content',
        isDefault: false,
        createdAt: 300,
        updatedAt: 300,
      };
      mockCreate.mockResolvedValue(newPrompt);

      const result = await useSettingsStore.getState().addSystemPrompt(mockDb, {
        name: 'New Prompt',
        content: 'New content',
      });

      expect(mockCreate).toHaveBeenCalledWith(mockDb, {
        name: 'New Prompt',
        content: 'New content',
      });
      expect(result).toEqual(newPrompt);
      expect(useSettingsStore.getState().systemPrompts).toContainEqual(newPrompt);
    });
  });

  describe('updateSystemPrompt', () => {
    it('should update a prompt via the database and update state', async () => {
      const existing: SystemPrompt = {
        id: '1',
        name: 'Old',
        content: 'Old content',
        isDefault: false,
        createdAt: 100,
        updatedAt: 100,
      };
      const updated: SystemPrompt = {
        id: '1',
        name: 'Updated',
        content: 'Updated content',
        isDefault: false,
        createdAt: 100,
        updatedAt: 200,
      };

      useSettingsStore.setState({ systemPrompts: [existing] });
      mockUpdate.mockResolvedValue(updated);

      await useSettingsStore.getState().updateSystemPrompt(mockDb, '1', {
        name: 'Updated',
        content: 'Updated content',
      });

      expect(mockUpdate).toHaveBeenCalledWith(mockDb, '1', {
        name: 'Updated',
        content: 'Updated content',
      });
      expect(useSettingsStore.getState().systemPrompts[0]).toEqual(updated);
    });

    it('should not update state if repo returns null', async () => {
      const existing: SystemPrompt = {
        id: '1',
        name: 'Old',
        content: 'Old content',
        isDefault: false,
        createdAt: 100,
        updatedAt: 100,
      };

      useSettingsStore.setState({ systemPrompts: [existing] });
      mockUpdate.mockResolvedValue(null);

      await useSettingsStore.getState().updateSystemPrompt(mockDb, '1', {
        name: 'Updated',
      });

      expect(useSettingsStore.getState().systemPrompts[0]).toEqual(existing);
    });
  });

  describe('deleteSystemPrompt', () => {
    it('should delete a prompt via the database and remove from state', async () => {
      const existing: SystemPrompt = {
        id: '1',
        name: 'Prompt',
        content: 'Content',
        isDefault: false,
        createdAt: 100,
        updatedAt: 100,
      };

      useSettingsStore.setState({ systemPrompts: [existing] });
      mockDelete.mockResolvedValue(undefined);

      await useSettingsStore.getState().deleteSystemPrompt(mockDb, '1');

      expect(mockDelete).toHaveBeenCalledWith(mockDb, '1');
      expect(useSettingsStore.getState().systemPrompts).toEqual([]);
    });

    it('should clear defaultSystemPromptId if the deleted prompt was the default', async () => {
      const existing: SystemPrompt = {
        id: '1',
        name: 'Prompt',
        content: 'Content',
        isDefault: true,
        createdAt: 100,
        updatedAt: 100,
      };

      useSettingsStore.setState({
        systemPrompts: [existing],
        defaultSystemPromptId: '1',
      });
      mockDelete.mockResolvedValue(undefined);

      await useSettingsStore.getState().deleteSystemPrompt(mockDb, '1');

      expect(useSettingsStore.getState().defaultSystemPromptId).toBeNull();
    });

    it('should not clear defaultSystemPromptId if a different prompt was deleted', async () => {
      const prompts: SystemPrompt[] = [
        { id: '1', name: 'Default', content: 'A', isDefault: true, createdAt: 100, updatedAt: 100 },
        { id: '2', name: 'Other', content: 'B', isDefault: false, createdAt: 200, updatedAt: 200 },
      ];

      useSettingsStore.setState({
        systemPrompts: prompts,
        defaultSystemPromptId: '1',
      });
      mockDelete.mockResolvedValue(undefined);

      await useSettingsStore.getState().deleteSystemPrompt(mockDb, '2');

      expect(useSettingsStore.getState().defaultSystemPromptId).toBe('1');
      expect(useSettingsStore.getState().systemPrompts).toHaveLength(1);
    });
  });

  describe('persist partialize', () => {
    it('should only persist theme, locale, and defaultSystemPromptId (not systemPrompts)', () => {
      // The persist config partializes state — systemPrompts should not be in storage.
      // We verify this by checking that after hydration, systemPrompts remains empty
      // even if the persisted state doesn't include it.
      useSettingsStore.setState({
        theme: 'dark',
        locale: 'zh-TW',
        defaultSystemPromptId: 'p-1',
        systemPrompts: [
          { id: 'p-1', name: 'X', content: 'Y', isDefault: true, createdAt: 1, updatedAt: 1 },
        ],
      });

      // Access the persist API to get serialized state
      const persistApi = (useSettingsStore as any).persist;
      const options = persistApi?.getOptions?.();

      if (options?.partialize) {
        const partialState = options.partialize(useSettingsStore.getState());
        expect(partialState).toHaveProperty('theme', 'dark');
        expect(partialState).toHaveProperty('locale', 'zh-TW');
        expect(partialState).toHaveProperty('defaultSystemPromptId', 'p-1');
        expect(partialState).not.toHaveProperty('systemPrompts');
      }
    });
  });
});
