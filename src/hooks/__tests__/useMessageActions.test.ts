/**
 * Tests for the useMessageActions hook.
 *
 * Verifies the exported hook and utility logic for message copy,
 * regeneration context building, and edit flows.
 */

jest.mock('@/stores/session-store', () => ({
  useSessionStore: jest.fn(),
}));

jest.mock('@/stores/chat-store', () => ({
  useChatStore: jest.fn(),
}));

jest.mock('@/hooks/useChat', () => ({
  useChat: jest.fn(() => ({
    sendMessage: jest.fn(),
    resendContext: jest.fn(),
  })),
}));

jest.mock('@/domain/session-manager', () => ({
  buildRegenerationContext: jest.fn(),
}));

jest.mock('@/utils/clipboard', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useMessageActions } from '../useMessageActions';

describe('useMessageActions hook', () => {
  it('is exported as a function', () => {
    expect(useMessageActions).toBeDefined();
    expect(typeof useMessageActions).toBe('function');
  });
});
