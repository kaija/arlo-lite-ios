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
  version: '1.1.0',
  description: 'A lightweight LLM client - bring your own API key',
  license: 'MIT',
  repository: 'https://github.com/arlo-lite/arlo-lite-ios',
} as const;

/**
 * Session title configuration.
 */
export const SESSION_TITLE_MAX_LENGTH = 50;

/**
 * Remote metadata table URL.
 * Contains context window sizes, token prices, and capability flags for known models.
 * Can be overridden via environment config in the future.
 */
export const MODEL_METADATA_URL =
  'https://raw.githubusercontent.com/arlo-lite/model-metadata/main/metadata.json';

/**
 * Maximum age (in milliseconds) before metadata cache is considered stale.
 * Default: 24 hours.
 */
export const METADATA_MAX_AGE_MS = 24 * 60 * 60 * 1000;
