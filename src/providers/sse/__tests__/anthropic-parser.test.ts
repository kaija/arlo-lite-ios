import {
  parseAnthropicSSELine,
  createAnthropicParserState,
} from '../anthropic-parser';

describe('parseAnthropicSSELine', () => {
  it('returns null for empty lines', () => {
    const state = createAnthropicParserState();
    expect(parseAnthropicSSELine('', state)).toEqual({
      done: false,
      eventType: null,
      data: null,
    });
  });

  it('skips SSE comment lines', () => {
    const state = createAnthropicParserState();
    expect(parseAnthropicSSELine(': keep-alive', state)).toEqual({
      done: false,
      eventType: null,
      data: null,
    });
  });

  it('captures event type from event: lines', () => {
    const state = createAnthropicParserState();
    const result = parseAnthropicSSELine('event: content_block_delta', state);

    expect(result).toEqual({
      done: false,
      eventType: 'content_block_delta',
      data: null,
    });
    expect(state.currentEventType).toBe('content_block_delta');
  });

  it('parses data line with previously captured event type', () => {
    const state = createAnthropicParserState();

    // First set the event type
    parseAnthropicSSELine('event: content_block_delta', state);

    // Then parse the data line
    const result = parseAnthropicSSELine(
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}',
      state
    );

    expect(result.done).toBe(false);
    expect(result.eventType).toBe('content_block_delta');
    expect(result.data).toEqual({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello' },
    });
  });

  it('marks done on message_stop event type', () => {
    const state = createAnthropicParserState();

    parseAnthropicSSELine('event: message_stop', state);
    const result = parseAnthropicSSELine('data: {"type":"message_stop"}', state);

    expect(result.done).toBe(true);
    expect(result.eventType).toBe('message_stop');
  });

  it('marks done when data type is message_stop', () => {
    const state = createAnthropicParserState();
    state.currentEventType = 'some_event';

    const result = parseAnthropicSSELine(
      'data: {"type":"message_stop"}',
      state
    );

    expect(result.done).toBe(true);
  });

  it('parses message_delta with usage', () => {
    const state = createAnthropicParserState();
    parseAnthropicSSELine('event: message_delta', state);

    const result = parseAnthropicSSELine(
      'data: {"type":"message_delta","usage":{"output_tokens":42}}',
      state
    );

    expect(result.done).toBe(false);
    expect(result.eventType).toBe('message_delta');
    expect(result.data).toEqual({
      type: 'message_delta',
      usage: { output_tokens: 42 },
    });
  });

  it('handles data line without space after colon', () => {
    const state = createAnthropicParserState();
    state.currentEventType = 'content_block_delta';

    const result = parseAnthropicSSELine(
      'data:{"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}',
      state
    );

    expect(result.data).toEqual({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'hi' },
    });
  });

  it('returns null data for malformed JSON', () => {
    const state = createAnthropicParserState();
    state.currentEventType = 'content_block_delta';

    const result = parseAnthropicSSELine('data: {not valid json}', state);
    expect(result.data).toBeNull();
    expect(result.done).toBe(false);
  });

  it('handles event: line without space after colon', () => {
    const state = createAnthropicParserState();
    const result = parseAnthropicSSELine('event:message_start', state);
    expect(state.currentEventType).toBe('message_start');
    expect(result.eventType).toBe('message_start');
  });

  it('skips empty data payload', () => {
    const state = createAnthropicParserState();
    state.currentEventType = 'ping';

    const result = parseAnthropicSSELine('data: ', state);
    expect(result.data).toBeNull();
  });

  it('skips unknown line formats', () => {
    const state = createAnthropicParserState();
    const result = parseAnthropicSSELine('id: 12345', state);
    expect(result).toEqual({ done: false, eventType: null, data: null });
  });
});
