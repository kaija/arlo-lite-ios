/**
 * Tests for the error classification module.
 *
 * Verifies that HTTP status codes, network errors, and streaming errors
 * are properly classified with appropriate messages, categories, and retry behavior.
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4
 */

import {
  classifyHttpError,
  classifyNetworkError,
  classifyStreamError,
  type ClassifiedError,
} from '../error-classifier';

describe('classifyHttpError', () => {
  it('classifies 401 as auth error, not retryable', () => {
    const result = classifyHttpError(401, '', 'Unauthorized');
    expect(result.category).toBe('auth');
    expect(result.isRetryable).toBe(false);
    expect(result.message).toContain('API key');
  });

  it('classifies 403 as auth error, not retryable', () => {
    const result = classifyHttpError(403, '', 'Forbidden');
    expect(result.category).toBe('auth');
    expect(result.isRetryable).toBe(false);
  });

  it('classifies 429 as rate limit error, retryable', () => {
    const result = classifyHttpError(429, '', 'Too Many Requests');
    expect(result.category).toBe('rate_limit');
    expect(result.isRetryable).toBe(true);
    expect(result.message).toContain('Rate limited');
  });

  it('classifies 500 as server error, retryable', () => {
    const result = classifyHttpError(500, '', 'Internal Server Error');
    expect(result.category).toBe('server');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies 502 as server error, retryable', () => {
    const result = classifyHttpError(502, '', 'Bad Gateway');
    expect(result.category).toBe('server');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies 503 as server error, retryable', () => {
    const result = classifyHttpError(503, '', 'Service Unavailable');
    expect(result.category).toBe('server');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies 400 as format error, not retryable', () => {
    const result = classifyHttpError(400, '', 'Bad Request');
    expect(result.category).toBe('format');
    expect(result.isRetryable).toBe(false);
  });

  it('classifies 404 as format error, not retryable', () => {
    const result = classifyHttpError(404, '', 'Not Found');
    expect(result.category).toBe('format');
    expect(result.isRetryable).toBe(false);
  });

  it('extracts error message from JSON response body (OpenAI format)', () => {
    const body = JSON.stringify({
      error: { message: 'Incorrect API key provided' },
    });
    const result = classifyHttpError(401, body, 'Unauthorized');
    expect(result.detail).toBe('Incorrect API key provided');
  });

  it('extracts error message from JSON response body (Anthropic format)', () => {
    const body = JSON.stringify({
      error: { type: 'authentication_error', message: 'invalid x-api-key' },
    });
    const result = classifyHttpError(401, body, 'Unauthorized');
    expect(result.detail).toBe('authentication_error: invalid x-api-key');
  });

  it('uses raw body when JSON parsing fails', () => {
    const body = 'plain text error message';
    const result = classifyHttpError(500, body, 'Internal Server Error');
    expect(result.detail).toBe('plain text error message');
  });

  it('truncates very long response bodies', () => {
    const body = 'x'.repeat(300);
    const result = classifyHttpError(500, body, 'Internal Server Error');
    expect(result.detail!.length).toBeLessThanOrEqual(201); // 200 + ellipsis
  });

  it('handles unknown status codes gracefully', () => {
    const result = classifyHttpError(418, '', "I'm a teapot");
    expect(result.category).toBe('unknown');
    expect(result.message).toContain('418');
  });
});

describe('classifyNetworkError', () => {
  it('classifies timeout errors as network, retryable', () => {
    const result = classifyNetworkError(new Error('Request timed out'));
    expect(result.category).toBe('network');
    expect(result.isRetryable).toBe(true);
    expect(result.message).toContain('timed out');
  });

  it('classifies network/connection errors as network, retryable', () => {
    const result = classifyNetworkError(new Error('Network request failed'));
    expect(result.category).toBe('network');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies DNS errors as network, retryable', () => {
    const result = classifyNetworkError(new Error('ENOTFOUND api.openai.com'));
    expect(result.category).toBe('network');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies connection refused as network, retryable', () => {
    const result = classifyNetworkError(new Error('ECONNREFUSED'));
    expect(result.category).toBe('network');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies abort errors as network, not retryable', () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    const result = classifyNetworkError(err);
    expect(result.category).toBe('network');
    expect(result.isRetryable).toBe(false);
  });

  it('classifies unknown errors as unknown, retryable', () => {
    const result = classifyNetworkError(new Error('something went wrong'));
    expect(result.category).toBe('unknown');
    expect(result.isRetryable).toBe(true);
  });
});

describe('classifyStreamError', () => {
  it('classifies HTTP errors embedded in stream error message', () => {
    const result = classifyStreamError(new Error('HTTP 429: Too Many Requests — rate limit exceeded'));
    expect(result.category).toBe('rate_limit');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies HTTP 401 in stream error', () => {
    const result = classifyStreamError(new Error('HTTP 401: Unauthorized — invalid api key'));
    expect(result.category).toBe('auth');
    expect(result.isRetryable).toBe(false);
  });

  it('classifies HTTP 500 in stream error', () => {
    const result = classifyStreamError(new Error('HTTP 500: Internal Server Error'));
    expect(result.category).toBe('server');
    expect(result.isRetryable).toBe(true);
  });

  it('classifies abort errors as stream, not retryable', () => {
    const err = new Error('The user aborted a request');
    err.name = 'AbortError';
    const result = classifyStreamError(err);
    expect(result.category).toBe('stream');
    expect(result.isRetryable).toBe(false);
  });

  it('classifies generic stream interruption as retryable', () => {
    const result = classifyStreamError(new Error('connection reset by peer'));
    expect(result.category).toBe('stream');
    expect(result.isRetryable).toBe(true);
    expect(result.message).toContain('interrupted');
  });

  it('includes original error message in detail', () => {
    const result = classifyStreamError(new Error('premature close'));
    expect(result.detail).toBe('premature close');
  });
});
