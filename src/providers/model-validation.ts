/**
 * Model ID validation utilities.
 *
 * Provides validation logic for user-entered model IDs
 * used when manually specifying models outside of API-fetched lists.
 */

/**
 * Validate a model ID string.
 * Returns true if the model ID is between 1 and 256 characters (inclusive).
 *
 * @param modelId - The model ID string to validate
 * @returns true if the model ID length is valid
 */
export function isValidModelId(modelId: string): boolean {
  return modelId.length >= 1 && modelId.length <= 256;
}
