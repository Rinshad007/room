import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { colors, radius, fontSizes, fontWeights, spacing } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  fullWidth?: boolean;
}

export default function Button({ title, onPress, variant = 'primary', loading, disabled, style, textStyle, fullWidth }: ButtonProps) {
  const containerStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'outline' && styles.outline,
    variant === 'danger' && styles.danger,
    variant === 'ghost' && styles.ghost,
    fullWidth && { width: '100%' as any },
    (disabled || loading) && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    variant === 'outline' && styles.labelOutline,
    variant === 'ghost' && styles.labelGhost,
    variant === 'danger' && styles.labelDanger,
    textStyle,
  ];

  return (
    <TouchableOpacity style={containerStyle} onPress={onPress} disabled={disabled || loading} activeOpacity={0.8}>
      {loading ? <ActivityIndicator color={variant === 'outline' ? colors.primary : '#fff'} size="small" /> : <Text style={labelStyle}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 46,
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.secondary },
  outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary },
  danger: { backgroundColor: colors.error },
  ghost: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
  labelOutline: { color: colors.primary },
  labelGhost: { color: colors.onSurfaceVariant },
  labelDanger: { color: '#fff' },
});
