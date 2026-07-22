/**
 * BraveSearchSettings — Configuration UI for the Brave Search tool.
 *
 * Provides:
 * - Toggle to enable/disable Brave Search
 * - Secure text input for API key
 * - Save/Clear buttons for key management
 * - Calls syncBraveSearchTool() on any state change
 *
 * Requirements: 8.1–8.8
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import { useSettingsStore } from '@/stores/settings-store';
import { buildServiceKey } from '@/database/secure-store';
import { syncBraveSearchTool } from '@/services/tools/brave-search';

const SERVICE_KEY = buildServiceKey('brave_search');

export function BraveSearchSettings() {
  const { colors, borderRadii } = useTheme();
  const { t } = useTranslation();

  const braveSearchEnabled = useSettingsStore((s) => s.braveSearchEnabled);
  const setBraveSearchEnabled = useSettingsStore((s) => s.setBraveSearchEnabled);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasStoredKey, setHasStoredKey] = useState(false);

  // Check if a key already exists on mount
  useEffect(() => {
    SecureStore.getItemAsync(SERVICE_KEY).then((key) => {
      setHasStoredKey(!!key);
    });
  }, []);

  const handleToggle = useCallback(async (value: boolean) => {
    setBraveSearchEnabled(value);
    await syncBraveSearchTool();
  }, [setBraveSearchEnabled]);

  const handleSave = useCallback(async () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;

    await SecureStore.setItemAsync(SERVICE_KEY, trimmed);
    setHasStoredKey(true);
    setApiKeyInput('');
    // Auto-enable when key is saved — the tool should be ready immediately
    if (!useSettingsStore.getState().braveSearchEnabled) {
      setBraveSearchEnabled(true);
    }
    await syncBraveSearchTool();
  }, [apiKeyInput, setBraveSearchEnabled]);

  const handleClear = useCallback(async () => {
    await SecureStore.deleteItemAsync(SERVICE_KEY);
    setHasStoredKey(false);
    setApiKeyInput('');
    await syncBraveSearchTool();
  }, []);

  return (
    <View style={styles.container}>
      {/* Enable toggle */}
      <View
        style={[
          styles.groupedList,
          { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList },
        ]}
      >
        <View style={styles.toggleRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.braveSearch.enable')}
          </Text>
          <Switch
            value={braveSearchEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: colors.border, true: colors.accent }}
            accessibilityLabel={t('settings.braveSearch.enable')}
          />
        </View>
      </View>

      {/* API Key section */}
      <View
        style={[
          styles.groupedList,
          { backgroundColor: colors.surface, borderRadius: borderRadii.groupedList, marginTop: 24 },
        ]}
      >
        <View style={styles.keySection}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t('settings.braveSearch.apiKey')}
          </Text>

          {hasStoredKey && (
            <Text style={[styles.keyStatus, { color: colors.textTertiary }]}>
              {t('settings.braveSearch.keyStored')}
            </Text>
          )}

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder={t('settings.braveSearch.apiKeyPlaceholder')}
            placeholderTextColor={colors.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t('settings.braveSearch.apiKey')}
          />

          <View style={styles.buttonRow}>
            <Pressable
              style={[styles.button, { backgroundColor: colors.accent }, !apiKeyInput.trim() && { opacity: 0.5 }]}
              onPress={handleSave}
              disabled={!apiKeyInput.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('settings.braveSearch.save')}
            >
              <Text style={[styles.buttonText, { color: colors.accentText }]}>
                {t('settings.braveSearch.save')}
              </Text>
            </Pressable>

            {hasStoredKey && (
              <Pressable
                style={[styles.button, styles.clearButton, { borderColor: colors.border }]}
                onPress={handleClear}
                accessibilityRole="button"
                accessibilityLabel={t('settings.braveSearch.clear')}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>
                  {t('settings.braveSearch.clear')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  groupedList: {
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
  },
  label: {
    fontSize: 15,
    fontWeight: '400',
  },
  keySection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  keyStatus: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 4,
  },
  input: {
    fontSize: 15,
    fontWeight: '400',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
