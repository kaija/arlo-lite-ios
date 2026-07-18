import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';

import en from './locales/en.json';
import zhTW from './locales/zh-TW.json';

// Supported locales
const SUPPORTED_LOCALES = ['en', 'zh-TW'] as const;
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

const FALLBACK_LOCALE: SupportedLocale = 'en';

/**
 * Locale resource map. English is always loaded; additional locales
 * are statically imported but only registered when matched to the device locale.
 * Metro bundler handles tree-shaking/splitting at build time.
 */
const localeResources: Record<SupportedLocale, Record<string, unknown>> = {
  en,
  'zh-TW': zhTW,
};

/**
 * Detect the best matching supported locale from the device settings.
 * Checks full language tags, language+region combos, and language codes.
 */
function detectDeviceLocale(): SupportedLocale {
  const deviceLocales = getLocales();

  for (const locale of deviceLocales) {
    const tag = locale.languageTag; // e.g. "zh-Hant-TW", "en-US"

    // Exact match on full tag
    if (SUPPORTED_LOCALES.includes(tag as SupportedLocale)) {
      return tag as SupportedLocale;
    }

    // Match language + region (e.g. "zh-TW")
    const langRegion = `${locale.languageCode}-${locale.regionCode}`;
    if (SUPPORTED_LOCALES.includes(langRegion as SupportedLocale)) {
      return langRegion as SupportedLocale;
    }

    // Match Traditional Chinese variants by languageTag pattern
    if (
      locale.languageCode === 'zh' &&
      (locale.regionCode === 'TW' ||
        locale.regionCode === 'HK' ||
        tag.includes('Hant'))
    ) {
      return 'zh-TW';
    }

    // Match base language code
    if (locale.languageCode === 'en') {
      return 'en';
    }
  }

  return FALLBACK_LOCALE;
}

/**
 * Human-readable display names for each supported locale.
 * Used in the language switcher UI.
 */
const LOCALE_DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
};

/**
 * Initialize i18next with device locale detection.
 * Registers ALL supported locales so runtime switching works seamlessly.
 */
function initI18n(overrideLocale?: string): typeof i18n {
  const initialLocale = overrideLocale
    ? normalizeLocale(overrideLocale)
    : detectDeviceLocale();

  // Register all locale resources so changeLanguage works without reloading
  const resources: Record<string, { translation: Record<string, unknown> }> = {};
  for (const locale of SUPPORTED_LOCALES) {
    resources[locale] = { translation: localeResources[locale] };
  }

  i18n.use(initReactI18next).init({
    lng: initialLocale,
    fallbackLng: FALLBACK_LOCALE,
    resources,
    interpolation: {
      escapeValue: false, // React already handles XSS
    },
    react: {
      useSuspense: false, // Avoid suspense boundary issues in React Native
    },
  });

  return i18n;
}

/**
 * Check if a locale string is one of our supported locales.
 */
function isSupported(locale?: string): locale is SupportedLocale {
  return !!locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale);
}

/**
 * Normalize a locale string to a supported locale.
 * Handles variants like 'zh-Hant-TW' → 'zh-TW', 'en-US' → 'en'.
 */
function normalizeLocale(locale: string): SupportedLocale {
  // Direct match
  if (isSupported(locale)) return locale;

  // Try language-region (e.g. 'zh-TW' from 'zh-Hant-TW')
  const parts = locale.split('-');
  if (parts[0] === 'zh') return 'zh-TW';
  if (parts[0] === 'en') return 'en';

  // Check language+region combo
  if (parts.length >= 2) {
    const langRegion = `${parts[0]}-${parts[parts.length - 1]}`;
    if (isSupported(langRegion)) return langRegion;
  }

  return FALLBACK_LOCALE;
}

/**
 * Change the active language at runtime.
 * Accepts any locale string — normalizes to a supported locale before switching.
 */
async function changeAppLanguage(locale: string): Promise<void> {
  const target = normalizeLocale(locale);
  await i18n.changeLanguage(target);
}

export {
  initI18n,
  detectDeviceLocale,
  changeAppLanguage,
  SUPPORTED_LOCALES,
  FALLBACK_LOCALE,
  LOCALE_DISPLAY_NAMES,
};
export type { SupportedLocale };
export default i18n;
