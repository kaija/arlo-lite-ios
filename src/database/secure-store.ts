import * as SecureStore from 'expo-secure-store';

/**
 * Secure storage wrapper for API keys.
 *
 * Security considerations:
 * - API keys are stored exclusively in expo-secure-store, which uses
 *   iOS Keychain (with kSecAttrAccessibleWhenUnlockedThisDeviceOnly)
 *   and Android Keystore under the hood.
 * - Keys are never logged, serialized to JSON state, or included in
 *   backup/export payloads.
 * - When the app is uninstalled, Keychain items are removed on iOS,
 *   ensuring keys cannot persist across reinstalls.
 * - The key pattern `arlo.provider.{providerId}.apiKey` namespaces
 *   entries to avoid collisions with other secure storage consumers.
 */

/**
 * Builds the secure storage key for a provider's API key.
 *
 * Uses dots as separators since expo-secure-store only allows
 * alphanumeric characters, ".", "-", and "_" in keys.
 *
 * @param providerId - The unique identifier of the provider.
 * @returns The namespaced key string used in secure storage.
 */
export function buildSecureKey(providerId: string): string {
  return `arlo.provider.${providerId}.apiKey`;
}

/**
 * Stores an API key securely for the given provider.
 *
 * The key is persisted in the platform's secure enclave (iOS Keychain /
 * Android Keystore) and is never written to logs or serializable state.
 *
 * @param providerId - The unique identifier of the provider.
 * @param apiKey - The API key value to store. Must not be empty.
 * @throws If the secure storage write fails.
 */
export async function storeApiKey(
  providerId: string,
  apiKey: string
): Promise<void> {
  if (!providerId) {
    throw new Error('providerId must not be empty');
  }
  if (!apiKey) {
    throw new Error('apiKey must not be empty');
  }

  const key = buildSecureKey(providerId);
  await SecureStore.setItemAsync(key, apiKey);
}

/**
 * Retrieves the stored API key for a provider.
 *
 * Returns null if no key has been stored for the given provider.
 * The returned value should be used only for API requests and must
 * never be logged or persisted outside secure storage.
 *
 * @param providerId - The unique identifier of the provider.
 * @returns The stored API key, or null if not found.
 */
export async function getApiKey(
  providerId: string
): Promise<string | null> {
  if (!providerId) {
    throw new Error('providerId must not be empty');
  }

  const key = buildSecureKey(providerId);
  return SecureStore.getItemAsync(key);
}

/**
 * Deletes the stored API key for a provider.
 *
 * This should be called when a provider is removed to ensure no
 * orphaned credentials remain in secure storage.
 *
 * @param providerId - The unique identifier of the provider.
 */
export async function deleteApiKey(providerId: string): Promise<void> {
  if (!providerId) {
    throw new Error('providerId must not be empty');
  }

  const key = buildSecureKey(providerId);
  await SecureStore.deleteItemAsync(key);
}
