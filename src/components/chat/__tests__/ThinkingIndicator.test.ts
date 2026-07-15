/**
 * Tests for ThinkingIndicator component.
 *
 * Since @testing-library/react-native is not available, we verify the
 * component is exported correctly and test the underlying store integration.
 */

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'chat.thinking': 'Thinking...',
        'chat.thinkingExpand': 'Show thinking',
        'chat.thinkingCollapse': 'Hide thinking',
        'accessibility.collapseThinking': 'Collapse thinking content',
        'accessibility.expandThinking': 'Expand thinking content',
      };
      return translations[key] ?? key;
    },
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      text: '#1C1C1E',
      textSecondary: '#636366',
      surface: '#F2F2F7',
      surfaceSecondary: '#E5E5EA',
      border: '#D1D1D6',
    },
    typography: {
      caption1: { fontSize: 12 },
      subheadline: { fontSize: 15 },
      footnote: { fontSize: 13 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    borderRadii: { sm: 4, md: 8 },
  }),
}));

import { ThinkingIndicator } from '../ThinkingIndicator';
import { useChatStore } from '@/stores/chat-store';

describe('ThinkingIndicator', () => {
  it('is exported as a function component', () => {
    expect(ThinkingIndicator).toBeDefined();
    expect(typeof ThinkingIndicator).toBe('function');
  });
});

describe('ThinkingIndicator store integration', () => {
  beforeEach(() => {
    useChatStore.setState({ isStreaming: false, streamContent: '', thinkingContent: '' });
  });

  it('reads thinkingContent from useChatStore', () => {
    expect(useChatStore.getState().thinkingContent).toBe('');
  });

  it('accumulates thinking content during streaming', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.getState().appendThinkingContent('Step 1: analyze the problem. ');
    useChatStore.getState().appendThinkingContent('Step 2: propose a solution.');

    const state = useChatStore.getState();
    expect(state.thinkingContent).toBe('Step 1: analyze the problem. Step 2: propose a solution.');
    expect(state.isStreaming).toBe(true);
  });

  it('thinking content persists after streaming completes (for expand/collapse)', () => {
    useChatStore.getState().setStreaming(true);
    useChatStore.getState().appendThinkingContent('I need to think about this...');
    useChatStore.getState().setStreaming(false);

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.thinkingContent).toBe('I need to think about this...');
  });

  it('clearStream resets thinking content', () => {
    useChatStore.getState().appendThinkingContent('Some thinking content');
    expect(useChatStore.getState().thinkingContent).toBe('Some thinking content');

    useChatStore.getState().clearStream();
    expect(useChatStore.getState().thinkingContent).toBe('');
  });

  it('streaming state transitions correctly for thinking phase', () => {
    // Start streaming
    useChatStore.getState().setStreaming(true);
    expect(useChatStore.getState().isStreaming).toBe(true);

    // Thinking phase — content arrives
    useChatStore.getState().appendThinkingContent('reasoning...');
    expect(useChatStore.getState().thinkingContent).toBe('reasoning...');

    // Text phase starts (thinking still stored)
    useChatStore.getState().appendStreamContent('Here is my answer.');
    expect(useChatStore.getState().streamContent).toBe('Here is my answer.');
    expect(useChatStore.getState().thinkingContent).toBe('reasoning...');

    // Stream completes
    useChatStore.getState().setStreaming(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
    // Thinking content remains for expand/collapse UI
    expect(useChatStore.getState().thinkingContent).toBe('reasoning...');
  });
});
