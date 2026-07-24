# Product: Arlo Lite

Arlo Lite is a free, open-source iOS client for interacting with LLMs. Users bring their own API key and talk directly to the provider — no backend server, no subscription.

## Target Users
Power users and developers who want a clean, fast chat interface for testing and daily-driving LLM APIs.

## Core Value Props
- Direct device-to-provider API calls (no middleman)
- Multi-provider support: OpenAI (Chat Completions + Responses API), Anthropic (Messages), and custom OpenAI-compatible endpoints
- Local-first persistence with iCloud backup
- Streaming responses with provider-specific parsers
- Per-session cost tracking from token usage
- Secure API key storage (expo-secure-store, never plaintext)

## Non-Goals
- No telemetry or analytics
- No backend/proxy server
- No paid features or subscriptions
