# Arlo Lite — Requirements

## Background

There is no free and open source, lightweight, and easy-to-use ChatGPT-like iOS client. Users should be able to pick their own LLM provider, supply their own API key, and chat directly against the provider's API — no middleman backend, no subscription.

## Goals

- Free and open source
- Lightweight, native iOS app (no bloat, no unnecessary dependencies)
- Bring-your-own API key — user talks directly to the LLM provider
- Easy to use

## Functional Requirements

### 1. LLM Provider Management

- Provider → model is a **1-N mapping**: user creates a provider first, then adds one or more models under it
- Provider fields:
  - Provider type (OpenAI, Anthropic, or Custom)
  - API key
  - Base URL (editable, defaults per provider type; required for Custom)
  - Display name/label
  - For OpenAI: which API to use — Chat Completions or Responses — selected by user, **default: Responses**
  - Streaming toggle: on by default; user can force-disable streaming per provider
- Model fields (per model under a provider):
  - Model id — picked from the provider's models API list (default) or entered manually
  - Context window size (prefilled from the model metadata table when known; user-editable)
  - Token prices (see Cost Tracking)
- User can edit and delete providers and models
- User can quickly switch the active model from the chat screen, without going through settings
- API keys stored securely in iOS Keychain (never in plain text/UserDefaults)
- **API key validation**: when the first model is added under a provider, test the key with a minimal request (`max_tokens: 10`) against that model and surface a clear success/error result

### Model Metadata & Cost Tracking

- App fetches a **model metadata table from a cloud CDN**: default token prices (input, output, cached input, cached output) and context window sizes per known model
- If a model is missing from the table, fields are left blank; user can fill or override any value manually
- App computes and shows the cost of each turn (message) and the running cost of each session, based on token usage returned by the provider API; cost is hidden when prices are blank

### 2. Provider API Support

- **OpenAI**: both Chat Completions API and Responses API (user picks per provider; default Responses)
- **Anthropic**: Messages API
- **Custom**: any OpenAI-compatible endpoint (user-supplied base URL + model)
- **Google (Gemini)**: deferred to a later version
- Streaming responses by default (SSE); each provider gets its own streaming parser (OpenAI and Anthropic use different stream formats). Non-streaming mode used when the user disables streaming on the provider

### 3. Chat Sessions

- All chat sessions persisted locally on-device
- User can create a new chat session
- User can switch between existing chat sessions (session list/history view)
- User can rename and delete a chat session
- User can switch model mid-session; the session records the last-used provider/model and settings
- Per-session configuration: thinking/reasoning effort (for models that support it)
  - UI exposes one abstract ThinkingLevel — **off / minimal / low / medium / high / xhigh** — mapped per provider:
    | ThinkingLevel | OpenAI (`reasoning_effort`) | Anthropic (`thinking.budget_tokens`) | Custom (OpenAI-compatible) |
    |---------------|------------------------------|--------------------------------------|-----------------------------|
    | off | omit | thinking disabled (`type: "disabled"`) — no budget sent | omit |
    | minimal | `minimal` | 1,024 | `minimal` |
    | low | `low` | 2,048 | `low` |
    | medium | `medium` | 8,192 | `medium` |
    | high | `high` | 16,384 | `high` |
    | xhigh | `high` (clamped) | 16,384 (clamped to high) | `high` (clamped) |
  - Control hidden for models that don't support reasoning

### Chat UX

- Markdown rendering of responses: code blocks with syntax highlighting, tables, lists
- Copy a message; copy a code block with one tap
- Streaming display of responses with a **Stop generation** button; stopping drops the partial message
- **Regenerate** the last response (replaces it)
- **Edit and resend** a previous user message; messages after the edited one are discarded
- Auto-title new sessions locally from the first message (truncated text; no LLM call)
- **Error handling**: show the API response error by default — a simple one-line message, expandable to see the full error detail; retry available
- **Context window**: show a context usage percentage circle in the chat; the app never truncates — the user decides when to open a new chat
  - Advanced (later): compress/summarize the current session and carry it into a new chat
- **Reasoning models**: while the model is thinking, show a blinking "thinking" text icon; user can expand to read the thinking content if desired

### Multimodal Input & Output

- Input attachments: file and image (for models/providers that support them)
- Voice input: **on-device speech-to-text** (dictation) by default; sending audio directly to the model is a future advanced feature
- Image generation: user can generate images via providers that support it, shown inline in the chat

### System Prompts

- App ships with a built-in default system prompt
- User can create and manage their own system prompts
- User selects which system prompt is the default for new sessions

### 4. iCloud Backup

- Chat sessions (and provider configs, excluding API keys) sync/back up via iCloud
- **Chat history text only** — file/image attachments and generated images are not synced (stored on-device only)
- Data available after reinstall or on a new device signed into the same iCloud account
- API keys are excluded from iCloud sync and re-entered per device (Keychain is not iCloud-synced by default)
- Conflict resolution: last write wins
- Deleting a session deletes it from iCloud too (propagates to all devices)

## Non-Functional Requirements

- Native iOS (Swift/SwiftUI), no cross-platform framework
- Minimum iOS version: **iOS 17** (enables SwiftData, String Catalogs, Observation framework)
- No backend server required — app talks directly to provider APIs
- No telemetry/analytics by default
- Offline access to past chat sessions (read-only when no network)
- Accessibility by default: Dynamic Type, VoiceOver labels, sufficient color contrast
- Localization: multi-language UI (String Catalog), English as the base language
- Appearance: dark and light mode, plus follow-system setting (default)
- **Extensible provider architecture**: provider integrations sit behind a common protocol (request building, streaming parser, thinking-effort mapping, model listing) so a new provider is added by implementing the protocol — no changes to chat/session logic

## Out of Scope (initial version)

- Multi-user/team accounts
- Server-side sync across non-Apple platforms
- Plugins/tools/function-calling UI
- Google (Gemini) provider — planned for a later version
- Audio input sent directly to the model — later advanced feature
