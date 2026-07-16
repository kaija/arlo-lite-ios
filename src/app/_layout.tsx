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
import { useChatStore } from '@/stores/chat-store';

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

        // Auto-create a session if none exist and a provider+model are configured
        const sessions = useSessionStore.getState().sessions;
        const providers = useProviderStore.getState().providers;
        const models = useProviderStore.getState().models;

        if (sessions.length === 0 && providers.length > 0 && models.length > 0) {
          // No sessions — auto-create one with the first available provider/model
          const defaultProvider = providers[0];
          const defaultModel = models.find(
            (m) => m.providerId === defaultProvider.id
          );
          if (defaultModel) {
            const sessionId = await useSessionStore
              .getState()
              .createSession(defaultProvider.id, defaultModel.modelId);
            await useSessionStore.getState().setActiveSession(sessionId);
            useChatStore.getState().switchModel(defaultProvider.id, defaultModel.modelId);
          }
        } else if (sessions.length > 0) {
          // Existing sessions — activate the most recent one
          const mostRecent = sessions[0]; // sessions are sorted by updatedAt desc
          await useSessionStore.getState().setActiveSession(mostRecent.id);
          if (mostRecent.providerId && mostRecent.modelId) {
            useChatStore.getState().switchModel(mostRecent.providerId, mostRecent.modelId);
          } else if (providers.length > 0 && models.length > 0) {
            // Session has no model — use the first available
            const defaultProvider = providers[0];
            const defaultModel = models.find(
              (m) => m.providerId === defaultProvider.id
            );
            if (defaultModel) {
              useChatStore.getState().switchModel(defaultProvider.id, defaultModel.modelId);
            }
          }
        }
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
