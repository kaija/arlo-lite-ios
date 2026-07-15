import * as fc from 'fast-check';
import { getAllSessions } from '../repositories/session-repo';

/**
 * Property 12: Session list ordering
 * Validates: Requirements 5.3
 *
 * For any set of sessions with distinct updatedAt timestamps,
 * the session list should be sorted in strictly descending order by updatedAt.
 */
describe('Feature: arlo-lite-app, Property 12: Session list ordering', () => {
  it('sessions are returned in strictly descending order by updatedAt', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(fc.nat(), { minLength: 1, maxLength: 50 }),
        async (distinctTimestamps) => {
          // Build session rows with distinct updatedAt values in random order
          const shuffled = [...distinctTimestamps].sort(() => Math.random() - 0.5);

          const rows = shuffled.map((ts, i) => ({
            id: `session-${i}`,
            title: `Session ${i}`,
            provider_id: 'provider-1',
            model_id: 'model-1',
            system_prompt_id: null,
            total_cost: 0,
            token_count: 0,
            created_at: ts,
            updated_at: ts,
          }));

          // Mock DB that returns rows in the SQL ORDER BY updated_at DESC order
          // This simulates what the real DB query would do
          const sortedRows = [...rows].sort((a, b) => b.updated_at - a.updated_at);
          const mockDb = {
            getAllAsync: jest.fn().mockResolvedValue(sortedRows),
          } as any;

          const sessions = await getAllSessions(mockDb);

          // Verify the function was called with the correct query
          expect(mockDb.getAllAsync).toHaveBeenCalledWith(
            'SELECT * FROM sessions ORDER BY updated_at DESC'
          );

          // Verify returned sessions are in strictly descending order by updatedAt
          expect(sessions.length).toBe(distinctTimestamps.length);
          for (let i = 0; i < sessions.length - 1; i++) {
            expect(sessions[i].updatedAt).toBeGreaterThan(sessions[i + 1].updatedAt);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
