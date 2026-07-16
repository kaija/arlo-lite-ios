import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { SettingsStackParamList } from './types';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { ProviderListScreen } from '@/screens/ProviderListScreen';
import { AboutScreen } from '@/screens/AboutScreen';

const Stack = createStackNavigator<SettingsStackParamList>();

// -- Placeholder screens (replaced by real implementations in later tasks) --

function ProviderDetailPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Provider Detail</Text>
    </View>
  );
}

function ModelDetailPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Model Detail</Text>
    </View>
  );
}

function SystemPromptsPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>System Prompts</Text>
    </View>
  );
}

/**
 * Settings stack navigator — provides the full settings flow:
 * SettingsMain → ProviderList → ProviderDetail → ModelDetail
 * SettingsMain → SystemPrompts
 * SettingsMain → About
 */
export function SettingsNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="ProviderList"
        component={ProviderListScreen}
        options={{ title: 'Providers' }}
      />
      <Stack.Screen
        name="ProviderDetail"
        component={ProviderDetailPlaceholder}
        options={{ title: 'Provider' }}
      />
      <Stack.Screen
        name="ModelDetail"
        component={ModelDetailPlaceholder}
        options={{ title: 'Model' }}
      />
      <Stack.Screen
        name="SystemPrompts"
        component={SystemPromptsPlaceholder}
        options={{ title: 'System Prompts' }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: 'About' }}
      />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    color: '#666',
  },
});
