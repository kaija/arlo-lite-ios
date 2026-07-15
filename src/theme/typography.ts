/**
 * Typography system for Arlo Lite.
 *
 * Supports dynamic font sizing based on device accessibility settings
 * using React Native's PixelRatio.getFontScale(). All sizes are base values
 * that scale proportionally with the user's preferred text size.
 *
 * Uses the system font (San Francisco on iOS, Roboto on Android).
 */

import { PixelRatio, Platform } from 'react-native';

export interface FontStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700';
  letterSpacing?: number;
}

export interface Typography {
  /** Large title for screen headers (34pt base) */
  largeTitle: FontStyle;
  /** Title level 1 (28pt base) */
  title1: FontStyle;
  /** Title level 2 (22pt base) */
  title2: FontStyle;
  /** Title level 3 (20pt base) */
  title3: FontStyle;
  /** Headline for list rows and emphasis (17pt bold) */
  headline: FontStyle;
  /** Standard body text (17pt base) */
  body: FontStyle;
  /** Callout text for secondary content (16pt base) */
  callout: FontStyle;
  /** Subheadline (15pt base) */
  subheadline: FontStyle;
  /** Footnote for metadata and timestamps (13pt base) */
  footnote: FontStyle;
  /** Caption level 1 (12pt base) */
  caption1: FontStyle;
  /** Caption level 2 (11pt base) */
  caption2: FontStyle;
  /** Monospace font for code blocks (15pt base) */
  code: FontStyle;
}

/**
 * Returns the current device font scale factor.
 * Returns 1.0 at default system size, larger values when user has
 * increased text size in accessibility settings.
 */
export function getFontScale(): number {
  return PixelRatio.getFontScale();
}

/**
 * Scales a base font size according to device accessibility settings.
 * Allows text to scale up to 2x for users who need larger text,
 * while maintaining a minimum readable size.
 */
export function scaleFontSize(baseSize: number, maxScale: number = 2.0): number {
  const scale = getFontScale();
  const clampedScale = Math.min(scale, maxScale);
  return Math.round(baseSize * clampedScale);
}

/**
 * Scales a line height proportionally to font size scaling.
 */
export function scaleLineHeight(baseLineHeight: number, maxScale: number = 2.0): number {
  const scale = getFontScale();
  const clampedScale = Math.min(scale, maxScale);
  return Math.round(baseLineHeight * clampedScale);
}

/**
 * Creates the typography scale with dynamic sizing applied.
 * Call this when the component mounts or when accessibility settings change.
 */
export function createTypography(): Typography {
  return {
    largeTitle: {
      fontSize: scaleFontSize(34),
      lineHeight: scaleLineHeight(41),
      fontWeight: '700',
      letterSpacing: 0.37,
    },
    title1: {
      fontSize: scaleFontSize(28),
      lineHeight: scaleLineHeight(34),
      fontWeight: '700',
      letterSpacing: 0.36,
    },
    title2: {
      fontSize: scaleFontSize(22),
      lineHeight: scaleLineHeight(28),
      fontWeight: '700',
      letterSpacing: 0.35,
    },
    title3: {
      fontSize: scaleFontSize(20),
      lineHeight: scaleLineHeight(25),
      fontWeight: '600',
      letterSpacing: 0.38,
    },
    headline: {
      fontSize: scaleFontSize(17),
      lineHeight: scaleLineHeight(22),
      fontWeight: '600',
      letterSpacing: -0.41,
    },
    body: {
      fontSize: scaleFontSize(17),
      lineHeight: scaleLineHeight(22),
      fontWeight: '400',
      letterSpacing: -0.41,
    },
    callout: {
      fontSize: scaleFontSize(16),
      lineHeight: scaleLineHeight(21),
      fontWeight: '400',
      letterSpacing: -0.32,
    },
    subheadline: {
      fontSize: scaleFontSize(15),
      lineHeight: scaleLineHeight(20),
      fontWeight: '400',
      letterSpacing: -0.24,
    },
    footnote: {
      fontSize: scaleFontSize(13),
      lineHeight: scaleLineHeight(18),
      fontWeight: '400',
      letterSpacing: -0.08,
    },
    caption1: {
      fontSize: scaleFontSize(12),
      lineHeight: scaleLineHeight(16),
      fontWeight: '400',
    },
    caption2: {
      fontSize: scaleFontSize(11),
      lineHeight: scaleLineHeight(13),
      fontWeight: '400',
      letterSpacing: 0.07,
    },
    code: {
      fontSize: scaleFontSize(15),
      lineHeight: scaleLineHeight(20),
      fontWeight: '400',
      ...(Platform.OS === 'ios'
        ? { fontFamily: 'Menlo' }
        : { fontFamily: 'monospace' }),
    } as FontStyle,
  };
}

/**
 * Base typography values (unscaled) for reference and testing.
 */
export const baseTypography: Typography = {
  largeTitle: {
    fontSize: 34,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  title1: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: 0.36,
  },
  title2: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.35,
  },
  title3: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '600',
    letterSpacing: 0.38,
  },
  headline: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    letterSpacing: -0.41,
  },
  body: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '400',
    letterSpacing: -0.41,
  },
  callout: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: -0.32,
  },
  subheadline: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: -0.24,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
    letterSpacing: -0.08,
  },
  caption1: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
  },
  caption2: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '400',
    letterSpacing: 0.07,
  },
  code: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
};
