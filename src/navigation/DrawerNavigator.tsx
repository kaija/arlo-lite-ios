import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerParamList } from './types';

const Drawer = createDrawerNavigator<DrawerParamList>();

/** Placeholder Chat screen — replaced by actual ChatScreen in task 14 */
function ChatScreenPlaceholder() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Chat Screen</Text>
    </View>
  );
}

/** Placeholder Session List used as custom drawer content */
function SessionListDrawerContent() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Session List</Text>
    </View>
  );
}

/**
 * Drawer navigator — the session list lives in the drawer panel,
 * and the Chat screen is the main content area.
 */
export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={() => <SessionListDrawerContent />}
      screenOptions={{
        headerShown: true,
        drawerType: 'slide',
      }}
    >
      <Drawer.Screen
        name="Chat"
        component={ChatScreenPlaceholder}
        options={{ title: 'Arlo Lite' }}
      />
    </Drawer.Navigator>
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
