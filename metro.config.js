// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Shim Node.js standard library modules that the Anthropic SDK
// tries to import (credential-chain.js uses node:fs, node:os, etc.)
// These modules don't exist in React Native runtime.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const nodeModules = [
    'node:fs',
    'node:os',
    'node:path',
    'node:crypto',
    'node:stream',
    'node:http',
    'node:https',
    'node:net',
    'node:zlib',
    'node:url',
    'node:util',
    'node:buffer',
    'node:events',
    'node:child_process',
    'fs',
    'os',
    'path',
    'crypto',
    'stream',
    'http',
    'https',
    'net',
    'zlib',
    'child_process',
  ];

  if (nodeModules.includes(moduleName)) {
    return {
      type: 'empty',
    };
  }

  // Fall back to the default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
