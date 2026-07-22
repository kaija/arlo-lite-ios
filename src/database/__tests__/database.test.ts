import { initDatabase, closeDatabase } from '../database';

// Mock expo-sqlite
const mockExecAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockCloseAsync = jest.fn();

const mockDb = {
  execAsync: mockExecAsync,
  getFirstAsync: mockGetFirstAsync,
  closeAsync: mockCloseAsync,
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(() => Promise.resolve(mockDb)),
}));

// Mock the migrations
jest.mock('../migrations/v1', () => ({
  migrateV1: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v2', () => ({
  migrateV2: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v3', () => ({
  migrateV3: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v4', () => ({
  migrateV4: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v5', () => ({
  migrateV5: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v6', () => ({
  migrateV6: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v7', () => ({
  migrateV7: jest.fn(() => Promise.resolve()),
}));

jest.mock('../migrations/v8', () => ({
  migrateV8: jest.fn(() => Promise.resolve()),
}));

import * as SQLite from 'expo-sqlite';
import { migrateV1 } from '../migrations/v1';
import { migrateV2 } from '../migrations/v2';
import { migrateV3 } from '../migrations/v3';
import { migrateV4 } from '../migrations/v4';
import { migrateV5 } from '../migrations/v5';
import { migrateV6 } from '../migrations/v6';
import { migrateV7 } from '../migrations/v7';

describe('database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initDatabase', () => {
    it('opens database with correct name', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 7 });

      await initDatabase();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('arlo-lite.db');
    });

    it('enables WAL mode', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 7 });

      await initDatabase();

      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    });

    it('enables foreign keys', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 7 });

      await initDatabase();

      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });

    it('runs migrations when user_version is 0', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 0 });

      await initDatabase();

      expect(migrateV1).toHaveBeenCalledWith(mockDb);
      expect(migrateV2).toHaveBeenCalledWith(mockDb);
      expect(migrateV3).toHaveBeenCalledWith(mockDb);
      expect(migrateV4).toHaveBeenCalledWith(mockDb);
      expect(migrateV5).toHaveBeenCalledWith(mockDb);
      expect(migrateV6).toHaveBeenCalledWith(mockDb);
      expect(migrateV7).toHaveBeenCalledWith(mockDb);
      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA user_version = 8');
    });

    it('skips migrations when user_version is current', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 8 });

      await initDatabase();

      expect(migrateV1).not.toHaveBeenCalled();
      expect(migrateV2).not.toHaveBeenCalled();
      expect(migrateV3).not.toHaveBeenCalled();
      expect(migrateV4).not.toHaveBeenCalled();
      expect(migrateV5).not.toHaveBeenCalled();
      expect(migrateV6).not.toHaveBeenCalled();
      expect(migrateV7).not.toHaveBeenCalled();
    });

    it('returns the database instance', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 7 });

      const db = await initDatabase();

      expect(db).toBe(mockDb);
    });
  });

  describe('closeDatabase', () => {
    it('closes the database connection', async () => {
      await closeDatabase(mockDb as any);

      expect(mockCloseAsync).toHaveBeenCalled();
    });
  });
});
