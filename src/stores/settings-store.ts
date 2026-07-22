import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';
import {
  getAllSystemPrompts,
  createSystemPrompt as createSystemPromptInDb,
  updateSystemPrompt as updateSystemPromptInDb,
  deleteSystemPrompt as deleteSystemPromptInDb,
} from '@/database/repositories/system-prompt-repo';
import type { CreateSystemPromptData, UpdateSystemPromptData } from '@/database/repositories/system-prompt-repo';
import type { SQLiteDatabase } from 'expo-sqlite';
import { changeAppLanguage, detectDeviceLocale } from '@/i18n/index';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface SettingsState {
  theme: ThemeMode;
  locale: string;
  defaultSystemPromptId: string | null;
  systemPrompts: SystemPrompt[];
  thinkingExpandedByDefault: boolean;
  braveSearchEnabled: boolean;
}

export interface SettingsActions {
  setTheme: (theme: ThemeMode) => void;
  setLocale: (locale: string) => void;
  setDefaultSystemPromptId: (id: string | null) => void;
  setThinkingExpandedByDefault: (value: boolean) => void;
  setBraveSearchEnabled: (value: boolean) => void;
  loadSystemPrompts: (db: SQLiteDatabase) => Promise<void>;
  addSystemPrompt: (db: SQLiteDatabase, data: CreateSystemPromptData) => Promise<SystemPrompt>;
  updateSystemPrompt: (db: SQLiteDatabase, id: string, updates: UpdateSystemPromptData) => Promise<void>;
  deleteSystemPrompt: (db: SQLiteDatabase, id: string) => Promise<void>;
}

export type SettingsStore = SettingsState & SettingsActions;

/**
 * Detect the device locale for the default value.
 * Returns a supported locale tag (e.g. 'en' or 'zh-TW') rather than
 * the raw device tag (e.g. 'zh-Hant-TW') to ensure i18n compatibility.
 */
function getDeviceLocale(): string {
  try {
    return detectDeviceLocale();
  } catch {
    return 'en';
  }
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // State
      theme: 'system',
      locale: getDeviceLocale(),
      defaultSystemPromptId: null,
      systemPrompts: [],
      thinkingExpandedByDefault: false,
      braveSearchEnabled: false,

      // Actions
      setTheme: (theme: ThemeMode) => {
        set({ theme });
      },

      setLocale: (locale: string) => {
        set({ locale });
        // Immediately switch the i18n runtime language
        changeAppLanguage(locale);
      },

      setDefaultSystemPromptId: (id: string | null) => {
        set({ defaultSystemPromptId: id });
      },

      setThinkingExpandedByDefault: (value: boolean) => {
        set({ thinkingExpandedByDefault: value });
      },

      setBraveSearchEnabled: (value: boolean) => {
        set({ braveSearchEnabled: value });
      },

      loadSystemPrompts: async (db: SQLiteDatabase) => {
        const prompts = await getAllSystemPrompts(db);
        set({ systemPrompts: prompts });
      },

      addSystemPrompt: async (db: SQLiteDatabase, data: CreateSystemPromptData) => {
        const prompt = await createSystemPromptInDb(db, data);
        set({ systemPrompts: [...get().systemPrompts, prompt] });
        return prompt;
      },

      updateSystemPrompt: async (db: SQLiteDatabase, id: string, updates: UpdateSystemPromptData) => {
        const updated = await updateSystemPromptInDb(db, id, updates);
        if (updated) {
          set({
            systemPrompts: get().systemPrompts.map((p) =>
              p.id === id ? updated : p
            ),
          });
        }
      },

      deleteSystemPrompt: async (db: SQLiteDatabase, id: string) => {
        await deleteSystemPromptInDb(db, id);
        set({
          systemPrompts: get().systemPrompts.filter((p) => p.id !== id),
        });
        // Clear default if the deleted prompt was the default
        if (get().defaultSystemPromptId === id) {
          set({ defaultSystemPromptId: null });
        }
      },
    }),
    {
      name: 'arlo-settings',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist non-sensitive config — system prompts live in SQLite
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
        defaultSystemPromptId: state.defaultSystemPromptId,
        thinkingExpandedByDefault: state.thinkingExpandedByDefault,
        braveSearchEnabled: state.braveSearchEnabled,
      }),
      // Normalize stale locale values (e.g. 'zh-Hant-TW' → 'zh-TW') on rehydrate
      onRehydrateStorage: () => (state) => {
        if (state && state.locale) {
          const normalized = detectDeviceLocale();
          // If persisted locale isn't a clean supported locale, normalize it
          if (state.locale !== 'en' && state.locale !== 'zh-TW') {
            state.locale = normalized;
            changeAppLanguage(normalized);
          }
        }
      },
    }
  )
);
