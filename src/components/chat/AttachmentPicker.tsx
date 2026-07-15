/**
 * AttachmentPicker component for selecting images and files to attach to messages.
 *
 * Features:
 * - Image picker (photo library + camera) when model supports image input
 * - File picker when model supports file input
 * - Encodes images as base64 data URLs for ContentPart[]
 * - Only shows buttons for capabilities the active model supports
 * - Full accessibility labels and i18n support
 *
 * Requirements: 13.1, 13.2
 */

import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import type { ContentPart } from '@/providers/types';

export interface AttachmentPickerProps {
  /** Whether the active model supports image input */
  supportsImageInput: boolean;
  /** Whether the active model supports file input */
  supportsFileInput: boolean;
  /** Called when attachments are selected */
  onAttachmentsSelected: (parts: ContentPart[]) => void;
  /** Whether the picker is disabled (offline, streaming, etc.) */
  disabled?: boolean;
}

/**
 * Attachment picker showing image and file buttons based on model capabilities.
 * Images are encoded to base64 data URLs and returned as ContentPart[].
 */
export function AttachmentPicker({
  supportsImageInput,
  supportsFileInput,
  onAttachmentsSelected,
  disabled = false,
}: AttachmentPickerProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  /**
   * Launch image picker with choice between library and camera.
   */
  const handleImagePress = useCallback(async () => {
    Alert.alert(
      t('attachments.imagePickerTitle'),
      undefined,
      [
        {
          text: t('attachments.photoLibrary'),
          onPress: () => pickImageFromLibrary(),
        },
        {
          text: t('attachments.camera'),
          onPress: () => pickImageFromCamera(),
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  }, [t]);

  /**
   * Pick an image from the photo library and encode as base64.
   */
  const pickImageFromLibrary = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('attachments.permissionDenied'),
        t('attachments.libraryPermissionMessage')
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const contentParts = await assetToContentParts(asset);
      if (contentParts.length > 0) {
        onAttachmentsSelected(contentParts);
      }
    }
  }, [onAttachmentsSelected]);

  /**
   * Pick an image from the camera and encode as base64.
   */
  const pickImageFromCamera = useCallback(async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t('attachments.permissionDenied'),
        t('attachments.cameraPermissionMessage')
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const contentParts = await assetToContentParts(asset);
      if (contentParts.length > 0) {
        onAttachmentsSelected(contentParts);
      }
    }
  }, [onAttachmentsSelected, t]);

  /**
   * Launch document picker for file selection.
   */
  const handleFilePress = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      // Read file as base64
      try {
        const base64Content = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const mimeType = asset.mimeType || 'application/octet-stream';
        const dataUrl = `data:${mimeType};base64,${base64Content}`;

        // For image files, send as image_url content part
        if (mimeType.startsWith('image/')) {
          const parts: ContentPart[] = [
            { type: 'image_url', image_url: { url: dataUrl } },
          ];
          onAttachmentsSelected(parts);
        } else {
          // For non-image files, include as text with file info
          const parts: ContentPart[] = [
            { type: 'text', text: `[File: ${asset.name}]\n${base64Content.substring(0, 1000)}...` },
          ];
          onAttachmentsSelected(parts);
        }
      } catch {
        Alert.alert(
          t('attachments.errorTitle'),
          t('attachments.errorReading')
        );
      }
    }
  }, [onAttachmentsSelected, t]);

  // Don't render if model doesn't support any attachments
  if (!supportsImageInput && !supportsFileInput) {
    return null;
  }

  return (
    <View style={styles.container}>
      {supportsImageInput && (
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleImagePress}
          disabled={disabled}
          accessibilityLabel={t('accessibility.attachImageButton')}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          activeOpacity={0.6}
        >
          <Text style={[styles.buttonIcon, disabled && styles.buttonIconDisabled]}>
            img
          </Text>
        </TouchableOpacity>
      )}

      {supportsFileInput && (
        <TouchableOpacity
          style={[styles.button, disabled && styles.buttonDisabled]}
          onPress={handleFilePress}
          disabled={disabled}
          accessibilityLabel={t('accessibility.attachFileButton')}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
          activeOpacity={0.6}
        >
          <Text style={[styles.buttonIcon, disabled && styles.buttonIconDisabled]}>
            +
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/**
 * Convert an ImagePicker asset to ContentPart[] with base64 encoding.
 */
async function assetToContentParts(
  asset: ImagePicker.ImagePickerAsset
): Promise<ContentPart[]> {
  let base64Data = asset.base64;

  // If base64 not available directly, read from URI
  if (!base64Data && asset.uri) {
    try {
      base64Data = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      return [];
    }
  }

  if (!base64Data) return [];

  // Determine MIME type from the asset
  const mimeType = asset.mimeType || 'image/jpeg';
  const dataUrl = `data:${mimeType};base64,${base64Data}`;

  return [
    { type: 'image_url', image_url: { url: dataUrl } },
  ];
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  };

  const button: ViewStyle = {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadii.sm,
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const buttonDisabled: ViewStyle = {
    opacity: 0.4,
  };

  const buttonIcon: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  };

  const buttonIconDisabled: TextStyle = {
    opacity: 0.4,
  };

  return StyleSheet.create({
    container,
    button,
    buttonDisabled,
    buttonIcon,
    buttonIconDisabled,
  });
}
