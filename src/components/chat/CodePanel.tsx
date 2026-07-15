/**
 * CodePanel — Syntax-highlighted code block for chat messages.
 *
 * Fixed dark background (#15151b) independent of app theme, with single-hue
 * accent-derived syntax highlighting via Prism tokenization from
 * react-syntax-highlighter. Renders tokens as React Native Text elements.
 *
 * Supports horizontal scroll for long lines, a copy button with confirmation,
 * and monospace font that respects Dynamic Type.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  View,
} from 'react-native';

import { useTheme } from '@/theme';
import { useToast } from '@/components/overlays/ToastProvider';
import { copyToClipboard } from '@/utils/clipboard';

export interface CodePanelProps {
  /** The raw code content to display */
  code: string;
  /** Programming language for syntax highlighting (optional) */
  language?: string;
}

/**
 * Set of languages recognized by our highlighter.
 * If the provided language is not in this set, we render plain text
 * and hide the language label.
 */
const RECOGNIZED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'python',
  'java',
  'c',
  'cpp',
  'csharp',
  'go',
  'rust',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'dart',
  'html',
  'css',
  'scss',
  'json',
  'yaml',
  'xml',
  'sql',
  'bash',
  'shell',
  'sh',
  'zsh',
  'powershell',
  'markdown',
  'graphql',
  'dockerfile',
  'toml',
  'ini',
  'lua',
  'r',
  'scala',
  'elixir',
  'erlang',
  'haskell',
  'clojure',
  'lisp',
  'perl',
  'vim',
  'makefile',
  'diff',
  'objectivec',
  'objc',
]);

/**
 * Token type categories mapped to theme color keys.
 */
type TokenCategory = 'keyword' | 'string' | 'type' | 'comment' | 'plain' | 'punctuation';

/**
 * Maps token class names from Prism to our color categories.
 */
function classifyToken(type: string): TokenCategory {
  // Keywords
  if (
    type === 'keyword' ||
    type === 'control-flow' ||
    type === 'module' ||
    type === 'boolean' ||
    type === 'tag' ||
    type === 'selector' ||
    type === 'important' ||
    type === 'atrule'
  ) {
    return 'keyword';
  }

  // Strings
  if (
    type === 'string' ||
    type === 'template-string' ||
    type === 'char' ||
    type === 'regex' ||
    type === 'attr-value' ||
    type === 'url'
  ) {
    return 'string';
  }

  // Types / functions / constants
  if (
    type === 'class-name' ||
    type === 'maybe-class-name' ||
    type === 'builtin' ||
    type === 'function' ||
    type === 'number' ||
    type === 'constant' ||
    type === 'attr-name' ||
    type === 'property'
  ) {
    return 'type';
  }

  // Comments
  if (
    type === 'comment' ||
    type === 'block-comment' ||
    type === 'prolog' ||
    type === 'doctype' ||
    type === 'cdata'
  ) {
    return 'comment';
  }

  // Punctuation
  if (type === 'punctuation' || type === 'operator') {
    return 'punctuation';
  }

  return 'plain';
}

/**
 * Simple token structure for our minimal highlighter.
 */
interface HighlightToken {
  content: string;
  category: TokenCategory;
}

/**
 * Minimal keyword-based tokenizer that identifies common patterns.
 * This provides basic syntax highlighting without depending on
 * react-syntax-highlighter's DOM-based rendering.
 */
function tokenize(code: string, language: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  // Language-specific keyword sets
  const keywords = getKeywords(language);
  const typeKeywords = getTypeKeywords(language);

  // Simple regex-based tokenization
  const patterns: Array<{ regex: RegExp; category: TokenCategory }> = [
    // Block comments (/* */)
    { regex: /\/\*[\s\S]*?\*\//g, category: 'comment' },
    // Line comments (//)
    { regex: /\/\/[^\n]*/g, category: 'comment' },
    // Hash comments (#)
    { regex: /#[^\n]*/g, category: 'comment' },
    // Double-quoted strings
    { regex: /"(?:[^"\\]|\\.)*"/g, category: 'string' },
    // Single-quoted strings
    { regex: /'(?:[^'\\]|\\.)*'/g, category: 'string' },
    // Template strings
    { regex: /`(?:[^`\\]|\\.)*`/g, category: 'string' },
  ];

  // Build a combined regex with named groups for efficiency
  let remaining = code;
  let position = 0;

  while (position < code.length) {
    let earliestMatch: { index: number; length: number; category: TokenCategory } | null = null;

    // Find the earliest pattern match from the current position
    for (const { regex, category } of patterns) {
      regex.lastIndex = position;
      const match = regex.exec(code);
      if (match && match.index >= position) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            category,
          };
        }
      }
    }

    if (earliestMatch && earliestMatch.index === position) {
      // Pattern match starts at current position
      tokens.push({
        content: code.slice(position, position + earliestMatch.length),
        category: earliestMatch.category,
      });
      position += earliestMatch.length;
    } else {
      // Process word/symbol before next pattern match
      const endIndex = earliestMatch ? earliestMatch.index : code.length;
      const segment = code.slice(position, endIndex);

      // Tokenize the plain segment into words and non-words
      const wordPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*)|([^a-zA-Z_$\s]+)|(\s+)/g;
      let wordMatch: RegExpExecArray | null;

      while ((wordMatch = wordPattern.exec(segment)) !== null) {
        const word = wordMatch[0];

        if (wordMatch[1]) {
          // Identifier - check if keyword or type
          if (keywords.has(word)) {
            tokens.push({ content: word, category: 'keyword' });
          } else if (typeKeywords.has(word)) {
            tokens.push({ content: word, category: 'type' });
          } else if (/^[A-Z]/.test(word)) {
            // PascalCase is likely a type/class
            tokens.push({ content: word, category: 'type' });
          } else {
            tokens.push({ content: word, category: 'plain' });
          }
        } else if (wordMatch[2]) {
          // Punctuation/operators
          tokens.push({ content: word, category: 'punctuation' });
        } else {
          // Whitespace
          tokens.push({ content: word, category: 'plain' });
        }
      }

      position = endIndex;
    }
  }

  return tokens;
}

/**
 * Returns language-specific keyword sets.
 */
function getKeywords(language: string): Set<string> {
  const common = new Set([
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break',
    'continue', 'return', 'try', 'catch', 'finally', 'throw', 'new',
    'delete', 'typeof', 'instanceof', 'in', 'of', 'void', 'null',
    'undefined', 'true', 'false', 'this', 'super',
  ]);

  const jsKeywords = new Set([
    ...common, 'const', 'let', 'var', 'function', 'class', 'extends',
    'import', 'export', 'default', 'from', 'async', 'await', 'yield',
    'static', 'get', 'set', 'enum', 'implements', 'interface', 'type',
    'namespace', 'declare', 'abstract', 'as', 'is',
  ]);

  const pythonKeywords = new Set([
    'def', 'class', 'import', 'from', 'as', 'if', 'elif', 'else',
    'for', 'while', 'try', 'except', 'finally', 'with', 'return',
    'yield', 'raise', 'pass', 'break', 'continue', 'and', 'or',
    'not', 'is', 'in', 'lambda', 'global', 'nonlocal', 'assert',
    'del', 'True', 'False', 'None', 'async', 'await',
  ]);

  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx':
      return jsKeywords;
    case 'python':
      return pythonKeywords;
    case 'swift':
      return new Set([
        ...common, 'func', 'var', 'let', 'struct', 'class', 'enum',
        'protocol', 'extension', 'import', 'guard', 'defer', 'where',
        'associatedtype', 'typealias', 'mutating', 'override', 'static',
        'private', 'public', 'internal', 'fileprivate', 'open', 'weak',
        'unowned', 'lazy', 'convenience', 'required', 'init', 'deinit',
        'self', 'Self', 'nil', 'throws', 'rethrows', 'async', 'await',
      ]);
    case 'go':
      return new Set([
        'break', 'case', 'chan', 'const', 'continue', 'default', 'defer',
        'else', 'fallthrough', 'for', 'func', 'go', 'goto', 'if',
        'import', 'interface', 'map', 'package', 'range', 'return',
        'select', 'struct', 'switch', 'type', 'var', 'true', 'false', 'nil',
      ]);
    case 'rust':
      return new Set([
        'as', 'break', 'const', 'continue', 'crate', 'else', 'enum',
        'extern', 'false', 'fn', 'for', 'if', 'impl', 'in', 'let',
        'loop', 'match', 'mod', 'move', 'mut', 'pub', 'ref', 'return',
        'self', 'Self', 'static', 'struct', 'super', 'trait', 'true',
        'type', 'unsafe', 'use', 'where', 'while', 'async', 'await',
      ]);
    default:
      return common;
  }
}

/**
 * Returns language-specific type keyword sets.
 */
function getTypeKeywords(language: string): Set<string> {
  const jsTypes = new Set([
    'string', 'number', 'boolean', 'object', 'symbol', 'bigint',
    'any', 'unknown', 'never', 'void', 'Array', 'Map', 'Set',
    'Promise', 'Record', 'Partial', 'Required', 'Readonly',
    'Pick', 'Omit', 'Exclude', 'Extract', 'NonNullable',
    'ReturnType', 'InstanceType', 'Parameters',
    'String', 'Number', 'Boolean', 'Object', 'Function',
    'Date', 'RegExp', 'Error', 'TypeError', 'RangeError',
  ]);

  const pythonTypes = new Set([
    'int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set',
    'frozenset', 'bytes', 'bytearray', 'memoryview', 'range',
    'type', 'object', 'complex', 'print', 'len', 'input',
    'enumerate', 'zip', 'map', 'filter', 'sorted', 'reversed',
    'Exception', 'ValueError', 'TypeError', 'KeyError',
    'IndexError', 'AttributeError', 'ImportError',
    'Optional', 'Union', 'List', 'Dict', 'Tuple', 'Set',
  ]);

  switch (language) {
    case 'javascript':
    case 'typescript':
    case 'jsx':
    case 'tsx':
      return jsTypes;
    case 'python':
      return pythonTypes;
    case 'swift':
      return new Set([
        'Int', 'Float', 'Double', 'Bool', 'String', 'Character',
        'Array', 'Dictionary', 'Set', 'Optional', 'Result',
        'Void', 'Any', 'AnyObject', 'Error', 'Codable',
        'Identifiable', 'Hashable', 'Equatable', 'Comparable',
      ]);
    case 'go':
      return new Set([
        'bool', 'byte', 'complex64', 'complex128', 'error',
        'float32', 'float64', 'int', 'int8', 'int16', 'int32',
        'int64', 'rune', 'string', 'uint', 'uint8', 'uint16',
        'uint32', 'uint64', 'uintptr',
      ]);
    case 'rust':
      return new Set([
        'i8', 'i16', 'i32', 'i64', 'i128', 'isize',
        'u8', 'u16', 'u32', 'u64', 'u128', 'usize',
        'f32', 'f64', 'bool', 'char', 'str', 'String',
        'Vec', 'Box', 'Rc', 'Arc', 'Cell', 'RefCell',
        'Option', 'Result', 'Ok', 'Err', 'Some', 'None',
      ]);
    default:
      return new Set<string>();
  }
}

/**
 * Normalizes a language identifier.
 * Returns null if the language is not recognized.
 */
function normalizeLanguage(language?: string): string | null {
  if (!language) return null;

  const lower = language.toLowerCase().trim();

  // Common aliases
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    rb: 'ruby',
    cs: 'csharp',
    'c++': 'cpp',
    'c#': 'csharp',
    'objective-c': 'objectivec',
    yml: 'yaml',
    sh: 'bash',
    zsh: 'bash',
    shell: 'bash',
  };

  const resolved = aliases[lower] ?? lower;
  return RECOGNIZED_LANGUAGES.has(resolved) ? resolved : null;
}

/**
 * CodePanel renders a code block with fixed dark background and accent-derived
 * syntax highlighting. Independent of light/dark app theme.
 */
export function CodePanel({ code, language }: CodePanelProps) {
  const theme = useTheme();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const normalizedLanguage = useMemo(
    () => normalizeLanguage(language),
    [language],
  );

  /** Color map for token categories derived from accent */
  const tokenColors = useMemo(
    (): Record<TokenCategory, TextStyle> => ({
      keyword: { color: theme.colors.codeKeyword },
      string: { color: theme.colors.codeString },
      type: { color: theme.colors.codeType },
      comment: { color: theme.colors.codeComment, fontStyle: 'italic' },
      punctuation: { color: 'rgba(232, 232, 232, 0.6)' },
      plain: { color: 'rgba(232, 232, 232, 0.85)' },
    }),
    [theme.colors],
  );

  /** Tokenized code for highlighted rendering */
  const tokens = useMemo((): HighlightToken[] => {
    if (!normalizedLanguage) return [];
    return tokenize(code, normalizedLanguage);
  }, [code, normalizedLanguage]);

  const handleCopy = useCallback(async () => {
    await copyToClipboard(code);
    toast.show('Copied to clipboard');

    // Show confirmation indicator for 2s
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => {
      setCopied(false);
      copyTimeoutRef.current = null;
    }, 2000);
  }, [code, toast]);

  const showLanguageLabel = normalizedLanguage !== null;

  const codeTextStyle: TextStyle = useMemo(
    () => ({
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: theme.typography.code.fontSize,
      lineHeight: theme.typography.code.lineHeight,
    }),
    [theme.typography.code],
  );

  return (
    <View
      style={[
        styles.container,
        { borderRadius: theme.borderRadii.codeBlock },
      ]}
      accessibilityRole="none"
      accessibilityLabel={
        showLanguageLabel
          ? `Code block, language ${normalizedLanguage}`
          : 'Code block'
      }
    >
      {/* Header: language label + copy button */}
      <View style={styles.header}>
        {showLanguageLabel ? (
          <Text
            style={[
              styles.languageLabel,
              {
                fontSize: theme.typography.caption1.fontSize,
                lineHeight: theme.typography.caption1.lineHeight,
              },
            ]}
          >
            {normalizedLanguage}
          </Text>
        ) : (
          <View />
        )}
        <Pressable
          onPress={handleCopy}
          style={styles.copyButton}
          accessibilityLabel={copied ? 'Copied' : 'Copy code'}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.copyButtonText, copied && styles.copiedText]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Code content with horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.codeContainer}
        accessibilityRole="none"
      >
        {normalizedLanguage && tokens.length > 0 ? (
          <Text style={codeTextStyle} selectable>
            {tokens.map((token, index) => (
              <Text key={index} style={tokenColors[token.category]}>
                {token.content}
              </Text>
            ))}
          </Text>
        ) : (
          <Text
            style={[
              styles.plainCode,
              codeTextStyle,
            ]}
            selectable
          >
            {code}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#15151b',
    marginVertical: 8,
    overflow: 'hidden',
    // Subtle inset border
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  languageLabel: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: 'rgba(232, 232, 232, 0.6)',
    textTransform: 'lowercase',
  },
  copyButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copyButtonText: {
    color: 'rgba(232, 232, 232, 0.7)',
    fontSize: 12,
    fontWeight: '500',
  },
  copiedText: {
    color: 'rgba(120, 220, 120, 0.9)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  codeContainer: {
    padding: 12,
    paddingRight: 24,
  },
  plainCode: {
    color: 'rgba(232, 232, 232, 0.85)',
  },
});

export default CodePanel;
