/**
 * Theme system for Arlo Lite.
 *
 * Provides a React context-based theming solution supporting:
 * - Light, dark, and system-follow appearance modes
 * - Dynamic font sizing via accessibility settings
 * - Consistent spacing scale
 * - WCAG AA 4.5:1 contrast compliance
 *
 * Usage:
 *   const { colors, typography, spacing } = useTheme();
 */

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { ColorPalette, lightColors, darkColors } from './colors';
import { Typography, createTypography } from './typography';
import { Spacing, BorderRadii, spacing, borderRadii } from './spacing';

export type AppearanceMode = 'light' | 'dark' | 'system';

export interface Theme {
  colors: ColorPalette;
  typography: Typography;
  spacing: Spacing;
  borderRadii: BorderRadii;
  isDark: boolean;
}

/**
 * Creates a complete theme object for the given appearance mode.
 */
export function createTheme(isDark: boolean): Theme {
  return {
    colors: isDark ? darkColors : lightColors,
    typography: createTypography(),
    spacing,
    borderRadii,
    isDark,
  };
}

/** Pre-built light theme instance (useful for testing / static contexts) */
export const lightTheme: Theme = {
  colors: lightColors,
  typography: createTypography(),
  spacing,
  borderRadii,
  isDark: false,
};

/** Pre-built dark theme instance (useful for testing / static contexts) */
export const darkTheme: Theme = {
  colors: darkColors,
  typography: createTypography(),
  spacing,
  borderRadii,
  isDark: true,
};

// ─── React Context ────────────────────────────────────────────────────────────

const ThemeContext = createContext<Theme>(lightTheme);

export interface ThemeProviderProps {
  /** The user's appearance preference from settings store */
  mode: AppearanceMode;
  children: React.ReactNode;
}

/**
 * ThemeProvider wraps the app to supply theme values via context.
 *
 * Resolves 'system' mode using the device's current color scheme.
 */
export function ThemeProvider({ mode, children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    let isDark: boolean;
    if (mode === 'system') {
      isDark = systemColorScheme === 'dark';
    } else {
      isDark = mode === 'dark';
    }
    return createTheme(isDark);
  }, [mode, systemColorScheme]);

  return React.createElement(ThemeContext.Provider, { value: theme }, children);
}

/**
 * Hook to access the current theme within any component.
 *
 * @example
 * const { colors, typography, spacing } = useTheme();
 */
export function useTheme(): Theme {
  return useContext(ThemeContext);
}

// Re-export sub-modules for direct imports when needed
export { lightColors, darkColors } from './colors';
export type { ColorPalette } from './colors';
export { createTypography, scaleFontSize, scaleLineHeight, getFontScale, baseTypography } from './typography';
export type { Typography, FontStyle } from './typography';
export { spacing, borderRadii } from './spacing';
export type { Spacing, BorderRadii } from './spacing';
export {
  SIDEBAR_EASING,
  DIALOG_EASING,
  TRANSITION_DURATION,
  SETTINGS_SLIDE_DURATION,
  MODEL_PICKER_FADE_DURATION,
  SIDEBAR_TRANSITION_DURATION,
  TOAST_ENTER_DURATION,
  TOAST_EXIT_DURATION,
  TOAST_DISPLAY_DURATION,
  RENAME_DIALOG_DURATION,
} from './animations';
