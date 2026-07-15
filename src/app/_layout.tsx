import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Slot } from 'expo-router';

/**
 * Root layout component for Expo Router.
 * Renders the matched route via <Slot />.
 * Full initialization (database, stores, i18n) will be added
 * once those modules are wired up end-to-end.
 */
export default function RootLayout() {
  return <Slot />;
}
