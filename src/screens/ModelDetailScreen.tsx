import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  ScrollView,
  FlatList,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StackScreenProps } from '@react-navigation/stack';
import * as SQLite from 'expo-sqlite';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { useProviderStore } from '@/stores/provider-store';
import type { CreateModelData, ModelConfig } from '@/stores/provider-store';
import { getApiKey } from '@/database/secure-store';
import { getModelMetadata } from '@/services/metadata-service';
import { getProvider } from '@/providers/registry';
import { ProviderError } from '@/providers/errors';
import type { SettingsStackParamList } from '@/navigation/types';
import type { ProviderConfig } from '@/providers/types';
import { ModelCard } from '@/components/settings/ModelCard';

type Props = StackScreenProps<SettingsStackParamList, 'ModelDetail'>;

/**
 * ModelDetailScreen shows models for a given provider and allows
 * adding new models (from API list or manual entry), editing, and deletion.
 */
export function ModelDetailScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { providerId } = route.params;

  // Store state
  const providers = useProviderStore((s) => s.providers);
  const models = useProviderStore((s) => s.models);
  const addModel = useProviderStore((s) => s.addModel);
  const deleteModel = useProviderStore((s) => s.deleteModel);

  const provider = useMemo(
    () => providers.find((p) => p.id === providerId),
    [providerId, providers],
  );

  const providerModels = useMemo(
    () => models.filter((m) => m.providerId === providerId),
    [models, providerId],
  );

  // Modal state
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [apiModelList, setApiModelList] = useState<string[]>([]);
  const [showApiList, setShowApiList] = useState(false);

  // SDK model listing state (auto-fetched on modal open)
  const [sdkModelList, setSdkModelList] = useState<string[]>([]);
  const [sdkModelsLoading, setSdkModelsLoading] = useState(false);
  const [sdkModelsFromCache, setSdkModelsFromCache] = useState(false);
  const [sdkModelsError, setSdkModelsError] = useState<string | null>(null);
  const [sdkModelsAuthError, setSdkModelsAuthError] = useState(false);
  const [sdkModelsFetched, setSdkModelsFetched] = useState(false);

  // Manual model ID validation
  const [modelIdError, setModelIdError] = useState<string | null>(null);

  // Form state
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [contextWindow, setContextWindow] = useState('');
  const [inputPrice, setInputPrice] = useState('');
  const [outputPrice, setOutputPrice] = useState('');
  const [cachedInputPrice, setCachedInputPrice] = useState('');
  const [cachedOutputPrice, setCachedOutputPrice] = useState('');
  const [supportsReasoning, setSupportsReasoning] = useState(false);
  const [supportsImageInput, setSupportsImageInput] = useState(false);
  const [supportsImageGeneration, setSupportsImageGeneration] = useState(false);
  const [supportsFileInput, setSupportsFileInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: t('models.title'),
    });
  }, [navigation, t]);

  /**
   * Ensures the models_cache table exists in SQLite.
   * Uses IF NOT EXISTS to be safe for repeated calls.
   */
  const ensureModelsCacheTable = useCallback(async (db: SQLite.SQLiteDatabase) => {
    await db.runAsync(
      `CREATE TABLE IF NOT EXISTS models_cache (
        provider_id TEXT PRIMARY KEY,
        model_ids TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      )`
    );
  }, []);

  /**
   * Caches a model list to SQLite for offline fallback.
   */
  const cacheModelList = useCallback(async (providerIdVal: string, modelIds: string[]) => {
    try {
      const db = await SQLite.openDatabaseAsync('arlo-lite.db');
      await ensureModelsCacheTable(db);
      await db.runAsync(
        `INSERT OR REPLACE INTO models_cache (provider_id, model_ids, fetched_at) VALUES (?, ?, ?)`,
        providerIdVal,
        JSON.stringify(modelIds),
        Date.now()
      );
    } catch {
      // Cache write failure is non-critical
    }
  }, [ensureModelsCacheTable]);

  /**
   * Loads cached model list from SQLite.
   */
  const loadCachedModelList = useCallback(async (providerIdVal: string): Promise<string[] | null> => {
    try {
      const db = await SQLite.openDatabaseAsync('arlo-lite.db');
      await ensureModelsCacheTable(db);
      const row = await db.getFirstAsync<{ model_ids: string; fetched_at: number }>(
        'SELECT model_ids, fetched_at FROM models_cache WHERE provider_id = ?',
        providerIdVal
      );
      if (row) {
        return JSON.parse(row.model_ids) as string[];
      }
      return null;
    } catch {
      return null;
    }
  }, [ensureModelsCacheTable]);

  /**
   * Fetch models from the provider API on modal open.
   * Handles caching, auth errors, and fallback to cache on network failure.
   */
  const fetchSdkModels = useCallback(async () => {
    if (!provider) return;

    setSdkModelsLoading(true);
    setSdkModelsError(null);
    setSdkModelsAuthError(false);
    setSdkModelsFromCache(false);
    setSdkModelsFetched(false);

    try {
      const apiKey = await getApiKey(provider.id);
      if (!apiKey) {
        setSdkModelsAuthError(true);
        setSdkModelsError(t('errors.invalidApiKey'));
        setSdkModelsLoading(false);
        setSdkModelsFetched(true);
        return;
      }

      const providerAdapter = getProvider(provider.type);
      const providerConfig: ProviderConfig = {
        id: provider.id,
        type: provider.type,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiMode: provider.apiMode ?? undefined,
        streamingEnabled: provider.streamingEnabled,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };

      const modelIds = await providerAdapter.listModels(providerConfig, apiKey);

      // Cache the successful result
      await cacheModelList(provider.id, modelIds);

      setSdkModelList(modelIds);
      setSdkModelsFromCache(false);
    } catch (error) {
      // Auth error: show error, do NOT fall back to cache
      if (error instanceof ProviderError && error.category === 'authentication') {
        setSdkModelsAuthError(true);
        setSdkModelsError(error.message || t('errors.invalidApiKey'));
        setSdkModelList([]);
      } else {
        // Network/other error: fall back to cache
        const cached = await loadCachedModelList(provider.id);
        if (cached && cached.length > 0) {
          setSdkModelList(cached);
          setSdkModelsFromCache(true);
        } else {
          setSdkModelList([]);
          setSdkModelsError(
            error instanceof Error ? error.message : t('errors.network')
          );
        }
      }
    } finally {
      setSdkModelsLoading(false);
      setSdkModelsFetched(true);
    }
  }, [provider, t, cacheModelList, loadCachedModelList]);

  // Reset form state
  const resetForm = useCallback(() => {
    setModelId('');
    setDisplayName('');
    setContextWindow('');
    setInputPrice('');
    setOutputPrice('');
    setCachedInputPrice('');
    setCachedOutputPrice('');
    setSupportsReasoning(false);
    setSupportsImageInput(false);
    setSupportsImageGeneration(false);
    setSupportsFileInput(false);
    setShowApiList(false);
    setApiModelList([]);
    setModelIdError(null);
    // Reset SDK model list state
    setSdkModelList([]);
    setSdkModelsLoading(false);
    setSdkModelsFromCache(false);
    setSdkModelsError(null);
    setSdkModelsAuthError(false);
    setSdkModelsFetched(false);
  }, []);

  // Open the add model modal and auto-fetch SDK models
  const handleOpenModal = useCallback(() => {
    resetForm();
    setIsModalVisible(true);
    // Trigger SDK model fetching when modal opens
    fetchSdkModels();
  }, [resetForm, fetchSdkModels]);

  // Close the add model modal
  const handleCloseModal = useCallback(() => {
    setIsModalVisible(false);
    resetForm();
  }, [resetForm]);

  // Show the API model list (already fetched by SDK)
  const handleSelectFromApi = useCallback(() => {
    if (sdkModelList.length > 0) {
      setApiModelList(sdkModelList);
      setShowApiList(true);
    }
  }, [sdkModelList]);

  // When a model is selected from the API list, prefill metadata
  const handleApiModelSelect = useCallback(
    async (selectedModelId: string) => {
      setModelId(selectedModelId);
      setDisplayName(selectedModelId);
      setShowApiList(false);

      // Prefill from metadata service
      await prefillMetadata(selectedModelId);
    },
    [],
  );

  // Prefill metadata from the local metadata cache
  const prefillMetadata = useCallback(async (id: string) => {
    try {
      const db = await SQLite.openDatabaseAsync('arlo-lite.db');
      const metadata = await getModelMetadata(db, id);

      if (metadata) {
        if (metadata.contextWindow != null) {
          setContextWindow(String(metadata.contextWindow));
        }
        if (metadata.inputPrice != null) {
          setInputPrice(String(metadata.inputPrice));
        }
        if (metadata.outputPrice != null) {
          setOutputPrice(String(metadata.outputPrice));
        }
        if (metadata.cachedInputPrice != null) {
          setCachedInputPrice(String(metadata.cachedInputPrice));
        }
        if (metadata.cachedOutputPrice != null) {
          setCachedOutputPrice(String(metadata.cachedOutputPrice));
        }
        setSupportsReasoning(metadata.supportsReasoning);
      }
    } catch {
      // Metadata lookup failed — fields stay blank for user input
    }
  }, []);

  // Handle manual model ID entry — validate and prefill on blur
  const handleModelIdBlur = useCallback(() => {
    const trimmed = modelId.trim();
    if (trimmed) {
      // Validate model ID length (1-256 characters)
      if (trimmed.length > 256) {
        setModelIdError(t('models.modelIdTooLong', { defaultValue: 'Model ID must be 256 characters or fewer' }));
      } else {
        setModelIdError(null);
      }
      if (!displayName.trim()) {
        setDisplayName(trimmed);
      }
      prefillMetadata(trimmed);
    } else {
      setModelIdError(null);
    }
  }, [modelId, displayName, prefillMetadata, t]);

  // Validate model ID on change
  const handleModelIdChange = useCallback((text: string) => {
    setModelId(text);
    const trimmed = text.trim();
    if (trimmed.length > 256) {
      setModelIdError(t('models.modelIdTooLong', { defaultValue: 'Model ID must be 256 characters or fewer' }));
    } else {
      setModelIdError(null);
    }
  }, [t]);

  // Validate API key before saving the first model
  const validateApiKeyIfNeeded = useCallback(async (): Promise<boolean> => {
    if (!provider) return false;

    // Only validate on the first model added to this provider
    if (providerModels.length > 0) return true;

    setIsValidating(true);
    try {
      const apiKey = await getApiKey(provider.id);
      if (!apiKey) {
        Alert.alert(t('errors.invalidApiKey'));
        return false;
      }

      const providerAdapter = getProvider(provider.type);
      const providerConfig: ProviderConfig = {
        id: provider.id,
        type: provider.type,
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiMode: provider.apiMode ?? undefined,
        streamingEnabled: provider.streamingEnabled,
        createdAt: provider.createdAt,
        updatedAt: provider.updatedAt,
      };

      const isValid = await providerAdapter.validateApiKey(providerConfig, apiKey);

      if (!isValid) {
        Alert.alert(t('providers.validationFailed'));
        return false;
      }

      return true;
    } catch (error) {
      Alert.alert(
        t('providers.validationFailed'),
        error instanceof Error ? error.message : String(error),
      );
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [provider, providerModels.length, t]);

  // Form validation
  const isFormValid = useMemo(() => {
    const trimmed = modelId.trim();
    return trimmed.length >= 1 && trimmed.length <= 256;
  }, [modelId]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!isFormValid || isSaving || !provider) return;

    setIsSaving(true);
    try {
      // Validate API key on first model
      const keyValid = await validateApiKeyIfNeeded();
      if (!keyValid) {
        setIsSaving(false);
        return;
      }

      const data: CreateModelData = {
        providerId: provider.id,
        modelId: modelId.trim(),
        displayName: displayName.trim() || modelId.trim(),
        contextWindow: contextWindow ? Number(contextWindow) : null,
        inputPrice: inputPrice ? Number(inputPrice) : null,
        outputPrice: outputPrice ? Number(outputPrice) : null,
        cachedInputPrice: cachedInputPrice ? Number(cachedInputPrice) : null,
        cachedOutputPrice: cachedOutputPrice ? Number(cachedOutputPrice) : null,
        supportsReasoning,
        supportsImageInput,
        supportsImageGeneration,
        supportsFileInput,
      };

      await addModel(data);
      handleCloseModal();
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
    provider,
    modelId,
    displayName,
    contextWindow,
    inputPrice,
    outputPrice,
    cachedInputPrice,
    cachedOutputPrice,
    supportsReasoning,
    supportsImageInput,
    supportsImageGeneration,
    supportsFileInput,
    addModel,
    handleCloseModal,
    validateApiKeyIfNeeded,
    t,
  ]);

  // Delete a model
  const handleDeleteModel = useCallback(
    (model: ModelConfig) => {
      Alert.alert(t('models.deleteTitle'), t('models.deleteConfirm'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteModel(model.id);
          },
        },
      ]);
    },
    [deleteModel, t],
  );

  // Render a model item
  const renderModelItem = useCallback(
    ({ item }: { item: ModelConfig }) => (
      <View style={styles.modelCardWrapper}>
        <ModelCard model={item} onPress={() => handleDeleteModel(item)} />
      </View>
    ),
    [styles.modelCardWrapper, handleDeleteModel],
  );

  // Render an API model option
  const renderApiModelItem = useCallback(
    ({ item }: { item: string }) => (
      <TouchableOpacity
        style={styles.apiModelItem}
        onPress={() => handleApiModelSelect(item)}
        accessibilityLabel={t('accessibility.modelItem', { name: item })}
        accessibilityRole="button"
      >
        <Text style={styles.apiModelText}>{item}</Text>
      </TouchableOpacity>
    ),
    [styles.apiModelItem, styles.apiModelText, handleApiModelSelect, t],
  );

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{t('errors.unknown')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Model List */}
      <FlatList
        data={providerModels}
        keyExtractor={(item) => item.id}
        renderItem={renderModelItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('models.empty')}</Text>
        }
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.addButton}
            onPress={handleOpenModal}
            accessibilityLabel={t('models.add')}
            accessibilityRole="button"
          >
            <Text style={styles.addButtonText}>{t('models.add')}</Text>
          </TouchableOpacity>
        }
      />

      {/* Add Model Modal */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={handleCloseModal}
              accessibilityLabel={t('common.cancel')}
              accessibilityRole="button"
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('models.add')}</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>

          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* SDK Models Loading State */}
            {sdkModelsLoading && !modelId.trim() && !showApiList && (
              <View style={styles.sdkLoadingContainer}>
                <ActivityIndicator size="small" color={theme.colors.accent} />
                <Text style={styles.sdkLoadingText}>{t('common.loading')}</Text>
              </View>
            )}

            {/* SDK Models Auth Error */}
            {sdkModelsAuthError && !modelId.trim() && !showApiList && (
              <View style={styles.sdkErrorContainer}>
                <Text style={styles.sdkErrorText}>{sdkModelsError || t('errors.invalidApiKey')}</Text>
              </View>
            )}

            {/* SDK Models Network Error with no cache (empty state) */}
            {sdkModelsFetched && !sdkModelsLoading && !sdkModelsAuthError && sdkModelList.length === 0 && sdkModelsError && !modelId.trim() && !showApiList && (
              <View style={styles.sdkEmptyContainer}>
                <Text style={styles.sdkEmptyText}>
                  {t('models.noModelsAvailable', { defaultValue: 'No models available. Enter a model ID manually.' })}
                </Text>
              </View>
            )}

            {/* SDK Models Empty result with no cache */}
            {sdkModelsFetched && !sdkModelsLoading && !sdkModelsAuthError && !sdkModelsError && sdkModelList.length === 0 && !modelId.trim() && !showApiList && (
              <View style={styles.sdkEmptyContainer}>
                <Text style={styles.sdkEmptyText}>
                  {t('models.noModelsAvailable', { defaultValue: 'No models available. Enter a model ID manually.' })}
                </Text>
              </View>
            )}

            {/* Model Selection — API model list available */}
            {!showApiList && !modelId.trim() && sdkModelsFetched && !sdkModelsLoading && !sdkModelsAuthError && sdkModelList.length > 0 && (
              <View style={styles.section}>
                {/* From cache indicator */}
                {sdkModelsFromCache && (
                  <View style={styles.cacheIndicatorContainer}>
                    <Text style={styles.cacheIndicatorText}>
                      {t('models.fromCache', { defaultValue: 'Loaded from cache' })}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.selectionButton}
                  onPress={handleSelectFromApi}
                  accessibilityLabel={t('models.selectFromList')}
                  accessibilityRole="button"
                >
                  <Text style={styles.selectionButtonText}>
                    {t('models.selectFromList')} ({sdkModelList.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Manual model ID entry — always shown unless API list or form is active */}
            {!showApiList && !modelId.trim() && (
              <View style={styles.section}>
                {sdkModelsFetched && !sdkModelsLoading && sdkModelList.length > 0 && (
                  <Text style={styles.orDivider}>— {t('models.manualEntry')} —</Text>
                )}

                <TextInput
                  style={[styles.input, modelIdError ? styles.inputError : undefined]}
                  value={modelId}
                  onChangeText={handleModelIdChange}
                  onBlur={handleModelIdBlur}
                  placeholder={t('models.modelIdPlaceholder')}
                  placeholderTextColor={theme.colors.textTertiary}
                  accessibilityLabel={t('models.modelId')}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {modelIdError && (
                  <Text style={styles.validationError}>{modelIdError}</Text>
                )}
              </View>
            )}

            {/* API Model List */}
            {showApiList && (
              <View style={styles.section}>
                <Text style={styles.label}>{t('models.selectFromList')}</Text>
                <FlatList
                  data={apiModelList}
                  keyExtractor={(item) => item}
                  renderItem={renderApiModelItem}
                  scrollEnabled={false}
                  style={styles.apiModelList}
                />
                <TouchableOpacity
                  style={styles.backToManual}
                  onPress={() => setShowApiList(false)}
                  accessibilityLabel={t('models.manualEntry')}
                  accessibilityRole="button"
                >
                  <Text style={styles.backToManualText}>
                    {t('models.manualEntry')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Model Form (visible once model ID is set) */}
            {modelId.trim().length > 0 && !showApiList && (
              <>
                {/* Model ID (editable) */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.modelId')}</Text>
                  <TextInput
                    style={[styles.input, modelIdError ? styles.inputError : undefined]}
                    value={modelId}
                    onChangeText={handleModelIdChange}
                    onBlur={handleModelIdBlur}
                    placeholder={t('models.modelIdPlaceholder')}
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.modelId')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {modelIdError && (
                    <Text style={styles.validationError}>{modelIdError}</Text>
                  )}
                </View>

                {/* Context Window */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.contextWindow')}</Text>
                  <TextInput
                    style={styles.input}
                    value={contextWindow}
                    onChangeText={setContextWindow}
                    placeholder="128000"
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.contextWindow')}
                    keyboardType="numeric"
                  />
                </View>

                {/* Input Price */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.inputPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={inputPrice}
                    onChangeText={setInputPrice}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.inputPrice')}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Output Price */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.outputPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={outputPrice}
                    onChangeText={setOutputPrice}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.outputPrice')}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Cached Input Price */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.cachedInputPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={cachedInputPrice}
                    onChangeText={setCachedInputPrice}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.cachedInputPrice')}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Cached Output Price */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('models.cachedOutputPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={cachedOutputPrice}
                    onChangeText={setCachedOutputPrice}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textTertiary}
                    accessibilityLabel={t('models.cachedOutputPrice')}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Capability Toggles */}
                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('models.supportsReasoning')}</Text>
                  <Switch
                    value={supportsReasoning}
                    onValueChange={setSupportsReasoning}
                    trackColor={{
                      false: theme.colors.surfaceSecondary,
                      true: theme.colors.accent,
                    }}
                    accessibilityLabel={t('models.supportsReasoning')}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('models.supportsImages')}</Text>
                  <Switch
                    value={supportsImageInput}
                    onValueChange={setSupportsImageInput}
                    trackColor={{
                      false: theme.colors.surfaceSecondary,
                      true: theme.colors.accent,
                    }}
                    accessibilityLabel={t('models.supportsImages')}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('models.supportsFiles')}</Text>
                  <Switch
                    value={supportsFileInput}
                    onValueChange={setSupportsFileInput}
                    trackColor={{
                      false: theme.colors.surfaceSecondary,
                      true: theme.colors.accent,
                    }}
                    accessibilityLabel={t('models.supportsFiles')}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.label}>{t('models.supportsImageGen')}</Text>
                  <Switch
                    value={supportsImageGeneration}
                    onValueChange={setSupportsImageGeneration}
                    trackColor={{
                      false: theme.colors.surfaceSecondary,
                      true: theme.colors.accent,
                    }}
                    accessibilityLabel={t('models.supportsImageGen')}
                  />
                </View>

                {/* Validation indicator */}
                {isValidating && (
                  <View style={styles.validatingRow}>
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                    <Text style={styles.validatingText}>
                      {t('providers.validating')}
                    </Text>
                  </View>
                )}

                {/* Save Button */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    (!isFormValid || isSaving || isValidating) &&
                      styles.saveButtonDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!isFormValid || isSaving || isValidating}
                  accessibilityLabel={t('models.save')}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !isFormValid || isSaving || isValidating,
                  }}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? t('common.loading') : t('models.save')}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    listContent: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.massive,
    },
    modelCardWrapper: {
      marginBottom: theme.spacing.md,
    },
    emptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      marginTop: theme.spacing.xl,
    },
    addButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    addButtonText: {
      ...theme.typography.body,
      color: theme.colors.accentText,
      fontWeight: '600',
    },

    // Modal styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    modalCancelText: {
      ...theme.typography.body,
      color: theme.colors.accent,
    },
    modalTitle: {
      ...theme.typography.body,
      fontWeight: '600',
      color: theme.colors.text,
    },
    modalHeaderSpacer: {
      width: 60,
    },
    modalScroll: {
      flex: 1,
    },
    modalContent: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.massive,
    },

    // Form styles
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
    selectionButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.accent,
    },
    selectionButtonText: {
      ...theme.typography.body,
      color: theme.colors.accent,
      fontWeight: '600',
    },
    orDivider: {
      ...theme.typography.caption1,
      color: theme.colors.textTertiary,
      textAlign: 'center',
      marginVertical: theme.spacing.lg,
    },
    apiModelList: {
      maxHeight: 300,
    },
    apiModelItem: {
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    apiModelText: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    backToManual: {
      marginTop: theme.spacing.md,
      alignItems: 'center',
    },
    backToManualText: {
      ...theme.typography.body,
      color: theme.colors.accent,
    },
    switchRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    validatingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.lg,
    },
    validatingText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
    saveButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      ...theme.typography.body,
      color: theme.colors.accentText,
      fontWeight: '600',
    },

    // SDK model listing styles
    sdkLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing.xl,
    },
    sdkLoadingText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginLeft: theme.spacing.sm,
    },
    sdkErrorContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.sm,
      padding: theme.spacing.lg,
      marginBottom: theme.spacing.xl,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    sdkErrorText: {
      ...theme.typography.body,
      color: theme.colors.error,
      textAlign: 'center',
    },
    sdkEmptyContainer: {
      paddingVertical: theme.spacing.xl,
      marginBottom: theme.spacing.lg,
    },
    sdkEmptyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    cacheIndicatorContainer: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      marginBottom: theme.spacing.md,
      alignItems: 'center',
    },
    cacheIndicatorText: {
      ...theme.typography.caption1,
      color: theme.colors.textTertiary,
      fontStyle: 'italic',
    },
    inputError: {
      borderColor: theme.colors.error,
    },
    validationError: {
      ...theme.typography.caption1,
      color: theme.colors.error,
      marginTop: theme.spacing.sm,
    },
  });
}
