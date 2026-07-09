import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import Input from '../components/Input';
import Button from '../components/Button';
import { authAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import { colors, fontSizes, fontWeights, spacing } from '../theme';
import type { AuthStackParamList } from '../navigation/AuthNavigator';

type NavProp = StackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const nav = useNavigation<NavProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const store = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Error', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      const res = await authAPI.login({ email, password });
      await store.setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (idToken) {
        const res = await authAPI.googleLogin(idToken);
        await store.setAuth(res.data.user, res.data.access_token, res.data.refresh_token);
      } else {
        throw new Error('Google Sign-In failed: No ID Token found');
      }
    } catch (e: any) {
      if (e.code === statusCodes.SIGN_IN_CANCELLED) {
        // User cancelled
      } else if (e.code === statusCodes.IN_PROGRESS) {
        Alert.alert('Status', 'Sign-in already in progress');
      } else if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert('Play Services', 'Google Play Services not available or outdated');
      } else {
        Alert.alert('Google Sign-In Failed', e.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.logo}>💸</Text>
          <Text style={styles.title}>Budget Buddy</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>
        </View>

        <View style={styles.form}>
          <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" icon="mail-outline" />
          <Input label="Password" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry icon="lock-closed-outline" />
          <Button title="Sign In" onPress={handleLogin} loading={loading} fullWidth style={styles.btn} />

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <Button 
            title="Continue with Google" 
            onPress={handleGoogleLogin} 
            variant="outline" 
            fullWidth 
            style={styles.googleBtn} 
            loading={loading}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate('Register')}>
            <Text style={styles.link}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.lg, justifyContent: 'center', paddingBottom: spacing.xl },
  header: { alignItems: 'center', marginBottom: spacing.xxl },
  logo: { fontSize: 64, marginBottom: spacing.md },
  title: { fontSize: fontSizes.xxxl, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary },
  form: { marginBottom: spacing.lg },
  btn: { marginTop: spacing.sm },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: spacing.md, color: colors.textMuted, fontSize: fontSizes.sm },
  googleBtn: { borderColor: colors.border, marginTop: spacing.xs },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  footerText: { color: colors.textSecondary, fontSize: fontSizes.md },
  link: { color: colors.primary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
});
