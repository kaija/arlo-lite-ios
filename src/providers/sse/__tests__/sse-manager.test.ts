import { createSSEStream } from '../sse-manager';
import type { SSECallbacks } from '../sse-manager';
import type { IProvider, StreamChunk } from '../../types';

/**
 * Helper: create a ReadableStream from an array of string chunks.
 */
function createMockReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index++;
      } else {
        controller.close();
      }
    },
  });
}

/**
 * Helper: create a minimal mock provider that parses lines using simple rules.
 */
function createMockProvider(
  parseFn?: (line: string) => StreamChunk | null
): IProvider {
  const defaultParse = (line: string): StreamChunk | null => {
    if (!line || line.startsWith(':') || !line.startsWith('data: ')) {
      return null;
    }
    const payload = line.slice(6);
    if (payload === '[DONE]') {
      return { type: 'done', content: '', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } };
    }
    try {
      const data = JSON.parse(payload) as { content?: string; thinking?: string; error?: string };
      if (data.error) {
        return { type: 'error', content: data.error };
      }
      if (data.thinking) {
        return { type: 'thinking', content: data.thinking };
      }
      return { type: 'text', content: data.content ?? '' };
    } catch {
      return null;
    }
  };

  return {
    type: 'openai',
    buildRequest: jest.fn(),
    parseResponse: jest.fn(),
    parseStreamChunk: parseFn ?? defaultParse,
    mapThinkingLevel: jest.fn(),
    listModels: jest.fn(),
    validateApiKey: jest.fn(),
  };
}

/**
 * Helper: mock global fetch for SSE testing.
 */
function mockFetch(stream: ReadableStream<Uint8Array>, status = 200): jest.Mock {
  const mockFn = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Internal Server Error',
    body: stream,
    text: jest.fn().mockResolvedValue(''),
  });
  global.fetch = mockFn;
  return mockFn;
}

/**
 * Helper: wait for async operations to complete.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe('createSSEStream', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('calls onChunk for text chunks', async () => {
    const stream = createMockReadableStream([
      'data: {"content":"Hello"}\n\n',
      'data: {"content":" world"}\n\n',
      'data: [DONE]\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onChunk).toHaveBeenCalledTimes(2);
    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: 'Hello' });
    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: ' world' });
  });

  it('calls onComplete with usage on [DONE]', async () => {
    const stream = createMockReadableStream([
      'data: {"content":"hi"}\n\n',
      'data: [DONE]\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onComplete).toHaveBeenCalledWith({
      promptTokens: 10,
      completionTokens: 5,
      totalTokens: 15,
    });
  });

  it('calls onComplete when stream ends naturally without [DONE]', async () => {
    const stream = createMockReadableStream([
      'data: {"content":"hello"}\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: 'hello' });
    expect(callbacks.onComplete).toHaveBeenCalled();
  });

  it('calls onError on HTTP error response', async () => {
    const stream = createMockReadableStream([]);
    const mockFn = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      body: stream,
      text: jest.fn().mockResolvedValue('Invalid API key'),
    });
    global.fetch = mockFn;

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onError).toHaveBeenCalled();
    const error = (callbacks.onError as jest.Mock).mock.calls[0][0] as Error;
    expect(error.message).toContain('401');
    expect(error.message).toContain('Invalid API key');
  });

  it('calls onError when response body is null', async () => {
    const mockFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: null,
      text: jest.fn().mockResolvedValue(''),
    });
    global.fetch = mockFn;

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onError).toHaveBeenCalled();
    const error = (callbacks.onError as jest.Mock).mock.calls[0][0] as Error;
    expect(error.message).toContain('null');
  });

  it('calls onError when provider returns error chunk', async () => {
    const stream = createMockReadableStream([
      'data: {"error":"rate_limit_exceeded"}\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onError).toHaveBeenCalled();
    const error = (callbacks.onError as jest.Mock).mock.calls[0][0] as Error;
    expect(error.message).toBe('rate_limit_exceeded');
  });

  it('calls onChunk for thinking chunks', async () => {
    const stream = createMockReadableStream([
      'data: {"thinking":"Let me think..."}\n\n',
      'data: {"content":"Answer"}\n\n',
      'data: [DONE]\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'thinking', content: 'Let me think...' });
    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: 'Answer' });
  });

  it('returns an SSEConnection with abort method', () => {
    const stream = createMockReadableStream(['data: {"content":"slow"}\n\n']);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const connection = createSSEStream(
      'https://api.example.com/chat',
      {},
      '{}',
      createMockProvider(),
      callbacks
    );

    expect(connection).toHaveProperty('abort');
    expect(typeof connection.abort).toBe('function');
  });

  it('does not call onError after abort', async () => {
    // Create a stream that won't close on its own
    let resolveRead: (value: { done: boolean; value?: Uint8Array }) => void = () => {};
    const mockReader = {
      read: jest.fn().mockImplementation(() => new Promise<{ done: boolean; value?: Uint8Array }>((resolve) => {
        resolveRead = resolve;
      })),
      releaseLock: jest.fn(),
    };

    const mockBody = {
      getReader: () => mockReader,
    } as unknown as ReadableStream<Uint8Array>;

    const mockFn = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      body: mockBody,
      text: jest.fn().mockResolvedValue(''),
    });
    global.fetch = mockFn;

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    const connection = createSSEStream(
      'https://api.example.com/chat',
      {},
      '{}',
      createMockProvider(),
      callbacks
    );

    // Let the fetch resolve
    await flushPromises();

    // Abort the connection
    connection.abort();
    resolveRead({ done: true });
    await flushPromises();

    // onError should not be called for user-initiated abort
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it('sends correct headers including Accept: text/event-stream', async () => {
    const stream = createMockReadableStream(['data: [DONE]\n\n']);
    const fetchMock = mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream(
      'https://api.example.com/chat',
      { 'Authorization': 'Bearer key', 'Content-Type': 'application/json' },
      '{"model":"gpt-4"}',
      createMockProvider(),
      callbacks
    );

    await flushPromises();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/chat',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'text/event-stream',
          Authorization: 'Bearer key',
          'Content-Type': 'application/json',
        }),
        body: '{"model":"gpt-4"}',
      })
    );
  });

  it('handles multi-line chunks split across stream reads', async () => {
    // Simulate data arriving in fragments
    const stream = createMockReadableStream([
      'data: {"conte',       // split mid-line
      'nt":"Hello"}\n\n',   // completes first event
      'data: [DONE]\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: 'Hello' });
    expect(callbacks.onComplete).toHaveBeenCalled();
  });

  it('calls onError when fetch throws network error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onError).toHaveBeenCalled();
    const error = (callbacks.onError as jest.Mock).mock.calls[0][0] as Error;
    expect(error.message).toBe('Network error');
  });

  it('skips lines that provider parser returns null for', async () => {
    const stream = createMockReadableStream([
      ': comment\n',
      '\n',
      'data: {"content":"visible"}\n\n',
      'data: [DONE]\n\n',
    ]);
    mockFetch(stream);

    const callbacks: SSECallbacks = {
      onChunk: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    };

    createSSEStream('https://api.example.com/chat', {}, '{}', createMockProvider(), callbacks);
    await flushPromises();

    expect(callbacks.onChunk).toHaveBeenCalledTimes(1);
    expect(callbacks.onChunk).toHaveBeenCalledWith({ type: 'text', content: 'visible' });
  });
});
