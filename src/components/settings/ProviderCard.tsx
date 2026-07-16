import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/common';
import { useTheme, Theme } from '@/theme';
import type { ProviderType } from '@/database/repositories/provider-repo';
import type { ConnectionStatus } from '@/stores/provider-store';

export interface ProviderCardProps {
  /** Provider display name */
  name: string;
  /** Provider type (openai, anthropic, custom) */
  type: ProviderType;
  /** Number of models configured for this provider */
  modelCount: number;
  /** Called when the card is pressed */
  onPress: () => void;
  /** Connection status: 'connected', 'failed', or 'untested' */
  connectionStatus?: ConnectionStatus;
  /** Short error message when connection status is 'failed' (max 80 chars) */
  connectionError?: string;
  /** Called when "Add models" prompt is tapped */
  onAddModels?: () => void;
}

/**
 * Displays a provider as a tappable card with name, type badge, model count,
 * and connection status indicator.
 * Used in the ProviderListScreen to list all configured providers.
 */
export function ProviderCard({
  name,
  type,
  modelCount,
  onPress,
  connectionStatus = 'untested',
  connectionError,
  onAddModels,
}: ProviderCardProps) {
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
            <View style={styles.nameRow}>
              <View style={[styles.statusDot, getStatusDotStyle(connectionStatus, theme)]} />
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
            </View>
            {connectionStatus === 'failed' && connectionError ? (
              <Text style={styles.errorText} numberOfLines={1}>
                {connectionError}
              </Text>
            ) : modelCount === 0 && onAddModels ? (
              <Text
                style={styles.addModelsText}
                onPress={onAddModels}
                accessibilityRole="link"
                accessibilityLabel={t('providers.addModels')}
              >
                {t('providers.addModels')}
              </Text>
            ) : (
              <Text style={styles.modelCount}>
                {modelCount} {modelCount === 1 ? 'model' : 'models'}
              </Text>
            )}
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeLabel}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function getStatusDotStyle(status: ConnectionStatus, theme: Theme): ViewStyle {
  switch (status) {
    case 'connected':
      return { backgroundColor: theme.colors.success };
    case 'failed':
      return { backgroundColor: theme.colors.error };
    case 'untested':
    default:
      return { backgroundColor: theme.colors.textTertiary };
  }
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

  const nameRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
  };

  const statusDot: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  };

  const name: TextStyle = {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  };

  const modelCount: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    marginLeft: 8 + theme.spacing.sm, // align with name (dot width + dot margin)
  };

  const errorText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.error,
    marginTop: theme.spacing.xs,
    marginLeft: 8 + theme.spacing.sm,
  };

  const addModelsText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.accent,
    marginTop: theme.spacing.xs,
    marginLeft: 8 + theme.spacing.sm,
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

  return StyleSheet.create({
    row,
    info,
    nameRow,
    statusDot,
    name,
    modelCount,
    errorText,
    addModelsText,
    badge,
    badgeText,
  });
}
