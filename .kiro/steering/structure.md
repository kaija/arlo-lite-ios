# Project Structure

```
src/
  app/                — Expo Router file-based routes (_layout.tsx, index.tsx)
  components/         — UI components organized by feature area
    chat/             — Message bubbles, streaming indicators, code blocks
    icons/            — SVG icon components
    input/            — Chat input bar, attachments
    layout/           — Screen layouts, containers
    overlays/         — Modals, sheets, pickers
    settings/         — Settings screen components
    sidebar/          — Session list, sidebar transition
  constants/          — App-wide constants and config values
  database/           — expo-sqlite schema, migrations, repositories
    migrations/       — Versioned SQL migration files
    repositories/     — Data access layer (query functions)
    database.ts       — DB initialization and connection
    secure-store.ts   — expo-secure-store wrapper for API keys
  domain/             — Business logic and domain computations
    context-tracker   — Token/context window tracking
    cost-calculator   — Per-turn cost from token usage + pricing
    session-manager   — Session lifecycle logic
    streaming-phase   — Stream state machine
    thinking-mapper   — Maps thinking effort levels per provider
  hooks/              — Custom React hooks (useChat, useSwipeToDelete, etc.)
  i18n/               — i18next setup and translation files
  providers/          — LLM provider implementations
    openai/           — OpenAI Chat Completions + Responses API
    anthropic/        — Anthropic Messages API
    custom/           — Custom OpenAI-compatible endpoints
    types.ts          — Shared provider interface
    registry.ts       — Provider registration and lookup
    errors.ts         — Provider error types
  services/           — Orchestration and side-effect logic
    completion-service — Sends requests, handles streaming
    agent-loop        — Multi-turn tool-use loop
    tool-executor     — Executes tool calls
    tool-registry     — Available tools registry
    tools/            — Individual tool implementations
  stores/             — Zustand stores
    chat-store        — Current conversation messages
    session-store     — Session list and active session
    provider-store    — Provider configs and active model
    settings-store    — App preferences
    ui-store          — Transient UI state (sidebar open, etc.)
  theme/              — Theme tokens, colors, typography
  utils/              — General utilities
```

## Conventions

- **Tests**: co-located in `__tests__/` directories next to source
- **Exports**: each module folder uses index re-exports where applicable
- **Provider pattern**: all providers implement the interface in `providers/types.ts`
- **Stores are thin**: business logic goes in `domain/` or `services/`, not in stores
- **Hooks hold view logic**: components stay declarative, hooks manage effects and derived state
