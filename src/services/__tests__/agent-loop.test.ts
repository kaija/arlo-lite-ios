/**
 * Smoke tests for runAgentLoop — covers the four key termination/error paths.
 */

import type { StreamChunk, ProviderConfig, IProvider } from '@/providers/types';
import type { AgentLoopCallbacks, AgentLoopOptions } from '@/services/agent-loop';
import type { CompletionServiceOptions } from '@/services/completion-service';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/database/secure-store', () => ({
  getApiKey: jest.fn().mockResolvedValue('test-key'),
}));

const mockStreamCompletion = jest.fn();

jest.mock('@/providers/registry', () => ({
  getProvider: jest.fn(() => ({
    type: 'openai' as const,
    streamCompletion: mockStreamCompletion,
    complete: jest.fn(),
    listModels: jest.fn(),
    validateApiKey: jest.fn(),
  })),
}));

import { runAgentLoop } from '@/services/agent-loop';
import { registerTool, _clearTools } from '@/services/tool-registry';

// ─── Helpers ────────────────────────────────────────────────────────────────

const doneChunk: StreamChunk = {
  type: 'done',
  content: '',
  usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
};

function toolCallChunks(name: string, id = 'tc_1'): StreamChunk[] {
  return [
    { type: 'tool_call', content: '', toolCall: { id, name, arguments: {} } },
    doneChunk,
  ];
}

function textChunks(text: string): StreamChunk[] {
  return [
    { type: 'text', content: text },
    doneChunk,
  ];
}

/** Creates an async iterable from an array of StreamChunks. */
async function* toAsyncIter(chunks: StreamChunk[]): AsyncIterable<StreamChunk> {
  for (const c of chunks) yield c;
}

const baseOpts: CompletionServiceOptions = {
  providerId: 'test',
  providerConfig: { id: 'test', type: 'openai', name: 'Test', baseUrl: 'http://localhost', streamingEnabled: true, createdAt: 0, updatedAt: 0 } as ProviderConfig,
  modelId: 'gpt-test',
  thinkingLevel: 'off',
};

const loopOpts: AgentLoopOptions = {
  providerType: 'openai',
  supportsToolUse: true,
  streaming: true,
  safetyCap: 3,
};

const noopCallbacks: AgentLoopCallbacks = {
  onToolCall: jest.fn().mockResolvedValue(undefined),
  onToolResult: jest.fn().mockResolvedValue(undefined),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _clearTools();
  mockStreamCompletion.mockReset();
});

describe('runAgentLoop', () => {
  it('terminates at safety cap when provider always returns tool calls', async () => {
    // Register a simple tool so execution doesn't return "not_found"
    registerTool({
      name: 'echo',
      description: 'echoes',
      parameters: { type: 'object', properties: {} },
      handler: async () => 'ok',
    });

    // Provider always returns a tool call — loop should hit safetyCap
    mockStreamCompletion.mockImplementation(() => toAsyncIter(toolCallChunks('echo')));

    const signal = new AbortController().signal;
    const result = await runAgentLoop(
      [{ role: 'user', content: 'hi' }],
      baseOpts,
      loopOpts,
      noopCallbacks,
      signal,
    );

    expect(result.terminationReason).toBe('safety_cap');
    expect(result.iterationCount).toBe(3);
  });

  it('returns immediately on final response (no tool calls)', async () => {
    mockStreamCompletion.mockImplementation(() => toAsyncIter(textChunks('Hello!')));

    const signal = new AbortController().signal;
    const result = await runAgentLoop(
      [{ role: 'user', content: 'hi' }],
      baseOpts,
      loopOpts,
      noopCallbacks,
      signal,
    );

    expect(result.terminationReason).toBe('final_response');
    expect(result.content).toBe('Hello!');
    expect(result.iterationCount).toBe(1);
  });

  it('tool errors do not crash the loop', async () => {
    registerTool({
      name: 'explode',
      description: 'always throws',
      parameters: { type: 'object', properties: {} },
      handler: async () => { throw new Error('boom'); },
    });

    // First call: tool call that will throw. Second call: final text response.
    let callCount = 0;
    mockStreamCompletion.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return toAsyncIter(toolCallChunks('explode'));
      return toAsyncIter(textChunks('recovered'));
    });

    const signal = new AbortController().signal;
    const result = await runAgentLoop(
      [{ role: 'user', content: 'hi' }],
      baseOpts,
      loopOpts,
      noopCallbacks,
      signal,
    );

    expect(result.terminationReason).toBe('final_response');
    expect(result.content).toBe('recovered');
    expect(result.iterationCount).toBe(2);
  });

  it('aborted signal stops iteration immediately', async () => {
    const ac = new AbortController();
    ac.abort(); // already aborted

    const result = await runAgentLoop(
      [{ role: 'user', content: 'hi' }],
      baseOpts,
      loopOpts,
      noopCallbacks,
      ac.signal,
    );

    expect(result.terminationReason).toBe('aborted');
    expect(result.iterationCount).toBe(0);
    expect(mockStreamCompletion).not.toHaveBeenCalled();
  });
});
