import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { calculateContextUsage, getContextStatus, ContextStatus } from '@/domain/context-tracker';
import { calculateMessageCost, calculateSessionTotal } from '@/domain/cost-calculator';
import type { ModelConfig } from '@/stores/provider-store';
import type { Message } from '@/database/repositories/message-repo';

export interface ContextUsageBarProps {
  /** The current model configuration (provides context window and pricing) */
  model: ModelConfig | null;
  /** Messages in the current session */
  messages: Message[];
}

/**
 * Displays context window usage as a progress bar with percentage,
 * and the running session cost total when pricing is configured.
 *
 * Color-coded status:
 * - normal (< 80%): accent color
 * - warning (80–95%): warning color
 * - critical (> 95%): error color
 *
 * Hides cost display entirely when model prices are null.
 */
export function ContextUsageBar({ model, messages }: ContextUsageBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Calculate total tokens used in this session
  const totalTokens = messages.reduce((sum, msg) => sum + (msg.totalTokens ?? 0), 0);

  // Context usage
  const contextWindow = model?.contextWindow ?? null;
  const percentage = calculateContextUsage(totalTokens, contextWindow);
  const clampedPercentage = Math.min(percentage, 100);
  const status = getContextStatus(percentage);

  // Cost calculation
  const inputPrice = model?.inputPrice ?? null;
  const outputPrice = model?.outputPrice ?? null;
  const hasPricing = inputPrice !== null && outputPrice !== null;

  const sessionTotal = hasPricing
    ? calculateSessionTotal(
        messages.map((msg) =>
          calculateMessageCost(
            msg.promptTokens ?? 0,
            msg.completionTokens ?? 0,
            inputPrice,
            outputPrice
          )
        )
      )
    : null;

  const statusColor = getStatusColor(status, theme);
  const styles = createStyles(theme, statusColor);

  const percentageText = Math.round(percentage);

  return (
    <View style={styles.container}>
      {/* Context usage section */}
      <View style={styles.row}>
        <Text
          style={styles.label}
          accessibilityLabel={t('accessibility.contextUsageIndicator', {
            percentage: percentageText,
          })}
        >
          {t('chat.contextUsage', { percentage: percentageText })}
        </Text>

        {hasPricing && sessionTotal !== null && sessionTotal > 0 && (
          <Text style={styles.costLabel}>
            {t('chat.sessionCost', { cost: formatCost(sessionTotal) })}
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.barBackground}>
        <View
          style={[styles.barFill, { width: `${clampedPercentage}%` }]}
          accessibilityRole="progressbar"
          accessibilityValue={{
            min: 0,
            max: 100,
            now: percentageText,
          }}
        />
      </View>
    </View>
  );
}

/**
 * Formats a cost value for display.
 * Shows 4 decimal places for small amounts, 2 for larger ones.
 */
function formatCost(cost: number): string {
  if (cost < 0.01) {
    return cost.toFixed(4);
  }
  return cost.toFixed(2);
}

/**
 * Maps context status to the appropriate theme color.
 */
function getStatusColor(status: ContextStatus, theme: Theme): string {
  switch (status) {
    case 'critical':
      return theme.colors.error;
    case 'warning':
      return theme.colors.warning;
    case 'normal':
    default:
      return theme.colors.accent;
  }
}

function createStyles(theme: Theme, statusColor: string) {
  const container: ViewStyle = {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  };

  const row: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  };

  const label: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
  };

  const costLabel: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
  };

  const barBackground: ViewStyle = {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    overflow: 'hidden',
  };

  const barFill: ViewStyle = {
    height: '100%',
    borderRadius: 2,
    backgroundColor: statusColor,
  };

  return StyleSheet.create({
    container,
    row,
    label,
    costLabel,
    barBackground,
    barFill,
  });
}
