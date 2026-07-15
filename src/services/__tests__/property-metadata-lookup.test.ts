/**
 * Property 11: Metadata lookup correctness
 *
 * For any model ID string, if it exists in the Metadata_Table the lookup should
 * return the exact context window and price values from the table; if it does not
 * exist, the lookup should return null for all metadata fields.
 *
 * Feature: arlo-lite-app, Property 11: Metadata lookup correctness
 * Validates: Requirements 2.2, 2.3
 */

import * as fc from 'fast-check';
import { getModelMetadata } from '../metadata-service';

/**
 * Creates a mock SQLite database that resolves lookups against a provided
 * in-memory metadata table.
 */
function createMockDb(metadataTable: Record<string, {
  model_id: string;
  context_window: number | null;
  input_price: number | null;
  output_price: number | null;
  cached_input_price: number | null;
  cached_output_price: number | null;
  supports_reasoning: number;
  updated_at: number;
}>) {
  return {
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(async (_sql: string, params?: any[]) => {
      const modelId = params?.[0];
      return Object.hasOwn(metadataTable, modelId) ? metadataTable[modelId] : null;
    }),
  };
}

describe('Property 11: Metadata lookup correctness', () => {
  it('when model exists in table: returned metadata matches exactly', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random model ID string
        fc.string({ minLength: 1, maxLength: 100 }),
        // Generate random metadata values
        fc.record({
          contextWindow: fc.oneof(
            fc.integer({ min: 1, max: 2_000_000 }),
            fc.constant(null as number | null)
          ),
          inputPrice: fc.oneof(
            fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            fc.constant(null as number | null)
          ),
          outputPrice: fc.oneof(
            fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            fc.constant(null as number | null)
          ),
          cachedInputPrice: fc.oneof(
            fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            fc.constant(null as number | null)
          ),
          cachedOutputPrice: fc.oneof(
            fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
            fc.constant(null as number | null)
          ),
          supportsReasoning: fc.integer({ min: 0, max: 1 }),
          updatedAt: fc.integer({ min: 1_000_000_000_000, max: 2_000_000_000_000 }),
        }),
        async (modelId, metadata) => {
          const row = {
            model_id: modelId,
            context_window: metadata.contextWindow,
            input_price: metadata.inputPrice,
            output_price: metadata.outputPrice,
            cached_input_price: metadata.cachedInputPrice,
            cached_output_price: metadata.cachedOutputPrice,
            supports_reasoning: metadata.supportsReasoning,
            updated_at: metadata.updatedAt,
          };

          const db = createMockDb({ [modelId]: row });

          const result = await getModelMetadata(db as any, modelId);

          // Result should not be null since the model exists
          expect(result).not.toBeNull();

          // All fields should match exactly
          expect(result!.modelId).toBe(modelId);
          expect(result!.contextWindow).toBe(metadata.contextWindow);
          expect(result!.inputPrice).toBe(metadata.inputPrice);
          expect(result!.outputPrice).toBe(metadata.outputPrice);
          expect(result!.cachedInputPrice).toBe(metadata.cachedInputPrice);
          expect(result!.cachedOutputPrice).toBe(metadata.cachedOutputPrice);
          expect(result!.supportsReasoning).toBe(metadata.supportsReasoning === 1);
          expect(result!.updatedAt).toBe(metadata.updatedAt);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('when model does not exist: returns null', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random model ID that will not be in the table
        fc.string({ minLength: 1, maxLength: 100 }),
        async (modelId) => {
          // Create an empty metadata table — no model exists
          const db = createMockDb({});

          const result = await getModelMetadata(db as any, modelId);

          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
