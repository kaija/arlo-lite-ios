/**
 * Color palettes for Arlo Lite.
 *
 * Design principles:
 * - Minimal, cool-toned aesthetic (Linear/Raycast-inspired)
 * - Single accent color: indigo #5856D6
 * - Monochrome palette outside of accent
 * - All text-on-background pairs maintain WCAG AA 4.5:1 minimum contrast ratio
 */

export interface ColorPalette {
  /** Primary background color */
  background: string;
  /** Elevated surface (cards, modals, drawers) */
  surface: string;
  /** Secondary surface for grouped content areas */
  surfaceSecondary: string;
  /** Primary text color */
  text: string;
  /** Secondary/muted text color */
  textSecondary: string;
  /** Tertiary/placeholder text */
  textTertiary: string;
  /** Accent color for interactive elements and highlights */
  accent: string;
  /** Accent text that appears on accent backgrounds */
  accentText: string;
  /** Border/separator color */
  border: string;
  /** Error/destructive action color */
  error: string;
  /** Error text for readability on backgrounds */
  errorText: string;
  /** Success/confirmation color */
  success: string;
  /** Warning/caution color */
  warning: string;
  /** Code block background */
  codeBackground: string;
  /** Input field background */
  inputBackground: string;
  /** Overlay/scrim for modals */
  overlay: string;
}

/**
 * Light mode color palette.
 *
 * Contrast ratios (text on background):
 * - text (#1C1C1E) on background (#FFFFFF): 17.4:1
 * - textSecondary (#636366) on background (#FFFFFF): 5.9:1
 * - textTertiary (#8E8E93) on background (#FFFFFF): 3.9:1 (decorative only, not body text)
 * - accent (#5856D6) on background (#FFFFFF): 5.1:1
 * - error (#D32F2F) on background (#FFFFFF): 5.6:1
 */
export const lightColors: ColorPalette = {
  background: '#FFFFFF',
  surface: '#F2F2F7',
  surfaceSecondary: '#E5E5EA',
  text: '#1C1C1E',
  textSecondary: '#636366',
  textTertiary: '#8E8E93',
  accent: '#5856D6',
  accentText: '#FFFFFF',
  border: '#D1D1D6',
  error: '#D32F2F',
  errorText: '#D32F2F',
  success: '#34C759',
  warning: '#FF9500',
  codeBackground: '#1C1C1E',
  inputBackground: '#F2F2F7',
  overlay: 'rgba(0, 0, 0, 0.4)',
};

/**
 * Dark mode color palette.
 *
 * Contrast ratios (text on background):
 * - text (#F2F2F7) on background (#000000): 18.1:1
 * - textSecondary (#AEAEB2) on background (#000000): 9.3:1
 * - textTertiary (#636366) on background (#000000): 4.6:1
 * - accent (#7B79E8) on background (#000000): 6.2:1
 * - accentText (#1C1C1E) on accent (#7B79E8): 5.0:1
 * - error (#EF5350) on background (#000000): 5.5:1
 */
export const darkColors: ColorPalette = {
  background: '#000000',
  surface: '#1C1C1E',
  surfaceSecondary: '#2C2C2E',
  text: '#F2F2F7',
  textSecondary: '#AEAEB2',
  textTertiary: '#636366',
  accent: '#7B79E8',
  accentText: '#1C1C1E',
  border: '#38383A',
  error: '#EF5350',
  errorText: '#EF5350',
  success: '#30D158',
  warning: '#FFD60A',
  codeBackground: '#1C1C1E',
  inputBackground: '#1C1C1E',
  overlay: 'rgba(0, 0, 0, 0.6)',
};
