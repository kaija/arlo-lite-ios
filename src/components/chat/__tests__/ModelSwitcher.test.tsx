import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ModelSwitcher } from '../ModelSwitcher';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore } from '@/stores/provider-store';

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        'modelSwitcher.title': 'Switch Model',
        'modelSwitcher.noModel': 'No model selected',
        'models.empty': 'No models added',
        'accessibility.modelSwitcherButton': 'Switch model',
        'accessibility.modelItem': `Model: ${params?.name ?? ''}`,
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
      textTertiary: '#8E8E93',
      background: '#FFFFFF',
      surface: '#F2F2F7',
      border: '#D1D1D6',
      overlay: 'rgba(0, 0, 0, 0.4)',
    },
    typography: {
      caption1: { fontSize: 12 },
      body: { fontSize: 17 },
      title3: { fontSize: 20 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20 },
    borderRadii: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
    isDark: false,
  }),
}));

describe('ModelSwitcher', () => {
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

  it('renders "No model selected" when no model is active', () => {
    const { getByText } = render(<ModelSwitcher />);
    expect(getByText('No model selected')).toBeTruthy();
  });

  it('displays the active model display name on the chip', () => {
    useProviderStore.setState({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiMode: 'responses', generationParams: { temperature: 0.7, maxTokens: 4096 }, streamingEnabled: true, createdAt: 1000, updatedAt: 1000 },
      ],
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputPrice: 5, outputPrice: 15, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: false, supportsImageInput: true, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeProviderId: 'p1', activeModelId: 'm1' });

    const { getByText } = render(<ModelSwitcher />);
    expect(getByText('GPT-4o')).toBeTruthy();
  });

  it('opens modal when chip is pressed', () => {
    useProviderStore.setState({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiMode: 'responses', generationParams: { temperature: 0.7, maxTokens: 4096 }, streamingEnabled: true, createdAt: 1000, updatedAt: 1000 },
      ],
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputPrice: 5, outputPrice: 15, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: false, supportsImageInput: true, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeProviderId: 'p1', activeModelId: 'm1' });

    const { getByText, getByLabelText } = render(<ModelSwitcher />);
    fireEvent.press(getByLabelText('Switch model'));
    // Modal should show provider group header and model title
    expect(getByText('Switch Model')).toBeTruthy();
    expect(getByText('OpenAI')).toBeTruthy();
  });

  it('calls switchModel when a model is selected from the list', () => {
    useProviderStore.setState({
      providers: [
        { id: 'p1', type: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', apiMode: 'responses', generationParams: { temperature: 0.7, maxTokens: 4096 }, streamingEnabled: true, createdAt: 1000, updatedAt: 1000 },
      ],
      models: [
        { id: 'm1', providerId: 'p1', modelId: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputPrice: 5, outputPrice: 15, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: false, supportsImageInput: true, supportsImageGeneration: false, supportsFileInput: false },
        { id: 'm2', providerId: 'p1', modelId: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, inputPrice: 0.15, outputPrice: 0.6, cachedInputPrice: null, cachedOutputPrice: null, supportsReasoning: false, supportsImageInput: true, supportsImageGeneration: false, supportsFileInput: false },
      ],
    });
    useChatStore.setState({ activeProviderId: 'p1', activeModelId: 'm1' });

    const { getByLabelText, getByText } = render(<ModelSwitcher />);
    // Open modal
    fireEvent.press(getByLabelText('Switch model'));
    // Select a different model
    fireEvent.press(getByText('GPT-4o Mini'));

    // Verify store was updated
    const state = useChatStore.getState();
    expect(state.activeProviderId).toBe('p1');
    expect(state.activeModelId).toBe('m2');
  });

  it('has correct accessibility role on the chip', () => {
    const { getByLabelText } = render(<ModelSwitcher />);
    const chip = getByLabelText('Switch model');
    expect(chip.props.accessibilityRole).toBe('button');
  });
});
