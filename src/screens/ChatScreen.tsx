import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';

import { ChatShell } from '@/components/layout/ChatShell';

/**
 * Main chat screen.
 *
 * Delegates all composition to ChatShell, which internally manages:
 * - Session sidebar with 3D page-turn transition
 * - NavigationChrome (top blur bar)
 * - Message list (FlatList + MessageFlow)
 * - InputChrome (bottom blur bar with model chip, thinking selector, context ring)
 * - Overlay screens (ModelPicker, RenameDialog, Settings, ProviderDetail)
 * - Store wiring (session-store, chat-store, provider-store, ui-store)
 *
 * KeyboardAvoidingView wraps the shell to maintain proper input positioning
 * when the keyboard is visible.
 */
export function ChatScreen() {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ChatShell />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
