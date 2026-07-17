import fc from 'fast-check';
import { resolveModelName } from '../resolve-model-name';
import type { ModelConfig } from '@/stores/provider-store';

/**
 * Property-based tests for resolveModelName utility.
 *
 * **Validates: Requirements 1.3, 1.4**
 *
 * Feature: per-message-model-tracking, Property 1: Model Name Resolution
 */

/** Arbitrary that generates a valid ModelConfig. */
function modelConfigArbitrary(): fc.Arbitrary<ModelConfig> {
  return fc.record({
    id: fc.uuid(),
    providerId: fc.string({ minLength: 1, maxLength: 20 }),
    modelId: fc.string({ minLength: 1, maxLength: 50 }),
    displayName: fc.string({ minLength: 1, maxLength: 50 }),
    contextWindow: fc.option(fc.nat({ max: 1000000 }), { nil: null }),
    inputPrice: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
    outputPrice: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
    cachedInputPrice: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
    cachedOutputPrice: fc.option(fc.float({ min: 0, max: 100, noNaN: true }), { nil: null }),
    supportsReasoning: fc.boolean(),
    supportsImageInput: fc.boolean(),
    supportsImageGeneration: fc.boolean(),
    supportsFileInput: fc.boolean(),
  });
}

describe('Property: Model Name Resolution', () => {
  it('returns displayName when models array contains a matching modelId', () => {
    fc.assert(
      fc.property(
        fc.array(modelConfigArbitrary(), { minLength: 1, maxLength: 20 }).chain((models) =>
          fc.tuple(
            fc.constant(models),
            fc.integer({ min: 0, max: models.length - 1 }),
          ),
        ),
        ([models, targetIndex]) => {
          const targetModelId = models[targetIndex].modelId;
          const result = resolveModelName(targetModelId, models);

          // Should return the displayName of the first matching model
          const expected = models.find((m) => m.modelId === targetModelId)!.displayName;
          return result === expected;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns raw modelId when models array does not contain a match', () => {
    fc.assert(
      fc.property(
        fc.array(modelConfigArbitrary(), { minLength: 0, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (models, rawModelId) => {
          // Ensure rawModelId does not match any model in the list
          const nonMatchingId = `__nonexistent__${rawModelId}`;
          const filteredModels = models.filter((m) => m.modelId !== nonMatchingId);

          const result = resolveModelName(nonMatchingId, filteredModels);
          return result === nonMatchingId;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('returns raw modelId when models array is empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        (modelId) => {
          const result = resolveModelName(modelId, []);
          return result === modelId;
        },
      ),
      { numRuns: 100 },
    );
  });
});
