import { migrateV1 } from '../migrations/v1';

const mockExecAsync = jest.fn<Promise<void>, [string]>();

const mockDb = {
  execAsync: mockExecAsync,
} as any;

describe('migrations/v1', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes SQL to create all tables', async () => {
    await migrateV1(mockDb);

    expect(mockExecAsync).toHaveBeenCalledTimes(1);
    const sql = mockExecAsync.mock.calls[0][0] as string;

    // Verify all tables are created
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS providers');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS models');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sessions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS messages');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS system_prompts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS model_metadata');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sync_log');
  });

  it('creates indexes for sessions and messages', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC)');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, created_at ASC)');
  });

  it('includes CHECK constraints for provider type', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain("CHECK(type IN ('openai', 'anthropic', 'custom'))");
  });

  it('includes CHECK constraints for message role', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain("CHECK(role IN ('user', 'assistant', 'system'))");
  });

  it('includes CHECK constraints for sync_log action', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain("CHECK(action IN ('insert', 'update', 'delete'))");
  });

  it('includes cascade delete on models when provider is deleted', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain('REFERENCES providers(id) ON DELETE CASCADE');
  });

  it('includes cascade delete on messages when session is deleted', async () => {
    await migrateV1(mockDb);

    const sql = mockExecAsync.mock.calls[0][0] as string;

    expect(sql).toContain('REFERENCES sessions(id) ON DELETE CASCADE');
  });
});
