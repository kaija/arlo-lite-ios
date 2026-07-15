import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ThinkingLevelSelector } from '../ThinkingLevelSelector';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'thinkingLevel.title': 'Thinking Level',
        'thinkingLevel.off': 'Off',
        'thinkingLevel.minimal': 'Minimal',
        'thinkingLevel.low': 'Low',
        'thinkingLevel.medium': 'Medium',
        'thinkingLevel.high': 'High',
        'thinkingLevel.xhigh': 'Extra High',
      };
      return translations[key] ?? key;
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
    },
    typography: {
      caption1: { fontSize: 12 },
    },
    spacing: { xs: 4, sm: 8, md: 12 },
    borderRadii: { full: 9999 },
    isDark: false,
  }),
}));

describe('ThinkingLevelSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useChatStore.setState({
      activeProviderId: null,
      activeModelId: null,
      thinkingLevel: 'off',
    });
    useProviderStore.setState({
      providers: [],
      models: [],
    });
  });

  it('renders nothing when no model is active', () => {
    const { toJSON } = render(<ThinkingLevelSelector />);
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when active model does not support reasoning', () => {
    useProviderStore.setState({
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputPrice: 5, outputPrice: 15, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: false, supportsImageInput: true, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeModelId: 'm1' });

    const { toJSON } = render(<ThinkingLevelSelector />);
    expect(toJSON()).toBeNull();
  });

  it('renders all thinking level options when model supports reasoning', () => {
    useProviderStore.setState({
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'o1', displayName: 'o1', contextWindow: 128000, inputPrice: 15, outputPrice: 60, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: true, supportsImageInput: false, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeModelId: 'm1', thinkingLevel: 'off' });

    const { getByText } = render(<ThinkingLevelSelector />);
    expect(getByText('Off')).toBeTruthy();
    expect(getByText('Minimal')).toBeTruthy();
    expect(getByText('Low')).toBeTruthy();
    expect(getByText('Medium')).toBeTruthy();
    expect(getByText('High')).toBeTruthy();
    expect(getByText('Extra High')).toBeTruthy();
  });

  it('calls setThinkingLevel when a level is tapped', () => {
    useProviderStore.setState({
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'o1', displayName: 'o1', contextWindow: 128000, inputPrice: 15, outputPrice: 60, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: true, supportsImageInput: false, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeModelId: 'm1', thinkingLevel: 'off' });

    const { getByText } = render(<ThinkingLevelSelector />);
    fireEvent.press(getByText('High'));

    const state = useChatStore.getState();
    expect(state.thinkingLevel).toBe('high');
  });

  it('has radiogroup accessibility role on container', () => {
    useProviderStore.setState({
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'o1', displayName: 'o1', contextWindow: 128000, inputPrice: 15, outputPrice: 60, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: true, supportsImageInput: false, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeModelId: 'm1', thinkingLevel: 'medium' });

    const { getByLabelText } = render(<ThinkingLevelSelector />);
    const container = getByLabelText('Thinking Level');
    expect(container.props.accessibilityRole).toBe('radiogroup');
  });

  it('marks the active level as checked in accessibility state', () => {
    useProviderStore.setState({
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'o1', displayName: 'o1', contextWindow: 128000, inputPrice: 15, outputPrice: 60, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: true, supportsImageInput: false, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeModelId: 'm1', thinkingLevel: 'medium' });

    const { getByLabelText } = render(<ThinkingLevelSelector />);
    const mediumButton = getByLabelText('Medium');
    expect(mediumButton.props.accessibilityState).toEqual({ checked: true });

    const offButton = getByLabelText('Off');
    expect(offButton.props.accessibilityState).toEqual({ checked: false });
  });
});
