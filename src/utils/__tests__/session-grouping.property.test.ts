import fc from 'fast-check';
import { groupSessionsByDate } from '../session-grouping';
import type { Session } from '@/database/repositories/session-repo';

/**
 * Property-based tests for session grouping date classification.
 *
 * **Validates: Requirements 7.6**
 *
 * Feature: mockup-ui-implementation, Property 1: Session grouping date classification
 */

/** Arbitrary that generates a valid Session with a given updatedAt timestamp. */
function sessionArbitrary(updatedAtArb: fc.Arbitrary<number>): fc.Arbitrary<Session> {
  return fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    providerId: fc.string({ minLength: 1, maxLength: 20 }),
    modelId: fc.string({ minLength: 1, maxLength: 20 }),
    systemPromptId: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
    thinkingLevel: fc.option(fc.constantFrom('off', 'minimal', 'low', 'medium', 'high', 'xhigh'), { nil: null }),
    totalCost: fc.float({ min: 0, max: 1000, noNaN: true }),
    tokenCount: fc.nat({ max: 100000 }),
    createdAt: updatedAtArb.map((t) => t - 1000),
    updatedAt: updatedAtArb,
  });
}

/**
 * Returns the start of day (midnight local time) for a given Date.
 */
function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Arbitrary that generates a reference "now" Date within a reasonable range
 * (years 2020–2030) to avoid edge cases with very old/new dates.
 */
const nowArbitrary = fc.date({
  min: new Date(2020, 0, 1),
  max: new Date(2030, 11, 31),
});

/**
 * Generates a timestamp that could land in any of the date groups relative to
 * a given "now" reference. Covers Today, Yesterday, This Week, This Month, Older.
 */
function timestampArbitrary(now: Date): fc.Arbitrary<number> {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  // Go up to 2 years in the past for "Older" sessions
  const twoYearsAgo = todayStart - 2 * 365 * 24 * 60 * 60 * 1000;

  return fc.oneof(
    // Today: [todayStart, todayStart + 23:59:59.999]
    fc.integer({ min: todayStart, max: todayStart + 24 * 60 * 60 * 1000 - 1 }),
    // Yesterday: [yesterdayStart, todayStart - 1]
    fc.integer({ min: yesterdayStart, max: todayStart - 1 }),
    // This Week / This Month / Older: spread across full range
    fc.integer({ min: twoYearsAgo, max: todayStart + 24 * 60 * 60 * 1000 - 1 }),
  );
}

describe('Property: Session grouping date classification', () => {
  it('every session in "Today" group has updatedAt within the current calendar day', () => {
    fc.assert(
      fc.property(
        nowArbitrary.chain((now) =>
          fc.tuple(
            fc.constant(now),
            fc.array(sessionArbitrary(timestampArbitrary(now)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([now, sessions]) => {
          const groups = groupSessionsByDate(sessions, now);
          const todayGroup = groups.find((g) => g.label === 'Today');
          if (!todayGroup) return true;

          const todayStart = startOfDay(now);
          const todayEnd = todayStart + 24 * 60 * 60 * 1000;

          for (const session of todayGroup.sessions) {
            if (session.updatedAt < todayStart || session.updatedAt >= todayEnd) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('every session in "Yesterday" group has updatedAt within the previous calendar day', () => {
    fc.assert(
      fc.property(
        nowArbitrary.chain((now) =>
          fc.tuple(
            fc.constant(now),
            fc.array(sessionArbitrary(timestampArbitrary(now)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([now, sessions]) => {
          const groups = groupSessionsByDate(sessions, now);
          const yesterdayGroup = groups.find((g) => g.label === 'Yesterday');
          if (!yesterdayGroup) return true;

          const todayStart = startOfDay(now);
          const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

          for (const session of yesterdayGroup.sessions) {
            if (session.updatedAt < yesterdayStart || session.updatedAt >= todayStart) {
              return false;
            }
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('no session appears in more than one group', () => {
    fc.assert(
      fc.property(
        nowArbitrary.chain((now) =>
          fc.tuple(
            fc.constant(now),
            fc.array(sessionArbitrary(timestampArbitrary(now)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([now, sessions]) => {
          const groups = groupSessionsByDate(sessions, now);
          const allGroupedSessions = groups.flatMap((g) => g.sessions);

          // Total sessions across all groups should equal total input sessions
          if (allGroupedSessions.length !== sessions.length) {
            return false;
          }

          // Check no duplicate IDs across groups
          const ids = allGroupedSessions.map((s) => s.id);
          return new Set(ids).size === ids.length;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all input sessions appear in the output (no sessions are lost)', () => {
    fc.assert(
      fc.property(
        nowArbitrary.chain((now) =>
          fc.tuple(
            fc.constant(now),
            fc.array(sessionArbitrary(timestampArbitrary(now)), { minLength: 0, maxLength: 30 }),
          ),
        ),
        ([now, sessions]) => {
          const groups = groupSessionsByDate(sessions, now);
          const allGroupedSessions = groups.flatMap((g) => g.sessions);

          // Every input session should appear in exactly one group
          const inputIds = new Set(sessions.map((s) => s.id));
          const outputIds = new Set(allGroupedSessions.map((s) => s.id));

          // Output contains all unique input IDs
          for (const id of inputIds) {
            if (!outputIds.has(id)) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('groups are returned in fixed display order when present', () => {
    const EXPECTED_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];

    fc.assert(
      fc.property(
        nowArbitrary.chain((now) =>
          fc.tuple(
            fc.constant(now),
            fc.array(sessionArbitrary(timestampArbitrary(now)), { minLength: 1, maxLength: 30 }),
          ),
        ),
        ([now, sessions]) => {
          const groups = groupSessionsByDate(sessions, now);
          const labels = groups.map((g) => g.label);

          // Check ordering: for any two labels, their relative order should
          // match the expected display order
          for (let i = 0; i < labels.length - 1; i++) {
            const idxA = EXPECTED_ORDER.indexOf(labels[i]);
            const idxB = EXPECTED_ORDER.indexOf(labels[i + 1]);
            if (idxA >= idxB) return false;
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
