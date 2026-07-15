import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StackScreenProps } from '@react-navigation/stack';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { useProviderStore } from '@/stores/provider-store';
import { getApiKey, storeApiKey } from '@/database/secure-store';
import { DEFAULT_PROVIDER_URLS } from '@/constants/defaults';
import type { SettingsStackParamList } from '@/navigation/types';
import type {
  ProviderType,
  OpenAIApiMode,
} from '@/database/repositories/provider-repo';

type Props = StackScreenProps<SettingsStackParamList, 'ProviderDetail'>;

const PROVIDER_TYPES: ProviderType[] = ['openai', 'anthropic', 'custom'];
const API_MODES: OpenAIApiMode[] = ['responses', 'chat-completions'];

/**
 * ProviderDetailScreen handles both creating a new provider
 * (when route params have no providerId) and editing an existing one.
 */
export function ProviderDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const providerId = route.params?.providerId;
  const isEditMode = !!providerId;

  // Store actions
  const providers = useProviderStore((s) => s.providers);
  const addProvider = useProviderStore((s) => s.addProvider);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const deleteProvider = useProviderStore((s) => s.deleteProvider);

  // Find existing provider for edit mode
  const existingProvider = useMemo(
    () => (providerId ? providers.find((p) => p.id === providerId) : undefined),
    [providerId, providers],
  );

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_PROVIDER_URLS.openai);
  const [apiMode, setApiMode] = useState<OpenAIApiMode>('responses');
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing provider data in edit mode
  useEffect(() => {
    if (existingProvider) {
      setName(existingProvider.name);
      setType(existingProvider.type);
      setBaseUrl(existingProvider.baseUrl);
      setApiMode(existingProvider.apiMode ?? 'responses');
      setStreamingEnabled(existingProvider.streamingEnabled);

      // Load the masked API key from secure store
      getApiKey(existingProvider.id).then((key) => {
        if (key) {
          setApiKey(key);
        }
      });
    }
  }, [existingProvider]);

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: isEditMode ? t('providers.edit') : t('providers.add'),
    });
  }, [isEditMode, navigation, t]);

  // Handle provider type change (create mode only)
  const handleTypeChange = useCallback(
    (newType: ProviderType) => {
      setType(newType);
      // Set default base URL based on type
      if (newType === 'openai') {
        setBaseUrl(DEFAULT_PROVIDER_URLS.openai);
      } else if (newType === 'anthropic') {
        setBaseUrl(DEFAULT_PROVIDER_URLS.anthropic);
      } else {
        setBaseUrl('');
      }
    },
    [],
  );

  // Validate form
  const isFormValid = useMemo(() => {
    if (!name.trim()) return false;
    if (!apiKey.trim()) return false;
    if (!baseUrl.trim()) return false;
    return true;
  }, [name, apiKey, baseUrl]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isFormValid || isSaving) return;

    setIsSaving(true);
    try {
      if (isEditMode && providerId) {
        // Update existing provider
        await updateProvider(providerId, {
          name: name.trim(),
          baseUrl: baseUrl.trim(),
          apiMode: type === 'openai' ? apiMode : undefined,
          streamingEnabled,
        });
        // Update API key in secure store
        await storeApiKey(providerId, apiKey.trim());
      } else {
        // Create new provider
        await addProvider(
          {
            type,
            name: name.trim(),
            baseUrl: baseUrl.trim(),
            apiMode: type === 'openai' ? apiMode : undefined,
            streamingEnabled,
          },
          apiKey.trim(),
        );
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        t('errors.unknown'),
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    isFormValid,
    isSaving,
    isEditMode,
    providerId,
    name,
    type,
    apiKey,
    baseUrl,
    apiMode,
    streamingEnabled,
    addProvider,
    updateProvider,
    navigation,
    t,
  ]);

  // Delete handler (edit mode only)
  const handleDelete = useCallback(() => {
    if (!providerId) return;

    Alert.alert(
      t('providers.deleteTitle'),
      t('providers.deleteConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteProvider(providerId);
            navigation.goBack();
          },
        },
      ],
    );
  }, [providerId, deleteProvider, navigation, t]);

  // Navigate to model management
  const handleManageModels = useCallback(() => {
    if (providerId) {
      navigation.navigate('ModelDetail', { providerId });
    }
  }, [providerId, navigation]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Provider Type */}
      <View style={styles.section}>
        <Text style={styles.label} accessibilityRole="text">
          {t('providers.type')}
        </Text>
        {isEditMode ? (
          <View style={styles.typeDisplay}>
            <Text style={styles.typeDisplayText} accessibilityLabel={t('providers.type')}>
              {t(`providers.type${capitalize(type)}`)}
            </Text>
          </View>
        ) : (
          <View style={styles.segmentedControl} accessibilityRole="radiogroup" accessibilityLabel={t('providers.type')}>
            {PROVIDER_TYPES.map((pt) => (
              <TouchableOpacity
                key={pt}
                style={[
                  styles.segment,
                  type === pt && styles.segmentActive,
                ]}
                onPress={() => handleTypeChange(pt)}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === pt }}
                accessibilityLabel={t(`providers.type${capitalize(pt)}`)}
              >
                <Text
                  style={[
                    styles.segmentText,
                    type === pt && styles.segmentTextActive,
                  ]}
                >
                  {t(`providers.type${capitalize(pt)}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Display Name */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('providers.name')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('providers.namePlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('providers.name')}
          autoCapitalize="words"
          autoCorrect={false}
        />
      </View>

      {/* API Key */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('providers.apiKey')}</Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder={t('providers.apiKeyPlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('providers.apiKey')}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Base URL */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('providers.baseUrl')}</Text>
        <TextInput
          style={styles.input}
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder={t('providers.baseUrlPlaceholder')}
          placeholderTextColor={theme.colors.textTertiary}
          accessibilityLabel={t('providers.baseUrl')}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* API Mode (OpenAI only) */}
      {type === 'openai' && (
        <View style={styles.section}>
          <Text style={styles.label}>{t('providers.apiMode')}</Text>
          <View style={styles.segmentedControl} accessibilityRole="radiogroup" accessibilityLabel={t('providers.apiMode')}>
            {API_MODES.map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.segment,
                  apiMode === mode && styles.segmentActive,
                ]}
                onPress={() => setApiMode(mode)}
                accessibilityRole="radio"
                accessibilityState={{ selected: apiMode === mode }}
                accessibilityLabel={
                  mode === 'responses'
                    ? t('providers.apiModeResponses')
                    : t('providers.apiModeChatCompletions')
                }
              >
                <Text
                  style={[
                    styles.segmentText,
                    apiMode === mode && styles.segmentTextActive,
                  ]}
                >
                  {mode === 'responses'
                    ? t('providers.apiModeResponses')
                    : t('providers.apiModeChatCompletions')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Streaming Toggle */}
      <View style={styles.switchRow}>
        <Text style={styles.label}>{t('providers.streaming')}</Text>
        <Switch
          value={streamingEnabled}
          onValueChange={setStreamingEnabled}
          trackColor={{
            false: theme.colors.surfaceSecondary,
            true: theme.colors.accent,
          }}
          accessibilityLabel={t('providers.streaming')}
        />
      </View>

      {/* Manage Models (edit mode only) */}
      {isEditMode && (
        <TouchableOpacity
          style={styles.manageModelsButton}
          onPress={handleManageModels}
          accessibilityLabel={t('navigation.models')}
          accessibilityRole="button"
        >
          <Text style={styles.manageModelsText}>
            {t('navigation.models')}
          </Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
      )}

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (!isFormValid || isSaving) && styles.saveButtonDisabled,
        ]}
        onPress={handleSave}
        disabled={!isFormValid || isSaving}
        accessibilityLabel={t('providers.save')}
        accessibilityRole="button"
        accessibilityState={{ disabled: !isFormValid || isSaving }}
      >
        <Text style={styles.saveButtonText}>
          {isSaving ? t('common.loading') : t('providers.save')}
        </Text>
      </TouchableOpacity>

      {/* Delete Button (edit mode only) */}
      {isEditMode && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          accessibilityLabel={t('providers.delete')}
          accessibilityRole="button"
        >
          <Text style={styles.deleteButtonText}>{t('providers.delete')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

/** Capitalize first letter for translation key lookup */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.massive,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      fontWeight: '500',
    },
    input: {
      ...theme.typography.body,
      backgroundColor: theme.colors.inputBackground,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      color: theme.colors.text,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    segmentedControl: {
      flexDirection: 'row',
      borderRadius: theme.borderRadii.sm,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: 'hidden',
    },
    segment: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.inputBackground,
    },
    segmentActive: {
      backgroundColor: theme.colors.accent,
    },
    segmentText: {
      ...theme.typography.body,
      color: theme.colors.text,
      fontSize: 14,
    },
    segmentTextActive: {
      color: theme.colors.accentText,
      fontWeight: '600',
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    typeDisplay: {
      backgroundColor: theme.colors.surfaceSecondary,
      borderRadius: theme.borderRadii.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    typeDisplayText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    manageModelsButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
    },
    manageModelsText: {
      ...theme.typography.body,
      color: theme.colors.accent,
      fontWeight: '500',
    },
    chevron: {
      ...theme.typography.body,
      color: theme.colors.textTertiary,
      fontSize: 20,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      ...theme.typography.body,
      color: theme.colors.accentText,
      fontWeight: '600',
    },
    deleteButton: {
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    deleteButtonText: {
      ...theme.typography.body,
      color: theme.colors.error,
      fontWeight: '600',
    },
  });
}
