import React from 'react';
import fc from 'fast-check';
import { render } from '@testing-library/react-native';
import { MessageActions } from '../MessageActions';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Property-based tests for MessageActions action button sets.
 *
 * **Validates: Requirements 2.1–2.4, 3.1–3.4, 4.1**
 *
 * Feature: per-message-model-tracking
 * - Property 2: Assistant Message Action Set
 * - Property 3: User Message Action Set
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.copy': 'Copy',
        'chat.regenerate': 'Regenerate',
        'chat.delete': 'Delete',
        'chat.copied': 'Copied',
        'accessibility.copyButton': 'Copy to clipboard',
        'accessibility.regenerateButton': 'Regenerate response',
        'accessibility.deleteButton': 'Delete',
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000',
      textSecondary: '#666',
      accent: '#5856D6',
      background: '#fff',
      surface: '#f5f5f5',
      surfaceSecondary: '#eee',
      border: '#ddd',
      codeBackground: '#1a1a1a',
    },
    typography: {
      body: { fontSize: 16, lineHeight: 24 },
      caption1: { fontSize: 12, lineHeight: 16 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 },
    borderRadii: { sm: 4, md: 8, lg: 12 },
    isDark: false,
  }),
}));

/** Generate an arbitrary Message with a specific role. */
function messageArbitrary(role: 'user' | 'assistant'): fc.Arbitrary<Message> {
  return fc.record({
    id: fc.uuid(),
    sessionId: fc.uuid(),
    role: fc.constant(role),
    content: fc.string({ minLength: 1, maxLength: 200 }),
    thinkingContent: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
    providerId: fc.string({ minLength: 1, maxLength: 20 }),
    modelId: fc.string({ minLength: 1, maxLength: 50 }),
    promptTokens: fc.option(fc.nat({ max: 100000 }), { nil: null }),
    completionTokens: fc.option(fc.nat({ max: 100000 }), { nil: null }),
    totalTokens: fc.option(fc.nat({ max: 200000 }), { nil: null }),
    cachedTokens: fc.option(fc.nat({ max: 100000 }), { nil: null }),
    cost: fc.option(fc.float({ min: 0, max: 10, noNaN: true }), { nil: null }),
    createdAt: fc.integer({ min: 1000000000000, max: 2000000000000 }),
  });
}

const noopAsync = jest.fn().mockResolvedValue(undefined);

describe('Property 2: Assistant Message Action Set', () => {
  it('for any assistant message, exactly {Copy, Regenerate, Delete} buttons are rendered', () => {
    fc.assert(
      fc.property(messageArbitrary('assistant'), (message) => {
        const { getByLabelText, queryByLabelText } = render(
          <MessageActions
            message={message}
            onCopy={noopAsync}
            onRegenerate={noopAsync}
            onDelete={noopAsync}
          />,
        );

        // Exactly these three buttons exist
        const copyBtn = getByLabelText('Copy to clipboard');
        const regenBtn = getByLabelText('Regenerate response');
        const deleteBtn = getByLabelText('Delete');

        // No Edit button present
        const editBtn = queryByLabelText('Edit');

        return (
          copyBtn !== null &&
          regenBtn !== null &&
          deleteBtn !== null &&
          editBtn === null
        );
      }),
      { numRuns: 50 },
    );
  });

  it('the action set has exactly 3 buttons for any assistant message', () => {
    fc.assert(
      fc.property(messageArbitrary('assistant'), (message) => {
        const { getAllByRole } = render(
          <MessageActions
            message={message}
            onCopy={noopAsync}
            onRegenerate={noopAsync}
            onDelete={noopAsync}
          />,
        );

        const buttons = getAllByRole('button');
        return buttons.length === 3;
      }),
      { numRuns: 50 },
    );
  });
});

describe('Property 3: User Message Action Set', () => {
  it('for any user message, exactly {Copy, Delete} buttons are rendered', () => {
    fc.assert(
      fc.property(messageArbitrary('user'), (message) => {
        const { getByLabelText, queryByLabelText } = render(
          <MessageActions
            message={message}
            onCopy={noopAsync}
            onRegenerate={noopAsync}
            onDelete={noopAsync}
          />,
        );

        // Exactly these two buttons exist
        const copyBtn = getByLabelText('Copy to clipboard');
        const deleteBtn = getByLabelText('Delete');

        // No Edit or Regenerate buttons present
        const editBtn = queryByLabelText('Edit');
        const regenBtn = queryByLabelText('Regenerate response');

        return (
          copyBtn !== null &&
          deleteBtn !== null &&
          editBtn === null &&
          regenBtn === null
        );
      }),
      { numRuns: 50 },
    );
  });

  it('the action set has exactly 2 buttons for any user message', () => {
    fc.assert(
      fc.property(messageArbitrary('user'), (message) => {
        const { getAllByRole } = render(
          <MessageActions
            message={message}
            onCopy={noopAsync}
            onRegenerate={noopAsync}
            onDelete={noopAsync}
          />,
        );

        const buttons = getAllByRole('button');
        return buttons.length === 2;
      }),
      { numRuns: 50 },
    );
  });
});
