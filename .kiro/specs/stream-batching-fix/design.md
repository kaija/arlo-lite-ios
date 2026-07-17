# Design Document: Stream Batching Fix

## Overview

This design introduces a batching layer between the SSE chunk iterator and the Zustand chat store to eliminate UI jank during LLM streaming. Instead of calling `set()` on every incoming chunk (50–100+ times per second), chunks accumulate in an in-memory ref buffer and flush to the store at a fixed 32ms interval (~30fps), keeping the JS thread responsive.

## Architecture

### Component Interaction

```
┌─────────────────┐     chunks     ┌──────────────────┐    flush (32ms)    ┌────────────────┐
│ streamCompletion │ ──────────────▶│  StreamBatcher   │ ──────────────────▶│   ChatStore    │
│  (AsyncGen)      │                │  (ref buffers +  │                    │ (Zustand set)  │
└─────────────────┘                │   setInterval)   │                    └────────────────┘
                                   └──────────────────┘
                                          │
                                          ▼ (on flush)
                                   ┌──────────────────┐
                                   │  Token Rate Calc  │
                                   │  (local state)    │
                                   └──────────────────┘
```

The `StreamBatcher` lives inside `useChat.ts` as a set of refs and a `setInterval` callback. It is not a separate module — the batching logic is local to the streaming loop since it needs access to the abort controller, accumulated content variables, and store actions.

### Data Flow

1. `for await (const chunk of streamCompletion(...))` yields chunks as before
2. Each `text` chunk appends to `textBufferRef.current` and increments `bufferedTokensRef.current`
3. Each `thinking` chunk appends to `thinkingBufferRef.current`
4. Every 32ms, the interval callback:
   - Checks if either buffer is non-empty (skip if both empty)
   - Calls a single `flushStreamBuffer(textDelta, thinkingDelta)` on the chat store
   - Computes token rate from `bufferedTokensRef` and elapsed time
   - Resets the buffer refs to empty strings
5. On stream end or abort: clear interval, flush remaining buffer, proceed with persistence

## Detailed Design

### New Chat Store Action: `flushStreamBuffer`

A single action that appends both text and thinking deltas in one `set()` call:

```typescript
// In chat-store.ts — new action added to ChatActions interface
interface ChatActions {
  // ... existing actions ...
  /** Append text and thinking content in a single atomic store update */
  flushStreamBuffer: (textDelta: string, thinkingDelta: string) => void;
}

// Implementation
flushStreamBuffer: (textDelta: string, thinkingDelta: string) => {
  set((state) => ({
    streamContent: state.streamContent + textDelta,
    thinkingContent: state.thinkingContent + thinkingDelta,
  }));
},
```

The existing `appendStreamContent` and `appendThinkingContent` actions remain for backward compatibility but are no longer called during streaming.

### Stream Batcher Implementation (inside useChat.ts)

```typescript
// Constants
const FLUSH_INTERVAL_MS = 32;

// Inside useChat():
const textBufferRef = useRef<string>('');
const thinkingBufferRef = useRef<string>('');
const flushIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
const bufferedChunkSizesRef = useRef<number>(0);
const lastFlushTimeRef = useRef<number>(0);

/**
 * Flush accumulated buffer content to the store in a single set() call.
 * Also computes and updates the token rate from buffered chunk sizes.
 */
function flushBuffer() {
  const textDelta = textBufferRef.current;
  const thinkingDelta = thinkingBufferRef.current;

  if (textDelta.length === 0 && thinkingDelta.length === 0) {
    return; // Skip — no-op flush
  }

  // Single store update for both text and thinking
  useChatStore.getState().flushStreamBuffer(textDelta, thinkingDelta);

  // Compute token rate from buffered data
  const now = Date.now();
  const elapsed = (now - lastFlushTimeRef.current) / 1000;
  if (elapsed > 0 && bufferedChunkSizesRef.current > 0) {
    const tokensThisFlush = Math.max(1, Math.ceil(bufferedChunkSizesRef.current / 4));
    totalStreamTokensRef.current += tokensThisFlush;

    // Update rolling window
    tokenSamplesRef.current.push({ time: now, tokens: tokensThisFlush });
    const windowStart = now - 2000;
    tokenSamplesRef.current = tokenSamplesRef.current.filter((s) => s.time >= windowStart);

    const samples = tokenSamplesRef.current;
    if (samples.length >= 2) {
      const windowTokens = samples.reduce((sum, s) => sum + s.tokens, 0);
      const windowDuration = (samples[samples.length - 1].time - samples[0].time) / 1000;
      if (windowDuration > 0) {
        setTokenRate(windowTokens / windowDuration);
      }
    } else {
      const totalElapsed = (now - streamStartRef.current) / 1000;
      if (totalElapsed > 0.1) {
        setTokenRate(totalStreamTokensRef.current / totalElapsed);
      }
    }
  }

  // Reset buffers
  textBufferRef.current = '';
  thinkingBufferRef.current = '';
  bufferedChunkSizesRef.current = 0;
  lastFlushTimeRef.current = now;
}

/**
 * Start the flush interval timer. Called at the beginning of streaming.
 */
function startBatcher() {
  lastFlushTimeRef.current = Date.now();
  flushIntervalRef.current = setInterval(flushBuffer, FLUSH_INTERVAL_MS);
}

/**
 * Stop the flush interval and perform a final flush of any remaining content.
 */
function stopBatcher() {
  if (flushIntervalRef.current !== null) {
    clearInterval(flushIntervalRef.current);
    flushIntervalRef.current = null;
  }
  flushBuffer(); // Final flush of remaining content
}
```

### Modified `handleStreaming` Flow

```typescript
async function handleStreaming(
  chatMessages: ChatMessage[],
  options: CompletionServiceOptions,
  sessionId: string,
  modelConfig: { inputPrice: number | null; outputPrice: number | null }
) {
  clearStream();
  setStreaming(true);
  resetTokenRate();

  const controller = new AbortController();
  abortControllerRef.current = controller;

  let accumulatedContent = '';
  let accumulatedThinking = '';
  let finalUsage: TokenUsage | undefined;

  // Start the batching interval
  startBatcher();

  try {
    for await (const chunk of streamCompletion(chatMessages, options, controller.signal)) {
      switch (chunk.type) {
        case 'text':
          accumulatedContent += chunk.content;
          textBufferRef.current += chunk.content;
          bufferedChunkSizesRef.current += chunk.content.length;
          break;
        case 'thinking':
          accumulatedThinking += chunk.content;
          thinkingBufferRef.current += chunk.content;
          break;
        case 'done':
          finalUsage = chunk.usage;
          break;
        case 'error':
          setError({ message: chunk.content, isRetryable: true });
          break;
      }
    }

    // Stream completed normally — stop batcher (flushes remaining)
    stopBatcher();

    // Persist assistant message (same logic as before)
    if (accumulatedContent.length > 0 || accumulatedThinking.length > 0) {
      // ... cost calculation and addMessage (unchanged)
    }
  } catch (err: unknown) {
    // Stop batcher on error too
    stopBatcher();
    // ... error handling (unchanged)
  } finally {
    abortControllerRef.current = null;
    setStreaming(false);
    clearStream();
    setTokenRate(0);
  }
}
```

### Modified `stopGeneration` (Abort Handling)

```typescript
const stopGeneration = useCallback(() => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }

  // Stop batcher — flushes remaining content to store
  stopBatcher();

  // Persist partial content if any was received
  const { streamContent } = useChatStore.getState();
  if (streamContent.length > 0 && activeSessionId) {
    addMessage(activeSessionId, {
      sessionId: activeSessionId,
      role: 'assistant',
      content: streamContent,
      thinkingContent: useChatStore.getState().thinkingContent || undefined,
      providerId: activeProviderId!,
      modelId: activeModelId!,
      promptTokens: null,
      completionTokens: null,
      totalTokens: null,
      cachedTokens: null,
      cost: null,
    }).catch(() => {
      // Best-effort persistence
    });
  }

  setStreaming(false);
  clearStream();
}, [setStreaming, clearStream, activeSessionId, activeProviderId, activeModelId, addMessage]);
```

### Cleanup on Unmount

A `useEffect` cleanup in the hook ensures the interval is cleared if the component unmounts mid-stream:

```typescript
useEffect(() => {
  return () => {
    if (flushIntervalRef.current !== null) {
      clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
    textBufferRef.current = '';
    thinkingBufferRef.current = '';
    bufferedChunkSizesRef.current = 0;
  };
}, []);
```

## Data Model Changes

No database schema changes. The only store change is adding `flushStreamBuffer` to `ChatActions`:

```typescript
export interface ChatActions {
  setStreaming: (streaming: boolean) => void;
  appendStreamContent: (text: string) => void;      // kept for compatibility
  appendThinkingContent: (text: string) => void;    // kept for compatibility
  flushStreamBuffer: (textDelta: string, thinkingDelta: string) => void;  // NEW
  clearStream: () => void;
  setThinkingLevel: (level: ThinkingLevel) => void;
  switchModel: (providerId: string, modelId: string) => void;
}
```

## Error Handling

- **Interval leak**: The `finally` block in `handleStreaming` and the `useEffect` cleanup both ensure the interval is cleared. Belt-and-suspenders approach prevents timer leaks.
- **Abort during flush**: `flushBuffer` is synchronous and idempotent — calling it after abort is safe even if the store has already been cleared. The `clearStream()` in `finally` resets to empty regardless.
- **Error in stream iteration**: The `catch` block calls `stopBatcher()` before handling the error, ensuring no orphaned timers.
- **Empty buffer flush**: Explicitly short-circuits when both buffers are empty strings, avoiding unnecessary Zustand subscriber notifications.

## Performance Characteristics

| Metric | Before | After |
|--------|--------|-------|
| Store set() calls per second | 50–100+ (per chunk) | ~31 (per interval) |
| React re-renders per second | 50–100+ | ~31 |
| Token rate updates per second | 50–100+ | ~31 |
| JS thread availability | Near 0% during fast streams | ~95%+ between flushes |

The 32ms interval aligns with common display refresh budgets (30fps). React Native's bridge batching and UI thread scheduling mean the actual render rate may be slightly lower, which is fine — the goal is to keep the JS thread free for interactions, not to maximize render throughput.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Flush Frequency Bound

For any stream of N chunks arriving within a single 32ms flush interval, the Chat_Store set() method SHALL be called at most once during that interval.

**Validates: Requirements 1.1, 1.2, 4.1**

### Property 2: Combined Flush Content Correctness

For any sequence of text chunks T₁...Tₙ and thinking chunks K₁...Kₘ accumulated between two consecutive flush boundaries, the single flush set() call SHALL append exactly concat(T₁...Tₙ) to streamContent and concat(K₁...Kₘ) to thinkingContent.

**Validates: Requirements 2.1, 2.2, 2.3, 7.2, 7.3**

### Property 3: Batched Token Rate Accuracy

For any set of text chunks accumulated between two consecutive flushes, the token rate SHALL be computed exactly once per flush based on the total character count of all chunks in the batch divided by the elapsed time since the previous flush.

**Validates: Requirements 3.1, 3.2**

### Property 4: Terminal Flush Completeness

For any non-empty buffer state at the moment of stream completion or abort signal, the Stream_Batcher SHALL flush all remaining buffer content to the Chat_Store such that the final store state equals the concatenation of all chunks received during the entire stream.

**Validates: Requirements 5.1, 5.3, 6.1, 6.2**

### Property 5: Abort Persists Partial Content

For any abort event where the Chat_Store streamContent is non-empty, the useChat_Hook SHALL persist an assistant message containing the stream content to the session store before clearing stream state.

**Validates: Requirements 6.3**

### Property 6: Empty Buffer Skip

For any flush interval tick where both the text buffer and thinking buffer are empty strings, no Chat_Store set() call SHALL occur.

**Validates: Requirements 1.3**
