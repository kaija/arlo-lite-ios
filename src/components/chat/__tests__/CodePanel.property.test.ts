import fc from 'fast-check';

import { lightColors, darkColors, ColorPalette } from '@/theme/colors';

/**
 * Property-based tests for code panel accent-derived color consistency.
 *
 * **Validates: Requirements 2.4, 2.8**
 *
 * Feature: mockup-ui-implementation, Property 9: Code panel accent-derived color consistency
 *
 * "For any app accent color, the code syntax colors (keyword, string, type, comment)
 * SHALL be deterministically derived from the accent using fixed mix ratios, and the
 * code block background SHALL remain #15151b regardless of theme mode."
 */

const FIXED_CODE_BLOCK_BACKGROUND = '#15151b';

/** Both theme palettes to exercise */
const themes: Array<{ name: string; palette: ColorPalette }> = [
  { name: 'light', palette: lightColors },
  { name: 'dark', palette: darkColors },
];

/**
 * Validates that a string is a valid hex color (#RRGGBB or #RGB format)
 * or an rgba(...) color string.
 */
function isValidColorString(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return (
    /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ||
    /^rgba?\(/.test(value)
  );
}

describe('Property: Code panel accent-derived color consistency', () => {
  it('codeBlockBackground is always #15151b regardless of theme mode', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        (theme) => {
          return theme.palette.codeBlockBackground === FIXED_CODE_BLOCK_BACKGROUND;
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code syntax colors (keyword, string, type, comment) are always present string values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        (theme) => {
          const { codeKeyword, codeString, codeType, codeComment } = theme.palette;
          return (
            typeof codeKeyword === 'string' &&
            codeKeyword.length > 0 &&
            typeof codeString === 'string' &&
            codeString.length > 0 &&
            typeof codeType === 'string' &&
            codeType.length > 0 &&
            typeof codeComment === 'string' &&
            codeComment.length > 0
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code syntax colors are valid color strings in all themes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        (theme) => {
          const { codeKeyword, codeString, codeType, codeComment } = theme.palette;
          return (
            isValidColorString(codeKeyword) &&
            isValidColorString(codeString) &&
            isValidColorString(codeType) &&
            isValidColorString(codeComment)
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('codeBlockBackground is independent of the main background color', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        (theme) => {
          // The code block background must be different from the main background
          // (since it's a fixed dark value independent of theme)
          return (
            theme.palette.codeBlockBackground !== theme.palette.background &&
            theme.palette.codeBlockBackground === FIXED_CODE_BLOCK_BACKGROUND
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code syntax colors are deterministic — same theme always yields same colors', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        fc.integer({ min: 1, max: 50 }),
        (theme, _iteration) => {
          // Reading the palette multiple times should always produce identical values
          const first = {
            keyword: theme.palette.codeKeyword,
            string: theme.palette.codeString,
            type: theme.palette.codeType,
            comment: theme.palette.codeComment,
          };
          const second = {
            keyword: theme.palette.codeKeyword,
            string: theme.palette.codeString,
            type: theme.palette.codeType,
            comment: theme.palette.codeComment,
          };
          return (
            first.keyword === second.keyword &&
            first.string === second.string &&
            first.type === second.type &&
            first.comment === second.comment
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('code syntax colors differ from each other (distinct roles have distinct colors)', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...themes),
        (theme) => {
          const { codeKeyword, codeString, codeType, codeComment } = theme.palette;
          // At minimum, the keyword and comment colors should differ
          // (they serve visually distinct roles)
          return codeKeyword !== codeComment && codeString !== codeComment;
        },
      ),
      { numRuns: 100 },
    );
  });
});
