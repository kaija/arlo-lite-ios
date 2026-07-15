/**
 * Property-based test: Provider request format correctness
 *
 * Feature: arlo-lite-app, Property 1: Provider request format correctness
 *
 * For any valid provider configuration (OpenAI Responses, OpenAI Chat Completions,
 * Anthropic, or Custom) and any non-empty message history, building a request
 * through the corresponding provider adapter should produce a well-formed HTTP
 * request body that conforms to that provider's API specification.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
 */

import * as fc from 'fast-check';
import { getProvider, clearProviderCache } from '../registry';
import { OpenAIProvider } from '../openai/openai-provider';
import { CustomProvider } from '../custom/custom-provider';
import type {
  ProviderConfig,
  CompletionRequest,
  ChatMessage,
  ThinkingLevel,
  ProviderType,
  OpenAIApiMode,
} from '../types';

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a random ThinkingLevel. */
const arbThinkingLevel: fc.Arbitrary<ThinkingLevel> = fc.constantFrom(
  'off',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh'
);

/** Generate a random non-empty message content string. */
const arbMessageContent = fc.string({ minLength: 1, maxLength: 200 });

/** Generate a random role for messages. */
const arbRole = fc.constantFrom<'system' | 'user' | 'assistant'>('system', 'user', 'assistant');

/** Generate a random ChatMessage. */
const arbChatMessage: fc.Arbitrary<ChatMessage> = fc.record({
  role: arbRole,
  content: arbMessageContent,
});

/** Generate a non-empty array of messages (1-10). */
const arbMessages: fc.Arbitrary<ChatMessage[]> = fc.array(arbChatMessage, {
  minLength: 1,
  maxLength: 10,
});

/** Generate a random model name. */
const arbModelName = fc.stringMatching(/^[a-z0-9][a-z0-9\-\.\/]{2,40}$/);

/** Generate a random base URL (valid http/https URL). */
const arbBaseUrl = fc.constantFrom(
  'https://api.openai.com/v1',
  'https://api.anthropic.com',
  'https://my-custom-llm.example.com/v1',
  'https://localhost:8080',
  'https://api.together.xyz/v1'
);

/** Provider type + api mode combinations that make sense. */
interface ProviderScenario {
  type: ProviderType;
  apiMode?: OpenAIApiMode;
}

const arbProviderScenario: fc.Arbitrary<ProviderScenario> = fc.constantFrom(
  { type: 'openai' as const, apiMode: 'responses' as const },
  { type: 'openai' as const, apiMode: 'chat-completions' as const },
  { type: 'anthropic' as const, apiMode: undefined },
  { type: 'custom' as const, apiMode: undefined }
);

/** Generate a full ProviderConfig given a scenario and base URL. */
function arbProviderConfig(scenario: ProviderScenario, baseUrl: string): ProviderConfig {
  return {
    id: 'test-provider-id',
    type: scenario.type,
    name: 'Test Provider',
    baseUrl,
    apiMode: scenario.apiMode,
    streamingEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/** Generate a CompletionRequest. */
function arbCompletionRequest(
  messages: ChatMessage[],
  model: string,
  thinkingLevel: ThinkingLevel
): CompletionRequest {
  return {
    messages,
    model,
    thinkingLevel,
    stream: true,
  };
}

// ─── Test ────────────────────────────────────────────────────────────────────

describe('Property 1: Provider request format correctness', () => {
  beforeEach(() => {
    clearProviderCache();
  });

  it('should produce well-formed HTTP request bodies for all provider types', () => {
    fc.assert(
      fc.property(
        arbProviderScenario,
        arbBaseUrl,
        arbMessages,
        arbModelName,
        arbThinkingLevel,
        (scenario, baseUrl, messages, model, thinkingLevel) => {
          // Arrange
          const config = arbProviderConfig(scenario, baseUrl);
          const request = arbCompletionRequest(messages, model, thinkingLevel);

          const provider = getProvider(scenario.type);

          // OpenAI and Custom providers require apiKey to be set
          if (provider.type === 'openai') {
            (provider as OpenAIProvider).setApiKey('sk-test-key');
          } else if (provider.type === 'custom') {
            (provider as CustomProvider).setApiKey('sk-test-key');
          }

          // Act
          const result = provider.buildRequest(config, request);

          // Assert 1: url is a non-empty string starting with the config's baseUrl
          expect(result.url).toBeTruthy();
          expect(typeof result.url).toBe('string');
          expect(result.url.startsWith(baseUrl)).toBe(true);

          // Assert 2: headers contains Content-Type or content-type
          const headerKeys = Object.keys(result.headers).map((k) => k.toLowerCase());
          expect(headerKeys).toContain('content-type');

          // Assert 3: body is valid JSON
          expect(typeof result.body).toBe('string');
          let parsedBody: Record<string, unknown>;
          expect(() => {
            parsedBody = JSON.parse(result.body);
          }).not.toThrow();

          parsedBody = JSON.parse(result.body);

          // Assert 4: Parsed body contains the model field matching request.model
          expect(parsedBody.model).toBe(model);

          // Assert 5-7: Provider-specific body structure
          if (scenario.type === 'openai' && scenario.apiMode === 'responses') {
            // OpenAI Responses API: body has `input` array
            expect(Array.isArray(parsedBody.input)).toBe(true);
            expect((parsedBody.input as unknown[]).length).toBeGreaterThan(0);
          } else if (scenario.type === 'openai' && scenario.apiMode === 'chat-completions') {
            // OpenAI Chat Completions: body has `messages` array
            expect(Array.isArray(parsedBody.messages)).toBe(true);
            expect((parsedBody.messages as unknown[]).length).toBeGreaterThan(0);
          } else if (scenario.type === 'anthropic') {
            // Anthropic: body has `messages` and optionally `system`
            expect(Array.isArray(parsedBody.messages)).toBe(true);
            // messages array should contain only non-system messages
            const nonSystemCount = messages.filter((m) => m.role !== 'system').length;
            if (nonSystemCount > 0) {
              expect((parsedBody.messages as unknown[]).length).toBe(nonSystemCount);
            }
            // system field is present if there were system messages
            const hasSystemMessage = messages.some((m) => m.role === 'system');
            if (hasSystemMessage) {
              expect(parsedBody.system).toBeDefined();
            }
          } else if (scenario.type === 'custom') {
            // Custom: uses OpenAI Chat Completions format, body has `messages` array
            expect(Array.isArray(parsedBody.messages)).toBe(true);
            expect((parsedBody.messages as unknown[]).length).toBeGreaterThan(0);
          }

          // Assert 8: body contains `stream` boolean
          expect(typeof parsedBody.stream).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });
});
