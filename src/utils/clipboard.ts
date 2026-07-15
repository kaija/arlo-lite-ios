import * as ExpoClipboard from 'expo-clipboard';

/**
 * Copies the given text to the system clipboard.
 * Uses expo-clipboard for cross-platform support.
 */
export async function copyToClipboard(text: string): Promise<void> {
  await ExpoClipboard.setStringAsync(text);
}

/**
 * Reads text content from the system clipboard.
 * Returns an empty string if clipboard is empty or unavailable.
 */
export async function getFromClipboard(): Promise<string> {
  return ExpoClipboard.getStringAsync();
}
