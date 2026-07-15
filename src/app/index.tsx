import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

/**
 * Home screen placeholder — will be replaced with the full chat UI.
 */
export default function HomeScreen() {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Arlo Lite</Text>
      <Text style={styles.subtitle}>Your LLM client</Text>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#5856D6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
