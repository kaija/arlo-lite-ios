/**
 * Tests for ContextUsageBar and MessageCost components.
 *
 * Since @testing-library/react-native is not available, we test the
 * underlying logic and verify exports are defined.
 */

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (key === 'chat.contextUsage') return `Context: ${params?.percentage}%`;
      if (key === 'chat.sessionCost') return `Session total: $${params?.cost}`;
      if (key === 'chat.messageCost') return `Cost: $${params?.cost}`;
      if (key === 'accessibility.contextUsageIndicator')
        return `Context usage: ${params?.percentage} percent`;
      return key;
    },
  }),
}));

jest.mock('@/theme', () => ({
  useTheme: () => ({
    colors: {
      accent: '#5856D6',
      warning: '#FF9500',
      error: '#D32F2F',
      textSecondary: '#636366',
      textTertiary: '#8E8E93',
      border: '#D1D1D6',
    },
    typography: {
      caption1: { fontSize: 12, lineHeight: 16 },
    },
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    borderRadii: { sm: 4 },
  }),
}));

import { ContextUsageBar } from '../ContextUsageBar';
import { MessageCost } from '../MessageCost';
import { calculateContextUsage, getContextStatus } from '@/domain/context-tracker';
import { calculateMessageCost, calculateSessionTotal } from '@/domain/cost-calculator';
import type { ModelConfig } from '@/stores/provider-store';
import type { Message } from '@/database/repositories/message-repo';

// ─── Component Export Tests ─────────────────────────────────────────────────

describe('ContextUsageBar', () => {
  it('is exported as a function component', () => {
    expect(ContextUsageBar).toBeDefined();
    expect(typeof ContextUsageBar).toBe('function');
  });
});

describe('MessageCost', () => {
  it('is exported as a function component', () => {
    expect(MessageCost).toBeDefined();
    expect(typeof MessageCost).toBe('function');
  });
});

// ─── Domain Logic Tests (context usage + cost calculation) ──────────────────

describe('Context usage calculation for ContextUsageBar', () => {
  it('calculates 0% when context window is null', () => {
    expect(calculateContextUsage(1000, null)).toBe(0);
  });

  it('calculates 0% when context window is 0', () => {
    expect(calculateContextUsage(1000, 0)).toBe(0);
  });

  it('calculates correct percentage', () => {
    expect(calculateContextUsage(4000, 8000)).toBe(50);
  });

  it('can exceed 100%', () => {
    expect(calculateContextUsage(10000, 8000)).toBe(125);
  });

  it('returns normal status below 80%', () => {
    expect(getContextStatus(79)).toBe('normal');
  });

  it('returns warning status at 80%', () => {
    expect(getContextStatus(80)).toBe('warning');
  });

  it('returns warning status at 95%', () => {
    expect(getContextStatus(95)).toBe('warning');
  });

  it('returns critical status above 95%', () => {
    expect(getContextStatus(96)).toBe('critical');
  });
});

describe('Cost calculation for session total display', () => {
  const inputPrice = 3.0; // $3 per 1M input tokens
  const outputPrice = 15.0; // $15 per 1M output tokens

  it('returns null when prices not configured', () => {
    expect(calculateMessageCost(100, 50, null, null)).toBeNull();
    expect(calculateMessageCost(100, 50, 3.0, null)).toBeNull();
    expect(calculateMessageCost(100, 50, null, 15.0)).toBeNull();
  });

  it('calculates correct message cost', () => {
    // 1000 input tokens * $3/1M + 500 output tokens * $15/1M
    // = 0.003 + 0.0075 = 0.0105
    const cost = calculateMessageCost(1000, 500, inputPrice, outputPrice);
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it('calculates session total from message costs', () => {
    const costs = [0.01, 0.02, null, 0.005];
    expect(calculateSessionTotal(costs)).toBeCloseTo(0.035, 6);
  });

  it('returns 0 when all costs are null', () => {
    expect(calculateSessionTotal([null, null, null])).toBe(0);
  });

  it('returns 0 for empty array', () => {
    expect(calculateSessionTotal([])).toBe(0);
  });
});
