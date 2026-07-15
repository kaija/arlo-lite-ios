import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme, Theme } from '@/theme';
import { copyToClipboard } from '@/utils/clipboard';

export interface CodeBlockProps {
  /** The code content to display */
  code: string;
  /** Programming language label (optional) */
  language?: string;
}

/**
 * Code block component with dark background, language label, and copy button.
 * Uses monospace font and accent-hue-derived syntax highlighting via
 * simple text rendering (full syntax highlighting requires native bridge).
 */
export function CodeBlock({ code, language }: CodeBlockProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = createStyles(theme);

  async function handleCopy() {
    await copyToClipboard(code);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {language ? (
          <Text style={styles.languageLabel}>{language}</Text>
        ) : (
          <View />
        )}
        <TouchableOpacity
          onPress={handleCopy}
          style={styles.copyButton}
          accessibilityLabel={t('chat.copyCode')}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.copyButtonText}>{t('chat.copyCode')}</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.scrollView}
      >
        <Text style={styles.code} selectable>
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    backgroundColor: theme.colors.codeBackground,
    borderRadius: theme.borderRadii.md,
    marginVertical: theme.spacing.sm,
    overflow: 'hidden',
  };

  const header: ViewStyle = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  };

  const languageLabel: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const copyButton: ViewStyle = {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
  };

  const copyButtonText: TextStyle = {
    ...theme.typography.caption1,
    color: theme.colors.accent,
  };

  const scrollView: ViewStyle = {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  };

  const code: TextStyle = {
    ...theme.typography.code,
    color: '#E8E8E8', // Light text on dark code background
  };

  return StyleSheet.create({
    container,
    header,
    languageLabel,
    copyButton,
    copyButtonText,
    scrollView,
    code,
  });
}
