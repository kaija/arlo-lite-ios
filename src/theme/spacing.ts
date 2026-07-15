/**
 * Spacing system for Arlo Lite.
 *
 * Based on a 4pt grid system for consistent spatial rhythm.
 * All values are multiples of 4.
 */

export interface Spacing {
  /** 2px — hairline separators */
  xxs: number;
  /** 4px — minimal padding */
  xs: number;
  /** 8px — compact spacing (between related elements) */
  sm: number;
  /** 12px — tight spacing */
  md: number;
  /** 16px — standard spacing (default padding, gaps) */
  lg: number;
  /** 20px — comfortable spacing */
  xl: number;
  /** 24px — section spacing */
  xxl: number;
  /** 32px — group spacing */
  xxxl: number;
  /** 40px — large section gaps */
  huge: number;
  /** 48px — screen-level padding */
  massive: number;
}

export const spacing: Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  massive: 48,
};

/**
 * Border radius constants following the same spatial system.
 */
export interface BorderRadii {
  /** 4px — subtle rounding (buttons, inputs) */
  sm: number;
  /** 8px — card rounding */
  md: number;
  /** 12px — modal/sheet rounding */
  lg: number;
  /** 16px — large card rounding */
  xl: number;
  /** 9999px — pill/circular shape */
  full: number;
}

export const borderRadii: BorderRadii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};
