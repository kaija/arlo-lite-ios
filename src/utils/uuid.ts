/**
 * Generate a new UUID v4 string.
 *
 * Uses a pure-JS implementation that works in React Native without
 * requiring Web Crypto polyfills or native modules.
 * Generates a RFC4122-compliant v4 UUID using Math.random().
 */
export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
