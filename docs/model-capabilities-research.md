# LLM Model Capabilities Research — Google Gemini, Anthropic Claude, OpenAI

**Research date: 2026-07-22.** All figures below come from first-party provider documentation fetched on that date. Prices are USD per 1M tokens (MTok) unless stated otherwise. Anything that could not be verified against a first-party page is recorded as `null` / "not documented" and listed in [Gaps & uncertainties](#gaps--uncertainties).

> A machine-readable companion to this document — one JSON object per model, 64 records — lives in the app at [`src/constants/model-catalog.json`](../src/constants/model-catalog.json).

> **Two doc-host migrations happened before this research.** Anthropic's `docs.claude.com` now 302-redirects to **`platform.claude.com/docs/...`**, and OpenAI's `platform.openai.com/docs` now 301-redirects to **`developers.openai.com/api/docs/...`**. Citations below use the current canonical hosts.

---

## Sources

Every URL fetched for this document, with the date fetched.

### Anthropic (Claude API)

| # | URL | Fetched |
|---|-----|---------|
| A1 | https://platform.claude.com/docs/en/about-claude/models/overview | 2026-07-22 |
| A2 | https://platform.claude.com/docs/en/about-claude/pricing | 2026-07-22 |
| A3 | https://platform.claude.com/docs/en/about-claude/model-deprecations | 2026-07-22 |
| A4 | https://platform.claude.com/docs/en/build-with-claude/overview | 2026-07-22 |
| A5 | https://platform.claude.com/docs/en/build-with-claude/pdf-support | 2026-07-22 |
| A6 | https://platform.claude.com/docs/en/build-with-claude/prompt-caching | 2026-07-22 |
| A7 | https://platform.claude.com/docs/en/build-with-claude/structured-outputs | 2026-07-22 |
| A8 | https://platform.claude.com/docs/en/build-with-claude/context-windows | 2026-07-22 |
| A9 | https://platform.claude.com/docs/en/build-with-claude/extended-thinking | 2026-07-22 |
| A10 | https://platform.claude.com/docs/en/build-with-claude/vision | 2026-07-22 |
| A11 | https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking | 2026-07-22 |

### Google (Gemini API)

| # | URL | Fetched |
|---|-----|---------|
| G1 | https://ai.google.dev/gemini-api/docs/models | 2026-07-22 (page "Last updated 2026-07-21 UTC") |
| G2 | https://ai.google.dev/gemini-api/docs/pricing | 2026-07-22 |
| G3 | https://ai.google.dev/gemini-api/docs/deprecations | 2026-07-22 |
| G4 | https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash | 2026-07-22 |
| G5 | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash | 2026-07-22 |
| G6 | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite | 2026-07-22 |
| G7 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite | 2026-07-22 |
| G8 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview | 2026-07-22 |
| G9 | https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview | 2026-07-22 |
| G10 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro | 2026-07-22 |
| G11 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash | 2026-07-22 |
| G12 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-lite | 2026-07-22 |
| G13 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image | 2026-07-22 |
| G14 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-image | 2026-07-22 |
| G15 | https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image | 2026-07-22 |
| G16 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-image | 2026-07-22 |
| G17 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview | 2026-07-22 |
| G18 | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-live-translate-preview | 2026-07-22 |
| G19 | https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview | 2026-07-22 |
| G20 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-native-audio-preview-12-2025 | 2026-07-22 |
| G21 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash-preview-tts | 2026-07-22 |
| G22 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-pro-preview-tts | 2026-07-22 |
| G23 | https://ai.google.dev/gemini-api/docs/models/gemini-omni-flash | 2026-07-22 |
| G24 | https://ai.google.dev/gemini-api/docs/models/gemini-2.5-computer-use-preview-10-2025 | 2026-07-22 |
| G25 | https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2 | 2026-07-22 |
| G26 | https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001 | 2026-07-22 |

### OpenAI (Platform API)

| # | URL | Fetched |
|---|-----|---------|
| O1 | https://developers.openai.com/api/docs/models | 2026-07-22 |
| O2 | https://developers.openai.com/api/docs/models/all | 2026-07-22 |
| O3 | https://developers.openai.com/api/docs/pricing | 2026-07-22 |
| O4 | https://developers.openai.com/api/docs/deprecations | 2026-07-22 |
| O5 | https://developers.openai.com/api/docs/guides/latest-model/gpt-5.6 | 2026-07-22 |
| O6 | https://developers.openai.com/api/docs/guides/file-inputs | 2026-07-22 |
| O7 | https://developers.openai.com/api/docs/models/gpt-5.6-sol (and `/gpt-5.6-terra`, `/gpt-5.6-luna`, `/gpt-5.5`, `/gpt-5.5-pro`, `/gpt-5.4`, `/gpt-5.4-mini`, `/gpt-5.4-nano`, `/gpt-5.4-pro`, `/gpt-5.3-codex`, `/gpt-5.3-chat-latest`, `/chat-latest`, `/gpt-realtime-2.1`, `/gpt-realtime-2.1-mini`, `/gpt-realtime-translate`, `/gpt-realtime-whisper`, `/gpt-audio-1.5`, `/gpt-image-2`, `/gpt-image-1.5`, `/gpt-image-1-mini`, `/sora-2`, `/sora-2-pro`, `/gpt-4o-transcribe`, `/gpt-4o-mini-transcribe`, `/gpt-4o-mini-tts`, `/text-embedding-3-large`, `/text-embedding-3-small`, `/o3-deep-research`, `/o4-mini-deep-research`, `/computer-use-preview`, `/gpt-oss-120b`, `/gpt-oss-20b`, `/omni-moderation-latest`) | 2026-07-22 |

> `openai.com/api/pricing` returned HTTP 403 to automated fetches; OpenAI's first-party pricing was taken from the equivalent documentation page O3 instead.

---

# 1. Anthropic — Claude API

## 1.1 Model IDs, status & lifecycle

Every Claude model ID is a **pinned snapshot**. From the 4.6 generation onward the IDs use a dateless format that is still a pinned snapshot, not an evergreen pointer; for pre-4.6 models the "alias" column is a convenience pointer that resolves to a dated ID. [A1]

| Model | API model ID | Alias | Status | Tentative retirement | Replacement |
|---|---|---|---|---|---|
| Claude Fable 5 | `claude-fable-5` | `claude-fable-5` | Active (GA 2026-06-09) | Not sooner than 2027-06-09 | — |
| Claude Mythos 5 | `claude-mythos-5` | — | Limited availability (invite-only, Project Glasswing) | not documented | — |
| Claude Mythos Preview | `claude-mythos-preview` | — | Retiring | **2026-07-21** (i.e. already past) | `claude-mythos-5` |
| Claude Opus 4.8 | `claude-opus-4-8` | `claude-opus-4-8` | Active | Not sooner than 2027-05-28 | — |
| Claude Sonnet 5 | `claude-sonnet-5` | `claude-sonnet-5` | Active | Not sooner than 2027-06-30 | — |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5` | Active | Not sooner than 2026-10-15 | — |
| Claude Opus 4.7 | `claude-opus-4-7` | `claude-opus-4-7` | Active (listed as Legacy in overview) | Not sooner than 2027-04-16 | — |
| Claude Opus 4.6 | `claude-opus-4-6` | `claude-opus-4-6` | Active (Legacy) | Not sooner than 2027-02-05 | — |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | `claude-sonnet-4-6` | Active (Legacy) | Not sooner than 2027-02-17 | — |
| Claude Sonnet 4.5 | `claude-sonnet-4-5-20250929` | `claude-sonnet-4-5` | Active (Legacy) | Not sooner than 2026-09-29 | — |
| Claude Opus 4.5 | `claude-opus-4-5-20251101` | `claude-opus-4-5` | Active (Legacy) | Not sooner than 2026-11-24 | — |
| Claude Opus 4.1 | `claude-opus-4-1-20250805` | `claude-opus-4-1` | **Deprecated** (2026-06-05) | **2026-08-05** | `claude-opus-4-8` |

Sources: [A1], [A3].

Cloud-platform IDs (Bedrock / Google Cloud) differ and follow the partner's own lifecycle: e.g. `anthropic.claude-opus-4-8`, `anthropic.claude-haiku-4-5-20251001-v1:0`, `claude-haiku-4-5@20251001`. Claude Platform on AWS uses the **same IDs as the Claude API**. [A1]

## 1.2 Context window & output limits

| Model | Max input (context window) | Max output tokens | Reliable knowledge cutoff | Training data cutoff |
|---|---|---|---|---|
| `claude-fable-5` | 1,000,000 | 128,000 | Jan 2026 | Jan 2026 |
| `claude-mythos-5` | 1,000,000 (shares Fable 5 specs) | 128,000 | Jan 2026 | Jan 2026 |
| `claude-opus-4-8` | 1,000,000 | 128,000 | Jan 2026 | Jan 2026 |
| `claude-sonnet-5` | 1,000,000 | 128,000 | Jan 2026 | Jan 2026 |
| `claude-haiku-4-5-20251001` | 200,000 | 64,000 | Feb 2025 | Jul 2025 |
| `claude-opus-4-7` | 1,000,000 | 128,000 | Jan 2026 | Jan 2026 |
| `claude-opus-4-6` | 1,000,000 | 128,000 | May 2025 | Aug 2025 |
| `claude-sonnet-4-6` | 1,000,000 | 128,000 | Aug 2025 | Jan 2026 |
| `claude-sonnet-4-5-20250929` | 200,000 | 64,000 | Jan 2025 | Jul 2025 |
| `claude-opus-4-5-20251101` | 200,000 | 64,000 | May 2025 | Aug 2025 |
| `claude-opus-4-1-20250805` | 200,000 | 32,000 | Jan 2025 | Mar 2025 |

Source: [A1].

Important context notes:

- **1M is the default, with no beta header and no long-context surcharge.** "For every model with a 1M-token context window, 1M is the default: you don't need a beta header, and long-context requests are billed at standard pricing." [A8] The pricing page repeats this: the full 1M window is included at standard rates, and "a 900k-token request is billed at the same per-token rate as a 9k-token request." [A2] **There is currently no Anthropic 1M-context premium tier.**
- **Extended output beta:** on the Message Batches API, Opus 4.8, Opus 4.7, Opus 4.6, Sonnet 5 and Sonnet 4.6 support up to **300k output tokens** via the `output-300k-2026-03-24` beta header. [A1]
- **Tokenizer change:** Opus 4.7 and later Opus models, Fable 5, Mythos 5/Preview and Sonnet 5 use a newer tokenizer that produces roughly **30% more tokens for the same text**. Sonnet 4.6 and earlier use the previous tokenizer. This materially affects cost comparisons across generations. [A1], [A2]
- Request payload caps: max 32 MB per request, max 600 PDF pages/images per request (100 when the context window is under 1M). [A5], [A8]

## 1.3 Pricing

Base rates (Standard, per MTok):

| Model | Input | 5m cache write | 1h cache write | Cache hit / refresh (read) | Output |
|---|---|---|---|---|---|
| Claude Fable 5 | $10.00 | $12.50 | $20.00 | $1.00 | $50.00 |
| Claude Mythos 5 | $10.00 | $12.50 | $20.00 | $1.00 | $50.00 |
| Claude Opus 4.8 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.7 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.6 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.5 | $5.00 | $6.25 | $10.00 | $0.50 | $25.00 |
| Claude Opus 4.1 (deprecated) | $15.00 | $18.75 | $30.00 | $1.50 | $75.00 |
| **Claude Sonnet 5 — through 2026-08-31 (introductory)** | $2.00 | $2.50 | $4.00 | $0.20 | $10.00 |
| **Claude Sonnet 5 — from 2026-09-01 (standard)** | $3.00 | $3.75 | $6.00 | $0.30 | $15.00 |
| Claude Sonnet 4.6 | $3.00 | $3.75 | $6.00 | $0.30 | $15.00 |
| Claude Sonnet 4.5 | $3.00 | $3.75 | $6.00 | $0.30 | $15.00 |
| Claude Haiku 4.5 | $1.00 | $1.25 | $2.00 | $0.10 | $5.00 |

Source: [A2]. Cache multipliers relative to base input: 5-minute write **1.25×**, 1-hour write **2×**, cache read **0.1×**. [A2]

Batch API — **50% discount on both input and output**: [A2]

| Model | Batch input | Batch output |
|---|---|---|
| Claude Fable 5 / Mythos 5 | $5.00 | $25.00 |
| Claude Opus 4.8 / 4.7 / 4.6 / 4.5 | $2.50 | $12.50 |
| Claude Opus 4.1 (deprecated) | $7.50 | $37.50 |
| Claude Sonnet 5 (through 2026-08-31) | $1.00 | $5.00 |
| Claude Sonnet 5 (from 2026-09-01) | $1.50 | $7.50 |
| Claude Sonnet 4.6 / 4.5 | $1.50 | $7.50 |
| Claude Haiku 4.5 | $0.50 | $2.50 |

Other pricing modifiers [A2]:

| Modifier | Effect | Scope |
|---|---|---|
| Long context (>200k) | **No surcharge** — standard rates across the full 1M window | Fable 5, Mythos 5/Preview, Opus 4.8/4.7/4.6, Sonnet 5, Sonnet 4.6 |
| Fast mode (research preview) | Opus 4.8: $10 in / $50 out. Opus 4.7: $30 in / $150 out (**fast mode for 4.7 is deprecated, removed 2026-07-24**). Not available on Opus 4.6 (silently runs at standard speed/price since 2026-06-29). Not available with Batch API. | Opus 4.8, Opus 4.7 |
| Data residency (`inference_geo: "us"`) | **1.1× multiplier** on input, output, cache writes and cache reads | Opus 4.6, Sonnet 4.6 and later |
| Regional / multi-region endpoints (Bedrock, Google Cloud) | **10% premium** over global endpoints | Sonnet 4.5, Haiku 4.5, Opus 4.5 and all later models |
| Web search server tool | $10 per 1,000 searches + token costs | all |
| Web fetch server tool | No additional charge | all |
| Code execution | Free when used with `web_search_20260209`+ / `web_fetch_20260209`+; otherwise 1,550 free container-hours/org/month then $0.05/hour/container | all |
| Claude Managed Agents session runtime | $0.08 per session-hour (plus tokens) | all |

## 1.4 Multimodal & feature matrix

Anthropic's overview states plainly: "All current Claude models support text and image input, text output, multilingual capabilities, and vision." [A1] There is **no image generation, no audio in/out, no video input, and no realtime/live voice API** anywhere in the Claude API. [A1], [A4]

| Model | Text in | Text out | Image in | Image out | Audio in | Audio out | Video in | PDF in | Realtime voice | Tools | Structured output | Prompt caching | Reasoning | Streaming |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `claude-fable-5` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ adaptive (always on) | ✅ |
| `claude-mythos-5` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ adaptive | ✅ |
| `claude-opus-4-8` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ adaptive | ✅ |
| `claude-sonnet-5` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ adaptive | ✅ |
| `claude-haiku-4-5-20251001` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ extended (not adaptive) | ✅ |
| `claude-opus-4-7` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ adaptive | ✅ |
| `claude-opus-4-6` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ extended + adaptive | ✅ |
| `claude-sonnet-4-6` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ extended + adaptive | ✅ |
| `claude-sonnet-4-5-20250929` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ extended | ✅ |
| `claude-opus-4-5-20251101` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ extended | ✅ |
| `claude-opus-4-1-20250805` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ (not listed) | ✅ | ✅ extended | ✅ |

Backing citations:

- **Thinking modes** per model (extended vs. adaptive) from the comparison tables in [A1]. Opus 4.8, Opus 4.7, Sonnet 5 and Fable 5 have adaptive thinking only ("Extended thinking: No"); Fable 5's is *always on*. Haiku 4.5 has extended thinking but not adaptive. [A1]
- **Prompt caching:** "Prompt caching (both automatic and explicit) is supported on all active Claude models." [A6]
- **Structured outputs:** GA on the Claude API for Fable 5, Mythos 5, Opus 4.8, Mythos Preview, Opus 4.7, Opus 4.6, Sonnet 5, Sonnet 4.6, Sonnet 4.5, Opus 4.5 and Haiku 4.5. Opus 4.1 is not in that list. [A7]
- **PDF support:** GA on the Claude API, Bedrock, Claude Platform on AWS, Google Cloud and Microsoft Foundry. [A4], [A5]

### Anthropic API parameter deprecation (breaking)

`temperature`, `top_p` and `top_k` are **deprecated and return a 400 error when set to a non-default value** on Claude Opus 4.7 and later (including Opus 4.8) and on Claude Sonnet 5. Omit them and steer with prompting instead. [A3]

### Recently deprecated / retired (Anthropic)

| Model | Deprecated | Retired | Replacement |
|---|---|---|---|
| `claude-opus-4-1-20250805` | 2026-06-05 | 2026-08-05 (pending) | `claude-opus-4-8` |
| `claude-opus-4-20250514` | 2026-04-14 | 2026-06-15 | `claude-opus-4-8` |
| `claude-sonnet-4-20250514` | 2026-04-14 | 2026-06-15 | `claude-sonnet-4-6` |
| `claude-3-haiku-20240307` | 2026-02-19 | 2026-04-20 | `claude-haiku-4-5-20251001` |
| `claude-3-7-sonnet-20250219` | 2025-10-28 | 2026-02-19 | `claude-sonnet-4-6` |
| `claude-3-5-haiku-20241022` | 2025-12-19 | 2026-02-19 | `claude-haiku-4-5-20251001` |
| `claude-3-opus-20240229` | 2025-06-30 | 2026-01-05 | `claude-opus-4-8` |

Source: [A3]. Retired models still carry pricing entries because they remain available on some partner clouds: Opus 4 (Google Cloud only), Sonnet 4 and Haiku 3.5 (Bedrock and Google Cloud only). [A2]

---

# 2. Google — Gemini API

Gemini's public model page is now a card index; per-model specs live on individual pages (G4–G26) and pricing on G2. Google exposes **four consumption tiers** per model — Standard, Batch, Flex and Priority — rather than a single price. Batch and Flex are typically 50% of Standard; Priority is typically 1.8× Standard. [G2]

## 2.1 Model IDs, status & lifecycle

| Model | API model code | Status | Release date | Shutdown date | Replacement |
|---|---|---|---|---|---|
| Gemini 3.6 Flash | `gemini-3.6-flash` | Stable | 2026-07-21 | none announced | — |
| Gemini 3.5 Flash | `gemini-3.5-flash` | Stable | 2026-05-19 | none announced | — |
| Gemini 3.5 Flash-Lite | `gemini-3.5-flash-lite` | Stable | 2026-07-21 | none announced | — |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | Stable | 2026-05-07 | **2027-05-07** | `gemini-3.5-flash-lite` |
| Gemini 3.1 Pro | `gemini-3.1-pro-preview` (+ `gemini-3.1-pro-preview-customtools`) | Preview | 2026-02-19 | none announced | — |
| Gemini 3 Flash | `gemini-3-flash-preview` | Preview | 2025-12-17 | none announced | `gemini-3.6-flash` |
| Nano Banana 2 | `gemini-3.1-flash-image` | Stable | 2026-05-28 | none announced | — |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | Stable | (page: updated 2026-06) | none announced | — |
| Nano Banana Pro | `gemini-3-pro-image` | Stable | 2026-05-28 | none announced | — |
| Gemini 3.1 Flash Live | `gemini-3.1-flash-live-preview` | Preview | (page: updated 2026-03) | none announced | — |
| Gemini 3.5 Live Translate | `gemini-3.5-live-translate-preview` | Preview | (page: updated 2026-06) | none announced | — |
| Gemini 3.1 Flash TTS | `gemini-3.1-flash-tts-preview` | Preview | (page: updated 2026-04) | none announced | — |
| Gemini Omni Flash | `gemini-omni-flash-preview` | Preview | (page: updated 2026-06) | none announced | — |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Stable | 2025-06-17 | **2026-10-16** | `gemini-3.1-pro-preview` |
| Gemini 2.5 Flash | `gemini-2.5-flash` | Stable | 2025-06-17 | **2026-10-16** | `gemini-3.6-flash` |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | Stable | 2025-07-22 | **2026-10-16** | `gemini-3.1-flash-lite` |
| Nano Banana | `gemini-2.5-flash-image` | Stable | 2025-10-02 | **2026-10-02** | `gemini-3.1-flash-image-preview` |
| Gemini 2.5 Flash Native Audio | `gemini-2.5-flash-native-audio-preview-12-2025` | Preview | — | none announced | — |
| Gemini 2.5 Flash TTS | `gemini-2.5-flash-preview-tts` | Preview | — | none announced | — |
| Gemini 2.5 Pro TTS | `gemini-2.5-pro-preview-tts` | Preview | — | none announced | — |
| Computer Use | `gemini-2.5-computer-use-preview-10-2025` | Preview | 2025-10 | none announced | — |
| Gemini Embedding 2 | `gemini-embedding-2` | Stable | (page: updated 2026-04) | none announced | — |
| Gemini Embedding | `gemini-embedding-001` | Stable | 2025-06 | none announced | — |

Sources: [G1], [G3], [G4]–[G26].

**Version naming:** Gemini IDs come in `stable`, `preview`, `latest` and `experimental` flavours. Stable IDs (e.g. `gemini-3.6-flash`) don't change and are recommended for production. `latest` aliases (e.g. `gemini-flash-latest`) hot-swap on every release with 2 weeks' notice for breaking changes. Preview models get at least 2 weeks' deprecation notice. [G1]

## 2.2 Context window & output limits

| Model | Max input tokens | Max output tokens | Knowledge cutoff |
|---|---|---|---|
| `gemini-3.6-flash` | 1,048,576 | 65,536 | not documented |
| `gemini-3.5-flash` | 1,048,576 | 65,536 | not documented |
| `gemini-3.5-flash-lite` | 1,048,576 | 65,536 | not documented |
| `gemini-3.1-flash-lite` | 1,048,576 | 65,536 | not documented |
| `gemini-3.1-pro-preview` | 1,048,576 | 65,536 | not documented |
| `gemini-3-flash-preview` | 1,048,576 | 65,536 | not documented |
| `gemini-2.5-pro` | 1,048,576 | 65,536 | January 2025 |
| `gemini-2.5-flash` | 1,048,576 | 65,536 | January 2025 |
| `gemini-2.5-flash-lite` | 1,048,576 | 65,536 | January 2025 |
| `gemini-3.1-flash-image` | 131,072 | 32,768 | not documented |
| `gemini-3.1-flash-lite-image` | 65,536 | 4,096 | not documented |
| `gemini-3-pro-image` | 65,536 | 32,768 | not documented |
| `gemini-2.5-flash-image` | 65,536 | 32,768 | June 2025 |
| `gemini-3.1-flash-live-preview` | 131,072 | 65,536 | not documented |
| `gemini-3.5-live-translate-preview` | 131,072 | 65,536 | not documented |
| `gemini-3.1-flash-tts-preview` | 8,192 | 16,384 | not documented |
| `gemini-2.5-flash-native-audio-preview-12-2025` | 131,072 | 8,192 | January 2025 |
| `gemini-2.5-flash-preview-tts` | 8,192 | 16,384 | not documented |
| `gemini-2.5-pro-preview-tts` | 8,192 | 16,384 | not documented |
| `gemini-omni-flash-preview` | 1,048,576 (context window) | video 3–10 s @ 720p/24 fps | not documented |
| `gemini-2.5-computer-use-preview-10-2025` | 128,000 | 64,000 | not documented |
| `gemini-embedding-2` | 8,192 | embedding dims 128–3072 (rec. 768/1536/3072) | not documented |
| `gemini-embedding-001` | 2,048 | embedding dims 128–3072 | not documented |

Sources: individual model pages [G4]–[G26]. **Google does not publish a knowledge cutoff for any Gemini 3.x model** — only the 2.5 family pages carry a "Knowledge cutoff" field.

## 2.3 Pricing (paid tier, per 1M tokens)

### Text / multimodal-understanding models — Standard tier

| Model | Input | Output (incl. thinking) | Context cache (read) | Cache storage | Tiered? |
|---|---|---|---|---|---|
| `gemini-3.6-flash` | $1.50 | $7.50 | $0.15 | $1.00 /1M tokens/hour | no tier |
| `gemini-3.5-flash` | $1.50 | $9.00 | $0.15 | $1.00 /1M/hr | no tier |
| `gemini-3.5-flash-lite` | $0.30 (text/image/video/audio) | $2.50 | $0.03 | $1.00 /1M/hr | no tier |
| `gemini-3.1-flash-lite` | $0.25 (text/image/video); $0.50 (audio) | $1.50 | $0.025 / $0.05 (audio) | $1.00 /1M/hr | modality-tiered |
| `gemini-3.1-pro-preview` | **$2.00 ≤200k; $4.00 >200k** | **$12.00 ≤200k; $18.00 >200k** | $0.20 ≤200k; $0.40 >200k | $4.50 /1M/hr | **200k context tier** |
| `gemini-3-flash-preview` | $0.50 (text/image/video); $1.00 (audio) | $3.00 | $0.05 / $0.10 (audio) | $1.00 /1M/hr | modality-tiered |
| `gemini-2.5-pro` | **$1.25 ≤200k; $2.50 >200k** | **$10.00 ≤200k; $15.00 >200k** | $0.125 ≤200k; $0.25 >200k | $4.50 /1M/hr | **200k context tier** |
| `gemini-2.5-flash` | $0.30 (text/image/video); $1.00 (audio) | $2.50 | $0.03 / $0.10 (audio) | $1.00 /1M/hr | modality-tiered |
| `gemini-2.5-flash-lite` | $0.10 (text/image/video); $0.30 (audio) | $0.40 | $0.01 / $0.03 (audio) | $1.00 /1M/hr | modality-tiered |

Source: [G2].

### Batch / Flex / Priority tiers

Batch and Flex are identical for every model listed; Priority is a premium tier.

| Model | Batch & Flex input | Batch & Flex output | Priority input | Priority output |
|---|---|---|---|---|
| `gemini-3.6-flash` | $0.75 | $3.75 | $2.70 | $13.50 |
| `gemini-3.5-flash` | $0.75 | $4.50 | $2.70 | $16.20 |
| `gemini-3.5-flash-lite` | $0.15 | $1.25 | $0.54 | $4.50 |
| `gemini-3.1-flash-lite` | $0.125 (t/i/v); $0.25 (audio) | $0.75 | $0.45 / $0.90 (audio) | $2.70 |
| `gemini-3.1-pro-preview` | $1.00 ≤200k; $2.00 >200k | $6.00 ≤200k; $9.00 >200k | $3.60 ≤200k; $7.20 >200k | $21.60 ≤200k; $32.40 >200k |
| `gemini-3-flash-preview` | $0.25 (t/i/v); $0.50 (audio) | $1.50 | $0.90 / $1.80 (audio) | $5.40 |
| `gemini-2.5-pro` | $0.625 ≤200k; $1.25 >200k | $5.00 ≤200k; $7.50 >200k | $2.25 ≤200k; $4.50 >200k | $18.00 ≤200k; $27.00 >200k |
| `gemini-2.5-flash` | $0.15 (t/i/v); $0.50 (audio) | $1.25 | $0.54 / $1.80 (audio) | $4.50 |
| `gemini-2.5-flash-lite` | $0.05 (t/i/v); $0.15 (audio) | $0.20 | $0.18 / $0.54 (audio) | $0.72 |

Source: [G2]. For `gemini-3.1-pro-preview` and `gemini-3-flash-preview`, Batch/Flex **context caching is billed at the Standard rate** ("Same as Standard"). [G2]

### Image, audio, live and video model pricing (Standard tier)

| Model | Input | Output |
|---|---|---|
| `gemini-3.1-flash-image` (Nano Banana 2) | $0.50 (text/image) | $3.00 text & thinking; **$60.00 per 1M image tokens** → $0.045 @0.5K, $0.067 @1K, $0.101 @2K, $0.151 @4K per image |
| `gemini-3.1-flash-lite-image` (NB2 Lite) | $0.25 (text/image/video) | $1.50 text & thinking; **$30.00 per 1M image tokens** → $0.0336 per 1K image |
| `gemini-3-pro-image` (Nano Banana Pro) | $2.00 (text/image); image input = 560 tokens ≈ $0.0011/image | $12.00 text & thinking; **$120.00 per 1M image tokens** → $0.134 @1K–2K, $0.24 @4K |
| `gemini-2.5-flash-image` (Nano Banana) | $0.30 (text/image) | $0.039 per image (image output $30/1M tokens; ≤1024×1024 = 1290 tokens) |
| `gemini-3.1-flash-live-preview` | $0.75 text; $3.00 audio (≈$0.005/min); $1.00 image/video (≈$0.002/min) | $4.50 text; $12.00 audio (≈$0.018/min) |
| `gemini-3.5-live-translate-preview` | $3.50 audio (≈$0.0053/min) | $21.00 audio (≈$0.0315/min); ≈$0.0368/min effective at 25 tokens/s |
| `gemini-3.1-flash-tts-preview` | $1.00 text | $20.00 audio (batch $0.50 / $10.00) |
| `gemini-2.5-flash-native-audio-preview-12-2025` | $0.50 text; $3.00 audio/video | $2.00 text; $12.00 audio |
| `gemini-2.5-flash-preview-tts` | $0.50 text | $10.00 audio (batch $0.25 / $5.00) |
| `gemini-2.5-pro-preview-tts` | $1.00 text | $20.00 audio (batch $0.50 / $10.00) |
| `gemini-omni-flash-preview` | $1.50 (text/image/video/audio) | $9.00 text; **$17.50 video** — 5,792 tokens per second of 720p ≈ **$0.10/second** |

Source: [G2]. Batch pricing for the image models is 50% of Standard. [G2]

### Grounding / tool surcharges

| Tool | Gemini 3 family | Gemini 2.5 family |
|---|---|---|
| Grounding with Google Search | 5,000 prompts/month free (shared across Gemini 3), then **$14 / 1,000 search queries** | 1,500 RPD free, then **$35 / 1,000 grounded prompts** |
| Grounding with Google Maps | 5,000 prompts/month free (shared), then $14 / 1,000 queries | 1,500 RPD free (Flash/Flash-Lite), 10,000 RPD free (Pro), then **$25 / 1,000 grounded prompts** |

Source: [G2]. Note the pricing model differs between generations: Gemini 3 charges **per search query executed** (one prompt can trigger several), whereas Gemini 2.5 charges per grounded prompt.

## 2.4 Multimodal & feature matrix

| Model | Text in | Text out | Image in | Image out | Audio in | Audio out | Video in | PDF in | Live/realtime | Tools (function calling) | Structured output | Caching | Thinking | Batch |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.5-flash` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.5-flash-lite` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.1-flash-lite` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.1-pro-preview` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3-flash-preview` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-pro` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-flash` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ⚠️ not listed | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-flash-lite` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.1-flash-image` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `gemini-3.1-flash-lite-image` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ (minimal & high) | ✅ |
| `gemini-3-pro-image` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| `gemini-2.5-flash-image` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| `gemini-3.1-flash-live-preview` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `gemini-3.5-live-translate-preview` | ❌ | ✅ (transcript) | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gemini-3.1-flash-tts-preview` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `gemini-2.5-flash-native-audio-preview-12-2025` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `gemini-2.5-flash-preview-tts` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `gemini-2.5-pro-preview-tts` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `gemini-omni-flash-preview` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ (≤10 s for editing) | ❌ | ❌ | — | — | — | — | — |
| `gemini-2.5-computer-use-preview-10-2025` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | — | — | — | — |
| `gemini-embedding-2` | ✅ | embeddings | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | — | — | — | — | — |
| `gemini-embedding-001` | ✅ | embeddings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — | — | — | — | — |

Sources: individual model pages [G4]–[G26], "Supported data types" and "Capabilities" tables.

⚠️ `gemini-2.5-flash`'s page lists inputs as "Text, images, video, audio" — **PDF is not listed**, unlike `gemini-2.5-pro` and `gemini-2.5-flash-lite` which both explicitly list PDF. This may be a doc inconsistency rather than a real capability gap; treated as unverified.

### Additional Gemini capabilities (per model page "Capabilities" tables)

| Model | Code execution | Computer use | File search | Search grounding | Maps grounding | URL context | Flex | Priority |
|---|---|---|---|---|---|---|---|---|
| `gemini-3.6-flash` | ✅ | ✅ (Preview) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.5-flash` | ✅ | ✅ (Preview) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.5-flash-lite` | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.1-flash-lite` | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3.1-pro-preview` | ✅ | not listed | ✅ (AI Studio only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-3-flash-preview` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-pro` | ✅ | not listed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-flash` | ✅ | not listed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gemini-2.5-flash-lite` | ✅ | not listed | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

Source: [G4]–[G12].

### Recently deprecated / shut down (Google)

| Model | Release | Shutdown | Replacement |
|---|---|---|---|
| `gemini-2.0-flash`, `gemini-2.0-flash-001` | 2025-02-05 | **2026-06-01 (shut down)** | `gemini-3.6-flash` |
| `gemini-2.0-flash-lite` | 2025-02-25 | **2026-06-01 (shut down)** | `gemini-3.1-flash-lite` |
| `gemini-3-pro-preview` | 2025-11-18 | 2026-03-09 | `gemini-3.1-pro-preview` |
| `gemini-3.1-flash-lite-preview` | 2026-03-03 | 2026-05-25 | `gemini-3.1-flash-lite` |
| `gemini-3.1-flash-image-preview` | 2026-02-26 | 2026-06-25 | `gemini-3.1-flash-image` |
| `gemini-3-pro-image-preview` | 2025-11-20 | 2026-06-25 | `gemini-3-pro-image` |
| `gemini-2.5-flash-lite-preview-09-2025` | 2025-09-25 | 2026-03-31 | `gemini-3.1-flash-lite` |
| `gemini-2.5-flash-preview-09-25` | 2025-09-25 | 2026-02-17 | `gemini-3.6-flash` |
| `gemini-2.5-flash-image-preview` | 2025-05-07 | 2026-01-15 | `gemini-2.5-flash-image` |
| Imagen 4 | — | deprecated | — |

Source: [G3]. Note the shutdown dates listed are the **earliest possible** retirement dates. [G3]

---

# 3. OpenAI — Platform API

## 3.1 Model IDs, aliases & snapshots

GPT-5.6 introduced a new naming scheme: the `gpt-5.6` alias routes to `gpt-5.6-sol` (flagship); `gpt-5.6-terra` is the mid tier and `gpt-5.6-luna` the high-volume tier. [O5]

| Model | API model ID | Aliases / snapshots | Status |
|---|---|---|---|
| GPT-5.6 Sol | `gpt-5.6-sol` | `gpt-5.6` (alias) | Active — flagship |
| GPT-5.6 Terra | `gpt-5.6-terra` | — | Active |
| GPT-5.6 Luna | `gpt-5.6-luna` | — | Active |
| GPT-5.5 | `gpt-5.5` | `gpt-5.5-2026-04-23` | Active |
| GPT-5.5 Pro | `gpt-5.5-pro` | `gpt-5.5-pro-2026-04-23` | Active |
| GPT-5.4 | `gpt-5.4` | `gpt-5.4-2026-03-05` | Active |
| GPT-5.4 mini | `gpt-5.4-mini` | `gpt-5.4-mini-2026-03-17` | Active |
| GPT-5.4 nano | `gpt-5.4-nano` | `gpt-5.4-nano-2026-03-17` | Active |
| GPT-5.4 Pro | `gpt-5.4-pro` | `gpt-5.4-pro-2026-03-05` | Active |
| GPT-5.3 Codex | `gpt-5.3-codex` | — | Active |
| ChatGPT model | `chat-latest` | — | Active |
| GPT-5.3 chat | `gpt-5.3-chat-latest` | — | **Deprecated — shutdown 2026-08-10** |
| GPT-5.4 Cyber | `gpt-5.4-cyber` | — | Listed, pricing not published |
| Realtime 2.1 | `gpt-realtime-2.1` | — | Active |
| Realtime 2.1 mini | `gpt-realtime-2.1-mini` | — | Active |
| Realtime translate | `gpt-realtime-translate` | — | Active |
| Realtime transcribe | `gpt-realtime-whisper` | — | Active |
| GPT Audio 1.5 | `gpt-audio-1.5` | — | Active |
| GPT Image 2 | `gpt-image-2` | `gpt-image-2-2026-04-21` | Active |
| GPT Image 1.5 | `gpt-image-1.5` | `gpt-image-1.5-2025-12-16` | **Deprecated — shutdown 2026-12-01** |
| GPT Image 1 mini | `gpt-image-1-mini` | — | **Deprecated — shutdown 2026-12-01** |
| Sora 2 | `sora-2` | `sora-2-2025-12-08`, `sora-2-2025-10-06` | **Deprecated — shutdown 2026-09-24** |
| Sora 2 Pro | `sora-2-pro` | `sora-2-pro-2025-10-06` | **Deprecated — shutdown 2026-09-24** |
| Transcribe | `gpt-4o-transcribe` | — | Active |
| Transcribe mini | `gpt-4o-mini-transcribe` | `gpt-4o-mini-transcribe-2025-12-15`, `-2025-03-20` | Active (the `-2025-03-20` snapshot retires 2027-01-20) |
| TTS mini | `gpt-4o-mini-tts` | `gpt-4o-mini-tts-2025-12-15`, `-2025-03-20` | Active (`-2025-03-20` retires 2026-07-23) |
| o3 deep research | `o3-deep-research` | `o3-deep-research-2025-06-26` | **Deprecated — shutdown 2026-07-23** |
| o4-mini deep research | `o4-mini-deep-research` | `o4-mini-deep-research-2025-06-26` | **Deprecated — shutdown 2026-07-23** |
| Computer use | `computer-use-preview` | `computer-use-preview-2025-03-11` | **Deprecated — shutdown 2026-07-23** |
| gpt-oss 120b | `gpt-oss-120b` | — | Active (open weights) |
| gpt-oss 20b | `gpt-oss-20b` | — | Active (open weights) |
| Embeddings | `text-embedding-3-large`, `text-embedding-3-small` | — | Active |
| Moderation | `omni-moderation-latest` | `omni-moderation`, `omni-moderation-2024-09-26` | Active |

Sources: [O2], [O4], [O7].

## 3.2 Context window & output limits

| Model | Context window (max input) | Max output tokens | Knowledge cutoff | Reasoning |
|---|---|---|---|---|
| `gpt-5.6-sol` | 1,050,000 | 128,000 | 2026-02-16 | ✅ |
| `gpt-5.6-terra` | 1,050,000 | 128,000 | 2026-02-16 | ✅ |
| `gpt-5.6-luna` | 1,050,000 | 128,000 | 2026-02-16 | ✅ |
| `gpt-5.5` | 1,050,000 | 128,000 | 2025-12-01 | ✅ |
| `gpt-5.5-pro` | 1,050,000 | 128,000 | 2025-12-01 | ✅ |
| `gpt-5.4` | 1,050,000 | 128,000 | 2025-08-31 | ✅ |
| `gpt-5.4-mini` | 400,000 | 128,000 | 2025-08-31 | ✅ |
| `gpt-5.4-nano` | 400,000 | 128,000 | 2025-08-31 | ✅ |
| `gpt-5.4-pro` | 1,050,000 | 128,000 | 2025-08-31 | ✅ |
| `gpt-5.3-codex` | 400,000 | 128,000 | 2025-08-31 | ✅ |
| `chat-latest` | 400,000 | 128,000 | 2025-08-31 | ✅ |
| `gpt-5.3-chat-latest` | 128,000 | 16,384 | 2025-08-31 | ✅ |
| `gpt-realtime-2.1` | 128,000 | 32,000 | 2024-09-30 | ❌ |
| `gpt-realtime-2.1-mini` | 128,000 | 32,000 | 2024-09-30 | ❌ |
| `gpt-realtime-translate` | 16,000 | 2,000 | 2024-09-30 | ❌ |
| `gpt-realtime-whisper` | 16,000 | 2,000 | 2024-09-30 | ❌ |
| `gpt-audio-1.5` | 128,000 | 16,384 | 2024-09-30 | ❌ |
| `o3-deep-research` | 200,000 | 100,000 | 2024-06-01 | ✅ |
| `o4-mini-deep-research` | 200,000 | 100,000 | 2024-06-01 | ✅ |
| `computer-use-preview` | 8,192 | 1,024 | 2023-10-01 | ❌ |
| `gpt-oss-120b` | 131,072 | 131,072 | 2024-06-01 | ✅ |
| `gpt-oss-20b` | 131,072 | 131,072 | 2024-06-01 | ✅ |
| `gpt-4o-transcribe` | 16,000 | 2,000 | 2024-06-01 | ❌ |
| `gpt-4o-mini-transcribe` | 16,000 | 2,000 | 2024-06-01 | ❌ |
| `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini`, `sora-2`, `sora-2-pro`, `gpt-4o-mini-tts`, `text-embedding-3-*` | not published as a token context window | — | — | ❌ |

Source: [O7] (per-model pages).

## 3.3 Pricing

### Flagship text models — Standard tier (per 1M tokens)

OpenAI splits every price into **short context** and **long context**. The boundary is documented on the model pages: "Prompts with **>272K input tokens** are priced at 2× input and 1.5× output for the full request." [O7]

| Model | Input | Cached input | Cache writes | Output | Long-ctx input | Long-ctx cached | Long-ctx cache write | Long-ctx output |
|---|---|---|---|---|---|---|---|---|
| `gpt-5.6-sol` | $5.00 | $0.50 | $6.25 | $30.00 | $10.00 | $1.00 | $12.50 | $45.00 |
| `gpt-5.6-terra` | $2.50 | $0.25 | $3.125 | $15.00 | $5.00 | $0.50 | $6.25 | $22.50 |
| `gpt-5.6-luna` | $1.00 | $0.10 | $1.25 | $6.00 | $2.00 | $0.20 | $2.50 | $9.00 |
| `gpt-5.5` | $5.00 | $0.50 | — | $30.00 | $10.00 | $1.00 | — | $45.00 |
| `gpt-5.5-pro` | $30.00 | — | — | $180.00 | $60.00 | — | — | $270.00 |
| `gpt-5.4` | $2.50 | $0.25 | — | $15.00 | $5.00 | $0.50 | — | $22.50 |
| `gpt-5.4-mini` | $0.75 | $0.075 | — | $4.50 | n/a | n/a | n/a | n/a |
| `gpt-5.4-nano` | $0.20 | $0.02 | — | $1.25 | n/a | n/a | n/a | n/a |
| `gpt-5.4-pro` | $30.00 | — | — | $180.00 | $60.00 | — | — | $270.00 |

Source: [O3].

**Explicit cache writes are new in GPT-5.6.** Only the GPT-5.6 family has a `Cache writes` column, billed at **1.25× the uncached input rate**; GPT-5.5 and earlier show "—" (implicit caching only, no write charge). [O3], [O5], [O7]

### Batch and Flex tiers (identical pricing)

| Model | Input | Cached input | Cache writes | Output | Long-ctx input | Long-ctx cached | Long-ctx cache write | Long-ctx output |
|---|---|---|---|---|---|---|---|---|
| `gpt-5.6-sol` | $2.50 | $0.25 | $3.125 | $15.00 | $5.00 | $0.50 | $6.25 | $22.50 |
| `gpt-5.6-terra` | $1.25 | $0.125 | $1.5625 | $7.50 | $2.50 | $0.25 | $3.125 | $11.25 |
| `gpt-5.6-luna` | $0.50 | $0.05 | $0.625 | $3.00 | $1.00 | $0.10 | $1.25 | $4.50 |
| `gpt-5.5` | $2.50 | $0.25 | — | $15.00 | $5.00 | $0.50 | — | $22.50 |
| `gpt-5.5-pro` | $15.00 | — | — | $90.00 | — | — | — | — |
| `gpt-5.4` | $1.25 | $0.13 | — | $7.50 | $2.50 | $0.25 | — | $11.25 |
| `gpt-5.4-mini` | $0.375 | $0.0375 | — | $2.25 | n/a | n/a | n/a | n/a |
| `gpt-5.4-nano` | $0.10 | $0.01 | — | $0.625 | n/a | n/a | n/a | n/a |
| `gpt-5.4-pro` | $15.00 | — | — | $90.00 | $30.00 | — | — | $135.00 |

Batch/Flex is a flat **50% discount** vs Standard. Source: [O3].

### Priority tier (short context only)

| Model | Input | Cached input | Cache writes | Output |
|---|---|---|---|---|
| `gpt-5.6-sol` | $10.00 | $1.00 | $12.50 | $60.00 |
| `gpt-5.6-terra` | $5.00 | $0.50 | $6.25 | $30.00 |
| `gpt-5.6-luna` | $2.00 | $0.20 | $2.50 | $12.00 |
| `gpt-5.5` | $12.50 | $1.25 | — | $75.00 |
| `gpt-5.4` | $5.00 | $0.50 | — | $30.00 |
| `gpt-5.4-mini` | $1.50 | $0.15 | — | $9.00 |

Source: [O3].

### Specialized, multimodal & media models

| Model | Modality | Input | Cached input | Output / cost |
|---|---|---|---|---|
| `chat-latest` | text | $5.00 | $0.50 | $30.00 |
| `gpt-5.3-codex` | text | $1.75 | $0.175 | $14.00 (Priority: $3.50 / $0.35 / $28.00) |
| `gpt-5.3-chat-latest` | text | $1.75 | $0.175 | $14.00 |
| `gpt-5.4-cyber` | text | not published | not published | not published |
| `gpt-realtime-2.1` | audio | $32.00 | $0.40 | $64.00 |
| `gpt-realtime-2.1` | text | $4.00 | $0.40 | $24.00 |
| `gpt-realtime-2.1` | image | $5.00 | $0.50 | — |
| `gpt-realtime-2.1-mini` | audio | $10.00 | $0.30 | $20.00 |
| `gpt-realtime-2.1-mini` | text | $0.60 | $0.06 | $2.40 |
| `gpt-realtime-2.1-mini` | image | $0.80 | $0.08 | — |
| `gpt-realtime-translate` | audio | — | — | **$0.034 / minute** |
| `gpt-realtime-whisper` | audio | — | — | **$0.017 / minute** |
| `gpt-audio-1.5` | text | $2.50 | — | $10.00 |
| `gpt-image-2` | image | $8.00 | $2.00 | $30.00 |
| `gpt-image-2` | text | $5.00 | $1.25 | — |
| `gpt-image-1.5` | image | $8.00 | $2.00 | $32.00 |
| `gpt-image-1.5` | text | $5.00 | $1.25 | $10.00 |
| `gpt-image-1-mini` | image | $2.50 | $0.25 | $8.00 |
| `gpt-image-1-mini` | text | $2.00 | $0.20 | — |
| `sora-2` | video | — | — | **$0.10 / second** (720p) |
| `sora-2-pro` | video | — | — | **$0.30/s** (720p), **$0.50/s** (1024p), **$0.70/s** (1080p) |
| `gpt-4o-transcribe` | audio→text | $2.50 | — | $10.00 (≈$0.006/min) |
| `gpt-4o-mini-transcribe` | audio→text | $1.25 | — | $5.00 (≈$0.003/min) |
| `o3-deep-research` | text | $10.00 | $2.50 | $40.00 (Batch: $5.00 / $20.00) |
| `o4-mini-deep-research` | text | $2.00 | $0.50 | $8.00 (Batch: $1.00 / $4.00) |
| `computer-use-preview` | text+image | $3.00 | — | $12.00 (Batch: $1.50 / $6.00) |

Sources: [O3], [O7]. Image-generation batch pricing is 50% of standard; Sora batch is 50% of standard. [O3]

### Tool surcharges

| Tool | Pricing |
|---|---|
| Web search (all models) | $10.00 / 1k calls + search content tokens at model rates |
| Web search preview (reasoning models) | $10.00 / 1k calls + content tokens at model rates |
| Web search preview (non-reasoning models) | $25.00 / 1k calls, content tokens free |
| File search — storage | $0.10 / GB per day (1 GB free) |
| File search — tool call | $2.50 / 1k calls (Responses API only) |
| Containers (Hosted Shell / Code Interpreter) | 1 GB $0.03, 4 GB $0.12, 16 GB $0.48, 64 GB $1.92 per 20-min session per container (billed per minute, 5-min minimum) |
| AgentKit / ChatKit upload storage | $0.10 / GB-day after 1 GB free per account per month |

Source: [O3].

**Regional processing (data residency) endpoints carry a 10% uplift** for models released on or after 2026-03-05 that are eligible for data residency. [O3]

## 3.4 Multimodal & feature matrix

| Model | Text in | Text out | Image in | Image out | Audio in | Audio out | Video in | Video out | PDF in | Realtime voice | Tools | Structured output | Prompt caching | Reasoning | Streaming |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `gpt-5.6-sol` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (explicit + implicit) | ✅ | ✅ |
| `gpt-5.6-terra` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (explicit + implicit) | ✅ | ✅ |
| `gpt-5.6-luna` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (explicit + implicit) | ✅ | ✅ |
| `gpt-5.5` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (implicit) | ✅ | ✅ |
| `gpt-5.5-pro` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ (no cached-input price) | ✅ | ❌ |
| `gpt-5.4` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (implicit) | ✅ | ✅ |
| `gpt-5.4-mini` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (implicit) | ✅ | ✅ |
| `gpt-5.4-nano` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ (implicit) | ✅ | ✅ |
| `gpt-5.4-pro` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `gpt-5.3-codex` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `chat-latest` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gpt-5.3-chat-latest` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `gpt-realtime-2.1` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `gpt-realtime-2.1-mini` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `gpt-realtime-translate` | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `gpt-realtime-whisper` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `gpt-audio-1.5` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `gpt-image-2` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `gpt-image-1.5` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `gpt-image-1-mini` | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `sora-2` / `sora-2-pro` | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gpt-4o-transcribe` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (realtime endpoint) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gpt-4o-mini-transcribe` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ (realtime endpoint) | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gpt-4o-mini-tts` | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `o3-deep-research` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `o4-mini-deep-research` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| `computer-use-preview` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `gpt-oss-120b` / `gpt-oss-20b` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| `omni-moderation-latest` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `text-embedding-3-large/small` | ✅ | embeddings | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Sources: [O7] per-model "Modalities" / "Features" / "Endpoints" panels; [O3] for cached-input availability; [O6] for PDF.

**PDF handling:** OpenAI does not model PDF as a separate modality. PDFs are passed as `input_file` items; "On models with vision capabilities, such as `gpt-4o` and later models, the API extracts both text and page images and sends both to the model." A `detail` field (`auto`/`low`/`high`) controls page-image processing; for **GPT-5.6 and later, `auto` = `high`**, for earlier models `auto` = `low`. Non-PDF documents get text-only extraction; spreadsheets go through a separate augmentation flow (first 1,000 rows per sheet). [O6] The PDF-in column above is therefore derived from "Image: input supported" plus [O6], not from an explicit per-model PDF flag.

### Hosted tool support (Responses API) — flagship models

`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna` and `gpt-5.4` all report **Supported** for: Web search, File search, Image generation, Code interpreter, Hosted shell, Apply patch, Skills, Computer use, MCP, Tool search. [O7]

### GPT-5.6 feature additions

Documented in the GPT-5.6 guide [O5]:

- `reasoning.effort` accepts `none`, `low`, `medium`, `high`, `xhigh`, **`max`** (new). Default is `medium`.
- **Pro mode** via `reasoning.mode: "pro"` — no separate `-pro` model slug needed for GPT-5.6.
- **Persisted reasoning** via `reasoning.context` (`auto` / `all_turns` / `current_turn`).
- **Explicit prompt caching** via `prompt_cache_options.mode: "explicit"` and `prompt_cache_options.ttl` (replaces `prompt_cache_retention`). Cache writes billed at 1.25× uncached input.
- **Programmatic Tool Calling** (`programmatic_tool_calling` tool with `allowed_callers`) — ZDR-compatible, no container cost.
- **Multi-agent (beta)** in the Responses API.
- Images sent with `original` or `auto` detail keep original dimensions (can raise input token counts).

### Recently deprecated / retired (OpenAI)

| Shutdown date | Model(s) | Replacement |
|---|---|---|
| **2026-07-23** | `computer-use-preview` (+ `-2025-03-11`), `o3-deep-research` (+ snapshot), `o4-mini-deep-research` (+ snapshot), `gpt-5-chat-latest`, `gpt-5-codex`, `gpt-5.1-chat-latest`, `gpt-5.1-codex`, `gpt-5.1-codex-max`, `gpt-5.1-codex-mini`, `gpt-5.2-codex`, `gpt-4o-search-preview-2025-03-11`, `gpt-4o-mini-search-preview-2025-03-11`, `gpt-4o-mini-tts-2025-03-20`, `gpt-realtime-mini-2025-10-06` | `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4-mini` (varies) |
| 2026-08-10 | `gpt-5.2-chat-latest`, `gpt-5.3-chat-latest` | `gpt-5.5` |
| 2026-09-24 | Videos API, `sora-2`, `sora-2-pro` and all their snapshots | — (no replacement) |
| 2026-10-23 | `gpt-3.5-turbo-0125`, `gpt-4-0613`, `gpt-4-1106-preview`, `gpt-4-turbo`, `gpt-4.1-nano`, `gpt-4o-2024-05-13`, `gpt-image-1`, `o1-2024-12-17` | `gpt-5.5` / `gpt-5.4-mini` / `gpt-5.4-nano` / `gpt-image-2` |
| 2026-12-01 | `gpt-image-1-mini`, `gpt-image-1.5`, `chatgpt-image-latest` | `gpt-image-2` |
| 2026-12-11 | `gpt-5-2025-08-07`, `gpt-5-mini-2025-08-07`, `gpt-5-nano-2025-08-07`, `gpt-5-pro-2025-10-06`, `o3-2025-04-16`, `o3-pro-2025-06-10` | `gpt-5.5`, `gpt-5.4-mini`, `gpt-5.4-nano`, `gpt-5.5-pro` |
| 2027-01-20 | `gpt-realtime`, `gpt-audio`, `gpt-4o-audio`, `gpt-4o-realtime`, `gpt-realtime-mini`, `gpt-audio-mini`, `gpt-4o-mini-realtime`, `gpt-4o-mini-audio`, `gpt-4o-mini-transcribe-2025-03-20` | `gpt-realtime-2.1`, `gpt-audio-1.5`, `gpt-realtime-2.1-mini` |

Source: [O4].

**OpenAI is winding down its self-serve fine-tuning platform** — no longer accessible to new users; existing users can create training jobs "for the coming months"; fine-tuned models remain available until their base models are deprecated. The only fine-tuning prices still listed are for `o4-mini-2025-04-16` ($100/hour training). [O3]

---

## Cross-provider quick comparison (flagship tiers)

| | Anthropic | Google | OpenAI |
|---|---|---|---|
| Flagship ID | `claude-fable-5` | `gemini-3.1-pro-preview` | `gpt-5.6-sol` (alias `gpt-5.6`) |
| Best price/perf ID | `claude-sonnet-5` | `gemini-3.6-flash` | `gpt-5.6-terra` |
| Cheapest ID | `claude-haiku-4-5-20251001` | `gemini-2.5-flash-lite` | `gpt-5.4-nano` |
| Max context | 1,000,000 | 1,048,576 | 1,050,000 |
| Max output | 128,000 (300k on Batch w/ beta) | 65,536 | 128,000 |
| Long-context surcharge | **None** | 2× input / 1.5× output above 200k (Pro models only) | 2× input / 1.5× output above 272k |
| Cache read discount | 0.1× input | ~0.1× input + storage/hour | 0.1× input |
| Cache write charge | 1.25× (5m) / 2× (1h) | none (storage billed hourly) | 1.25× (GPT-5.6+ only) |
| Batch discount | 50% | 50% | 50% |
| Image generation | ❌ | ✅ (Nano Banana family) | ✅ (`gpt-image-2`) |
| Audio in/out | ❌ | ✅ | ✅ |
| Video in | ❌ | ✅ | ❌ |
| Realtime voice API | ❌ | ✅ (Live API) | ✅ (Realtime API) |

---

## Gaps & uncertainties

Things that could **not** be verified from a first-party page, and are recorded as `null` / "not documented" above:

1. **Gemini 3.x knowledge cutoffs.** No Gemini 3 model page (`gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-flash-lite`, `gemini-3.1-pro-preview`, `gemini-3-flash-preview`, and all the 3.x image/live/TTS models) publishes a "Knowledge cutoff" field — only the 2.5-family pages do. All Gemini 3.x cutoffs are `null`.
2. **Gemini release dates for several preview models.** The deprecations page [G3] only lists release dates for a subset. For `gemini-3.1-flash-lite-image`, `gemini-3.1-flash-live-preview`, `gemini-3.5-live-translate-preview`, `gemini-3.1-flash-tts-preview` and `gemini-omni-flash-preview` I have only the model page's "Latest update" month, which is not necessarily the release date.
3. **`gemini-2.5-flash` PDF input.** Its page lists inputs as "Text, images, video, audio" with no PDF, while `gemini-2.5-pro` and `gemini-2.5-flash-lite` explicitly list PDF. Marked ⚠️ / unverified rather than assumed.
4. **Claude Mythos 5 / Mythos Preview.** Invitation-only under Project Glasswing. Docs say Mythos 5 "shares Claude Fable 5's specs and pricing" [A1] but publish no independent context/output table. Mythos Preview's retirement date (2026-07-21) has already passed relative to this research date; current status unconfirmed.
5. **Claude Fable 5 / Mythos 5 max context tooltip.** The overview tooltip for Fable 5 says 1M tokens; the exact `max_input_tokens` returned by the Models API was not queried (that requires an authenticated call to `/v1/models`).
6. **`gpt-5.4-cyber`.** Listed in OpenAI's specialized-models pricing table with "–" for input, cached input and output. No price published; no model detail page found.
7. **OpenAI PDF support is inferred, not per-model-flagged.** OpenAI's model pages expose only Text/Image/Audio/Video modality flags. PDF support is documented generically in the file-inputs guide as applying to "models with vision capabilities, such as `gpt-4o` and later models" [O6]. The `pdfIn` values for OpenAI models are derived from image-input capability + that statement.
8. **OpenAI context windows for media models.** `gpt-image-2`, `gpt-image-1.5`, `gpt-image-1-mini`, `sora-2`, `sora-2-pro`, `gpt-4o-mini-tts` and the embedding models publish no token context window on their model pages; recorded as `null`.
9. **`openai.com/api/pricing` was unreachable** (HTTP 403 to automated requests). All OpenAI pricing comes from the equivalent first-party docs page `developers.openai.com/api/docs/pricing` [O3], which is the same data OpenAI links to as "the pricing page" from each model page.
10. **`gpt-realtime-2.1` structured outputs.** The model page reports "Structured outputs: Not supported", but the Realtime API's own guides were not cross-checked; there may be a JSON-schema mechanism specific to Realtime sessions.
11. **`gpt-oss-120b` / `gpt-oss-20b` pricing.** These open-weight models appear in the model catalog but carry no price on OpenAI's pricing page (they're intended for self-hosting). Recorded as `null`.
12. **Anthropic per-model streaming flag.** Anthropic documents streaming as a platform feature [A4] rather than a per-model capability; `streaming: true` is asserted for all Claude models on that basis.
13. **Gemini "latest" aliases.** [G1] documents the `gemini-flash-latest` naming pattern, but no first-party page enumerates which concrete model each `-latest` alias currently resolves to, so aliases are omitted from the per-model records.
