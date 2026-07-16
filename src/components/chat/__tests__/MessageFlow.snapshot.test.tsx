/**
 * Snapshot tests for MessageFlow component.
 *
 * Validates visual structure for user messages (Req 1.1) and
 * assistant messages (Req 1.2) by comparing rendered output to snapshots.
 */

import React from 'react';
import { render } from '@testing-library/react-native';

import { MessageFlow, MessageFlowProps } from '../MessageFlow';
import type { Message } from '@/database/repositories/message-repo';

// ─── Mocks ─────────────────────────────────────────────────────────────────────

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'chat.roleUser': 'You',
        'chat.copy': 'Copy',
        'chat.edit': 'Edit',
        'chat.delete': 'Delete',
        'chat.regenerate': 'Regenerate',
        'accessibility.copyButton': 'Copy message',
        'accessibility.editButton': 'Edit message',
        'accessibility.deleteButton': 'Delete message',
        'accessibility.regenerateButton': 'Regenerate response',
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

// Mock SVG icons
jest.mock('@/components/icons', () => ({
  CopyIcon: () => 'CopyIcon',
  RegenerateIcon: () => 'RegenerateIcon',
  EditIcon: () => 'EditIcon',
  DeleteIcon: () => 'DeleteIcon',
}));

// ─── Helpers ───────────────────────────────────────────────────────────────────

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-snapshot-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello, this is a test message.',
    thinkingContent: null,
    providerId: 'provider-1',
    modelId: 'model-1',
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cachedTokens: null,
    cost: null,
    createdAt: 1700000000000,
    ...overrides,
  };
}

function renderMessageFlow(overrides: Partial<MessageFlowProps> = {}) {
  const defaultProps: MessageFlowProps = {
    message: createMessage(),
    modelName: 'GPT-4o',
    showAvatars: true,
    isStreaming: false,
    onCopy: jest.fn(),
    onRegenerate: jest.fn(),
    onEdit: jest.fn(),
    onDelete: jest.fn(),
    ...overrides,
  };
  return render(<MessageFlow {...defaultProps} />);
}

// ─── Snapshot Tests ────────────────────────────────────────────────────────────

describe('MessageFlow Snapshots', () => {
  it('renders a user message and matches snapshot (Req 1.1)', () => {
    const { toJSON } = renderMessageFlow({
      message: createMessage({
        role: 'user',
        content: 'What is the meaning of life?',
      }),
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it('renders an assistant message and matches snapshot (Req 1.2)', () => {
    const { toJSON } = renderMessageFlow({
      message: createMessage({
        role: 'assistant',
        content: 'The meaning of life is a philosophical question that has been debated for centuries.',
      }),
      modelName: 'Claude 3.5 Sonnet',
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it('renders a user message with token metadata and matches snapshot', () => {
    const { toJSON } = renderMessageFlow({
      message: createMessage({
        role: 'user',
        content: 'Explain quantum computing.',
        promptTokens: 2400,
        completionTokens: 0,
      }),
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it('renders an assistant message with token metadata and cost', () => {
    const { toJSON } = renderMessageFlow({
      message: createMessage({
        role: 'assistant',
        content: 'Quantum computing leverages quantum mechanical phenomena.',
        promptTokens: 1500,
        completionTokens: 3200,
        cost: 0.047,
      }),
      modelName: 'GPT-4o',
    });

    expect(toJSON()).toMatchSnapshot();
  });

  it('renders an assistant message while streaming (no action buttons)', () => {
    const { toJSON } = renderMessageFlow({
      message: createMessage({
        role: 'assistant',
        content: 'Generating response...',
      }),
      modelName: 'GPT-4o',
      isStreaming: true,
    });

    expect(toJSON()).toMatchSnapshot();
  });
});
