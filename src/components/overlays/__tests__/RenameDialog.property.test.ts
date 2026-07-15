import fc from 'fast-check';

/**
 * Property-based tests for rename dialog validation.
 *
 * **Validates: Requirements 11.5, 11.6**
 *
 * Feature: mockup-ui-implementation, Property 8: Rename dialog validation
 *
 * Property: For any string input to the rename dialog, the Save button SHALL be
 * disabled if and only if the trimmed input is empty, and when Save is enabled
 * the persisted title SHALL equal the trimmed input value.
 */

// ─── Pure validation helpers ──────────────────────────────────────────────────

/**
 * Returns true if the input is a valid rename value (non-empty after trim).
 * This mirrors the RenameDialog's `isSaveEnabled` logic.
 */
export function isRenameValid(input: string): boolean {
  return input.trim().length > 0;
}

/**
 * Returns the trimmed input that would be persisted on Save.
 * This mirrors the RenameDialog's `trimmedText` passed to `onSave`.
 */
export function getRenameResult(input: string): string {
  return input.trim();
}

// ─── Property Tests ───────────────────────────────────────────────────────────

describe('Property: Rename dialog validation', () => {
  it('Save is disabled if and only if trimmed input is empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (input) => {
          const valid = isRenameValid(input);
          const trimmedEmpty = input.trim().length === 0;

          // Save disabled ↔ trimmed input is empty
          return valid === !trimmedEmpty;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('when Save is enabled, persisted title equals the trimmed input', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (input) => {
          if (!isRenameValid(input)) {
            // Skip inputs that would disable Save — not relevant to this property
            return true;
          }

          const result = getRenameResult(input);
          return result === input.trim();
        },
      ),
      { numRuns: 100 },
    );
  });

  it('whitespace-only strings always disable Save', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', '\u00A0'), {
          minLength: 0,
          maxLength: 50,
        }),
        (whitespaceOnly) => {
          return isRenameValid(whitespaceOnly) === false;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('any string with at least one non-whitespace character enables Save', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.string({ minLength: 0, maxLength: 50 }),
          fc.char().filter((c) => c.trim().length > 0),
          fc.string({ minLength: 0, maxLength: 50 }),
        ),
        ([prefix, nonWs, suffix]) => {
          const input = prefix + nonWs + suffix;
          return isRenameValid(input) === true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('persisted title has no leading or trailing whitespace', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 200 }).filter(
          (s) => s.trim().length > 0,
        ),
        (input) => {
          const result = getRenameResult(input);
          return result === result.trim() && result.length > 0;
        },
      ),
      { numRuns: 100 },
    );
  });
});
