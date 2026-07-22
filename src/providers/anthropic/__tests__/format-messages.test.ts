/**
 * Tests for Anthropic message formatting — tool_use and tool_result conversion.
 */

// Mock native modules that can't load in Jest
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

import { _formatMessages as formatMessages } from '../anthropic-provider';
import type { ChatMessage } from '../../types';

describe('formatMessages (Anthropic)', () => {
  it('converts role:"tool" messages to user messages with tool_result blocks', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'What time is it?' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'toolu_1', name: 'datetime', arguments: {} }],
      },
      { role: 'tool', content: '2025-01-15T10:30:00Z', tool_call_id: 'toolu_1' },
    ];

    const result = formatMessages(messages);

    expect(result).toHaveLength(3);
    // First: plain user message
    expect(result[0]).toEqual({ role: 'user', content: 'What time is it?' });
    // Second: assistant with tool_use block
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'toolu_1', name: 'datetime', input: {} }],
    });
    // Third: user message wrapping tool_result
    expect(result[2]).toEqual({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '2025-01-15T10:30:00Z' }],
    });
  });

  it('merges consecutive tool messages into one user message', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: 'Let me check both.',
        toolCalls: [
          { id: 'tc_1', name: 'a', arguments: { x: 1 } },
          { id: 'tc_2', name: 'b', arguments: { y: 2 } },
        ],
      },
      { role: 'tool', content: 'result_a', tool_call_id: 'tc_1' },
      { role: 'tool', content: 'result_b', tool_call_id: 'tc_2' },
    ];

    const result = formatMessages(messages);

    expect(result).toHaveLength(2);
    // Assistant with text + two tool_use blocks
    expect(result[0].role).toBe('assistant');
    expect(result[0].content).toEqual([
      { type: 'text', text: 'Let me check both.' },
      { type: 'tool_use', id: 'tc_1', name: 'a', input: { x: 1 } },
      { type: 'tool_use', id: 'tc_2', name: 'b', input: { y: 2 } },
    ]);
    // Merged tool results
    expect(result[1]).toEqual({
      role: 'user',
      content: [
        { type: 'tool_result', tool_use_id: 'tc_1', content: 'result_a' },
        { type: 'tool_result', tool_use_id: 'tc_2', content: 'result_b' },
      ],
    });
  });

  it('excludes system messages', () => {
    const messages: ChatMessage[] = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ];

    const result = formatMessages(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: 'user', content: 'Hi' });
  });

  it('passes through plain user and assistant messages unchanged', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];

    const result = formatMessages(messages);
    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]);
  });

  it('handles assistant toolCalls with no text content', () => {
    const messages: ChatMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc_x', name: 'lookup', arguments: { q: 'test' } }],
      },
    ];

    const result = formatMessages(messages);
    expect(result).toHaveLength(1);
    // No text block when content is empty
    expect(result[0]).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 'tc_x', name: 'lookup', input: { q: 'test' } }],
    });
  });
});
