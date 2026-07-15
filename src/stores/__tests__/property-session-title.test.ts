import * as fc from 'fast-check';
import { generateSessionTitle } from '../session-store';
import { SESSION_TITLE_MAX_LENGTH } from '@/constants/defaults';

/**
 * Property 7: Session title truncation
 * Validates: Requirements 5.2
 *
 * For any non-empty user message string M, the auto-generated session title T should satisfy:
 * - length(T) ≤ 53 (50 + "...")
 * - T is a prefix of M (or T equals M if length(M) ≤ 50)
 * - T is never empty
 */
describe('Feature: arlo-lite-app, Property 7: Session title truncation', () => {
  it('title is never empty for non-empty messages', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (message) => {
          const title = generateSessionTitle(message);
          expect(title.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('title equals message when message length ≤ 50', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: SESSION_TITLE_MAX_LENGTH }),
        (message) => {
          const title = generateSessionTitle(message);
          expect(title).toBe(message);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('title is truncated to 50 chars + "..." when message length > 50', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: SESSION_TITLE_MAX_LENGTH + 1, maxLength: 200 }),
        (message) => {
          const title = generateSessionTitle(message);
          expect(title).toBe(message.slice(0, SESSION_TITLE_MAX_LENGTH) + '...');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('title length is always bounded: ≤ 53 (50 + "...")', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (message) => {
          const title = generateSessionTitle(message);
          expect(title.length).toBeLessThanOrEqual(SESSION_TITLE_MAX_LENGTH + 3);
        }
      ),
      { numRuns: 100 }
    );
  });
});
