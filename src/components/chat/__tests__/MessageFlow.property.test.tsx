import React from 'react';
import fc from 'fast-check';
import { render } from '@testing-library/react-native';

import { MessageFlow } from '../MessageFlow';
import type { Message } from '@/database/repositories/message-repo';

/**
 * Property-based tests for MessageFlow action visibility vs streaming state.
 *
 * **Validates: Requirements 7.1, 7.2**
 *
 * Feature: per-message-model-tracking
 * - Property 6: Action Visibility Follows Streaming State
 *
 * For any message rendered by MessageFlow, action buttons are visible if and only if
 * `isStreaming` is `false`. When `isStreaming` is `true`, no action buttons are rendered.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// Mocks
// ═══════════════════════════════════════════════════════════════════════════════

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'chat.roleUser': 'You',
        'chat.copy': 'Copy',
        'chat.delete': 'Delete',
        'chat.regenerate': 'Regenerate',
        'accessibility.copyButton': 'Copy message',
        'accessibility.deleteButton': 'Delete message',
        'accessibility.regenerateButton': 'Regenerate response',
        'accessibility.modelLabel': 'Model: {{model}}',
      };
      return translations[key] ?? fallback ?? key;
    },
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      text: '#1C1C1E',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      surfaceSecondary: '#E5E5EA',
      border: '#D1D1D6',
      codeBackground: '#1C1C1E',
      inlineCodeBackground: '#F2F2F7',
      inlineCodeText: '#1C1C1E',
    },
    typography: {
      body: { fontSize: 17, lineHeight: 22, fontWeight: '400' },
      title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
      title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
      title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
      subheadline: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
      caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
      code: { fontSize: 15, lineHeight: 20, fontWeight: '400', fontFamily: 'Menlo' },
    },
    spacing: { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
    borderRadii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    isDark: false,
  }),
}));

jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: {
      View: View,
    },
    FadeIn: {
      duration: () => ({
        withInitialValues: () => undefined,
      }),
    },
    useSharedValue: (val: number) => ({ value: val }),
    useAnimatedStyle: (fn: () => object) => fn(),
    withSpring: (val: number) => val,
  };
});

jest.mock('@/hooks/usePressAnimation', () => ({
  usePressAnimation: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}));

jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

jest.mock('../CodeBlock', () => ({
  CodeBlock: () => null,
}));

jest.mock('@/components/icons', () => ({
  CopyIcon: () => 'CopyIcon',
  RegenerateIcon: () => 'RegenerateIcon',
  DeleteIcon: () => 'DeleteIcon',
}));

// ═══════════════════════════════════════════════════════════════════════════════
// Arbitraries
// ═══════════════════════════════════════════════════════════════════════════════

/** Generate an arbitrary Message with a given role. */
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

/** Generate an arbitrary message with any role. */
const anyMessageArb = fc.oneof(messageArbitrary('user'), messageArbitrary('assistant'));

const noop = jest.fn();

// ═══════════════════════════════════════════════════════════════════════════════
// Property 6: Action Visibility Follows Streaming State
// ═══════════════════════════════════════════════════════════════════════════════

describe('Property 6: Action Visibility Follows Streaming State', () => {
  it('when isStreaming=true, no action buttons are rendered for any message', () => {
    fc.assert(
      fc.property(anyMessageArb, (message) => {
        const { queryByLabelText, queryAllByRole } = render(
          <MessageFlow
            message={message}
            modelDisplayName="Test Model"
            showAvatars={false}
            isStreaming={true}
            onCopy={noop}
            onRegenerate={noop}
            onDelete={noop}
          />,
        );

        // No action buttons should be rendered while streaming
        const copyBtn = queryByLabelText('Copy message');
        const regenBtn = queryByLabelText('Regenerate response');
        const deleteBtn = queryByLabelText('Delete message');
        const buttons = queryAllByRole('button');

        return (
          copyBtn === null &&
          regenBtn === null &&
          deleteBtn === null &&
          buttons.length === 0
        );
      }),
      { numRuns: 50 },
    );
  });

  it('when isStreaming=false, action buttons are rendered for any message', () => {
    fc.assert(
      fc.property(anyMessageArb, (message) => {
        const { queryByLabelText, queryAllByRole } = render(
          <MessageFlow
            message={message}
            modelDisplayName="Test Model"
            showAvatars={false}
            isStreaming={false}
            onCopy={noop}
            onRegenerate={noop}
            onDelete={noop}
          />,
        );

        // At minimum, Copy and Delete should always be present
        const copyBtn = queryByLabelText('Copy message');
        const deleteBtn = queryByLabelText('Delete message');
        const buttons = queryAllByRole('button');

        return (
          copyBtn !== null &&
          deleteBtn !== null &&
          buttons.length >= 2
        );
      }),
      { numRuns: 50 },
    );
  });

  it('for any assistant message: streaming=false shows exactly 3 action buttons', () => {
    fc.assert(
      fc.property(messageArbitrary('assistant'), (message) => {
        const { queryAllByRole } = render(
          <MessageFlow
            message={message}
            modelDisplayName="Test Model"
            showAvatars={false}
            isStreaming={false}
            onCopy={noop}
            onRegenerate={noop}
            onDelete={noop}
          />,
        );

        const buttons = queryAllByRole('button');
        return buttons.length === 3;
      }),
      { numRuns: 50 },
    );
  });

  it('for any user message: streaming=false shows exactly 2 action buttons', () => {
    fc.assert(
      fc.property(messageArbitrary('user'), (message) => {
        const { queryAllByRole } = render(
          <MessageFlow
            message={message}
            modelDisplayName="Test Model"
            showAvatars={false}
            isStreaming={false}
            onCopy={noop}
            onRegenerate={noop}
            onDelete={noop}
          />,
        );

        const buttons = queryAllByRole('button');
        return buttons.length === 2;
      }),
      { numRuns: 50 },
    );
  });
});
