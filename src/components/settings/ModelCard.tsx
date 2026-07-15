import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/common';
import { useTheme, Theme } from '@/theme';
import type { ModelConfig } from '@/stores/provider-store';

export interface ModelCardProps {
  /** The model configuration to display */
  model: ModelConfig;
  /** Called when the card is pressed */
  onPress: () => void;
}

/**
 * Displays a model as a tappable card with display name, model ID,
 * and capability badges. Used in the ModelDetailScreen model list.
 */
export function ModelCard({ model, onPress }: ModelCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const capabilities = getCapabilities(model, t);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={t('accessibility.modelItem', { name: model.displayName })}
      accessibilityRole="button"
    >
      <Card>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.displayName} numberOfLines={1}>
              {model.displayName}
            </Text>
            <Text style={styles.modelId} numberOfLines={1}>
              {model.modelId}
            </Text>
          </View>
        </View>
        {capabilities.length > 0 && (
          <View style={styles.badges}>
            {capabilities.map((cap) => (
              <View key={cap} style={styles.badge}>
                <Text style={styles.badgeText}>{cap}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );
}

function getCapabilities(
  model: ModelConfig,
  t: (key: string) => string,
): string[] {
  const caps: string[] = [];
  if (model.supportsReasoning) caps.push(t('models.supportsReasoning'));
  if (model.supportsImageInput) caps.push(t('models.supportsImages'));
  if (model.supportsFileInput) caps.push(t('models.supportsFiles'));
  if (model.supportsImageGeneration) caps.push(t('models.supportsImageGen'));
  return caps;
}

function createStyles(theme: Theme) {
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const info: ViewStyle = {
    flex: 1,
  };

  const displayName: TextStyle = {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  };

  const modelId: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  };

  const badges: ViewStyle = {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.sm,
  };

  const badge: ViewStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(88, 86, 214, 0.2)'
      : 'rgba(88, 86, 214, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadii.sm,
    marginRight: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  };

  const badgeText: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '500',
    color: theme.colors.accent,
    fontSize: 11,
  };

  return StyleSheet.create({
    row,
    info,
    displayName,
    modelId,
    badges,
    badge,
    badgeText,
  });
}
