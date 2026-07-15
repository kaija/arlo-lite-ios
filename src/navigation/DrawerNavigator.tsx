import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import type { DrawerParamList } from './types';
import { ChatScreen } from '@/screens/ChatScreen';
import { SessionListScreen } from '@/screens/SessionListScreen';

const Drawer = createDrawerNavigator<DrawerParamList>();

/**
 * Drawer navigator — the session list lives in the drawer panel,
 * and the Chat screen is the main content area.
 */
export function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={() => <SessionListScreen />}
      screenOptions={{
        headerShown: true,
        drawerType: 'slide',
      }}
    >
      <Drawer.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Arlo Lite' }}
      />
    </Drawer.Navigator>
  );
}
