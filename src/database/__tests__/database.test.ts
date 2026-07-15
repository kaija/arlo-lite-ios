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

// Mock the migration
jest.mock('../migrations/v1', () => ({
  migrateV1: jest.fn(() => Promise.resolve()),
}));

import * as SQLite from 'expo-sqlite';
import { migrateV1 } from '../migrations/v1';

describe('database', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initDatabase', () => {
    it('opens database with correct name', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 1 });

      await initDatabase();

      expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('arlo-lite.db');
    });

    it('enables WAL mode', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 1 });

      await initDatabase();

      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL');
    });

    it('enables foreign keys', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 1 });

      await initDatabase();

      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON');
    });

    it('runs migrations when user_version is 0', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 0 });

      await initDatabase();

      expect(migrateV1).toHaveBeenCalledWith(mockDb);
      expect(mockExecAsync).toHaveBeenCalledWith('PRAGMA user_version = 1');
    });

    it('skips migrations when user_version is current', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 1 });

      await initDatabase();

      expect(migrateV1).not.toHaveBeenCalled();
    });

    it('returns the database instance', async () => {
      mockGetFirstAsync.mockResolvedValue({ user_version: 1 });

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
