import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import i18n from 'i18next';

import { initI18n } from '@/i18n/index';
import { initDatabase } from '@/database/database';
import { ThemeProvider } from '@/theme';
import { useProviderStore } from '@/stores/provider-store';
import { useSessionStore } from '@/stores/session-store';
import { useSettingsStore } from '@/stores/settings-store';

// Initialize i18n synchronously at module load (safe to call multiple times)
try {
  if (!i18n.isInitialized) {
    initI18n();
  }
} catch (e) {
  console.warn('[RootLayout] i18n init warning:', e);
}

/**
 * Root layout component for Expo Router.
 *
 * Responsibilities:
 * - Initialize i18n (synchronous, at import time)
 * - Bootstrap the database and hydrate Zustand stores
 * - Provide SafeAreaProvider and ThemeProvider context
 * - Show a loading indicator until bootstrap completes
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const themeMode = useSettingsStore((state) => state.theme) ?? 'system';

  useEffect(() => {
    async function bootstrap() {
      try {
        const db = await initDatabase();

        useProviderStore.getState().setDatabase(db);
        useSessionStore.getState().setDatabase(db);

        await Promise.all([
          useProviderStore.getState().loadProviders(),
          useProviderStore.getState().loadModels(),
          useSessionStore.getState().loadSessions(),
          useSettingsStore.getState().loadSystemPrompts(db),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[RootLayout] Bootstrap error:', message);
        setBootError(message);
      } finally {
        setIsReady(true);
      }
    }

    bootstrap();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  if (bootError) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorText}>Boot error: {bootError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider mode={themeMode}>
        <Slot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
