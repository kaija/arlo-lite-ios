import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { useChatStore } from '@/stores/chat-store';
import { useProviderStore, ModelConfig } from '@/stores/provider-store';
import type { Provider } from '@/database/repositories/provider-repo';

interface ModelGroup {
  provider: Provider;
  models: ModelConfig[];
}

/**
 * Chip/pill button that shows the current model name.
 * Tapping opens a bottom-sheet-style modal listing all models grouped by provider.
 * Selecting a model calls chatStore.switchModel() and records the switch in session metadata.
 */
export function ModelSwitcher() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [modalVisible, setModalVisible] = useState(false);

  const { activeProviderId, activeModelId, switchModel } = useChatStore();
  const { providers, models } = useProviderStore();

  // Find the currently active model for display
  const activeModel = useMemo(
    () => models.find((m) => m.id === activeModelId || m.modelId === activeModelId),
    [models, activeModelId],
  );

  // Group models by provider
  const modelGroups: ModelGroup[] = useMemo(() => {
    return providers
      .map((provider) => ({
        provider,
        models: models.filter((m) => m.providerId === provider.id),
      }))
      .filter((group) => group.models.length > 0);
  }, [providers, models]);

  const handleSelectModel = useCallback(
    (providerId: string, modelId: string) => {
      switchModel(providerId, modelId);
      setModalVisible(false);
    },
    [switchModel],
  );

  const chipLabel = activeModel?.displayName ?? t('modelSwitcher.noModel');

  return (
    <>
      <TouchableOpacity
        style={styles.chip}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
        accessibilityLabel={t('accessibility.modelSwitcherButton')}
        accessibilityRole="button"
        accessibilityHint={t('modelSwitcher.title')}
      >
        <Text style={styles.chipText} numberOfLines={1}>
          {chipLabel}
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.sheet} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('modelSwitcher.title')}</Text>

            <FlatList
              data={modelGroups}
              keyExtractor={(item) => item.provider.id}
              renderItem={({ item: group }) => (
                <View style={styles.group}>
                  <Text style={styles.groupHeader}>{group.provider.name}</Text>
                  {group.models.map((model) => {
                    const isActive =
                      model.providerId === activeProviderId &&
                      (model.id === activeModelId || model.modelId === activeModelId);

                    return (
                      <TouchableOpacity
                        key={model.id}
                        style={[styles.modelRow, isActive && styles.modelRowActive]}
                        onPress={() => handleSelectModel(model.providerId, model.id)}
                        activeOpacity={0.7}
                        accessibilityLabel={t('accessibility.modelItem', {
                          name: model.displayName,
                        })}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                      >
                        <View style={styles.modelInfo}>
                          <Text
                            style={[styles.modelName, isActive && styles.modelNameActive]}
                            numberOfLines={1}
                          >
                            {model.displayName}
                          </Text>
                          <Text style={styles.modelId} numberOfLines={1}>
                            {model.modelId}
                          </Text>
                        </View>
                        {isActive && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>{t('models.empty')}</Text>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function createStyles(theme: Theme) {
  const chip: ViewStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(88, 86, 214, 0.2)'
      : 'rgba(88, 86, 214, 0.1)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadii.full,
    alignSelf: 'center',
  };

  const chipText: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '600',
    color: theme.colors.accent,
    maxWidth: 160,
  };

  const overlay: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  };

  const sheet: ViewStyle = {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadii.xl,
    borderTopRightRadius: theme.borderRadii.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    maxHeight: '70%',
  };

  const handle: ViewStyle = {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: theme.colors.border,
    alignSelf: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  };

  const sheetTitle: TextStyle = {
    ...theme.typography.title3,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  };

  const group: ViewStyle = {
    marginBottom: theme.spacing.md,
  };

  const groupHeader: TextStyle = {
    ...theme.typography.caption1,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  };

  const modelRow: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadii.md,
  };

  const modelRowActive: ViewStyle = {
    backgroundColor: theme.isDark
      ? 'rgba(88, 86, 214, 0.15)'
      : 'rgba(88, 86, 214, 0.08)',
  };

  const modelInfo: ViewStyle = {
    flex: 1,
  };

  const modelName: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
  };

  const modelNameActive: TextStyle = {
    color: theme.colors.accent,
    fontWeight: '600',
  };

  const modelId: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    marginTop: 2,
  };

  const checkmark: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '700',
    marginLeft: theme.spacing.sm,
  };

  const emptyText: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  };

  return StyleSheet.create({
    chip,
    chipText,
    overlay,
    sheet,
    handle,
    sheetTitle,
    group,
    groupHeader,
    modelRow,
    modelRowActive,
    modelInfo,
    modelName,
    modelNameActive,
    modelId,
    checkmark,
    emptyText,
  });
}
