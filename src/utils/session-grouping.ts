import type { Session } from '@/database/repositories/session-repo';

/**
 * A group of sessions sharing the same relative date label.
 */
export interface SessionGroup {
  /** The human-readable label for this group. */
  label: string;
  /** Sessions that fall within this date group, preserving original order. */
  sessions: Session[];
}

/** Possible group labels in display order. */
const GROUP_LABELS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as const;

/**
 * Returns the start of a given day (midnight, local time) as epoch ms.
 */
function startOfDay(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Determines which group label a timestamp belongs to, relative to `now`.
 */
function classifyTimestamp(timestamp: number, now: Date): string {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  if (timestamp >= todayStart) {
    return 'Today';
  }

  if (timestamp >= yesterdayStart) {
    return 'Yesterday';
  }

  // Start of the current week (Monday = start)
  const dayOfWeek = now.getDay();
  // getDay() returns 0 for Sunday, so shift to Monday-based
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = todayStart - daysSinceMonday * 24 * 60 * 60 * 1000;

  if (timestamp >= weekStart) {
    return 'This Week';
  }

  // Start of the current month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  if (timestamp >= monthStart) {
    return 'This Month';
  }

  return 'Older';
}

/**
 * Groups sessions by their `updatedAt` timestamp into date-based buckets.
 *
 * Each session appears in exactly one group. Groups are returned in
 * chronological display order: Today, Yesterday, This Week, This Month, Older.
 * Only non-empty groups are included in the result.
 *
 * @param sessions - The sessions to group (any order).
 * @param now - Optional reference date for testing; defaults to current time.
 * @returns An array of SessionGroup objects with non-empty groups only.
 */
export function groupSessionsByDate(
  sessions: Session[],
  now: Date = new Date()
): SessionGroup[] {
  const buckets = new Map<string, Session[]>(
    GROUP_LABELS.map((label) => [label, []])
  );

  for (const session of sessions) {
    const label = classifyTimestamp(session.updatedAt, now);
    buckets.get(label)!.push(session);
  }

  // Return only non-empty groups in display order
  return GROUP_LABELS.filter((label) => buckets.get(label)!.length > 0).map(
    (label) => ({
      label,
      sessions: buckets.get(label)!,
    })
  );
}
