# Implementation Plan: Brave Search Tool

## Tasks

- [x] 1. Add `unregisterTool()` to tool registry
  - Add `export function unregisterTool(name: string): void { tools.delete(name); }` — one line, `Map.delete` is already a no-op for missing keys
  - **File:** `src/services/tool-registry.ts`
  - _Requirements: 4.1, 4.5_

- [x] 2. Add `buildServiceKey()` to secure store
  - Add `export function buildServiceKey(serviceId: string): string { return \`arlo.service.\${serviceId}.apiKey\`; }` — one line
  - **File:** `src/database/secure-store.ts`
  - _Requirements: 7.1_

- [x] 3. Add `braveSearchEnabled` + `setBraveSearchEnabled` to settings store
  - Add `braveSearchEnabled: boolean` to `SettingsState` (default `false`)
  - Add `setBraveSearchEnabled: (value: boolean) => void` to `SettingsActions`
  - Add `braveSearchEnabled` to the `partialize` config
  - **File:** `src/stores/settings-store.ts`
  - _Requirements: 6.1, 6.2, 6.3_

- [x] 4. Create `brave-search.ts` with tool definition + `syncBraveSearchTool()`
  - Export `braveSearchTool: ToolDefinition` — name `brave_web_search`, required `query` param, optional `count` param (1–50, default 5)
  - Handler: read key via `SecureStore.getItemAsync(buildServiceKey('brave_search'))`, POST to Brave LLM Context API, format `grounding.generic` results, return error strings on failure (never throw)
  - Export `syncBraveSearchTool()` — reads `braveSearchEnabled` + checks key existence, registers or unregisters accordingly
  - **File:** `src/services/tools/brave-search.ts`
  - _Requirements: 1.1–1.5, 2.1–2.6, 3.1–3.3, 4.2–4.4, 5.1–5.3_

- [x] 5. Add startup call to `syncBraveSearchTool`
  - In bootstrap (after `initBuiltInTools()`), add `await syncBraveSearchTool()`
  - **File:** `src/app/_layout.tsx`
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 6. Create `BraveSearchSettings` UI component
  - Toggle bound to `braveSearchEnabled` via settings store
  - Secure text input for API key (read/write via `SecureStore` + `buildServiceKey('brave_search')`)
  - Save button stores key, clear button deletes key
  - On toggle/save/clear → calls `syncBraveSearchTool()`
  - All user-facing text via `useTranslation()` under `settings.braveSearch` namespace
  - **File:** `src/components/settings/BraveSearchSettings.tsx`
  - _Requirements: 8.1–8.8_

- [x] 7. Wire `BraveSearchSettings` into settings screen navigation
  - Add a row in the settings list that navigates to `BraveSearchSettings`
  - **File:** `src/app/settings.tsx` (or wherever the settings list lives)
  - _Requirements: 8.1_

- [x] 8. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Dependency Table

| Task | Depends On | Rationale |
|------|-----------|-----------|
| 1. unregisterTool | — | One-line addition, no dependencies |
| 2. buildServiceKey | — | One-line addition, no dependencies |
| 3. Settings store | — | State addition, no dependencies |
| 4. brave-search.ts | 1, 2, 3 | Imports unregisterTool, buildServiceKey, reads settings store |
| 5. Startup call | 4 | Calls syncBraveSearchTool |
| 6. UI component | 3, 4 | Uses settings store + syncBraveSearchTool |
| 7. Navigation wiring | 6 | References BraveSearchSettings component |

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4"] },
    { "id": 2, "tasks": ["5", "6"] },
    { "id": 3, "tasks": ["7"] }
  ]
}
```
