import fc from 'fast-check';
import {
  shouldSnapOpen,
  GESTURE_SNAP_THRESHOLD,
  BUTTON_SNAP_THRESHOLD,
} from '../useSidebarTransition';

/**
 * Property-based tests for sidebar snap threshold.
 *
 * **Validates: Requirements 7.1, 14.5, 14.6**
 *
 * Feature: mockup-ui-implementation, Property 6: Sidebar snap threshold
 *
 * For any drag release progress value between 0.0 and 1.0, the sidebar SHALL snap
 * open if progress >= 0.4 (button-triggered) or >= 0.22 (gesture-triggered), and
 * snap closed otherwise.
 */

describe('Property: Sidebar snap threshold', () => {
  it('snaps open when gesture progress >= 0.22', () => {
    fc.assert(
      fc.property(
        fc.double({ min: GESTURE_SNAP_THRESHOLD, max: 1.0, noNaN: true }),
        (progress) => {
          return shouldSnapOpen(progress, true) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('snaps closed when gesture progress < 0.22', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0, max: GESTURE_SNAP_THRESHOLD, noNaN: true }).filter(
          (v) => v < GESTURE_SNAP_THRESHOLD,
        ),
        (progress) => {
          return shouldSnapOpen(progress, true) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('snaps open when button progress >= 0.4', () => {
    fc.assert(
      fc.property(
        fc.double({ min: BUTTON_SNAP_THRESHOLD, max: 1.0, noNaN: true }),
        (progress) => {
          return shouldSnapOpen(progress, false) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('snaps closed when button progress < 0.4', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0, max: BUTTON_SNAP_THRESHOLD, noNaN: true }).filter(
          (v) => v < BUTTON_SNAP_THRESHOLD,
        ),
        (progress) => {
          return shouldSnapOpen(progress, false) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('gesture threshold is lower than button threshold', () => {
    // This is a structural invariant: gesture requires less progress to snap open
    expect(GESTURE_SNAP_THRESHOLD).toBeLessThan(BUTTON_SNAP_THRESHOLD);
  });

  it('for any progress in [0,1], the snap decision is deterministic and consistent with thresholds', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.0, max: 1.0, noNaN: true }),
        fc.boolean(),
        (progress, isGesture) => {
          const result = shouldSnapOpen(progress, isGesture);
          const threshold = isGesture ? GESTURE_SNAP_THRESHOLD : BUTTON_SNAP_THRESHOLD;

          if (progress >= threshold) {
            return result === true;
          }
          return result === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('at threshold boundary values, behavior is correct (>= means inclusive)', () => {
    // Exact gesture threshold -> should snap open
    expect(shouldSnapOpen(GESTURE_SNAP_THRESHOLD, true)).toBe(true);
    // Exact button threshold -> should snap open
    expect(shouldSnapOpen(BUTTON_SNAP_THRESHOLD, false)).toBe(true);
    // Just below gesture threshold -> closed
    expect(shouldSnapOpen(GESTURE_SNAP_THRESHOLD - 0.001, true)).toBe(false);
    // Just below button threshold -> closed
    expect(shouldSnapOpen(BUTTON_SNAP_THRESHOLD - 0.001, false)).toBe(false);
  });
});
