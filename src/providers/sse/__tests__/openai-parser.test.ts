import { parseOpenAISSELine, splitSSEBuffer } from '../openai-parser';

describe('parseOpenAISSELine', () => {
  it('returns null data for empty lines', () => {
    expect(parseOpenAISSELine('')).toEqual({ done: false, data: null });
    expect(parseOpenAISSELine('  ')).toEqual({ done: false, data: null });
  });

  it('skips SSE comment lines (keep-alive pings)', () => {
    expect(parseOpenAISSELine(': ping')).toEqual({ done: false, data: null });
    expect(parseOpenAISSELine(':comment')).toEqual({ done: false, data: null });
  });

  it('skips non-data lines', () => {
    expect(parseOpenAISSELine('event: message')).toEqual({ done: false, data: null });
    expect(parseOpenAISSELine('id: 123')).toEqual({ done: false, data: null });
  });

  it('parses [DONE] terminator', () => {
    expect(parseOpenAISSELine('data: [DONE]')).toEqual({ done: true, data: null });
  });

  it('parses [DONE] terminator without space after colon', () => {
    expect(parseOpenAISSELine('data:[DONE]')).toEqual({ done: true, data: null });
  });

  it('parses a valid JSON data line', () => {
    const line = 'data: {"choices":[{"delta":{"content":"Hello"}}]}';
    const result = parseOpenAISSELine(line);
    expect(result.done).toBe(false);
    expect(result.data).toEqual({
      choices: [{ delta: { content: 'Hello' } }],
    });
  });

  it('parses data line without space after colon', () => {
    const line = 'data:{"id":"test"}';
    const result = parseOpenAISSELine(line);
    expect(result.done).toBe(false);
    expect(result.data).toEqual({ id: 'test' });
  });

  it('returns null data for malformed JSON', () => {
    const line = 'data: {invalid json}';
    const result = parseOpenAISSELine(line);
    expect(result.done).toBe(false);
    expect(result.data).toBeNull();
  });

  it('parses usage-only chunk', () => {
    const line = 'data: {"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}';
    const result = parseOpenAISSELine(line);
    expect(result.done).toBe(false);
    expect(result.data).toEqual({
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });
});

describe('splitSSEBuffer', () => {
  it('splits on newlines and preserves remainder', () => {
    const buffer = 'data: {"a":1}\n\ndata: {"b":2}\nincomplete';
    const result = splitSSEBuffer(buffer);
    expect(result.lines).toEqual(['data: {"a":1}', '', 'data: {"b":2}']);
    expect(result.remainder).toBe('incomplete');
  });

  it('handles CRLF line endings', () => {
    const buffer = 'data: {"a":1}\r\n\r\ndata: {"b":2}\r\n';
    const result = splitSSEBuffer(buffer);
    // The trailing \r\n splits to [..., ''] — pop() takes '' as remainder
    expect(result.lines).toEqual(['data: {"a":1}', '', 'data: {"b":2}']);
    expect(result.remainder).toBe('');
  });

  it('returns empty lines array when buffer has no newline', () => {
    const buffer = 'partial data';
    const result = splitSSEBuffer(buffer);
    expect(result.lines).toEqual([]);
    expect(result.remainder).toBe('partial data');
  });

  it('handles empty buffer', () => {
    const result = splitSSEBuffer('');
    expect(result.lines).toEqual([]);
    expect(result.remainder).toBe('');
  });
});
