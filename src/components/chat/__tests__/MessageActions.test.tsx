/**
 * Tests for the MessageActions component.
 *
 * Verifies that the correct action buttons are rendered based on message role.
 * - Assistant messages: Copy, Regenerate, Delete
 * - User messages: Copy, Delete
 * - No Edit button for any role
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
        'chat.regenerate': 'Regenerate',
        'chat.delete': 'Delete',
        'chat.copied': 'Copied to clipboard',
        'accessibility.copyButton': 'Copy to clipboard',
        'accessibility.regenerateButton': 'Regenerate response',
        'accessibility.deleteButton': 'Delete message',
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
  const mockOnDelete = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders copy button for all messages', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(getByText('Copy')).toBeTruthy();
  });

  it('renders regenerate button for all assistant messages', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(getByText('Regenerate')).toBeTruthy();
  });

  it('does not render regenerate button for user messages', () => {
    const message = createMessage({ role: 'user' });
    const { queryByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(queryByText('Regenerate')).toBeNull();
  });

  it('renders delete button for all messages', () => {
    const message = createMessage({ role: 'user' });
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(getByText('Delete')).toBeTruthy();
  });

  it('does not render any edit button', () => {
    const userMessage = createMessage({ role: 'user' });
    const { queryByText } = render(
      <MessageActions
        message={userMessage}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(queryByText('Edit')).toBeNull();
  });

  it('calls onCopy when copy button is pressed', () => {
    const message = createMessage();
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.press(getByText('Copy'));
    expect(mockOnCopy).toHaveBeenCalledWith(message);
  });

  it('calls onRegenerate when regenerate button is pressed', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.press(getByText('Regenerate'));
    expect(mockOnRegenerate).toHaveBeenCalled();
  });

  it('calls onDelete when delete button is pressed', () => {
    const message = createMessage({ role: 'user' });
    const { getByText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    fireEvent.press(getByText('Delete'));
    expect(mockOnDelete).toHaveBeenCalled();
  });

  it('has accessibility labels on all action buttons for assistant messages', () => {
    const message = createMessage({ role: 'assistant' });
    const { getByLabelText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(getByLabelText('Copy to clipboard')).toBeTruthy();
    expect(getByLabelText('Regenerate response')).toBeTruthy();
    expect(getByLabelText('Delete message')).toBeTruthy();
  });

  it('has accessibility labels on all action buttons for user messages', () => {
    const message = createMessage({ role: 'user' });
    const { getByLabelText } = render(
      <MessageActions
        message={message}
        onCopy={mockOnCopy}
        onRegenerate={mockOnRegenerate}
        onDelete={mockOnDelete}
      />
    );

    expect(getByLabelText('Copy to clipboard')).toBeTruthy();
    expect(getByLabelText('Delete message')).toBeTruthy();
  });
});
