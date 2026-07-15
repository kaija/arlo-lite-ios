/**
 * Tests for AboutScreen.
 *
 * Validates the component exports correctly and that it uses
 * the expected APP_METADATA constants for display.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AboutScreen } from '../AboutScreen';
import { APP_METADATA } from '@/constants/defaults';

describe('AboutScreen', () => {
  it('exports the AboutScreen component', () => {
    expect(AboutScreen).toBeDefined();
    expect(typeof AboutScreen).toBe('function');
  });

  it('APP_METADATA contains required fields for the about screen', () => {
    expect(APP_METADATA.name).toBe('Arlo Lite');
    expect(APP_METADATA.version).toBeDefined();
    expect(APP_METADATA.license).toBe('MIT');
    expect(APP_METADATA.repository).toContain('github.com');
    expect(APP_METADATA.description).toBeDefined();
  });

  it('APP_METADATA version is a valid semver string', () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;
    expect(APP_METADATA.version).toMatch(semverRegex);
  });

  it('APP_METADATA repository is a valid URL', () => {
    expect(APP_METADATA.repository).toMatch(/^https?:\/\//);
  });
});
