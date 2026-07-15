import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { calculateMessageCost } from '@/domain/cost-calculator';
import type { Message } from '@/database/repositories/message-repo';

export interface MessageCostProps {
  /** The message to compute cost for */
  message: Message;
  /** Price per million input tokens, or null if not configured */
  inputPrice: number | null;
  /** Price per million output tokens, or null if not configured */
  outputPrice: number | null;
}

/**
 * Displays the cost of a single assistant message.
 * Hidden entirely when:
 * - Prices are not configured (null)
 * - The message has no token data
 * - The computed cost is null or zero
 */
export function MessageCost({ message, inputPrice, outputPrice }: MessageCostProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  // Only show cost for assistant messages with token data
  if (message.role !== 'assistant') {
    return null;
  }

  const cost = calculateMessageCost(
    message.promptTokens ?? 0,
    message.completionTokens ?? 0,
    inputPrice,
    outputPrice
  );

  // Hide if prices not configured or cost is zero/null
  if (cost === null || cost === 0) {
    return null;
  }

  const styles = createStyles(theme);

  return (
    <Text style={styles.cost}>
      {t('chat.messageCost', { cost: formatCost(cost) })}
    </Text>
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

function createStyles(theme: Theme) {
  const cost: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textTertiary,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  };

  return StyleSheet.create({ cost });
}
