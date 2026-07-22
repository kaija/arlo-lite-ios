/**
 * Built-in tools — device info and datetime.
 * Both run entirely on-device with no network requests.
 */

import { Platform } from 'react-native';
import * as Device from 'expo-device';
import type { ToolDefinition } from '@/services/tool-registry';

export const deviceInfoTool: ToolDefinition = {
  name: 'get_device_info',
  description: 'Returns device OS, model, locale, and timezone.',
  parameters: {
    type: 'object',
    properties: {
      fields: {
        type: 'array',
        items: { type: 'string', enum: ['os', 'model', 'locale', 'timezone', 'all'] },
        description: 'Which fields to return. "all" for everything.',
      },
    },
    required: ['fields'],
  },
  handler: async (args, _ctx) => {
    const fields = (args.fields as string[]) ?? ['all'];
    const info: Record<string, string> = {};
    if (fields.includes('all') || fields.includes('os')) info.os = `${Platform.OS} ${Platform.Version}`;
    if (fields.includes('all') || fields.includes('model')) info.model = Device.modelName ?? 'Unknown';
    if (fields.includes('all') || fields.includes('locale')) info.locale = Intl.DateTimeFormat().resolvedOptions().locale;
    if (fields.includes('all') || fields.includes('timezone')) info.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return JSON.stringify(info);
  },
};

export const datetimeTool: ToolDefinition = {
  name: 'get_current_datetime',
  description: 'Returns current date/time in the specified format.',
  parameters: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['iso', 'unix', 'human', 'date_only', 'time_only'] },
    },
    required: ['format'],
  },
  handler: async (args, _ctx) => {
    const now = new Date();
    switch (args.format) {
      case 'unix': return String(Math.floor(now.getTime() / 1000));
      case 'human': return now.toLocaleString();
      case 'date_only': return now.toLocaleDateString();
      case 'time_only': return now.toLocaleTimeString();
      default: return now.toISOString();
    }
  },
};
