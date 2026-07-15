import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  Linking,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '@/theme';
import type { Theme } from '@/theme';
import { APP_METADATA } from '@/constants/defaults';

/**
 * AboutScreen — displays app information, license, source code link,
 * and a no-telemetry statement.
 */
export function AboutScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleOpenSource = () => {
    Linking.openURL(APP_METADATA.repository);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      accessibilityRole="summary"
    >
      {/* App Identity */}
      <View style={styles.header} accessibilityRole="header">
        <Text style={styles.appName} accessibilityLabel={APP_METADATA.name}>
          {APP_METADATA.name}
        </Text>
        <Text
          style={styles.description}
          accessibilityLabel={t('about.description')}
        >
          {t('about.description')}
        </Text>
      </View>

      {/* Info Section */}
      <View style={styles.section}>
        {/* Version */}
        <View style={styles.row} accessibilityLabel={`${t('about.version')}: ${APP_METADATA.version}`}>
          <Text style={styles.label}>{t('about.version')}</Text>
          <Text style={styles.value}>{APP_METADATA.version}</Text>
        </View>

        <View style={styles.separator} />

        {/* License */}
        <View style={styles.row} accessibilityLabel={`${t('about.license')}: ${APP_METADATA.license}`}>
          <Text style={styles.label}>{t('about.license')}</Text>
          <Text style={styles.value}>{t('about.licenseValue')}</Text>
        </View>

        <View style={styles.separator} />

        {/* Source Code */}
        <TouchableOpacity
          style={styles.row}
          onPress={handleOpenSource}
          accessibilityLabel={t('about.sourceCode')}
          accessibilityRole="link"
          accessibilityHint={APP_METADATA.repository}
        >
          <Text style={styles.label}>{t('about.sourceCode')}</Text>
          <Text style={styles.linkValue}>{t('about.openSource')}</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Section */}
      <View style={styles.section}>
        <View style={styles.privacyRow} accessibilityLabel={t('about.noTelemetry')}>
          <Text style={styles.privacyText}>{t('about.noTelemetry')}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.huge,
    },
    header: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
      paddingVertical: theme.spacing.xl,
    },
    appName: {
      ...theme.typography.title1,
      color: theme.colors.text,
      fontWeight: '700',
      marginBottom: theme.spacing.sm,
    },
    description: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
    section: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadii.md,
      marginBottom: theme.spacing.lg,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: 44,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.border,
      marginLeft: theme.spacing.lg,
    },
    label: {
      ...theme.typography.body,
      color: theme.colors.text,
    },
    value: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
    },
    linkValue: {
      ...theme.typography.body,
      color: theme.colors.accent,
    },
    privacyRow: {
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      minHeight: 44,
      justifyContent: 'center',
    },
    privacyText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });
}
