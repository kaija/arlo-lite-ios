/**
 * Web Fetch tool — fetches a URL, converts HTML to Markdown via Turndown,
 * and returns the content for the agent to process in-context.
 *
 * Ported from reference/arlo/src/tools/web-fetch.ts to the arlo-lite
 * ToolDefinition pattern. No zod, no domain blocklist, no binary persistence.
 */

import type { ToolDefinition, ToolContext } from '@/services/tool-registry';
import { registerTool, getTool } from '@/services/tool-registry';

// ─── Tunables ──────────────────────────────────────────────────────────────

const MAX_URL_LENGTH = 2000;
const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 10;
const MAX_MARKDOWN_LENGTH = 100_000;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min

const USER_AGENT = 'arlo-lite-webfetch/0.1';

// ─── URL helpers ───────────────────────────────────────────────────────────

function validateURL(url: string): string | null {
  if (url.length > MAX_URL_LENGTH) return 'URL exceeds max length';
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'URL is not parseable';
  }
  if (parsed.username || parsed.password) return 'URL must not contain credentials';
  if (!parsed.hostname.includes('.')) return 'Hostname must contain a dot';
  return null; // valid
}

function isSameHost(a: string, b: string): boolean {
  try {
    const ua = new URL(a);
    const ub = new URL(b);
    if (ua.port !== ub.port) return false;
    const strip = (h: string) => h.replace(/^www\./, '');
    return strip(ua.hostname) === strip(ub.hostname);
  } catch {
    return false;
  }
}

// ─── TTL cache ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return e.result;
}

function cacheSet(key: string, result: string): void {
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ─── HTML to text (DOM-free, works in React Native) ────────────────────────

/**
 * Strip HTML to plain text without requiring a DOM environment.
 * Removes script/style blocks, strips tags, decodes common entities,
 * and collapses whitespace. Good enough for LLM consumption.
 */
function htmlToText(html: string): string {
  let text = html;
  // Remove script, style, noscript, head blocks entirely
  text = text.replace(/<(script|style|noscript|head|svg|canvas|template)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Convert <br>, <p>, <div>, <li>, headings to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, '\n');
  text = text.replace(/<(p|div|li|h[1-6]|tr|blockquote)[^>]*>/gi, '\n');
  // Strip all remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n');
  // Trim lines
  text = text.split('\n').map(l => l.trim()).join('\n');
  return text.trim();
}

// ─── AbortSignal.any polyfill ──────────────────────────────────────────────

function anySignal(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  const handler = function (this: AbortSignal) {
    controller.abort(this.reason);
    for (const s of signals) s.removeEventListener('abort', handler);
  };
  for (const s of signals) {
    if (s.aborted) { controller.abort(s.reason); break; }
    s.addEventListener('abort', handler, { once: true });
  }
  return controller.signal;
}

// ─── Fetch pipeline ────────────────────────────────────────────────────────

interface FetchOk {
  type: 'ok';
  status: number;
  statusText: string;
  contentType: string;
  text: string;
  bytes: number;
}

interface FetchRedirect {
  type: 'redirect';
  from: string;
  to: string;
  status: number;
}

async function fetchURL(
  url: string,
  signal: AbortSignal,
  depth = 0,
): Promise<FetchOk | FetchRedirect> {
  if (depth > MAX_REDIRECTS) throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  const combined = anySignal(signal, timeout.signal);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: combined,
      headers: { Accept: 'text/markdown, text/html, */*', 'User-Agent': USER_AGENT },
    });
  } catch (err) {
    if (timeout.signal.aborted && !signal.aborted) throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS}ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // Handle redirects
  if ([301, 302, 303, 307, 308].includes(res.status)) {
    const loc = res.headers.get('location');
    if (!loc) throw new Error('Redirect missing Location header');
    const target = new URL(loc, url).toString();
    if (isSameHost(url, target)) return fetchURL(target, signal, depth + 1);
    return { type: 'redirect', from: url, to: target, status: res.status };
  }

  // Content-length pre-check
  const cl = res.headers.get('content-length');
  if (cl !== null) {
    const n = parseInt(cl, 10);
    if (Number.isFinite(n) && n > MAX_CONTENT_BYTES) throw new Error(`Response too large: ${n} bytes`);
  }

  // Read body as text — React Native fetch doesn't support ReadableStream.
  const text = await res.text();
  const bytes = text.length; // approximation; sufficient for size-gating

  if (bytes > MAX_CONTENT_BYTES) {
    throw new Error(`Response exceeded ${MAX_CONTENT_BYTES} bytes`);
  }

  return {
    type: 'ok',
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers.get('content-type') ?? '',
    text,
    bytes,
  };
}

// ─── Tool definition ───────────────────────────────────────────────────────

export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description:
    'Fetch a URL and return its content as Markdown. Use when you need to read a web page, documentation, or article. HTTP URLs are auto-upgraded to HTTPS. Results are cached for 15 minutes.',
  timeoutMs: 65_000, // web fetches can take up to 60s; allow slight headroom
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch.' },
      prompt: { type: 'string', description: 'What information to extract from the page (optional context for your own focus).' },
    },
    required: ['url'],
  },
  handler: async (args: Record<string, unknown>, ctx: ToolContext): Promise<string> => {
    const url = (args.url as string) ?? '';
    const prompt = (args.prompt as string) ?? '';

    // Validate
    const err = validateURL(url);
    if (err) return `Error: ${err}`;

    // Cache hit
    const cached = cacheGet(url);
    if (cached) return cached;

    const start = Date.now();
    try {
      // Upgrade http → https
      let target = url;
      try {
        const p = new URL(url);
        if (p.protocol === 'http:') { p.protocol = 'https:'; target = p.toString(); }
      } catch { /* already validated */ }

      const response = await fetchURL(target, ctx.signal);

      // Cross-host redirect
      if (response.type === 'redirect') {
        return [
          'REDIRECT DETECTED: The URL redirects to a different host.',
          '',
          `Original URL: ${response.from}`,
          `Redirect URL: ${response.to}`,
          `Status: ${response.status}`,
          '',
          `To complete your request, call web_fetch again with url: "${response.to}"`,
        ].join('\n');
      }

      const { status, statusText, contentType, text: raw, bytes } = response;

      // Convert
      let markdown = contentType.includes('text/html') ? htmlToText(raw) : raw;

      // Truncate
      if (markdown.length > MAX_MARKDOWN_LENGTH) {
        markdown = markdown.slice(0, MAX_MARKDOWN_LENGTH) + '\n\n[Content truncated due to length...]';
      }

      const durationMs = Date.now() - start;
      const result = [
        `# web_fetch result`,
        `URL: ${url}`,
        `Status: ${status} ${statusText}`,
        `Content-Type: ${contentType || 'unknown'}`,
        `Bytes: ${bytes}`,
        `Duration: ${durationMs}ms`,
        prompt ? `Prompt: ${prompt}` : '',
        '',
        '## Page content (markdown)',
        '',
        markdown,
      ].filter(Boolean).join('\n');

      cacheSet(url, result);
      return result;
    } catch (e) {
      return `Error fetching URL: ${e instanceof Error ? e.message : String(e)}`;
    }
  },
};

/** Register web_fetch if not already present. No API key dependency. */
export function syncWebFetchTool(): void {
  if (!getTool('web_fetch')) {
    registerTool(webFetchTool);
  }
}
