import { useSettingsStore } from '@/stores/settings-store';
import { useTheme as useThemeContext } from '@/theme/index';
import type { AppearanceMode } from '@/theme/index';
import type { ThemeMode } from '@/stores/settings-store';

export interface UseThemeResult {
  colors: ReturnType<typeof useThemeContext>['colors'];
  typography: ReturnType<typeof useThemeContext>['typography'];
  spacing: ReturnType<typeof useThemeContext>['spacing'];
  borderRadii: ReturnType<typeof useThemeContext>['borderRadii'];
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Combines the settings store's theme preference with the ThemeProvider context.
 *
 * Exposes the resolved theme values (colors, typography, spacing) along with
 * the current mode setting and a setter to change it.
 */
export function useAppTheme(): UseThemeResult {
  const theme = useThemeContext();
  const mode = useSettingsStore((s) => s.theme);
  const setMode = useSettingsStore((s) => s.setTheme);

  return {
    colors: theme.colors,
    typography: theme.typography,
    spacing: theme.spacing,
    borderRadii: theme.borderRadii,
    isDark: theme.isDark,
    mode,
    setMode,
  };
}

export { useThemeContext as useTheme };
