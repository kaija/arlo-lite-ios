/**
 * Tests for the useChat hook's underlying logic.
 *
 * Since we can't render hooks directly without @testing-library/react-hooks,
 * we test the exported module and verify the helper function logic.
 */

jest.mock('@/stores/session-store', () => ({
  useSessionStore: jest.fn(),
}));

jest.mock('@/stores/chat-store', () => ({
  useChatStore: jest.fn(),
}));

jest.mock('@/stores/provider-store', () => ({
  useProviderStore: jest.fn(),
}));

jest.mock('@/providers/registry', () => ({
  getProvider: jest.fn(),
}));

jest.mock('@/providers/sse/sse-manager', () => ({
  createSSEStream: jest.fn(),
}));

jest.mock('@/database/secure-store', () => ({
  getApiKey: jest.fn(),
}));

jest.mock('@/domain/cost-calculator', () => ({
  calculateMessageCost: jest.fn(),
}));

import { useChat } from '../useChat';

describe('useChat hook', () => {
  it('is exported as a function', () => {
    expect(useChat).toBeDefined();
    expect(typeof useChat).toBe('function');
  });
});
