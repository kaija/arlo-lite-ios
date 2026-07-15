import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { ThemeProvider } from '@/theme/index';
import { initI18n } from '@/i18n/index';
import { initDatabase } from '@/database/database';
import { useSettingsStore } from '@/stores/settings-store';
import { useProviderStore } from '@/stores/provider-store';
import { useSessionStore } from '@/stores/session-store';

/**
 * Root layout component that initializes all app-level services:
 * - i18n (internationalization)
 * - SQLite database
 * - Zustand store hydration (providers, sessions, system prompts)
 *
 * Wraps the entire app in ThemeProvider and NavigationContainer.
 * Shows a loading screen until all initialization is complete.
 */
export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings store for theme mode
  const themeMode = useSettingsStore((s) => s.theme);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        // 1. Initialize i18n
        initI18n();

        // 2. Initialize the database
        const db = await initDatabase();

        if (!mounted) return;

        // 3. Set database on stores
        useProviderStore.getState().setDatabase(db);
        useSessionStore.getState().setDatabase(db);

        // 4. Load initial data
        await Promise.all([
          useProviderStore.getState().loadProviders(),
          useProviderStore.getState().loadModels(),
          useSessionStore.getState().loadSessions(),
          useSettingsStore.getState().loadSystemPrompts(db),
        ]);

        if (!mounted) return;
        setIsReady(true);
      } catch (err) {
        if (!mounted) return;
        const message = err instanceof Error ? err.message : 'Unknown initialization error';
        setError(message);
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Failed to initialize app</Text>
        <Text style={styles.errorDetail}>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.center} accessibilityLabel="Loading app">
        <ActivityIndicator size="large" color="#5856D6" />
      </View>
    );
  }

  return (
    <ThemeProvider mode={themeMode}>
      <NavigationContainer>
        <AppContent />
      </NavigationContainer>
    </ThemeProvider>
  );
}

/**
 * Placeholder app content until navigation is fully wired (task 10.1).
 * Will be replaced with <RootNavigator /> once that task is complete.
 */
function AppContent() {
  return (
    <View style={styles.center}>
      <Text>Arlo Lite</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#FF3B30',
  },
  errorDetail: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
