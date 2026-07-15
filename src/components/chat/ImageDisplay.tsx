/**
 * ImageDisplay component for rendering images inline in chat messages.
 *
 * Displays base64 data URL or HTTP URL images with appropriate sizing.
 * Used for:
 * - Generated images from models that support image generation
 * - Image previews in user messages with attachments
 *
 * Requirements: 13.4
 */

import React, { useState } from 'react';
import {
  View,
  Image,
  StyleSheet,
  ViewStyle,
  ImageStyle,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';

export interface ImageDisplayProps {
  /** The image URL (base64 data URL or HTTP URL) */
  url: string;
  /** Optional alt text for accessibility */
  alt?: string;
  /** Optional maximum width (defaults to 80% of screen width) */
  maxWidth?: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const DEFAULT_MAX_WIDTH = SCREEN_WIDTH * 0.8;
const DEFAULT_ASPECT_RATIO = 1; // square fallback

/**
 * Renders an image inline in the chat with loading state and proper sizing.
 * Supports both base64 data URLs and HTTP/HTTPS URLs.
 */
export function ImageDisplay({
  url,
  alt,
  maxWidth = DEFAULT_MAX_WIDTH,
}: ImageDisplayProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme, maxWidth);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  const handleLoad = () => {
    setLoading(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  // Calculate display dimensions maintaining aspect ratio
  const displayWidth = dimensions
    ? Math.min(dimensions.width, maxWidth)
    : maxWidth;
  const displayHeight = dimensions
    ? (displayWidth / dimensions.width) * dimensions.height
    : maxWidth * DEFAULT_ASPECT_RATIO;

  if (error) {
    return (
      <View
        style={styles.errorContainer}
        accessibilityLabel={t('attachments.imageLoadError')}
      >
        <View style={styles.errorPlaceholder} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      )}
      <Image
        source={{ uri: url }}
        style={[
          styles.image,
          dimensions ? { width: displayWidth, height: displayHeight } : null,
        ]}
        resizeMode="contain"
        onLoad={(event) => {
          const { width, height } = event.nativeEvent.source;
          setDimensions({ width, height });
          handleLoad();
        }}
        onError={handleError}
        accessibilityLabel={alt || t('attachments.generatedImage')}
        accessibilityRole="image"
      />
    </View>
  );
}

function createStyles(theme: Theme, maxWidth: number) {
  const container: ViewStyle = {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadii.md,
    overflow: 'hidden',
    maxWidth,
  };

  const image: ImageStyle = {
    width: maxWidth,
    height: maxWidth,
    borderRadius: theme.borderRadii.md,
  };

  const loadingOverlay: ViewStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    zIndex: 1,
    minHeight: 100,
    minWidth: 100,
  };

  const errorContainer: ViewStyle = {
    marginVertical: theme.spacing.sm,
    borderRadius: theme.borderRadii.md,
    overflow: 'hidden',
  };

  const errorPlaceholder: ViewStyle = {
    width: 100,
    height: 100,
    backgroundColor: theme.colors.surfaceSecondary,
    borderRadius: theme.borderRadii.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
  };

  return StyleSheet.create({
    container,
    image,
    loadingOverlay,
    errorContainer,
    errorPlaceholder,
  });
}
