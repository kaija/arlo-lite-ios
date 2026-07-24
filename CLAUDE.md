# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Arlo Lite — an Expo/React Native iOS client for LLM APIs. Bring-your-own-key, no backend: every request goes device → provider. Expo SDK 52, RN 0.76, TypeScript strict, Zustand, expo-sqlite, Expo Router.

## Commands

```bash
npm test                                    # jest (jest-expo preset)
npx jest src/hooks/__tests__/useChat.test.ts   # single test file
npx jest -t "regenerates from"              # single test by name
npx tsc --noEmit                            # typecheck
npx expo run:ios                            # build native + install on sim + start Metro
npx expo run:ios --device                   # physical iPhone (signing must be set up in Xcode first)
npx expo start --dev-client                 # Metro only, against an already-installed build
```

`npm run lint` is currently broken — the script exists but there is no `eslint.config.js` (ESLint 9 flat config). Use `npx tsc --noEmit` for static checking, or add a flat config if lint is needed.

First-time / after native dep changes: `npm install && npx expo prebuild --platform ios && (cd ios && pod install)`.

**Known build break:** `expo-localization` fails to compile under Xcode 26 (non-exhaustive `Calendar.Identifier` switch in `node_modules/expo-localization/ios/LocalizationModule.swift` ~line 93). Add `@unknown default: return "gregory"`. The patch lives in `node_modules` and must be re-applied after every `npm install`.

`@/` is aliased to `src/` in tsconfig, babel (`babel-plugin-module-resolver`), and jest `moduleNameMapper` — all three must stay in sync.

## Architecture

Request flow for a chat turn:

```
ChatScreen → useChat (hooks/useChat.ts)
   ├─ tools enabled? → services/agent-loop.ts  (multi-turn tool loop)
   └─ otherwise      → services/completion-service.ts
                          → providers/registry.ts → IProvider adapter
```

- **`providers/`** — the extension seam. Every adapter implements `IProvider` (`providers/types.ts`): `complete`, `streamCompletion`, `listModels`, `validateApiKey`. Adapters own *all* HTTP/SDK work and normalize responses into `StreamChunk` / `CompletionResponse`. `registry.ts` holds one eager stateless instance per `ProviderType`. Adding a provider = new adapter + registry entry + `ProviderType` union member. `custom/` targets arbitrary OpenAI-compatible endpoints (llama-server, vLLM, …) and carries the messiest compat logic.
- **`services/completion-service.ts`** — thin: pulls the API key from secure store, resolves the adapter, delegates. No network logic here.
- **`services/agent-loop.ts`** — calls the provider, detects tool calls, runs them via `tool-executor.ts`, appends results, loops until a final text response or a safety cap (`TerminationReason`). Tools live in `services/tools/` and register in `tool-registry.ts`.
- **`domain/`** — pure functions, heavily property-tested. `thinking-mapper.ts` maps the abstract `ThinkingLevel` (`off|minimal|low|medium|high|xhigh`) onto each provider's wire format (OpenAI `reasoning_effort`, Anthropic `budget_tokens`, custom `chat_template_kwargs`); `cost-calculator.ts` and `context-tracker.ts` derive cost/usage from token counts + model pricing.
- **`database/`** — `database.ts` runs versioned migrations (`migrations/v1..v8`) against `PRAGMA user_version`. Adding a migration means a new `vN.ts`, an entry in the `migrations` map, and bumping `CURRENT_VERSION` — never edit an existing migration. Repositories in `repositories/` are the only SQL callers.
- **`database/secure-store.ts`** — API keys live *only* in expo-secure-store, never in SQLite or AsyncStorage. Keep it that way.
- **`constants/model-catalog.json`** + `model-capabilities.ts` — static catalog (pricing, context window, modality flags) matched by model ID/alias; auto-populates a model's capabilities on add. `utils/model-capabilities.ts` holds the regex fallbacks for models missing from the catalog. Users can override any field afterward.
- **`stores/`** — Zustand, deliberately thin. Business logic belongs in `domain/` or `services/`; effects and derived state belong in hooks; components stay declarative.

## Conventions

- Tests co-located in `__tests__/` next to source. `*.property.test.ts` files use fast-check — non-trivial pure logic gets a property test, not just examples.
- All user-facing text goes through i18next (`src/i18n/locales/`, en + zh-TW).
- No `any` unless unavoidable; doc-comment exported functions and interfaces.
- `ponytail:` comments mark deliberate simplifications and their upgrade path — read them before "fixing" something that looks under-built.
- Design intent lives in `docs/design-system.md` and `docs/ui-ux-design.md`: no chat bubbles, full-width text differentiated by sender, single indigo accent, errors inline in the message flow never as modals.
- Project steering docs are in `.kiro/steering/`; feature specs (requirements/design/tasks) in `.kiro/specs/`.

## Website

`website/` is a static site auto-deployed to GitHub Pages on push to `main` (`.github/workflows/deploy-website.yml`). Unrelated to the app build.
