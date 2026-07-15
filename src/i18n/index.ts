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
 * Initialize i18next with device locale detection.
 * Registers only the detected locale and the fallback (if different).
 */
function initI18n(): typeof i18n {
  const detectedLocale = detectDeviceLocale();

  const resources: Record<string, { translation: Record<string, unknown> }> = {
    [detectedLocale]: { translation: localeResources[detectedLocale] },
  };

  // Ensure fallback resources are always available
  if (detectedLocale !== FALLBACK_LOCALE) {
    resources[FALLBACK_LOCALE] = {
      translation: localeResources[FALLBACK_LOCALE],
    };
  }

  i18n.use(initReactI18next).init({
    lng: detectedLocale,
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

export { initI18n, detectDeviceLocale, SUPPORTED_LOCALES, FALLBACK_LOCALE };
export type { SupportedLocale };
export default i18n;
