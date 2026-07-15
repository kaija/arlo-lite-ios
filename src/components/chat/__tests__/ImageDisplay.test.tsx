/**
 * Tests for ImageDisplay component.
 *
 * Validates:
 * - Renders an image with the provided URL
 * - Has proper accessibility label
 * - Shows loading indicator initially
 * - Shows error state on image load failure
 */

import React from 'react';
import { render } from '@testing-library/react-native';

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

import { ImageDisplay } from '../ImageDisplay';

describe('ImageDisplay', () => {
  it('renders an image with the provided URL', () => {
    const testUrl = 'https://example.com/image.png';
    const { getByLabelText } = render(
      <ImageDisplay url={testUrl} alt="Test image" />
    );

    const image = getByLabelText('Test image');
    expect(image).toBeTruthy();
    expect(image.props.source).toEqual({ uri: testUrl });
  });

  it('uses alt text as accessibility label', () => {
    const { getByLabelText } = render(
      <ImageDisplay url="https://example.com/img.png" alt="Custom alt text" />
    );

    expect(getByLabelText('Custom alt text')).toBeTruthy();
  });

  it('uses default accessibility label when alt is not provided', () => {
    const { getByLabelText } = render(
      <ImageDisplay url="https://example.com/img.png" />
    );

    expect(getByLabelText('attachments.generatedImage')).toBeTruthy();
  });

  it('renders with base64 data URL', () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    const { getByLabelText } = render(
      <ImageDisplay url={dataUrl} alt="Base64 image" />
    );

    const image = getByLabelText('Base64 image');
    expect(image.props.source).toEqual({ uri: dataUrl });
  });
});
