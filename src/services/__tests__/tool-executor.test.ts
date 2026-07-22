import { executeToolCalls } from '@/services/tool-executor';
import { registerTool, _clearTools } from '@/services/tool-registry';

beforeEach(() => _clearTools());

const echoTool = {
  name: 'echo',
  description: 'Echoes input',
  parameters: { type: 'object' as const, properties: { msg: { type: 'string' } }, required: ['msg'] },
  handler: async (args: Record<string, unknown>) => String(args.msg),
};

describe('executeToolCalls', () => {
  it('returns not_found for unknown tools', async () => {
    const results = await executeToolCalls(
      [{ id: '1', name: 'nope', arguments: {} }],
      new AbortController().signal,
    );
    expect(results).toEqual([{ toolCallId: '1', name: 'nope', status: 'not_found', content: 'Tool "nope" not found' }]);
  });

  it('executes a tool and returns success', async () => {
    registerTool(echoTool);
    const results = await executeToolCalls(
      [{ id: '2', name: 'echo', arguments: { msg: 'hi' } }],
      new AbortController().signal,
    );
    expect(results[0]).toMatchObject({ status: 'success', content: 'hi' });
  });

  it('wraps handler errors as error status', async () => {
    registerTool({ ...echoTool, name: 'boom', handler: async () => { throw new Error('kaboom'); } });
    const results = await executeToolCalls(
      [{ id: '3', name: 'boom', arguments: {} }],
      new AbortController().signal,
    );
    expect(results[0]).toMatchObject({ status: 'error', content: 'kaboom' });
  });

  it('stops processing when signal is aborted', async () => {
    registerTool(echoTool);
    const ac = new AbortController();
    ac.abort();
    const results = await executeToolCalls(
      [{ id: '4', name: 'echo', arguments: { msg: 'x' } }],
      ac.signal,
    );
    expect(results).toHaveLength(0);
  });

  it('returns timeout status when handler exceeds timeout', async () => {
    registerTool({
      ...echoTool,
      name: 'slow',
      handler: async (_args, ctx) => {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, 5000);
          ctx.signal.addEventListener('abort', () => { clearTimeout(timer); reject(ctx.signal.reason); });
        });
        return 'done';
      },
    });
    const results = await executeToolCalls(
      [{ id: '5', name: 'slow', arguments: {} }],
      new AbortController().signal,
      50, // 50ms timeout
    );
    expect(results[0]).toMatchObject({ status: 'timeout', content: 'Tool execution timed out' });
  });
});
