/**
 * Default system prompt applied to new sessions when no user-defined default is set.
 */
export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful assistant. Answer questions clearly and concisely.';

/**
 * Default base URLs for each provider type.
 */
export const DEFAULT_PROVIDER_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
} as const;

/**
 * App metadata constants.
 */
export const APP_METADATA = {
  name: 'Arlo Lite',
  version: '1.0.0',
  description: 'A lightweight LLM client - bring your own API key',
  license: 'MIT',
  repository: 'https://github.com/arlo-lite/arlo-lite-ios',
} as const;

/**
 * Session title configuration.
 */
export const SESSION_TITLE_MAX_LENGTH = 50;
