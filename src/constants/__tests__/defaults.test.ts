import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_PROVIDER_URLS,
  APP_METADATA,
  SESSION_TITLE_MAX_LENGTH,
} from '../defaults';

describe('defaults constants', () => {
  describe('DEFAULT_SYSTEM_PROMPT', () => {
    it('is a non-empty string', () => {
      expect(DEFAULT_SYSTEM_PROMPT.length).toBeGreaterThan(0);
    });
  });

  describe('DEFAULT_PROVIDER_URLS', () => {
    it('has the correct OpenAI base URL', () => {
      expect(DEFAULT_PROVIDER_URLS.openai).toBe('https://api.openai.com/v1');
    });

    it('has the correct Anthropic base URL', () => {
      expect(DEFAULT_PROVIDER_URLS.anthropic).toBe('https://api.anthropic.com');
    });
  });

  describe('APP_METADATA', () => {
    it('has a name', () => {
      expect(APP_METADATA.name).toBe('Arlo Lite');
    });

    it('has a version string', () => {
      expect(APP_METADATA.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('SESSION_TITLE_MAX_LENGTH', () => {
    it('is set to 50', () => {
      expect(SESSION_TITLE_MAX_LENGTH).toBe(50);
    });
  });
});
