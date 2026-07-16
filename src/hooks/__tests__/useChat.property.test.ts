// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
  ]),
}));

jest.mock('@/database/repositories/system-prompt-repo', () => ({
  getAllSystemPrompts: jest.fn(() => Promise.resolve([])),
  createSystemPrompt: jest.fn(),
  updateSystemPrompt: jest.fn(),
  deleteSystemPrompt: jest.fn(),
}));

import fc from 'fast-check';

/**
 * Property-based tests for system prompt prepend correctness.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 *
 * Feature: provider-ui-integration, Property 12: System Prompt Prepend Correctness
 *
 * Properties tested:
 * 1. When defaultSystemPromptId is non-null and matches a prompt,
 *    messages[0] is a system message with that prompt's content.
 * 2. When defaultSystemPromptId is null, messages are returned unchanged.
 * 3. The original messages array is not mutated.
 */

import { useSettingsStore } from '@/stores/settings-store';
import type { ChatMessage } from '@/providers/types';
import type { SystemPrompt } from '@/database/repositories/system-prompt-repo';

/**
 * Pure extraction of the prependSystemPrompt logic from useChat.ts.
 * Reads from useSettingsStore.getState() to determine the default prompt.
 */
function prependSystemPrompt(chatMessages: ChatMessage[]): ChatMessage[] {
  const { defaultSystemPromptId, systemPrompts } = useSettingsStore.getState();
  if (!defaultSystemPromptId) return chatMessages;

  const prompt = systemPrompts.find((p) => p.id === defaultSystemPromptId);
  if (!prompt) return chatMessages;

  return [{ role: 'system', content: prompt.content }, ...chatMessages];
}

/** Arbitrary for generating a non-system ChatMessage */
const chatMessageArb: fc.Arbitrary<ChatMessage> = fc.record({
  role: fc.constantFrom('user' as const, 'assistant' as const),
  content: fc.string({ minLength: 1, maxLength: 200 }),
});

/** Arbitrary for a system prompt object */
function systemPromptArb(id?: string): fc.Arbitrary<SystemPrompt> {
  return fc.record({
    id: id ? fc.constant(id) : fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    content: fc.string({ minLength: 1, maxLength: 500 }),
    isDefault: fc.boolean(),
    createdAt: fc.integer({ min: 1000000000, max: 2000000000 }),
    updatedAt: fc.integer({ min: 1000000000, max: 2000000000 }),
  });
}

describe('Property 12: System Prompt Prepend Correctness', () => {
  afterEach(() => {
    // Reset the settings store to defaults
    useSettingsStore.setState({
      defaultSystemPromptId: null,
      systemPrompts: [],
    });
  });

  it('non-null defaultSystemPromptId matching a prompt → messages[0] is system with prompt content', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        systemPromptArb('test-prompt-id'),
        (messages, prompt) => {
          // Set up the settings store with the prompt as default
          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // First message should be a system message with the prompt's content
          if (result.length === 0) return false;
          if (result[0].role !== 'system') return false;
          if (result[0].content !== prompt.content) return false;

          // Result length should be original + 1
          if (result.length !== messages.length + 1) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null defaultSystemPromptId → messages returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        (messages) => {
          // Set up settings store with null default
          useSettingsStore.setState({
            defaultSystemPromptId: null,
            systemPrompts: [],
          });

          const result = prependSystemPrompt(messages);

          // Should be the same reference (no modification)
          return result === messages;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('non-null defaultSystemPromptId with no matching prompt → messages returned unchanged', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 0, maxLength: 20 }),
        fc.uuid(),
        (messages, nonMatchingId) => {
          // Set up settings store with an ID that doesn't match any prompt
          useSettingsStore.setState({
            defaultSystemPromptId: nonMatchingId,
            systemPrompts: [], // No prompts at all
          });

          const result = prependSystemPrompt(messages);

          // Should be the same reference (no modification)
          return result === messages;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('original messages array is not mutated when system prompt is prepended', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        systemPromptArb('mutate-test-id'),
        (messages, prompt) => {
          // Deep copy to compare after
          const originalLength = messages.length;
          const originalFirstRole = messages[0]?.role;
          const originalFirstContent = messages[0]?.content;

          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // Original array should be untouched
          if (messages.length !== originalLength) return false;
          if (messages[0]?.role !== originalFirstRole) return false;
          if (messages[0]?.content !== originalFirstContent) return false;

          // Result should be a new array, not the same reference
          if (result === messages) return false;

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('remaining messages after prepend preserve their original order and content', () => {
    fc.assert(
      fc.property(
        fc.array(chatMessageArb, { minLength: 1, maxLength: 20 }),
        systemPromptArb('order-test-id'),
        (messages, prompt) => {
          useSettingsStore.setState({
            defaultSystemPromptId: prompt.id,
            systemPrompts: [prompt],
          });

          const result = prependSystemPrompt(messages);

          // All original messages should follow the system prompt in order
          for (let i = 0; i < messages.length; i++) {
            if (result[i + 1].role !== messages[i].role) return false;
            if (result[i + 1].content !== messages[i].content) return false;
          }

          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
