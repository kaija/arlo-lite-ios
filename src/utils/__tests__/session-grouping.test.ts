import { groupSessionsByDate, SessionGroup } from '../session-grouping';
import type { Session } from '@/database/repositories/session-repo';

/** Helper to create a Session with a given updatedAt timestamp. */
function makeSession(id: string, updatedAt: number): Session {
  return {
    id,
    title: `Session ${id}`,
    providerId: 'provider-1',
    modelId: 'model-1',
    systemPromptId: null,
    thinkingLevel: null,
    totalCost: 0,
    tokenCount: 0,
    createdAt: updatedAt - 1000,
    updatedAt,
  };
}

describe('groupSessionsByDate', () => {
  // Fixed reference: Wednesday, 2025-01-15 14:00:00 local
  const now = new Date(2025, 0, 15, 14, 0, 0, 0);
  const todayStart = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
  const yesterdayStart = new Date(2025, 0, 14, 0, 0, 0, 0).getTime();
  // Monday Jan 13 is start of this week
  const weekStart = new Date(2025, 0, 13, 0, 0, 0, 0).getTime();
  const monthStart = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  it('returns an empty array for no sessions', () => {
    const result = groupSessionsByDate([], now);
    expect(result).toEqual([]);
  });

  it('classifies a session from today into "Today"', () => {
    const sessions = [makeSession('1', todayStart + 3600_000)];
    const result = groupSessionsByDate(sessions, now);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Today');
    expect(result[0].sessions).toHaveLength(1);
    expect(result[0].sessions[0].id).toBe('1');
  });

  it('classifies a session from yesterday into "Yesterday"', () => {
    const sessions = [makeSession('1', yesterdayStart + 3600_000)];
    const result = groupSessionsByDate(sessions, now);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Yesterday');
  });

  it('classifies a session from earlier this week into "This Week"', () => {
    // Monday Jan 13 at noon
    const sessions = [makeSession('1', weekStart + 12 * 3600_000)];
    const result = groupSessionsByDate(sessions, now);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('This Week');
  });

  it('classifies a session from earlier this month into "This Month"', () => {
    // Jan 5 at noon
    const sessions = [makeSession('1', new Date(2025, 0, 5, 12, 0, 0).getTime())];
    const result = groupSessionsByDate(sessions, now);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('This Month');
  });

  it('classifies a session from a previous month into "Older"', () => {
    // December 2024
    const sessions = [makeSession('1', new Date(2024, 11, 20, 12, 0, 0).getTime())];
    const result = groupSessionsByDate(sessions, now);

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('Older');
  });

  it('each session appears in exactly one group', () => {
    const sessions = [
      makeSession('today', todayStart + 1000),
      makeSession('yesterday', yesterdayStart + 1000),
      makeSession('week', weekStart + 1000),
      makeSession('month', monthStart + 1000),
      makeSession('older', new Date(2024, 5, 1).getTime()),
    ];
    const result = groupSessionsByDate(sessions, now);

    const allSessions = result.flatMap((g) => g.sessions);
    expect(allSessions).toHaveLength(5);

    // No duplicates
    const ids = allSessions.map((s) => s.id);
    expect(new Set(ids).size).toBe(5);
  });

  it('returns groups in display order: Today, Yesterday, This Week, This Month, Older', () => {
    const sessions = [
      makeSession('older', new Date(2024, 5, 1).getTime()),
      makeSession('today', todayStart + 5000),
      makeSession('month', monthStart + 5000),
      makeSession('yesterday', yesterdayStart + 5000),
      makeSession('week', weekStart + 5000),
    ];
    const result = groupSessionsByDate(sessions, now);

    const labels = result.map((g) => g.label);
    expect(labels).toEqual(['Today', 'Yesterday', 'This Week', 'This Month', 'Older']);
  });

  it('omits empty groups from the result', () => {
    const sessions = [
      makeSession('today', todayStart + 5000),
      makeSession('older', new Date(2024, 0, 1).getTime()),
    ];
    const result = groupSessionsByDate(sessions, now);

    const labels = result.map((g) => g.label);
    expect(labels).toEqual(['Today', 'Older']);
    expect(labels).not.toContain('Yesterday');
    expect(labels).not.toContain('This Week');
    expect(labels).not.toContain('This Month');
  });

  it('handles boundary: session at exact start of today goes to "Today"', () => {
    const sessions = [makeSession('1', todayStart)];
    const result = groupSessionsByDate(sessions, now);

    expect(result[0].label).toBe('Today');
  });

  it('handles boundary: session 1ms before today goes to "Yesterday"', () => {
    const sessions = [makeSession('1', todayStart - 1)];
    const result = groupSessionsByDate(sessions, now);

    expect(result[0].label).toBe('Yesterday');
  });

  it('handles Sunday edge case for week boundary', () => {
    // Sunday, Jan 19 2025
    const sundayNow = new Date(2025, 0, 19, 14, 0, 0, 0);
    // Monday Jan 13 is still start of this week
    const mondayOfWeek = new Date(2025, 0, 13, 0, 0, 0, 0).getTime();
    const sessions = [makeSession('1', mondayOfWeek + 1000)];
    const result = groupSessionsByDate(sessions, sundayNow);

    expect(result[0].label).toBe('This Week');
  });
});
