import React from 'react';
import { View, FlatList, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useTheme, Theme } from '@/theme';
import { Button } from '@/components/common';
import { ProviderCard } from '@/components/settings/ProviderCard';
import { useProviderStore } from '@/stores/provider-store';
import type { SettingsStackParamList } from '@/navigation/types';
import type { Provider } from '@/database/repositories/provider-repo';

type NavigationProp = StackNavigationProp<SettingsStackParamList, 'ProviderList'>;

/**
 * Screen displaying all configured providers.
 * Allows navigating to provider detail for editing, or adding a new provider.
 */
export function ProviderListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const providers = useProviderStore((state) => state.providers);
  const models = useProviderStore((state) => state.models);
  const connectionStatuses = useProviderStore((state) => state.connectionStatuses);
  const styles = createStyles(theme);

  function getModelCount(providerId: string): number {
    return models.filter((m) => m.providerId === providerId).length;
  }

  function handleProviderPress(providerId: string) {
    navigation.navigate('ProviderDetail', { providerId });
  }

  function handleAddProvider() {
    navigation.navigate('ProviderDetail', {});
  }

  function handleAddModels(providerId: string) {
    navigation.navigate('ProviderDetail', { providerId });
  }

  function renderItem({ item }: { item: Provider }) {
    const connectionState = connectionStatuses[item.id];
    return (
      <View style={styles.cardWrapper}>
        <ProviderCard
          name={item.name}
          type={item.type}
          modelCount={getModelCount(item.id)}
          onPress={() => handleProviderPress(item.id)}
          connectionStatus={connectionState?.status ?? 'untested'}
          connectionError={connectionState?.error}
          onAddModels={() => handleAddModels(item.id)}
        />
      </View>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('providers.empty')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={providers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.listContent}
      />
      <View style={styles.footer}>
        <Button
          title={t('providers.add')}
          onPress={handleAddProvider}
          accessibilityLabel={t('providers.add')}
        />
      </View>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
  };

  const listContent: ViewStyle = {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.huge,
  };

  const cardWrapper: ViewStyle = {
    marginBottom: theme.spacing.md,
  };

  const emptyContainer: ViewStyle = {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.massive,
  };

  const emptyText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
  };

  const footer: ViewStyle = {
    padding: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  };

  return StyleSheet.create({
    container,
    listContent,
    cardWrapper,
    emptyContainer,
    emptyText,
    footer,
  });
}
