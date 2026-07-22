# Design Document: Brave Search Tool

## Overview

Adds a `brave_web_search` tool to Arlo Lite's agent loop. The tool calls the Brave LLM Context API and returns formatted grounding text. It is dynamically registered/unregistered based on a settings toggle and the presence of a securely stored API key.

## Architecture

No new architectural layers. The feature adds:
- One tool definition file (`src/services/tools/brave-search.ts`)
- One helper function + one new export in tool-registry
- One new export in secure-store
- Two new fields/actions in settings-store
- One sync function that wires registration logic
- One settings UI screen

All changes follow existing patterns exactly.

## Components

### 1. Tool Definition — `src/services/tools/brave-search.ts`

A single exported `ToolDefinition` object following the `built-in.ts` pattern.

```typescript
import type { ToolDefinition, ToolContext } from '@/services/tool-registry';
import { getApiKey, buildServiceKey } from '@/database/secure-store';

const BRAVE_SERVICE_ID = 'brave_search';
const BRAVE_API_URL = 'https://api.search.brave.com/res/v1/llm/context';
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
        description: 'Number of results (1-50).',
        minimum: 1,
        maximum: 50,
        default: 5,
      },
    },
    required: ['query'],
  },
  handler: async (args: Record<string, unknown>, ctx: ToolContext): Promise<string> => {
    const query = args.query as string;
    const count = (args.count as number) ?? 5;

    const key = buildServiceKey(BRAVE_SERVICE_ID);
    const apiKey = await getApiKey(key);
    if (!apiKey) {
      return 'Error: Brave Search API key not configured.';
    }

    try {
      const res = await fetch(BRAVE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Subscription-Token': apiKey,
        },
        body: JSON.stringify({ q: query, count, maximum_number_of_tokens: 4096 }),
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), ctx.signal]),
      });

      if (!res.ok) {
        return `Error: Brave Search returned HTTP ${res.status}.`;
      }

      const data = await res.json();
      const results: Array<{ title?: string; url?: string; snippets?: string[] }> =
        data?.grounding?.generic ?? [];

      if (results.length === 0) {
        return `No results found for "${query}".`;
      }

      return results
        .map((r) => {
          const snippetText = (r.snippets ?? []).join(' ');
          return `Title: ${r.title ?? 'Untitled'}\nURL: ${r.url ?? ''}\nContent: ${snippetText}`;
        })
        .join('\n\n');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'Error: Brave Search request was cancelled.';
      }
      if (err instanceof Error && err.name === 'TimeoutError') {
        return 'Error: Brave Search request timed out after 15 seconds.';
      }
      const msg = err instanceof Error ? err.message : String(err);
      return `Error: Brave Search failed — ${msg}`;
    }
  },
};
```

Note: The handler calls `getApiKey(key)` where `key` is the full secure-store key string (output of `buildServiceKey`). This is slightly different from the existing provider pattern where `getApiKey` takes a `providerId` and internally builds the key. For service keys, we pass the pre-built key directly. See "Secure Store" section below for the approach — we reuse the same `SecureStore.getItemAsync`/`setItemAsync` calls via thin wrappers.

**Correction on key retrieval:** To avoid changing the existing `getApiKey` signature, the handler will use the raw `SecureStore.getItemAsync` with the built key, or we add parallel `getServiceKey`/`storeServiceKey`/`deleteServiceKey` helpers. The simplest approach: add `buildServiceKey` and call `SecureStore.getItemAsync(buildServiceKey('brave_search'))` directly in the handler. This keeps the existing `getApiKey`/`storeApiKey` functions untouched.

Revised key retrieval in handler:
```typescript
import * as SecureStore from 'expo-secure-store';
import { buildServiceKey } from '@/database/secure-store';

// Inside handler:
const apiKey = await SecureStore.getItemAsync(buildServiceKey(BRAVE_SERVICE_ID));
```

### 2. Tool Registry Addition — `src/services/tool-registry.ts`

Add one export:

```typescript
/** Unregister a tool by name. No-op if not registered. */
export function unregisterTool(name: string): void {
  tools.delete(name);
}
```

One line. `Map.delete` is already a no-op for missing keys.

### 3. Secure Store Addition — `src/database/secure-store.ts`

Add one export:

```typescript
/**
 * Builds the secure storage key for a service's API key.
 * Uses the `arlo.service.{serviceId}.apiKey` namespace to separate
 * service credentials from LLM provider credentials.
 */
export function buildServiceKey(serviceId: string): string {
  return `arlo.service.${serviceId}.apiKey`;
}
```

No new `storeServiceKey`/`getServiceKey` helpers needed — call the same `SecureStore.setItemAsync` / `getItemAsync` / `deleteItemAsync` with the key from `buildServiceKey`. This avoids duplicating the existing pattern.

### 4. Settings Store Addition — `src/stores/settings-store.ts`

Add to `SettingsState`:
```typescript
braveSearchEnabled: boolean; // default: false
```

Add to `SettingsActions`:
```typescript
setBraveSearchEnabled: (value: boolean) => void;
```

Add to `partialize`:
```typescript
braveSearchEnabled: state.braveSearchEnabled,
```

### 5. Sync Function — `src/services/tools/brave-search.ts`

A single exported helper that checks conditions and registers/unregisters:

```typescript
import { registerTool, unregisterTool, getTool } from '@/services/tool-registry';
import * as SecureStore from 'expo-secure-store';
import { buildServiceKey } from '@/database/secure-store';
import { useSettingsStore } from '@/stores/settings-store';

const BRAVE_SERVICE_ID = 'brave_search';

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
```

Called:
- At app startup (in `_layout.tsx` bootstrap, after `initBuiltInTools()`)
- From the Brave Settings screen when the user toggles or saves/clears the key

### 6. Settings UI — `src/components/settings/BraveSearchSettings.tsx`

A component (or screen presented modally) containing:
- A `Switch` bound to `braveSearchEnabled`
- A `TextInput` with `secureTextEntry` for the API key
- A save/clear button for the key
- All text via `useTranslation()`

On toggle change or key save/clear, calls `syncBraveSearchTool()`.

Navigation: Add a row in the existing settings list that pushes to this component.

### 7. Startup Integration — `src/app/_layout.tsx`

In the `bootstrap()` function, after `initBuiltInTools()` is called (or wherever built-in tools are initialized), add:

```typescript
const { syncBraveSearchTool } = require('@/services/tools/brave-search');
await syncBraveSearchTool();
```

This ensures the tool is registered on cold start if conditions are met.

## Data Flow

```
User toggles ON + saves key
  → setBraveSearchEnabled(true)
  → SecureStore.setItemAsync(buildServiceKey('brave_search'), key)
  → syncBraveSearchTool()
    → reads enabled (true) + reads key (exists)
    → registerTool(braveSearchTool)

Agent loop starts a turn
  → getToolSchemas(providerType) includes brave_web_search
  → LLM may call brave_web_search
  → handler fires fetch to Brave API
  → returns formatted text → LLM uses as grounding
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| No API key configured | Handler returns error string (never throws) |
| HTTP non-2xx | Returns "Error: Brave Search returned HTTP {status}." |
| Network timeout (15s) | Returns "Error: Brave Search request timed out after 15 seconds." |
| Context signal aborted | Returns "Error: Brave Search request was cancelled." |
| Other fetch error | Returns "Error: Brave Search failed — {message}" |
| Empty results | Returns "No results found for \"{query}\"." |

All errors are returned as strings to the LLM (never thrown), matching the tool handler contract where the LLM sees the return value.

## Internationalization

- All UI text in `BraveSearchSettings` uses i18next keys under a `settings.braveSearch` namespace.
- Error strings returned to the LLM are in English (they are for the model, not displayed to the user directly).

## Security Considerations

- API key stored exclusively in expo-secure-store (iOS Keychain).
- Key never appears in AsyncStorage, logs, or serialized state.
- Key is only read inside the handler at invocation time — not cached in memory.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Request construction is correct

*For any* valid query string and count integer (1–50), the handler SHALL construct a POST request to `https://api.search.brave.com/res/v1/llm/context` with body `{q: query, count: count, maximum_number_of_tokens: 4096}` and header `X-Subscription-Token` set to the stored API key.

**Validates: Requirements 2.1, 2.2**

### Property 2: Non-2xx status codes surface in error message

*For any* HTTP response with a status code outside 200–299, the string returned by the handler SHALL contain that numeric status code.

**Validates: Requirements 2.5**

### Property 3: Successful response formatting preserves all result fields

*For any* API response containing a non-empty `grounding.generic` array where each entry has a title, URL, and snippets array, the handler's return string SHALL contain each entry's title, URL, and concatenated snippet text.

**Validates: Requirements 3.1, 3.2**

### Property 4: unregisterTool removes registered tools

*For any* tool name that is currently registered in the Tool_Registry, calling `unregisterTool(name)` SHALL cause `getTool(name)` to return undefined, and calling `unregisterTool` on a name that is NOT registered SHALL not throw.

**Validates: Requirements 4.1, 4.5**

### Property 5: buildServiceKey follows naming pattern

*For any* non-empty serviceId string, `buildServiceKey(serviceId)` SHALL return the string `arlo.service.${serviceId}.apiKey`.

**Validates: Requirements 7.1**
