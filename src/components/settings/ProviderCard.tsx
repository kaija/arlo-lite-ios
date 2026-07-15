import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/common';
import { useTheme, Theme } from '@/theme';
import type { ProviderType } from '@/database/repositories/provider-repo';

export interface ProviderCardProps {
  /** Provider display name */
  name: string;
  /** Provider type (openai, anthropic, custom) */
  type: ProviderType;
  /** Number of models configured for this provider */
  modelCount: number;
  /** Called when the card is pressed */
  onPress: () => void;
}

/**
 * Displays a provider as a tappable card with name, type badge, and model count.
 * Used in the ProviderListScreen to list all configured providers.
 */
export function ProviderCard({ name, type, modelCount, onPress }: ProviderCardProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const typeLabel = getTypeLabel(type, t);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={t('accessibility.providerItem', { name, type: typeLabel })}
      accessibilityRole="button"
    >
      <Card>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.modelCount}>
              {modelCount} {modelCount === 1 ? 'model' : 'models'}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeLabel}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function getTypeLabel(type: ProviderType, t: (key: string) => string): string {
  switch (type) {
    case 'openai':
      return t('providers.typeOpenAI');
    case 'anthropic':
      return t('providers.typeAnthropic');
    case 'custom':
      return t('providers.typeCustom');
    default:
      return type;
  }
}

function createStyles(theme: Theme) {
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const info: ViewStyle = {
    flex: 1,
    marginRight: theme.spacing.md,
  };

  const name: TextStyle = {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
  };

  const modelCount: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  };

  const badge: ViewStyle = {
    backgroundColor: theme.isDark ? 'rgba(88, 86, 214, 0.2)' : 'rgba(88, 86, 214, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadii.sm,
  };

  const badgeText: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '600',
    color: theme.colors.accent,
  };

  return StyleSheet.create({ row, info, name, modelCount, badge, badgeText });
}
