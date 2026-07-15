import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a new UUID v4 string.
 * Wraps the uuid package for consistent usage across the app.
 */
export function generateId(): string {
  return uuidv4();
}
