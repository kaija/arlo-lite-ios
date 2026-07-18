import { migrateV5 } from '../migrations/v5';
import {
  createProvider,
  getProvider,
  type ProviderRow,
} from '../repositories/provider-repo';
import { inferPresetFromType } from '@/constants/provider-presets';

// Mock uuid and date for deterministic output
jest.mock('@/utils/uuid', () => ({ generateId: () => 'test-id-123' }));
jest.mock('@/utils/date', () => ({ getCurrentTimestamp: () => 1700000000 }));

// Mock expo-sqlite (not directly used but needed for module resolution)
jest.mock('expo-sqlite', () => ({}));

const mockExecAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockGetAllAsync = jest.fn();

const mockDb = {
  execAsync: mockExecAsync,
  runAsync: mockRunAsync,
  getFirstAsync: mockGetFirstAsync,
  getAllAsync: mockGetAllAsync,
};

describe('Migration v5 — preset column', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('runs ALTER TABLE to add preset column', async () => {
    await migrateV5(mockDb as any);

    expect(mockExecAsync).toHaveBeenCalledTimes(1);
    expect(mockExecAsync).toHaveBeenCalledWith(
      'ALTER TABLE providers ADD COLUMN preset TEXT DEFAULT NULL'
    );
  });

  it('existing rows have preset = NULL after migration', async () => {
    // Simulate reading existing rows after migration — preset is NULL
    const legacyRow: ProviderRow = {
      id: 'legacy-1',
      type: 'custom',
      name: 'My Local LLM',
      base_url: 'http://localhost:8080/v1',
      api_mode: null,
      streaming_enabled: 1,
      generation_params: JSON.stringify({ maxTokens: 4096 }),
      reasoning_mode: null,
      thinking_kwargs: null,
      preset: null,
      created_at: 1690000000,
      updated_at: 1690000000,
    };

    mockGetFirstAsync.mockResolvedValue(legacyRow);

    const provider = await getProvider(mockDb as any, 'legacy-1');

    expect(provider).not.toBeNull();
    // preset inferred from type because stored value is NULL
    expect(provider!.preset).toBe('other');
    expect(provider!.type).toBe('custom');
  });

  it('new provider can be inserted with preset value', async () => {
    mockRunAsync.mockResolvedValue(undefined);

    const provider = await createProvider(mockDb as any, {
      type: 'custom',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      preset: 'ollama',
    });

    // Verify INSERT includes preset column with value
    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const insertCall = mockRunAsync.mock.calls[0];
    const sql = insertCall[0] as string;
    expect(sql).toContain('preset');

    // The preset value should be passed as a parameter (10th value param)
    expect(insertCall).toContain('ollama');

    // Returned provider has correct preset
    expect(provider.preset).toBe('ollama');
    expect(provider.type).toBe('custom');
  });
});

describe('Create + Read round-trip with preset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a provider with preset ollama and reads it back correctly', async () => {
    mockRunAsync.mockResolvedValue(undefined);

    // Create provider with preset
    const created = await createProvider(mockDb as any, {
      type: 'custom',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434/v1',
      preset: 'ollama',
    });

    expect(created.type).toBe('custom');
    expect(created.preset).toBe('ollama');

    // Simulate reading it back from database
    const storedRow: ProviderRow = {
      id: 'test-id-123',
      type: 'custom',
      name: 'Ollama',
      base_url: 'http://localhost:11434/v1',
      api_mode: null,
      streaming_enabled: 1,
      generation_params: JSON.stringify({ maxTokens: 4096 }),
      reasoning_mode: null,
      thinking_kwargs: null,
      preset: 'ollama',
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    mockGetFirstAsync.mockResolvedValue(storedRow);

    const read = await getProvider(mockDb as any, 'test-id-123');

    expect(read).not.toBeNull();
    expect(read!.type).toBe('custom');
    expect(read!.preset).toBe('ollama');
    expect(read!.name).toBe('Ollama');
    expect(read!.baseUrl).toBe('http://localhost:11434/v1');
  });

  it('uses inferPresetFromType when preset is NULL (legacy row)', async () => {
    // A legacy provider that was created before v5 migration — no preset stored
    const legacyRow: ProviderRow = {
      id: 'legacy-custom-1',
      type: 'custom',
      name: 'Old Custom Provider',
      base_url: 'http://localhost:8080/v1',
      api_mode: null,
      streaming_enabled: 1,
      generation_params: JSON.stringify({ maxTokens: 4096 }),
      reasoning_mode: null,
      thinking_kwargs: null,
      preset: null,
      created_at: 1690000000,
      updated_at: 1690000000,
    };

    mockGetFirstAsync.mockResolvedValue(legacyRow);

    const provider = await getProvider(mockDb as any, 'legacy-custom-1');

    expect(provider).not.toBeNull();
    // inferPresetFromType('custom') should return 'other'
    expect(provider!.preset).toBe('other');
    expect(inferPresetFromType('custom')).toBe('other');
  });

  it('infers openai preset for legacy openai provider', async () => {
    const legacyRow: ProviderRow = {
      id: 'legacy-openai-1',
      type: 'openai',
      name: 'OpenAI',
      base_url: 'https://api.openai.com/v1',
      api_mode: 'responses',
      streaming_enabled: 1,
      generation_params: JSON.stringify({ maxTokens: 4096 }),
      reasoning_mode: null,
      thinking_kwargs: null,
      preset: null,
      created_at: 1690000000,
      updated_at: 1690000000,
    };

    mockGetFirstAsync.mockResolvedValue(legacyRow);

    const provider = await getProvider(mockDb as any, 'legacy-openai-1');

    expect(provider).not.toBeNull();
    expect(provider!.preset).toBe('openai');
    expect(inferPresetFromType('openai')).toBe('openai');
  });

  it('infers anthropic preset for legacy anthropic provider', async () => {
    const legacyRow: ProviderRow = {
      id: 'legacy-anthropic-1',
      type: 'anthropic',
      name: 'Anthropic',
      base_url: 'https://api.anthropic.com',
      api_mode: null,
      streaming_enabled: 1,
      generation_params: JSON.stringify({ maxTokens: 4096 }),
      reasoning_mode: null,
      thinking_kwargs: null,
      preset: null,
      created_at: 1690000000,
      updated_at: 1690000000,
    };

    mockGetFirstAsync.mockResolvedValue(legacyRow);

    const provider = await getProvider(mockDb as any, 'legacy-anthropic-1');

    expect(provider).not.toBeNull();
    expect(provider!.preset).toBe('anthropic');
    expect(inferPresetFromType('anthropic')).toBe('anthropic');
  });
});
