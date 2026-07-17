/**
 * Tests for the useMessageActions hook.
 *
 * Verifies the exported hook returns the expected interface with
 * copyMessage, regenerateFrom, and deleteMessage methods.
 */

jest.mock('@/stores/session-store', () => ({
  useSessionStore: jest.fn((selector: any) => {
    const state = {
      activeSessionId: 'session-1',
      messages: {},
      deleteMessage: jest.fn(),
    };
    return selector(state);
  }),
}));

jest.mock('@/hooks/useChat', () => ({
  useChat: jest.fn(() => ({
    regenerateFrom: jest.fn(),
  })),
}));

jest.mock('@/utils/clipboard', () => ({
  copyToClipboard: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/components/overlays/ToastProvider', () => ({
  useToast: () => ({ show: jest.fn() }),
}));

import { renderHook } from '@testing-library/react-native';
import { useMessageActions } from '../useMessageActions';

describe('useMessageActions hook', () => {
  it('is exported as a function', () => {
    expect(useMessageActions).toBeDefined();
    expect(typeof useMessageActions).toBe('function');
  });

  it('returns copyMessage, regenerateFrom, and deleteMessage', () => {
    const { result } = renderHook(() => useMessageActions());

    expect(result.current.copyMessage).toBeDefined();
    expect(typeof result.current.copyMessage).toBe('function');

    expect(result.current.regenerateFrom).toBeDefined();
    expect(typeof result.current.regenerateFrom).toBe('function');

    expect(result.current.deleteMessage).toBeDefined();
    expect(typeof result.current.deleteMessage).toBe('function');
  });

  it('does not expose editMessage or isLastAssistantMessage', () => {
    const { result } = renderHook(() => useMessageActions());

    expect((result.current as any).editMessage).toBeUndefined();
    expect((result.current as any).isLastAssistantMessage).toBeUndefined();
    expect((result.current as any).regenerate).toBeUndefined();
  });
});
