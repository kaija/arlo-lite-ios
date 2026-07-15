import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { DrawerNavigator } from './DrawerNavigator';
import { SettingsNavigator } from './SettingsNavigator';
import type { RootStackParamList } from './types';

const Stack = createStackNavigator<RootStackParamList>();

/**
 * Root navigator containing the main Drawer and Settings stack.
 * The Drawer is the primary interface; Settings is pushed on top.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={DrawerNavigator} />
      <Stack.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
