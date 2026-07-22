import { registerTool, unregisterTool, getTool, getToolSchemas, _clearTools } from '@/services/tool-registry';
import type { ToolDefinition } from '@/services/tool-registry';

const validTool: ToolDefinition = {
  name: 'test_tool',
  description: 'A test tool',
  parameters: { type: 'object', properties: {} },
  handler: async () => 'ok',
};

beforeEach(() => _clearTools());

describe('registerTool', () => {
  it('registers and retrieves a valid tool', () => {
    registerTool(validTool);
    expect(getTool('test_tool')).toBe(validTool);
  });

  it('throws on invalid name', () => {
    expect(() => registerTool({ ...validTool, name: '' })).toThrow('Invalid tool name');
    expect(() => registerTool({ ...validTool, name: 'has spaces' })).toThrow('Invalid tool name');
    expect(() => registerTool({ ...validTool, name: 'a'.repeat(65) })).toThrow('Invalid tool name');
  });

  it('throws on duplicate name', () => {
    registerTool(validTool);
    expect(() => registerTool(validTool)).toThrow('already registered');
  });

  it('throws on empty description', () => {
    expect(() => registerTool({ ...validTool, description: '' })).toThrow('non-empty description');
  });

  it('throws when parameters lacks type:"object"', () => {
    expect(() => registerTool({ ...validTool, parameters: { type: 'string' } })).toThrow('type:"object"');
  });
});

describe('getToolSchemas', () => {
  beforeEach(() => registerTool(validTool));

  it('formats for openai', () => {
    const schemas = getToolSchemas('openai');
    expect(schemas).toEqual([{
      type: 'function',
      function: { name: 'test_tool', description: 'A test tool', parameters: { type: 'object', properties: {} } },
    }]);
  });

  it('formats for anthropic', () => {
    const schemas = getToolSchemas('anthropic');
    expect(schemas).toEqual([{
      name: 'test_tool',
      description: 'A test tool',
      input_schema: { type: 'object', properties: {} },
    }]);
  });

  it('formats custom same as openai', () => {
    expect(getToolSchemas('custom')).toEqual(getToolSchemas('openai'));
  });
});

describe('getTool', () => {
  it('returns undefined for unknown tool', () => {
    expect(getTool('nope')).toBeUndefined();
  });
});

describe('unregisterTool', () => {
  it('removes a registered tool so getTool returns undefined', () => {
    registerTool(validTool);
    expect(getTool('test_tool')).toBe(validTool);
    unregisterTool('test_tool');
    expect(getTool('test_tool')).toBeUndefined();
  });

  it('does not throw when unregistering a name that was never registered', () => {
    expect(() => unregisterTool('nonexistent')).not.toThrow();
  });
});
