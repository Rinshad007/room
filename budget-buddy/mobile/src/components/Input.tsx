import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity, ViewStyle, KeyboardTypeOptions, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, fontSizes, spacing } from '../theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  error?: string;
  style?: StyleProp<ViewStyle>;
  icon?: keyof typeof Ionicons.glyphMap;
}

export default function Input({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType = 'default', autoCapitalize = 'none', multiline, numberOfLines, editable = true, error, style, icon }: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, focused && styles.focused, !!error && styles.errored, !editable && styles.disabled]}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.icon} />}
        <TextInput
          style={[styles.input, multiline && { height: numberOfLines ? numberOfLines * 22 : 80, textAlignVertical: 'top' }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: fontSizes.sm, marginBottom: spacing.xs, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgInput, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  focused: { borderColor: colors.primary },
  errored: { borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  icon: { marginRight: spacing.sm },
  input: { flex: 1, color: colors.textPrimary, fontSize: fontSizes.md, paddingVertical: spacing.sm + 2, minHeight: 46 },
  eyeBtn: { padding: spacing.xs },
  error: { color: colors.danger, fontSize: fontSizes.xs, marginTop: spacing.xs },
});
