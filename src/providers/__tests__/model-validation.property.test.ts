/**
 * Property-based tests for model ID length validation.
 *
 * Feature: sdk-provider-integration, Property 18: Model ID length validation
 *
 * **Validates: Requirements 9.4**
 *
 * Property Statement:
 * For any string input as a manual model ID, the system SHALL accept it
 * if and only if its length is between 1 and 256 characters (inclusive).
 */

import fc from 'fast-check';
import { isValidModelId } from '../model-validation';

describe('Property 18: Model ID length validation', () => {
  // Feature: sdk-provider-integration, Property 18: Model ID length validation

  it('accepts strings with length 1-256', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 256 }),
        (modelId) => isValidModelId(modelId) === true
      ),
      { numRuns: 100 }
    );
  });

  it('rejects empty strings', () => {
    expect(isValidModelId('')).toBe(false);
  });

  it('rejects strings longer than 256 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 257, maxLength: 500 }),
        (modelId) => isValidModelId(modelId) === false
      ),
      { numRuns: 100 }
    );
  });
});
