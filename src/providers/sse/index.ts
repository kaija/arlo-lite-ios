/**
 * SSE streaming module — provides the stream manager and format-specific parsers.
 */

export { createSSEStream } from './sse-manager';
export type { SSECallbacks, SSEConnection, SSELineParser } from './sse-manager';
export { parseOpenAISSELine, splitSSEBuffer } from './openai-parser';
export type { OpenAIParsedLine } from './openai-parser';
export {
  parseAnthropicSSELine,
  createAnthropicParserState,
} from './anthropic-parser';
export type { AnthropicParsedEvent, AnthropicParserState } from './anthropic-parser';
