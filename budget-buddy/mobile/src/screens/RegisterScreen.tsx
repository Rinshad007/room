import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup } from 'firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ref, set, get } from 'firebase/database';
import Toast from 'react-native-toast-message';
import { auth, db } from '../firebase';
import { useAuthStore } from '../store/auth';
import type { User } from '../types';
import { colors, shadows } from '../theme';
import Card from '../components/Card';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { setAuth } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Full Name is required' });
      return;
    }
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Email is required' });
      return;
    }
    if (password !== confirm) {
      Toast.show({ type: 'error', text1: 'Error', text2: "Passwords don't match" });
      return;
    }
    if (password.length < 8) {
      Toast.show({ type: 'error', text1: 'Error', text2: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const fbUser = cred.user;
      await updateProfile(fbUser, { displayName: name.trim() });

      const userData: User = {
        id: fbUser.uid,
        name: name.trim(),
        email: fbUser.email || email.trim(),
        upi_id: null,
        created_at: new Date().toISOString(),
      };

      await set(ref(db, `users/${fbUser.uid}`), userData);
      const token = await fbUser.getIdToken();
      await setAuth(userData, token, '');
      Toast.show({ type: 'success', text1: 'Welcome to Budget Buddy!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Registration failed', text2: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        const fbUser = userCredential.user;

        const snapshot = await get(ref(db, `users/${fbUser.uid}`));
        const userData: User = snapshot.exists() ? snapshot.val() : {
          id: fbUser.uid,
          name: fbUser.displayName || fbUser.email || 'User',
          email: fbUser.email || '',
          upi_id: null,
          created_at: new Date().toISOString(),
        };

        if (!snapshot.exists()) {
          await set(ref(db, `users/${fbUser.uid}`), userData);
        }

        const token = await fbUser.getIdToken();
        await setAuth(userData, token, '');
        Toast.show({ type: 'success', text1: 'Welcome to Budget Buddy!' });
        return;
      }

      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any).idToken || (signInResult as any).data?.idToken;
      if (!idToken) throw new Error('No ID token found');

      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      const fbUser = userCredential.user;

      const snapshot = await get(ref(db, `users/${fbUser.uid}`));
      const userData: User = snapshot.exists() ? snapshot.val() : {
        id: fbUser.uid,
        name: fbUser.displayName || fbUser.email || 'User',
        email: fbUser.email || '',
        upi_id: null,
        created_at: new Date().toISOString(),
      };

      if (!snapshot.exists()) {
        await set(ref(db, `users/${fbUser.uid}`), userData);
      }

      const token = await fbUser.getIdToken();
      await setAuth(userData, token, '');
      Toast.show({ type: 'success', text1: 'Welcome to Budget Buddy!' });
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Google Sign-In failed', text2: err.message });
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
        {/* Logo area */}
        <View style={styles.logoSection}>
          <View style={styles.logoWrap}>
            <Ionicons name="wallet" size={32} color={colors.onPrimary} />
          </View>
          <Text style={styles.appName}>Budget Buddy</Text>
        </View>

        {/* Form Card */}
        <Card glass style={styles.glassCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Create Account</Text>
          </View>

          {/* Name field */}
          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Rahul Sharma"
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
            />
          </View>

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

          {/* Password field */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passContainer}>
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="Min. 8 chars"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowPassword(!showPassword)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.onSurfaceVariant + '99'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password field */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={styles.passContainer}>
              <TextInput
                style={[styles.input, { paddingRight: 48 }]}
                placeholder="Repeat password"
                placeholderTextColor={colors.onSurfaceVariant + '80'}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry={!showConfirm}
                autoComplete="new-password"
              />
              <TouchableOpacity
                style={styles.eyeBtn}
                onPress={() => setShowConfirm(!showConfirm)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.onSurfaceVariant + '99'}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <Ionicons name="refresh" size={24} color={colors.onPrimary} style={styles.spinning} />
            ) : (
              <Text style={styles.submitBtnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Login Button */}
          <TouchableOpacity
            style={[styles.googleBtn, loading && styles.btnDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                fill="#EA4335"
                d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.42 7.54l3.9 3.02C6.24 7.65 8.92 5.04 12 5.04z"
              />
              <Path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.76 2.91c2.2-2.02 3.67-5 3.67-8.64z"
              />
              <Path
                fill="#FBBC05"
                d="M5.32 14.78c-.23-.69-.36-1.42-.36-2.18s.13-1.49.36-2.18L1.42 7.4C.51 9.21 0 11.24 0 13.35s.51 4.14 1.42 5.95l3.9-3.52z"
              />
              <Path
                fill="#34A853"
                d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.76-2.91c-1.05.7-2.4 1.12-4.2 1.12-3.08 0-5.76-2.61-6.68-5.52l-3.9 3.02C3.37 20.35 7.35 23 12 23z"
              />
            </Svg>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>
        </Card>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate('Login')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
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
  // Logo area
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
  // Form Card
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
  field: {
    gap: 6,
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
  passContainer: {
    position: 'relative',
    width: '100%',
  },
  eyeBtn: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  submitBtn: {
    height: 56,
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
  spinning: {},
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.outlineVariant + '66',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.onSurfaceVariant + '99',
    textTransform: 'uppercase',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.outlineVariant + '99',
    backgroundColor: colors.bgSurfaceContainerHigh,
    borderRadius: 12,
    height: 56,
    width: '100%',
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onSurface,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 16,
    color: colors.onSurfaceVariant,
  },
  footerLink: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
});
