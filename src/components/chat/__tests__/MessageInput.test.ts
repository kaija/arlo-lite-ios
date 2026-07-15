/**
 * Tests for MessageInput component.
 *
 * Since @testing-library/react-native is not available, we test the
 * component export and verify the interface contract.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#F2F2F7',
      surfaceSecondary: '#E5E5EA',
      text: '#1C1C1E',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      accent: '#5856D6',
      border: '#D1D1D6',
      error: '#D32F2F',
    },
    typography: {
      body: { fontSize: 17, lineHeight: 22 },
      caption1: { fontSize: 12, lineHeight: 16 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    borderRadii: { sm: 4, md: 8 },
    isDark: false,
  }),
}));

jest.mock('@/hooks/useNetwork', () => ({
  useNetwork: () => ({
    isConnected: true,
    isInternetReachable: true,
  }),
}));

jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: {
    requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
    start: jest.fn(),
    stop: jest.fn(),
    abort: jest.fn(),
  },
  useSpeechRecognitionEvent: jest.fn(),
}));

import { MessageInput } from '../MessageInput';

describe('MessageInput', () => {
  it('is exported as a function component', () => {
    expect(MessageInput).toBeDefined();
    expect(typeof MessageInput).toBe('function');
  });
});
