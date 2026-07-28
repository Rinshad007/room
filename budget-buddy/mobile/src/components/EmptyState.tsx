import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSizes, spacing } from '../theme';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}

export default function EmptyState({ icon = 'file-tray-outline', title, subtitle }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={56} color={colors.outline} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  title: { fontSize: fontSizes.lg, color: colors.onSurfaceVariant, fontWeight: '600', marginTop: spacing.md, textAlign: 'center' },
  subtitle: { fontSize: fontSizes.sm, color: colors.outline, marginTop: spacing.xs, textAlign: 'center' },
});
