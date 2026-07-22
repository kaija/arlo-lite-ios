/**
 * Tool executor — sequential dispatch with per-call timeout and error wrapping.
 * Never throws; all failures are captured as ToolResult with appropriate status.
 */

import type { ToolCall } from '@/providers/types';
import { getTool } from '@/services/tool-registry';

export type ToolResultStatus = 'success' | 'error' | 'timeout' | 'not_found';

export interface ToolResult {
  toolCallId: string;
  name: string;
  status: ToolResultStatus;
  content: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/** Create an AbortSignal that fires after `ms` — React Native polyfill for AbortSignal.timeout. */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

/**
 * Execute tool calls sequentially. Each call gets a per-tool or default timeout.
 * Never throws — errors are captured as ToolResult with appropriate status.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  signal: AbortSignal,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const call of toolCalls) {
    if (signal.aborted) break;

    const def = getTool(call.name);
    if (!def) {
      results.push({ toolCallId: call.id, name: call.name, status: 'not_found', content: `Tool "${call.name}" not found` });
      continue;
    }

    const toolTimeout = def.timeoutMs ?? timeoutMs;
    const { signal: tSignal, clear } = timeoutSignal(toolTimeout);

    try {
      const content = await def.handler(call.arguments, { signal: tSignal });
      results.push({ toolCallId: call.id, name: call.name, status: 'success', content });
    } catch (err: unknown) {
      const isTimeout = tSignal.aborted && !signal.aborted;
      results.push({
        toolCallId: call.id,
        name: call.name,
        status: isTimeout ? 'timeout' : 'error',
        content: isTimeout ? 'Tool execution timed out' : (err instanceof Error ? err.message : String(err)),
      });
    } finally {
      clear();
    }
  }

  return results;
}
