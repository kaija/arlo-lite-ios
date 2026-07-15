# Arlo Lite — Project Steering

## Overview

Arlo Lite is a free, open-source, lightweight native iOS client for interacting with LLMs. Users bring their own API key and talk directly to the provider's API — no middleman backend, no subscription. The app targets power users and developers who want a clean, fast chat interface for testing and daily-driving LLM APIs.

## Architecture Principles

- **Native iOS (Swift/SwiftUI)** — minimum deployment target: iOS 17
- **No backend server** — all API calls go directly from device to provider
- **Extensible provider protocol** — each provider (OpenAI, Anthropic, Custom) implements a common protocol for request building, streaming parsing, thinking-effort mapping, and model listing
- **Local-first persistence** — SwiftData for chat sessions; iCloud sync for backup (text only, no attachments)
- **Secure key storage** — API keys live exclusively in iOS Keychain, never in UserDefaults or plain text

## Supported Providers

| Provider | API | Default |
|----------|-----|---------|
| OpenAI | Chat Completions or Responses (user picks) | Responses |
| Anthropic | Messages API | — |
| Custom | OpenAI-compatible endpoint | — |
| Google (Gemini) | Deferred to later version | — |

## Key Functional Areas

1. **Provider & Model Management** — 1-to-N provider→model mapping, CDN-fetched metadata table for prices/context sizes
2. **Chat Sessions** — local persistence, model switching mid-session, per-session thinking level control
3. **Streaming** — SSE by default with provider-specific parsers; non-streaming fallback toggle
4. **Markdown Rendering** — code blocks with syntax highlighting, tables, lists, one-tap copy
5. **Multimodal Input** — file/image attachments, on-device speech-to-text dictation
6. **Image Generation** — inline display for providers that support it
7. **System Prompts** — built-in default, user-managed library, selectable default for new sessions
8. **iCloud Backup** — chat text + provider configs (excluding keys); last-write-wins conflict resolution
9. **Cost Tracking** — per-turn and per-session cost computed from token usage and model pricing

## Non-Functional Requirements

- No telemetry/analytics by default
- Offline read access to past sessions
- Accessibility: Dynamic Type, VoiceOver labels, sufficient color contrast
- Localization via String Catalog (English base)
- Appearance: light, dark, and system-follow (default)

## Project Structure

```
docs/
  requirements.md          — Full functional + non-functional requirements

mockup/                    — Interactive HTML/JSX prototype
  ios-frame.jsx            — iOS 26 Liquid Glass device frame components
  Arlo Lite.dc.html       — Main prototype (design-component format)
  arlo-standalone.dc.html  — Standalone bundled version
  Arlo Lite.html           — Pre-bundled distributable
  support.js               — dc-runtime for rendering prototypes
  _ds/                     — Apple Design System (tokens, components, UI kits)
  uploads/                 — Reference copy of requirements

.kiro/
  specs/arlo-lite-app/     — Feature spec (requirements, design, tasks, UI/UX)
  steering/                — This file and future project norms
```

## Mockup Folder Reference

The `mockup/` directory contains a fully interactive HTML prototype of the app built on an Apple Design System with iOS 26 Liquid Glass styling. Key details:

### Device Frame (`ios-frame.jsx`)
Exports reusable React components for prototyping iOS screens:
- `IOSDevice` — bezel with Dynamic Island, status bar, home indicator (402×874 default)
- `IOSStatusBar` — time, signal, WiFi, battery
- `IOSNavBar` — liquid glass pill navigation with large title
- `IOSGlassPill` — blur + tint + shine glass effect element
- `IOSList` / `IOSListRow` — grouped inset list with 26px radius cards
- `IOSKeyboard` — iOS 26 liquid glass keyboard

### Design System (`_ds/apple-design-system-*/`)
A full token + component system:
- **Tokens**: colors (12 system + semantic + dark), typography (SF Pro, Dynamic Type scale), spacing (4pt grid), materials (vibrancy/blur), elevation (4 shadow levels + transitions)
- **Components**: Button, SegmentedControl, Badge, Slider, Stepper, Switch, TextField, ListGroup, ListRow, Avatar, NavBar, TabBar
- **UI Kits**: Messages app clone, Settings app clone (interactive)
- **Font**: SF Pro (self-hosted TTF)
- **Icons**: Lucide Icons (prototype layer substitute for SF Symbols)

### Prototype Interactions
The dc.html files implement:
- Chat message stream with user/assistant differentiation
- Streaming text with blinking caret indicator
- Thinking state with expanding reasoning content
- Context usage ring near input field
- Thinking effort cycling control
- Session sidebar with swipe-to-delete and hold-to-rename
- Page-turn-like sidebar reveal transition
- Model switcher chip above input
- Light/dark theme toggle
- Code blocks with single-hue syntax highlighting
- Error messages inline in message stream with retry

## UI/UX Design Principles

- Minimal, cool-toned aesthetic (Linear/Raycast-inspired)
- No chat bubbles — full-width flowing text differentiated by sender label
- Single accent color (indigo `#5856D6` in prototype); monochrome palette
- Motion and transitions provide personality, not color variety
- Session switcher transition is the one expressive animation spot
- Status metadata shown via ring/gauge icon near input, not a top bar
- Errors render inline in message flow, never as blocking modals
- Code blocks use fixed dark background with accent-hue-derived highlighting

## Development Norms

- Use SwiftUI as the primary UI framework
- Follow Apple Human Interface Guidelines for native feel
- Use Swift Concurrency (async/await, actors) for networking and streaming
- Keep view models testable and decoupled from SwiftUI views
- Prefer composition over inheritance in the provider protocol design
- Use String Catalog (.xcstrings) for all user-facing text from day one
- Write doc comments on all public protocol methods
