/**
 * Unit tests for the Arlo Lite theme system.
 *
 * Tests cover:
 * - Color contrast ratios meet WCAG AA (4.5:1 minimum)
 * - Typography dynamic scaling
 * - Spacing consistency
 * - Theme creation and exports
 */

import { PixelRatio } from 'react-native';
import { lightColors, darkColors, ColorPalette } from '../colors';
import {
  scaleFontSize,
  scaleLineHeight,
  baseTypography,
  createTypography,
} from '../typography';
import { spacing, borderRadii } from '../spacing';
import { lightTheme, darkTheme, createTheme } from '../index';

// Mock PixelRatio.getFontScale to return 1.0 for predictable tests
jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.0);

// ─── Contrast Ratio Utilities ─────────────────────────────────────────────────

/**
 * Parse a hex color string to RGB values.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '');
  return {
    r: parseInt(cleaned.substring(0, 2), 16),
    g: parseInt(cleaned.substring(2, 4), 16),
    b: parseInt(cleaned.substring(4, 6), 16),
  };
}

/**
 * Calculate relative luminance per WCAG 2.1 spec.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);

  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors per WCAG 2.1.
 * Returns a value between 1 and 21.
 */
function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Color Contrast Tests ─────────────────────────────────────────────────────

describe('Color Contrast - WCAG AA Compliance (4.5:1 minimum)', () => {
  describe('Light mode', () => {
    it('text on background meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.text, lightColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('textSecondary on background meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.textSecondary, lightColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accent on background meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.accent, lightColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('error on background meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.error, lightColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('text on surface meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.text, lightColors.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accentText on accent meets 4.5:1', () => {
      const ratio = contrastRatio(lightColors.accentText, lightColors.accent);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Dark mode', () => {
    it('text on background meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.text, darkColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('textSecondary on background meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.textSecondary, darkColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accent on background meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.accent, darkColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('error on background meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.error, darkColors.background);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('text on surface meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.text, darkColors.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('accentText on accent meets 4.5:1', () => {
      const ratio = contrastRatio(darkColors.accentText, darkColors.accent);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});

// ─── Typography Tests ─────────────────────────────────────────────────────────

describe('Typography', () => {
  describe('scaleFontSize', () => {
    it('returns base size when font scale is 1.0', () => {
      // At default scale (mocked to 1.0 by jest-expo), should return base
      const result = scaleFontSize(17);
      expect(result).toBe(17);
    });

    it('always returns a positive integer', () => {
      const result = scaleFontSize(12);
      expect(result).toBeGreaterThan(0);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('scaleLineHeight', () => {
    it('returns base line height at default scale', () => {
      const result = scaleLineHeight(22);
      expect(result).toBe(22);
    });

    it('always returns a positive integer', () => {
      const result = scaleLineHeight(18);
      expect(result).toBeGreaterThan(0);
      expect(Number.isInteger(result)).toBe(true);
    });
  });

  describe('baseTypography', () => {
    it('defines all expected text styles', () => {
      const expectedKeys = [
        'largeTitle', 'title1', 'title2', 'title3',
        'headline', 'body', 'callout', 'subheadline',
        'footnote', 'caption1', 'caption2', 'code',
      ];
      expect(Object.keys(baseTypography)).toEqual(expect.arrayContaining(expectedKeys));
    });

    it('all font sizes are positive', () => {
      for (const [, style] of Object.entries(baseTypography)) {
        expect(style.fontSize).toBeGreaterThan(0);
      }
    });

    it('all line heights are greater than or equal to font sizes', () => {
      for (const [, style] of Object.entries(baseTypography)) {
        expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
      }
    });
  });

  describe('createTypography', () => {
    it('returns a typography object with all keys', () => {
      const typo = createTypography();
      expect(typo).toHaveProperty('body');
      expect(typo).toHaveProperty('headline');
      expect(typo).toHaveProperty('code');
      expect(typo.body.fontSize).toBeGreaterThan(0);
    });
  });
});

// ─── Dynamic Font Size Scaling Tests ──────────────────────────────────────────

describe('Dynamic Font Size Scaling', () => {
  afterEach(() => {
    // Restore default mock
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.0);
  });

  it('scales font size up at 1.5x accessibility setting', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    const result = scaleFontSize(17);
    expect(result).toBe(Math.round(17 * 1.5)); // 26
  });

  it('scales font size up at 2.0x accessibility setting', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2.0);
    const result = scaleFontSize(17);
    expect(result).toBe(Math.round(17 * 2.0)); // 34
  });

  it('clamps font size at maxScale (default 2.0x)', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(3.0);
    const result = scaleFontSize(17);
    // Should clamp to 2.0x, not 3.0x
    expect(result).toBe(Math.round(17 * 2.0)); // 34
  });

  it('scales line height proportionally', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    const result = scaleLineHeight(22);
    expect(result).toBe(Math.round(22 * 1.5)); // 33
  });

  it('createTypography produces larger sizes at increased scale', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.5);
    const scaledTypo = createTypography();
    expect(scaledTypo.body.fontSize).toBe(Math.round(17 * 1.5));
    expect(scaledTypo.body.lineHeight).toBe(Math.round(22 * 1.5));
  });

  it('createTypography respects max scale clamping', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2.5);
    const scaledTypo = createTypography();
    // Should clamp to 2.0x
    expect(scaledTypo.body.fontSize).toBe(Math.round(17 * 2.0));
    expect(scaledTypo.headline.fontSize).toBe(Math.round(17 * 2.0));
  });

  it('all font sizes remain positive at any valid scale', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(0.8);
    const scaledTypo = createTypography();
    for (const [, style] of Object.entries(scaledTypo)) {
      expect(style.fontSize).toBeGreaterThan(0);
      expect(style.lineHeight).toBeGreaterThan(0);
    }
  });

  it('line heights always >= font sizes at any scale', () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1.75);
    const scaledTypo = createTypography();
    for (const [, style] of Object.entries(scaledTypo)) {
      expect(style.lineHeight).toBeGreaterThanOrEqual(style.fontSize);
    }
  });
});

// ─── Spacing Tests ────────────────────────────────────────────────────────────

describe('Spacing', () => {
  it('all spacing values are positive multiples of 2', () => {
    for (const [, value] of Object.entries(spacing)) {
      expect(value).toBeGreaterThan(0);
      expect(value % 2).toBe(0);
    }
  });

  it('spacing values are in ascending order', () => {
    const values = Object.values(spacing);
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('uses 4pt grid for main spacing values (xs through massive)', () => {
    // xs and above should be multiples of 4
    expect(spacing.xs % 4).toBe(0);
    expect(spacing.sm % 4).toBe(0);
    expect(spacing.lg % 4).toBe(0);
    expect(spacing.xl % 4).toBe(0);
    expect(spacing.xxl % 4).toBe(0);
    expect(spacing.xxxl % 4).toBe(0);
    expect(spacing.huge % 4).toBe(0);
    expect(spacing.massive % 4).toBe(0);
  });

  it('border radii are all positive', () => {
    for (const [, value] of Object.entries(borderRadii)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});

// ─── Theme Object Tests ───────────────────────────────────────────────────────

describe('Theme', () => {
  describe('lightTheme', () => {
    it('has colors, typography, spacing, and borderRadii', () => {
      expect(lightTheme).toHaveProperty('colors');
      expect(lightTheme).toHaveProperty('typography');
      expect(lightTheme).toHaveProperty('spacing');
      expect(lightTheme).toHaveProperty('borderRadii');
    });

    it('isDark is false', () => {
      expect(lightTheme.isDark).toBe(false);
    });

    it('uses light colors', () => {
      expect(lightTheme.colors.background).toBe(lightColors.background);
    });
  });

  describe('darkTheme', () => {
    it('has colors, typography, spacing, and borderRadii', () => {
      expect(darkTheme).toHaveProperty('colors');
      expect(darkTheme).toHaveProperty('typography');
      expect(darkTheme).toHaveProperty('spacing');
      expect(darkTheme).toHaveProperty('borderRadii');
    });

    it('isDark is true', () => {
      expect(darkTheme.isDark).toBe(true);
    });

    it('uses dark colors', () => {
      expect(darkTheme.colors.background).toBe(darkColors.background);
    });
  });

  describe('createTheme', () => {
    it('creates light theme when isDark is false', () => {
      const theme = createTheme(false);
      expect(theme.isDark).toBe(false);
      expect(theme.colors).toEqual(lightColors);
    });

    it('creates dark theme when isDark is true', () => {
      const theme = createTheme(true);
      expect(theme.isDark).toBe(true);
      expect(theme.colors).toEqual(darkColors);
    });
  });
});
