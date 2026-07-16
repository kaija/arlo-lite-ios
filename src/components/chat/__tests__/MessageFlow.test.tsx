import React from 'react';
import { render } from '@testing-library/react-native';

import { MessageFlow, MessageFlowProps } from '../MessageFlow';
import type { Message } from '@/database/repositories/message-repo';

// Mock i18next
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

// Mock theme
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

// Mock react-native-reanimated
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

// Mock usePressAnimation
jest.mock('@/hooks/usePressAnimation', () => ({
  usePressAnimation: () => ({
    animatedStyle: {},
    onPressIn: jest.fn(),
    onPressOut: jest.fn(),
  }),
}));

// Mock markdown
jest.mock('react-native-markdown-display', () => {
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ children }: { children: string }) => <Text>{children}</Text>,
  };
});

// Mock CodeBlock
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

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello world',
    thinkingContent: null,
    providerId: 'p1',
    modelId: 'm1',
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cachedTokens: null,
    cost: null,
    createdAt: Date.now(),
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

describe('MessageFlow', () => {
  it('renders user message with "You" label', () => {
    const { getByText } = renderMessageFlow({
      message: createMessage({ role: 'user', content: 'Hello' }),
    });
    expect(getByText('You')).toBeTruthy();
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders assistant message with model name label', () => {
    const { getByText } = renderMessageFlow({
      message: createMessage({ role: 'assistant', content: 'Hi there' }),
      modelName: 'Claude 3.5',
    });
    expect(getByText('Claude 3.5')).toBeTruthy();
    expect(getByText('Hi there')).toBeTruthy();
  });

  it('does not display token metadata when cost is null', () => {
    const { queryByText } = renderMessageFlow({
      message: createMessage({
        role: 'assistant',
        promptTokens: 1500,
        completionTokens: 3200,
        cost: null,
      }),
    });
    expect(queryByText('1.5k in / 3.2k out')).toBeNull();
  });

  it('displays token metadata with cost when cost is available', () => {
    const { getByText } = renderMessageFlow({
      message: createMessage({
        role: 'assistant',
        promptTokens: 1500,
        completionTokens: 3200,
        cost: 0.053,
      }),
    });
    expect(getByText('1.5k in / 3.2k out · $0.053')).toBeTruthy();
  });

  it('hides action buttons while streaming', () => {
    const { queryByLabelText } = renderMessageFlow({
      message: createMessage({ role: 'assistant' }),
      isStreaming: true,
    });
    expect(queryByLabelText('Copy message')).toBeNull();
    expect(queryByLabelText('Regenerate response')).toBeNull();
    expect(queryByLabelText('Delete message')).toBeNull();
  });

  it('shows copy, regenerate, delete buttons for assistant when not streaming', () => {
    const { getByLabelText } = renderMessageFlow({
      message: createMessage({ role: 'assistant' }),
      isStreaming: false,
    });
    expect(getByLabelText('Copy message')).toBeTruthy();
    expect(getByLabelText('Regenerate response')).toBeTruthy();
    expect(getByLabelText('Delete message')).toBeTruthy();
  });

  it('shows copy, edit, delete buttons for user messages', () => {
    const { getByLabelText, queryByLabelText } = renderMessageFlow({
      message: createMessage({ role: 'user' }),
      isStreaming: false,
    });
    expect(getByLabelText('Copy message')).toBeTruthy();
    expect(getByLabelText('Edit message')).toBeTruthy();
    expect(getByLabelText('Delete message')).toBeTruthy();
    expect(queryByLabelText('Regenerate response')).toBeNull();
  });

  it('does not render avatar when showAvatars is false', () => {
    const { toJSON } = renderMessageFlow({
      showAvatars: false,
    });
    // Avatar has width 23; if hidden, we should not find such a view
    const json = JSON.stringify(toJSON());
    // When showAvatars is false, no 23px wide view should be present
    expect(json).not.toContain('"width":23');
  });

  it('renders avatar when showAvatars is true', () => {
    const { toJSON } = renderMessageFlow({
      showAvatars: true,
    });
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"width":23');
  });
});
