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
 * - Permission denied shows alert and does not invoke callback (Req 1.4, 5.3)
 * - Cancelled picker/camera produces no callback invocation (Req 1.5, 5.4)
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

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

import * as ImagePicker from 'expo-image-picker';
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

  describe('permission denied paths', () => {
    it('library permission denied shows alert and does not invoke callback', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });

      const { getByLabelText } = render(
        <AttachmentPicker
          supportsImageInput={true}
          supportsFileInput={false}
          onAttachmentsSelected={mockOnAttachmentsSelected}
        />
      );

      // Tap image button to trigger the Alert with options
      fireEvent.press(getByLabelText('accessibility.attachImageButton'));

      // Find the "Photo Library" option from the Alert and press it
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const alertButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      const photoLibraryButton = alertButtons.find(b => b.text === 'attachments.photoLibrary');

      // Trigger the Photo Library option
      await act(async () => {
        photoLibraryButton?.onPress?.();
      });

      // Should show permission denied alert
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'attachments.permissionDenied',
          'attachments.libraryPermissionMessage'
        );
      });

      // Callback should NOT have been invoked
      expect(mockOnAttachmentsSelected).not.toHaveBeenCalled();
      expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    });

    it('camera permission denied shows alert and does not launch camera', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: false });

      const { getByLabelText } = render(
        <AttachmentPicker
          supportsImageInput={true}
          supportsFileInput={false}
          onAttachmentsSelected={mockOnAttachmentsSelected}
        />
      );

      fireEvent.press(getByLabelText('accessibility.attachImageButton'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const alertButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      const cameraButton = alertButtons.find(b => b.text === 'attachments.camera');

      await act(async () => {
        cameraButton?.onPress?.();
      });

      // Should show permission denied alert
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          'attachments.permissionDenied',
          'attachments.cameraPermissionMessage'
        );
      });

      // Camera should NOT have been launched, callback NOT invoked
      expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
      expect(mockOnAttachmentsSelected).not.toHaveBeenCalled();
    });
  });

  describe('multi-select configuration', () => {
    it('launchImageLibraryAsync is called with allowsMultipleSelection: true and selectionLimit: 10', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });

      const { getByLabelText } = render(
        <AttachmentPicker
          supportsImageInput={true}
          supportsFileInput={false}
          onAttachmentsSelected={mockOnAttachmentsSelected}
        />
      );

      fireEvent.press(getByLabelText('accessibility.attachImageButton'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const alertButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      const photoLibraryButton = alertButtons.find(b => b.text === 'attachments.photoLibrary');

      await act(async () => {
        photoLibraryButton?.onPress?.();
      });

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            allowsMultipleSelection: true,
            selectionLimit: 10,
          })
        );
      });
    });
  });

  describe('cancellation paths', () => {
    it('cancelled library picker does not invoke callback', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });

      const { getByLabelText } = render(
        <AttachmentPicker
          supportsImageInput={true}
          supportsFileInput={false}
          onAttachmentsSelected={mockOnAttachmentsSelected}
        />
      );

      fireEvent.press(getByLabelText('accessibility.attachImageButton'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const alertButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      const photoLibraryButton = alertButtons.find(b => b.text === 'attachments.photoLibrary');

      await act(async () => {
        photoLibraryButton?.onPress?.();
      });

      await waitFor(() => {
        expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled();
      });

      expect(mockOnAttachmentsSelected).not.toHaveBeenCalled();
    });

    it('cancelled camera does not invoke callback', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (ImagePicker.requestCameraPermissionsAsync as jest.Mock).mockResolvedValueOnce({ granted: true });
      (ImagePicker.launchCameraAsync as jest.Mock).mockResolvedValueOnce({ canceled: true, assets: [] });

      const { getByLabelText } = render(
        <AttachmentPicker
          supportsImageInput={true}
          supportsFileInput={false}
          onAttachmentsSelected={mockOnAttachmentsSelected}
        />
      );

      fireEvent.press(getByLabelText('accessibility.attachImageButton'));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalled();
      });

      const alertButtons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
      const cameraButton = alertButtons.find(b => b.text === 'attachments.camera');

      await act(async () => {
        cameraButton?.onPress?.();
      });

      await waitFor(() => {
        expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
      });

      expect(mockOnAttachmentsSelected).not.toHaveBeenCalled();
    });
  });
});
