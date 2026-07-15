/**
 * Tests for AttachmentPicker component.
 *
 * Validates:
 * - Renders image button when model supports image input
 * - Renders file button when model supports file input
 * - Hides buttons when model doesn't support capabilities
 * - Renders nothing when neither capability is supported
 * - Buttons are disabled when disabled prop is true
 * - Accessibility labels are present
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

// Mock dependencies before imports
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
  launchCameraAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn().mockResolvedValue({ canceled: true, assets: [] }),
}));

jest.mock('expo-file-system', () => ({
  readAsStringAsync: jest.fn().mockResolvedValue('base64data'),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      text: '#000',
      textSecondary: '#666',
      textTertiary: '#999',
      background: '#fff',
      surface: '#fff',
      surfaceSecondary: '#f0f0f0',
      border: '#ddd',
      accent: '#5856D6',
      error: '#FF3B30',
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 40 },
    typography: {
      body: { fontSize: 16 },
      caption1: { fontSize: 12 },
    },
    borderRadii: { sm: 4, md: 8, lg: 12 },
  }),
}));

import { AttachmentPicker } from '../AttachmentPicker';

describe('AttachmentPicker', () => {
  const mockOnAttachmentsSelected = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders image button when supportsImageInput is true', () => {
    const { getByLabelText } = render(
      <AttachmentPicker
        supportsImageInput={true}
        supportsFileInput={false}
        onAttachmentsSelected={mockOnAttachmentsSelected}
      />
    );

    expect(getByLabelText('accessibility.attachImageButton')).toBeTruthy();
  });

  it('renders file button when supportsFileInput is true', () => {
    const { getByLabelText } = render(
      <AttachmentPicker
        supportsImageInput={false}
        supportsFileInput={true}
        onAttachmentsSelected={mockOnAttachmentsSelected}
      />
    );

    expect(getByLabelText('accessibility.attachFileButton')).toBeTruthy();
  });

  it('renders both buttons when both capabilities are supported', () => {
    const { getByLabelText } = render(
      <AttachmentPicker
        supportsImageInput={true}
        supportsFileInput={true}
        onAttachmentsSelected={mockOnAttachmentsSelected}
      />
    );

    expect(getByLabelText('accessibility.attachImageButton')).toBeTruthy();
    expect(getByLabelText('accessibility.attachFileButton')).toBeTruthy();
  });

  it('renders nothing when neither capability is supported', () => {
    const { toJSON } = render(
      <AttachmentPicker
        supportsImageInput={false}
        supportsFileInput={false}
        onAttachmentsSelected={mockOnAttachmentsSelected}
      />
    );

    expect(toJSON()).toBeNull();
  });

  it('disables buttons when disabled prop is true', () => {
    const { getByLabelText } = render(
      <AttachmentPicker
        supportsImageInput={true}
        supportsFileInput={true}
        onAttachmentsSelected={mockOnAttachmentsSelected}
        disabled={true}
      />
    );

    const imageButton = getByLabelText('accessibility.attachImageButton');
    const fileButton = getByLabelText('accessibility.attachFileButton');

    expect(imageButton.props.accessibilityState).toEqual({ disabled: true });
    expect(fileButton.props.accessibilityState).toEqual({ disabled: true });
  });
});
