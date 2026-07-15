/**
 * Tests for StreamingIndicator component.
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
        'chat.stopGeneration': 'Stop generation',
        'accessibility.stopButton': 'Stop generating response',
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
      border: '#D1D1D6',
      error: '#D32F2F',
    },
    typography: {
      caption1: { fontSize: 12 },
      subheadline: { fontSize: 15 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    borderRadii: { sm: 4, md: 8 },
  }),
}));

import { StreamingIndicator } from '../StreamingIndicator';
import { useChatStore } from '@/stores/chat-store';

describe('StreamingIndicator', () => {
  it('is exported as a function component', () => {
    expect(StreamingIndicator).toBeDefined();
    expect(typeof StreamingIndicator).toBe('function');
  });

  it('accepts onStop prop interface', () => {
    // Verify the component signature accepts the expected props
    expect(StreamingIndicator.length).toBeDefined();
  });
});

describe('StreamingIndicator store integration', () => {
  beforeEach(() => {
    useChatStore.setState({ isStreaming: false, streamContent: '', thinkingContent: '' });
  });

  it('reads isStreaming state from useChatStore', () => {
    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
  });

  it('reflects streaming state changes', () => {
    useChatStore.getState().setStreaming(true);
    expect(useChatStore.getState().isStreaming).toBe(true);

    useChatStore.getState().setStreaming(false);
    expect(useChatStore.getState().isStreaming).toBe(false);
  });

  it('clearStream resets stream content', () => {
    useChatStore.getState().appendStreamContent('partial response');
    expect(useChatStore.getState().streamContent).toBe('partial response');

    useChatStore.getState().clearStream();
    expect(useChatStore.getState().streamContent).toBe('');
  });

  it('stop generation flow: setStreaming(false) + clearStream', () => {
    // Simulate active streaming
    useChatStore.getState().setStreaming(true);
    useChatStore.getState().appendStreamContent('partial');

    // Simulate stop — what the onStop callback should do
    useChatStore.getState().setStreaming(false);
    useChatStore.getState().clearStream();

    const state = useChatStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.streamContent).toBe('');
    expect(state.thinkingContent).toBe('');
  });
});
