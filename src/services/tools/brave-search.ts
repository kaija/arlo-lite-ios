/**
 * Brave Web Search tool — calls the Brave Web Search API and returns
 * formatted results. Dynamically registered/unregistered via
 * syncBraveSearchTool() based on settings toggle + key presence.
 *
 * API docs: https://api-dashboard.search.brave.com/documentation/services/web-search
 * Endpoint: GET https://api.search.brave.com/res/v1/web/search
 */

import type { ToolDefinition, ToolContext } from '@/services/tool-registry';
import { registerTool, unregisterTool, getTool } from '@/services/tool-registry';
import * as SecureStore from 'expo-secure-store';
import { buildServiceKey } from '@/database/secure-store';
import { useSettingsStore } from '@/stores/settings-store';

const BRAVE_SERVICE_ID = 'brave_search';
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const TIMEOUT_MS = 15_000;

export const braveSearchTool: ToolDefinition = {
  name: 'brave_web_search',
  description:
    'Search the web for current information. Use when you need up-to-date facts, news, or data not in your training set.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
      count: {
        type: 'integer',
        description: 'Number of results (1-20, default 5).',
        minimum: 1,
        maximum: 20,
        default: 5,
      },
    },
    required: ['query'],
  },
  handler: async (args: Record<string, unknown>, ctx: ToolContext): Promise<string> => {
    const query = args.query as string;
    const count = Math.min((args.count as number) ?? 5, 20);

    const apiKey = await SecureStore.getItemAsync(buildServiceKey(BRAVE_SERVICE_ID));
    if (!apiKey) {
      return 'Error: Brave Search API key not configured.';
    }

    // Manual timeout — React Native lacks AbortSignal.timeout/any
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);
    const onParentAbort = () => timeoutController.abort();
    ctx.signal.addEventListener('abort', onParentAbort, { once: true });

    try {
      const url = new URL(BRAVE_API_URL);
      url.searchParams.set('q', query);
      url.searchParams.set('count', String(count));
      url.searchParams.set('extra_snippets', 'true');

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: timeoutController.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        return `Error: Brave Search returned HTTP ${res.status}. ${body}`.trim();
      }

      const data = await res.json() as BraveWebSearchResponse;
      const webResults = data?.web?.results ?? [];

      if (webResults.length === 0) {
        return `No results found for "${query}".`;
      }

      return webResults
        .map((r, i) => {
          const snippets = [r.description, ...(r.extra_snippets ?? [])].filter(Boolean);
          const snippetText = snippets.join(' ');
          return `[${i + 1}] ${r.title ?? 'Untitled'}\nURL: ${r.url ?? ''}\n${snippetText}`;
        })
        .join('\n\n');
    } catch (err: unknown) {
      const wasTimeout = timeoutController.signal.aborted && !ctx.signal.aborted;
      if (wasTimeout) {
        return 'Error: Brave Search request timed out after 15 seconds.';
      }
      if (ctx.signal.aborted) {
        return 'Error: Brave Search request was cancelled.';
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Error: Brave Search failed — ${msg}`;
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener('abort', onParentAbort);
    }
  },
};

// ─── Response types (subset of Brave Web Search API) ───────────────────────

interface BraveWebSearchResponse {
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      extra_snippets?: string[];
    }>;
  };
}

/** Register or unregister the brave search tool based on settings + key presence. */
export async function syncBraveSearchTool(): Promise<void> {
  const enabled = useSettingsStore.getState().braveSearchEnabled;
  const apiKey = await SecureStore.getItemAsync(buildServiceKey(BRAVE_SERVICE_ID));

  if (enabled && apiKey) {
    if (!getTool('brave_web_search')) {
      registerTool(braveSearchTool);
    }
  } else {
    unregisterTool('brave_web_search');
  }
}
