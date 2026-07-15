import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import type { SettingsStackParamList } from './types';
import { ProviderDetailScreen } from '@/screens/ProviderDetailScreen';

const Stack = createStackNavigator<SettingsStackParamList>();

// -- Placeholder screens (replaced by real implementations in later tasks) --

function SettingsMainPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings</Text>
    </View>
  );
}

function ProviderListPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Provider List</Text>
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

function AboutPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>About</Text>
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
        component={SettingsMainPlaceholder}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="ProviderList"
        component={ProviderListPlaceholder}
        options={{ title: 'Providers' }}
      />
      <Stack.Screen
        name="ProviderDetail"
        component={ProviderDetailScreen}
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
        component={AboutPlaceholder}
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
