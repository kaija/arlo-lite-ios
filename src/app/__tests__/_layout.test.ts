/**
 * Tests for the root layout initialization logic.
 *
 * Since we don't have @testing-library/react-native, we test the
 * initialization flow by verifying the functions it depends on work correctly.
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() =>
    Promise.resolve({
      execAsync: jest.fn(() => Promise.resolve()),
      getFirstAsync: jest.fn(() => Promise.resolve({ user_version: 1 })),
      getAllAsync: jest.fn(() => Promise.resolve([])),
      runAsync: jest.fn(() => Promise.resolve()),
      closeAsync: jest.fn(() => Promise.resolve()),
    })
  ),
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/database/repositories/system-prompt-repo', () => ({
  getAllSystemPrompts: jest.fn(() => Promise.resolve([])),
  createSystemPrompt: jest.fn(),
  updateSystemPrompt: jest.fn(),
  deleteSystemPrompt: jest.fn(),
}));

jest.mock('@/database/repositories/provider-repo', () => ({
  createProvider: jest.fn(),
  getAllProviders: jest.fn(() => Promise.resolve([])),
  updateProvider: jest.fn(),
  deleteProvider: jest.fn(),
}));

jest.mock('@/database/repositories/session-repo', () => ({
  createSession: jest.fn(),
  getAllSessions: jest.fn(() => Promise.resolve([])),
  updateSession: jest.fn(),
  deleteSession: jest.fn(),
}));

jest.mock('@/database/repositories/message-repo', () => ({
  createMessage: jest.fn(),
  getMessagesBySession: jest.fn(() => Promise.resolve([])),
  deleteMessagesAfter: jest.fn(),
}));

import { initI18n } from '@/i18n/index';
import { initDatabase } from '@/database/database';
import { useProviderStore } from '@/stores/provider-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Root layout initialization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProviderStore.setState({ db: null, providers: [], models: [] });
    useSessionStore.setState({ db: null, sessions: [], activeSessionId: null, messages: {} });
    useSettingsStore.setState({
      theme: 'system',
      locale: 'en-US',
      defaultSystemPromptId: null,
      systemPrompts: [],
    });
  });

  it('should initialize i18n without errors', () => {
    expect(() => initI18n()).not.toThrow();
  });

  it('should initialize database and return a db instance', async () => {
    const db = await initDatabase();
    expect(db).toBeDefined();
    expect(db.execAsync).toBeDefined();
  });

  it('should set database on provider store', async () => {
    const db = await initDatabase();
    useProviderStore.getState().setDatabase(db);
    expect(useProviderStore.getState().db).toBe(db);
  });

  it('should set database on session store', async () => {
    const db = await initDatabase();
    useSessionStore.getState().setDatabase(db);
    expect(useSessionStore.getState().db).toBe(db);
  });

  it('should load providers after database is set', async () => {
    const db = await initDatabase();
    useProviderStore.getState().setDatabase(db);
    await useProviderStore.getState().loadProviders();
    // Should not throw and providers should be an array
    expect(Array.isArray(useProviderStore.getState().providers)).toBe(true);
  });

  it('should load sessions after database is set', async () => {
    const db = await initDatabase();
    useSessionStore.getState().setDatabase(db);
    await useSessionStore.getState().loadSessions();
    expect(Array.isArray(useSessionStore.getState().sessions)).toBe(true);
  });

  it('should load system prompts after database is set', async () => {
    const db = await initDatabase();
    await useSettingsStore.getState().loadSystemPrompts(db);
    expect(Array.isArray(useSettingsStore.getState().systemPrompts)).toBe(true);
  });

  it('should default theme mode to system', () => {
    expect(useSettingsStore.getState().theme).toBe('system');
  });

  it('should run full bootstrap sequence without errors', async () => {
    // Simulate the bootstrap() function from _layout.tsx
    initI18n();

    const db = await initDatabase();

    useProviderStore.getState().setDatabase(db);
    useSessionStore.getState().setDatabase(db);

    await Promise.all([
      useProviderStore.getState().loadProviders(),
      useProviderStore.getState().loadModels(),
      useSessionStore.getState().loadSessions(),
      useSettingsStore.getState().loadSystemPrompts(db),
    ]);

    // Verify all stores are hydrated
    expect(useProviderStore.getState().db).toBe(db);
    expect(useSessionStore.getState().db).toBe(db);
    expect(Array.isArray(useProviderStore.getState().providers)).toBe(true);
    expect(Array.isArray(useProviderStore.getState().models)).toBe(true);
    expect(Array.isArray(useSessionStore.getState().sessions)).toBe(true);
    expect(Array.isArray(useSettingsStore.getState().systemPrompts)).toBe(true);
  });
});
