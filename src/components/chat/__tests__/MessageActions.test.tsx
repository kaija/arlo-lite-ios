/**
 * Tests for the MessageActions component.
 *
 * Verifies that the correct action buttons are rendered based on message role
 * and position (last assistant message).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { MessageActions } from '../MessageActions';
import type { Message } from '@/database/repositories/message-repo';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.copy': 'Copy',
        'chat.edit': 'Edit',
        'chat.regenerate': 'Regenerate',
        'chat.copied': 'Copied to clipboard',
        'accessibility.copyButton': 'Copy to clipboard',
        'accessibility.editButton': 'Edit',
        'accessibility.regenerateButton': 'Regenerate response',
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

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello world',
    providerId: 'provider-1',
    modelId: 'model-1',
    thinkingContent: null,
    promptTokens: null,
    completionTokens: null,
    totalTokens: null,
    cachedTokens: null,
    cost: null,
    createdAt: 1704067200000,
    ...overrides,
  };
}

describe('MessageActions', () => {
  const mockOnCopy = jest.fn().mockResolvedValue(undefined);
  const mockOnRegenerate = jest.fn().mockResolvedValue(undefined);
  const mockOnEdit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders copy button for all messages', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(getByText('Copy')).toBeTruthy();
  });

  it('renders edit button only for user messages', () => {
    const userMessage = createMessage({ role: 'user' });
    const { getByText } = render(
      <MessageActions
        message={userMessage}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(getByText('Edit')).toBeTruthy();
  });

  it('does not render edit button for assistant messages', () => {
    const assistantMessage = createMessage({ role: 'assistant' });
    const { queryByText } = render(
      <MessageActions
        message={assistantMessage}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(queryByText('Edit')).toBeNull();
  });

  it('renders regenerate button only when isLastAssistant is true', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={true}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(getByText('Regenerate')).toBeTruthy();
  });

  it('does not render regenerate button when isLastAssistant is false', () => {
    const message = createMessage({ role: 'assistant' });
    const { queryByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(queryByText('Regenerate')).toBeNull();
  });

  it('calls onCopy when copy button is pressed', () => {
    const message = createMessage();
    const { getByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.press(getByText('Copy'));
    expect(mockOnCopy).toHaveBeenCalledWith(message);
  });

  it('calls onEdit when edit button is pressed on user message', () => {
    const message = createMessage({ role: 'user' });
    const { getByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.press(getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(message);
  });

  it('calls onRegenerate when regenerate button is pressed', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        isLastAssistant={true}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    fireEvent.press(getByText('Regenerate'));
    expect(mockOnRegenerate).toHaveBeenCalled();
  });

  it('has accessibility labels on all action buttons', () => {
    const message = createMessage({ role: 'user' });
    const { getByLabelText } = render(
      <MessageActions
        message={message}
        isLastAssistant={false}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onEdit={mockOnEdit}
      />
    );

    expect(getByLabelText('Copy to clipboard')).toBeTruthy();
    expect(getByLabelText('Edit')).toBeTruthy();
  });
});
