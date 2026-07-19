/**
 * Custom provider adapter — OpenAI-compatible Chat Completions over raw
 * XMLHttpRequest. Covers llama.cpp (llama-server), Ollama, vLLM, OpenRouter,
 * Gemini OpenAI-compat, and any other /v1-style backend.
 *
 * Why raw XHR: on React Native New Architecture, fetch/expo-fetch fail on
 * plain-HTTP LAN servers (ATS) and cannot deliver incremental SSE chunks
 * reliably. XHR uses the classic networking bridge, honours
 * NSAllowsArbitraryLoads, and exposes responseText incrementally via
 * onprogress — everything SSE needs. No OpenAI SDK.
 *
 * Thinking effort is mapped per backend via config.reasoningMode, whose
 * default comes from the provider preset (see constants/provider-presets.ts):
 * - 'chat-template-kwargs' — llama.cpp / vLLM / Ollama:
 *     chat_template_kwargs: { enable_thinking, reasoning_effort }
 *     (Qwen templates read enable_thinking, gpt-oss templates read
 *     reasoning_effort; each ignores the key it doesn't know)
 * - 'openai-reasoning-effort' — OpenRouter / Gemini / cloud proxies:
 *     reasoning_effort: "low" | "medium" | "high"
 * - 'auto' — send both mechanisms; servers ignore unknown fields
 * - 'none' — send nothing
 */

import type {
  CompletionRequest,
  CompletionResponse,
  IProvider,
  ProviderConfig,
  ProviderType,
  StreamChunk,
  TokenUsage,
} from '../types';
import { ProviderError } from '../errors';
import { mapThinkingLevelCustom } from '../../domain/thinking-mapper';

/** Sentinel stored when a backend needs no API key (see ProviderDetailScreen). */
const NO_KEY_SENTINEL = 'sk-no-key-required';

function authHeader(apiKey: string): Record<string, string> {
  return apiKey && apiKey !== NO_KEY_SENTINEL
    ? { Authorization: `Bearer ${apiKey}` }
    : {};
}

function joinUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

interface JsonResult {
  status: number;
  json: Record<string, unknown> | null;
  retryAfter: number | null;
}

/** Plain JSON request over XHR. Rejects with ProviderError on network failure. */
function requestJson(
  method: 'GET' | 'POST',
  url: string,
  apiKey: string,
  body?: unknown,
  timeoutMs = 120000,
): Promise<JsonResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    if (body !== undefined) xhr.setRequestHeader('Content-Type', 'application/json');
    for (const [k, v] of Object.entries(authHeader(apiKey))) xhr.setRequestHeader(k, v);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        // Non-JSON body — caller decides based on status
      }
      const ra = parseInt(xhr.getResponseHeader('retry-after') ?? '', 10);
      resolve({ status: xhr.status, json, retryAfter: Number.isNaN(ra) ? null : ra });
    };
    xhr.onerror = () => {
      console.log('[CustomProvider] XHR network error:', method, url);
      reject(new ProviderError('Network request failed', 'network'));
    };
    xhr.ontimeout = () => {
      console.log('[CustomProvider] XHR timeout:', method, url);
      reject(new ProviderError('Request timed out', 'network'));
    };
    xhr.send(body !== undefined ? JSON.stringify(body) : null);
  });
}

function errorFromStatus(
  status: number,
  json: Record<string, unknown> | null,
  retryAfter: number | null,
): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError('Authentication failed', 'authentication');
  }
  if (status === 429) {
    return new ProviderError('Rate limited', 'rate_limit', retryAfter);
  }
  // llama.cpp / OpenAI error shape: { error: { message } } or { error: "..." }
  const err = json?.error;
  const message =
    (typeof err === 'object' && err !== null && typeof (err as Record<string, unknown>).message === 'string'
      ? ((err as Record<string, unknown>).message as string)
      : undefined) ??
    (typeof err === 'string' ? err : undefined) ??
    `HTTP ${status}`;
  return new ProviderError(message, 'server');
}

/**
 * POST an SSE request and yield each `data:` JSON payload.
 *
 * Line-based parsing: OpenAI-compatible servers emit single-line
 * `data: {...}` events terminated by `data: [DONE]`. Non-data lines
 * (keep-alive comments, blank separators) are skipped.
 */
function streamSSE(
  url: string,
  apiKey: string,
  body: unknown,
  signal: AbortSignal,
): AsyncIterable<Record<string, unknown>> {
  const events: Record<string, unknown>[] = [];
  let finished = false;
  let failure: ProviderError | null = null;
  let notify: (() => void) | null = null;

  const wake = () => {
    const n = notify;
    notify = null;
    n?.();
  };
  const finish = (err?: ProviderError) => {
    if (finished) return;
    finished = true;
    if (err) failure = err;
    wake();
  };

  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.responseType = 'text';
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Accept', 'text/event-stream');
  for (const [k, v] of Object.entries(authHeader(apiKey))) xhr.setRequestHeader(k, v);

  let seen = 0;
  let buf = '';
  const pump = () => {
    if (finished || xhr.status >= 400) return; // error body handled in onload
    const text = xhr.responseText;
    if (text.length > seen) {
      buf += text.slice(seen);
      seen = text.length;
    }
    let nl: number;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') {
        finish();
        return;
      }
      try {
        events.push(JSON.parse(payload) as Record<string, unknown>);
      } catch {
        // Partial or non-JSON payload — skip
      }
    }
    wake();
  };

  xhr.onprogress = pump;
  xhr.onload = () => {
    if (xhr.status >= 400) {
      let json: Record<string, unknown> | null = null;
      try {
        json = JSON.parse(xhr.responseText) as Record<string, unknown>;
      } catch {
        // Non-JSON error body
      }
      const ra = parseInt(xhr.getResponseHeader('retry-after') ?? '', 10);
      finish(errorFromStatus(xhr.status, json, Number.isNaN(ra) ? null : ra));
      return;
    }
    pump();
    finish();
  };
  xhr.onerror = () => finish(new ProviderError('Network request failed', 'network'));
  xhr.ontimeout = () => finish(new ProviderError('Request timed out', 'network'));

  const onAbort = () => {
    xhr.abort();
    finish();
  };
  if (signal.aborted) {
    finish();
  } else {
    signal.addEventListener('abort', onAbort);
    xhr.send(JSON.stringify(body));
  }

  return {
    async *[Symbol.asyncIterator]() {
      while (true) {
        while (events.length > 0) yield events.shift()!;
        if (failure) throw failure;
        if (finished) return;
        await new Promise<void>((resolve) => {
          notify = resolve;
        });
      }
    },
  };
}

function parseUsage(u: Record<string, unknown>): TokenUsage {
  const details = u.prompt_tokens_details as Record<string, unknown> | undefined;
  return {
    promptTokens: (u.prompt_tokens as number) ?? 0,
    completionTokens: (u.completion_tokens as number) ?? 0,
    totalTokens: (u.total_tokens as number) ?? 0,
    cachedTokens: details?.cached_tokens as number | undefined,
  };
}

/** Reasoning text lives in different delta/message keys across backends. */
function reasoningText(obj: Record<string, unknown>): string | undefined {
  const value = obj.reasoning_content ?? obj.reasoning ?? obj.thinking;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function buildBody(
  config: ProviderConfig,
  request: CompletionRequest,
  stream: boolean,
): Record<string, unknown> {
  const messages = request.messages.map((msg) => ({
    role: msg.role,
    content:
      typeof msg.content === 'string'
        ? msg.content
        : msg.content.map((part) =>
            part.type === 'text'
              ? { type: 'text' as const, text: part.text }
              : { type: 'image_url' as const, image_url: { url: part.image_url.url } },
          ),
  }));

  const body: Record<string, unknown> = { model: request.model, messages, stream };
  if (stream) body.stream_options = { include_usage: true };
  if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;

  const thinking = mapThinkingLevelCustom(
    request.thinkingLevel,
    config.reasoningMode ?? 'auto',
    config.thinkingKwargs,
  );
  if (thinking.reasoning_effort) body.reasoning_effort = thinking.reasoning_effort;
  if (thinking.chat_template_kwargs) body.chat_template_kwargs = thinking.chat_template_kwargs;

  return body;
}

/**
 * Custom provider adapter for OpenAI-compatible endpoints.
 * Stateless — all per-request state lives in the transport functions.
 */
export class CustomProvider implements IProvider {
  readonly type: ProviderType = 'custom';

  async complete(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
  ): Promise<CompletionResponse> {
    const url = joinUrl(config.baseUrl, '/chat/completions');
    const { status, json, retryAfter } = await requestJson(
      'POST',
      url,
      apiKey,
      buildBody(config, request, false),
      300000,
    );
    if (status < 200 || status >= 300 || !json) {
      throw errorFromStatus(status, json, retryAfter);
    }

    const choice = (json.choices as Array<Record<string, unknown>> | undefined)?.[0];
    const message = (choice?.message as Record<string, unknown> | undefined) ?? {};
    return {
      content: (message.content as string) ?? '',
      thinkingContent: reasoningText(message),
      usage: parseUsage((json.usage as Record<string, unknown>) ?? {}),
      finishReason: (choice?.finish_reason as string) ?? 'stop',
    };
  }

  async *streamCompletion(
    config: ProviderConfig,
    request: CompletionRequest,
    apiKey: string,
    signal: AbortSignal,
  ): AsyncIterable<StreamChunk> {
    const url = joinUrl(config.baseUrl, '/chat/completions');
    try {
      let usage: TokenUsage | undefined;
      const sse = streamSSE(url, apiKey, buildBody(config, request, true), signal);
      for await (const chunk of sse) {
        const choice = (chunk.choices as Array<Record<string, unknown>> | undefined)?.[0];
        const delta = choice?.delta as Record<string, unknown> | undefined;
        if (delta) {
          const thinking = reasoningText(delta);
          if (thinking) yield { type: 'thinking', content: thinking };
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            yield { type: 'text', content: delta.content };
          }
        }
        if (chunk.usage) usage = parseUsage(chunk.usage as Record<string, unknown>);
      }
      yield { type: 'done', content: '', ...(usage ? { usage } : {}) };
    } catch (error) {
      if (signal.aborted) {
        yield { type: 'done', content: '' };
        return;
      }
      const err =
        error instanceof ProviderError
          ? error
          : new ProviderError(error instanceof Error ? error.message : 'Unknown error', 'network');
      yield { type: 'error', content: `${err.category}: ${err.message}` };
      yield { type: 'done', content: '' };
    }
  }

  /**
   * List models from GET {baseUrl}/models.
   * Parses OpenAI `data[]` first, then Ollama `models[]`. Returns [] on failure.
   */
  async listModels(config: ProviderConfig, apiKey: string): Promise<string[]> {
    try {
      const { status, json } = await requestJson(
        'GET',
        joinUrl(config.baseUrl, '/models'),
        apiKey,
        undefined,
        10000,
      );
      if (status < 200 || status >= 300 || !json) {
        console.log('[CustomProvider] listModels HTTP', status, 'json:', !!json);
        return [];
      }

      const ids: string[] = [];
      if (Array.isArray(json.data)) {
        for (const item of json.data as Array<{ id?: string }>) {
          if (item?.id) ids.push(item.id);
        }
      }
      if (ids.length === 0 && Array.isArray(json.models)) {
        for (const item of json.models as Array<{ name?: string; model?: string }>) {
          if (item?.name) ids.push(item.name);
          else if (item?.model) ids.push(item.model);
        }
      }
      return ids.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } catch (err) {
      console.log('[CustomProvider] listModels failed:', err instanceof Error ? err.message : err);
      return [];
    }
  }

  /**
   * Validate connectivity via GET /models: only 401/403 mean a bad key;
   * any other HTTP response proves the endpoint is reachable.
   */
  async validateApiKey(config: ProviderConfig, apiKey: string): Promise<boolean> {
    try {
      const { status } = await requestJson(
        'GET',
        joinUrl(config.baseUrl, '/models'),
        apiKey,
        undefined,
        10000,
      );
      return status !== 401 && status !== 403;
    } catch {
      return false;
    }
  }
}
