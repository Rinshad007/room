import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { sendPasswordResetEmail } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { auth } from '../firebase';
import { colors, shadows } from '../theme';
import Card from '../components/Card';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Please enter your email address' });
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      Toast.show({ type: 'success', text1: 'Email Sent', text2: 'Password reset link sent to your inbox.' });
    } catch (err: any) {
      const msg = err.code === 'auth/user-not-found'
        ? 'No account found with that email.'
        : err.message || 'Failed to send reset email';
      Toast.show({ type: 'error', text1: 'Reset Failed', text2: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 16 }]}
          onPress={() => nav.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>

        {/* Logo area */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrap}>
            <Ionicons name="lock-closed" size={32} color={colors.onPrimary} />
          </View>
          <Text style={styles.appName}>Reset Password</Text>
        </View>

        {/* Form Card */}
        <Card glass style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Forgot Password</Text>
          </View>

          {sent ? (
            <View style={styles.successSection}>
              <Ionicons name="mail-unread-outline" size={48} color={colors.secondary} />
              <Text style={styles.successText}>
                We have sent a password reset link to your email address: {email}
              </Text>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => nav.navigate('Login')}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>Back to Login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.infoText}>
                Enter the email address associated with your account, and we will email you a link to reset your password.
              </Text>

              {/* Email field */}
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.onSurfaceVariant + '80'}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.btnDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.submitBtnText}>
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgSurfaceContainerLow,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outlineVariant + '33',
    zIndex: 10,
  },
  logoSection: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.float,
  },
  appName: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    color: colors.primary,
  },
  glassCard: {
    width: '100%',
    maxWidth: 384,
    gap: 16,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant + '33',
    paddingBottom: 8,
  },
  cardTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '600',
    color: colors.primary,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceVariant,
  },
  successSection: {
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  successText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurface,
    textAlign: 'center',
  },
  field: {
    gap: 6,
    width: '100%',
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
  },
  input: {
    width: '100%',
    height: 56,
    backgroundColor: colors.bgSurfaceContainerLow,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.onSurface,
  },
  submitBtn: {
    height: 56,
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...shadows.float,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onPrimary,
  },
});
