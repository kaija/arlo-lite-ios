/**
 * Tool registry — Map-based registry with provider-specific schema formatting.
 *
 * Registers tool definitions and exposes them as JSON schemas shaped for
 * the active provider type (OpenAI/Custom function calling vs Anthropic tool use).
 */

import type { OpenAIApiMode, ProviderType } from '@/providers/types';

/** Context passed to every tool handler. Extend as tools need more. */
export interface ToolContext {
  signal: AbortSignal;
}

/** A registered tool: schema + handler. */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema with type:"object"
  /** Optional per-tool timeout in ms. Overrides the executor's default (30s). */
  timeoutMs?: number;
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>;
}

const tools = new Map<string, ToolDefinition>();

const NAME_RE = /^[a-zA-Z0-9_]{1,64}$/;

/** Register a tool. Throws on invalid or duplicate definitions. */
export function registerTool(def: ToolDefinition): void {
  if (!NAME_RE.test(def.name)) {
    throw new Error(`Invalid tool name "${def.name}": must be 1-64 alphanumeric/underscore chars`);
  }
  if (tools.has(def.name)) {
    throw new Error(`Tool "${def.name}" is already registered`);
  }
  if (!def.description) {
    throw new Error(`Tool "${def.name}" must have a non-empty description`);
  }
  if (def.parameters?.type !== 'object') {
    throw new Error(`Tool "${def.name}" parameters must have type:"object"`);
  }
  tools.set(def.name, def);
}

/** Unregister a tool by name. No-op if not registered. */
export function unregisterTool(name: string): void {
  tools.delete(name);
}

/** Look up a tool by name. */
export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

/** Return tool schemas formatted for the given provider type and API mode. */
export function getToolSchemas(providerType: ProviderType, apiMode?: OpenAIApiMode): unknown[] {
  const schemas: unknown[] = [];
  for (const def of tools.values()) {
    if (providerType === 'anthropic') {
      schemas.push({ name: def.name, description: def.description, input_schema: def.parameters });
    } else if (providerType === 'openai' && apiMode === 'responses') {
      // Responses API: flat format { type, name, description, parameters }
      schemas.push({ type: 'function', name: def.name, description: def.description, parameters: def.parameters });
    } else {
      // Chat Completions / custom: nested { type, function: { name, description, parameters } }
      schemas.push({ type: 'function', function: { name: def.name, description: def.description, parameters: def.parameters } });
    }
  }
  return schemas;
}

/** Register built-in tools. Call once at app startup. */
export function initBuiltInTools(): void {
  // Avoid re-registering on hot-reload
  if (tools.has('get_device_info')) return;

  // Lazy import to keep module-level side-effect-free
  const { deviceInfoTool, datetimeTool } = require('@/services/tools/built-in');
  registerTool(deviceInfoTool);
  registerTool(datetimeTool);

  const { syncWebFetchTool } = require('@/services/tools/web-fetch');
  syncWebFetchTool();
}

/**
 * Clear all registered tools. Exposed for testing only.
 * @internal
 */
export function _clearTools(): void {
  tools.clear();
}
