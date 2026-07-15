import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

import { useTheme, Theme } from '@/theme';
import { ThemeSelector } from '@/components/settings/ThemeSelector';
import type { SettingsStackParamList } from '@/navigation/types';

type NavigationProp = StackNavigationProp<SettingsStackParamList, 'SettingsMain'>;

interface SettingsRowProps {
  label: string;
  onPress: () => void;
  theme: Theme;
}

function SettingsRow({ label, onPress, theme }: SettingsRowProps) {
  const styles = createRowStyles(theme);
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowChevron}>›</Text>
    </Pressable>
  );
}

/**
 * Main settings screen.
 * Sections: Appearance (theme selector), navigation rows (Providers, System Prompts, About).
 */
export function SettingsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const styles = createStyles(theme);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionHeader}>{t('settings.appearance')}</Text>
        <View style={styles.sectionCard}>
          <Text style={styles.label}>{t('settings.theme')}</Text>
          <ThemeSelector />
        </View>
      </View>

      {/* Navigation Section */}
      <View style={styles.section}>
        <View style={styles.sectionCard}>
          <SettingsRow
            label={t('settings.providers')}
            onPress={() => navigation.navigate('ProviderList')}
            theme={theme}
          />
          <View style={styles.separator} />
          <SettingsRow
            label={t('settings.systemPrompts')}
            onPress={() => navigation.navigate('SystemPrompts')}
            theme={theme}
          />
          <View style={styles.separator} />
          <SettingsRow
            label={t('settings.about')}
            onPress={() => navigation.navigate('About')}
            theme={theme}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(theme: Theme) {
  const container: ViewStyle = {
    flex: 1,
    backgroundColor: theme.colors.background,
  };

  const content: ViewStyle = {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.massive,
  };

  const section: ViewStyle = {
    marginBottom: theme.spacing.xxl,
  };

  const sectionHeader: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontSize: 13,
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  };

  const sectionCard: ViewStyle = {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadii.lg,
    padding: theme.spacing.lg,
  };

  const label: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  };

  const separator: ViewStyle = {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.xs,
  };

  return StyleSheet.create({
    container,
    content,
    section,
    sectionHeader,
    sectionCard,
    label,
    separator,
  });
}

function createRowStyles(theme: Theme) {
  const row: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  };

  const rowLabel: TextStyle = {
    ...theme.typography.body,
    color: theme.colors.text,
  };

  const rowChevron: TextStyle = {
    fontSize: 20,
    color: theme.colors.textTertiary,
  };

  return StyleSheet.create({
    row,
    rowLabel,
    rowChevron,
  });
}
