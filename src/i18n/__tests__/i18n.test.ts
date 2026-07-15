/**
 * Unit tests for i18n setup.
 *
 * Tests cover:
 * - Locale detection and fallback to English
 * - i18next initialization
 * - All locale files have matching keys
 */
import { detectDeviceLocale, SUPPORTED_LOCALES, FALLBACK_LOCALE } from '../index';
import en from '../locales/en.json';
import zhTW from '../locales/zh-TW.json';

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [
    {
      languageTag: 'en-US',
      languageCode: 'en',
      regionCode: 'US',
      currencyCode: 'USD',
      currencySymbol: '$',
      decimalSeparator: '.',
      digitGroupingSeparator: ',',
      textDirection: 'ltr',
    },
  ]),
}));

// Mock react-i18next
jest.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: jest.fn(),
  },
}));

const { getLocales } = require('expo-localization');

// ─── Helper: Extract all leaf keys from nested JSON ───────────────────────────

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

// ─── Locale Detection Tests ───────────────────────────────────────────────────

describe('detectDeviceLocale', () => {
  it('returns "en" for English device locale', () => {
    getLocales.mockReturnValue([
      { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
    ]);
    expect(detectDeviceLocale()).toBe('en');
  });

  it('returns "zh-TW" for Traditional Chinese (Taiwan) locale', () => {
    getLocales.mockReturnValue([
      { languageTag: 'zh-TW', languageCode: 'zh', regionCode: 'TW' },
    ]);
    expect(detectDeviceLocale()).toBe('zh-TW');
  });

  it('returns "zh-TW" for zh-Hant tag variants', () => {
    getLocales.mockReturnValue([
      { languageTag: 'zh-Hant-TW', languageCode: 'zh', regionCode: 'TW' },
    ]);
    expect(detectDeviceLocale()).toBe('zh-TW');
  });

  it('returns "zh-TW" for Hong Kong Traditional Chinese', () => {
    getLocales.mockReturnValue([
      { languageTag: 'zh-Hant-HK', languageCode: 'zh', regionCode: 'HK' },
    ]);
    expect(detectDeviceLocale()).toBe('zh-TW');
  });

  it('falls back to "en" for unsupported locales', () => {
    getLocales.mockReturnValue([
      { languageTag: 'fr-FR', languageCode: 'fr', regionCode: 'FR' },
    ]);
    expect(detectDeviceLocale()).toBe('en');
  });

  it('falls back to "en" when device returns empty locales', () => {
    getLocales.mockReturnValue([]);
    expect(detectDeviceLocale()).toBe('en');
  });

  it('uses first matching locale from preference list', () => {
    getLocales.mockReturnValue([
      { languageTag: 'ja-JP', languageCode: 'ja', regionCode: 'JP' },
      { languageTag: 'zh-TW', languageCode: 'zh', regionCode: 'TW' },
      { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
    ]);
    expect(detectDeviceLocale()).toBe('zh-TW');
  });
});

// ─── i18n Initialization Tests ────────────────────────────────────────────────

describe('initI18n', () => {
  it('initializes i18next with detected locale', () => {
    getLocales.mockReturnValue([
      { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
    ]);

    const { initI18n } = require('../index');
    const i18nInstance = initI18n();

    expect(i18nInstance.language).toBe('en');
  });

  it('sets fallbackLng to en', () => {
    getLocales.mockReturnValue([
      { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
    ]);

    const { initI18n } = require('../index');
    const i18nInstance = initI18n();

    expect(i18nInstance.options.fallbackLng).toEqual(['en']);
  });

  it('can change language to zh-TW after initialization', () => {
    getLocales.mockReturnValue([
      { languageTag: 'en-US', languageCode: 'en', regionCode: 'US' },
    ]);

    const { initI18n } = require('../index');
    const i18nInstance = initI18n();

    i18nInstance.changeLanguage('zh-TW');
    expect(i18nInstance.language).toBe('zh-TW');
  });
});

// ─── Locale File Consistency Tests ────────────────────────────────────────────

describe('locale files', () => {
  const enKeys = getLeafKeys(en as Record<string, unknown>);
  const zhTWKeys = getLeafKeys(zhTW as Record<string, unknown>);

  it('zh-TW has all keys present in en', () => {
    const missingInZhTW = enKeys.filter((k) => !zhTWKeys.includes(k));
    expect(missingInZhTW).toEqual([]);
  });

  it('en has all keys present in zh-TW', () => {
    const missingInEn = zhTWKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('both locale files have the same number of keys', () => {
    expect(enKeys.length).toBe(zhTWKeys.length);
  });
});

// ─── Constants Tests ──────────────────────────────────────────────────────────

describe('i18n constants', () => {
  it('has en and zh-TW as supported locales', () => {
    expect(SUPPORTED_LOCALES).toContain('en');
    expect(SUPPORTED_LOCALES).toContain('zh-TW');
  });

  it('uses en as the fallback locale', () => {
    expect(FALLBACK_LOCALE).toBe('en');
  });
});
