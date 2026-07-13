/**
 * ProfileScreen — port of web's ProfilePage.tsx
 *
 * Features:
 *  - User avatar + name/email
 *  - Edit form (name, email, UPI ID)
 *  - Manage Friends button
 *  - Budget button
 *  - Sign Out
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { ref, update } from 'firebase/database';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import { useAuthStore } from '../store/auth';
import { resetRealtimeStore } from '../hooks/useRealtimeStore';
import { auth, db } from '../firebase';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const { user, setUser, logout } = useAuthStore();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [upiId, setUpiId] = useState(user?.upi_id || '');
  const [saving, setSaving] = useState(false);

  const initials = user?.name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'BB';

  const handleSave = async () => {
    if (!name.trim()) {
      if (Platform.OS === 'web') {
        alert('Name cannot be empty');
      } else {
        Alert.alert('Error', 'Name cannot be empty');
      }
      return;
    }
    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        email: email.trim(),
        upi_id: upiId.trim() || null,
      };
      if (user?.id) {
        await update(ref(db, `users/${user.id}`), updates);
        await setUser({ ...user, ...updates });
      }
      if (Platform.OS === 'web') {
        alert('Profile updated!');
      } else {
        Alert.alert('Success', 'Profile updated!');
      }
    } catch (err: any) {
      if (Platform.OS === 'web') {
        alert(err.message || 'Failed to update profile');
      } else {
        Alert.alert('Error', err.message || 'Failed to update profile');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      try {
        await signOut(auth);
        resetRealtimeStore();
        await logout();
      } catch (err: any) {
        if (Platform.OS === 'web') {
          alert(err.message || 'Logout failed');
        } else {
          Alert.alert('Error', err.message);
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('Are you sure you want to sign out?');
      if (confirmed) {
        await doLogout();
      }
    } else {
      Alert.alert('Sign Out', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: doLogout,
        },
      ]);
    }
  };

  return (
    <View style={styles.root}>
      <TopBar title="Profile" showBack showNotifications={false} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar + Name ──────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{user?.name}</Text>
          <Text style={styles.displayEmail}>{user?.email}</Text>
        </View>

        {/* ── Edit Profile Form ─────────────────────────────────────── */}
        <Card glass style={styles.formCard}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>UPI ID</Text>
            <TextInput
              style={styles.input}
              value={upiId}
              onChangeText={setUpiId}
              placeholder="yourname@upi"
              placeholderTextColor={colors.onSurfaceVariant + '80'}
              autoCapitalize="none"
            />
            <Text style={styles.fieldHint}>
              Adding your UPI ID lets friends pay you directly via Google Pay, PhonePe, etc.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.65 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={18} color={colors.onPrimary} />
            <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </Card>

        {/* ── Quick Links ────────────────────────────────────────────── */}
        <Card glass style={styles.linksCard}>
          <Text style={styles.sectionTitle}>Manage</Text>

          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Friends')} activeOpacity={0.7}>
            <View style={styles.linkIcon}>
              <Ionicons name="people-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.linkLabel}>Friends</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant + '60'} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Budget')} activeOpacity={0.7}>
            <View style={styles.linkIcon}>
              <Ionicons name="wallet-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.linkLabel}>Budget Settings</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant + '60'} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.linkRow} onPress={() => nav.navigate('Groups')} activeOpacity={0.7}>
            <View style={styles.linkIcon}>
              <Ionicons name="people-circle-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.linkLabel}>Groups</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceVariant + '60'} />
          </TouchableOpacity>
        </Card>

        {/* ── Sign Out ──────────────────────────────────────────────── */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.float,
  },
  avatarText: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.onPrimary },
  displayName: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary },
  displayEmail: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant },

  formCard: { gap: spacing.md },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: colors.primary,
    marginBottom: 4,
  },
  fieldGroup: { gap: 5 },
  label: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 2,
  },
  input: {
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.bgSurfaceContainerLow,
    paddingHorizontal: 14,
    fontSize: fontSizes.sm,
    color: colors.onSurface,
  },
  fieldHint: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant + '99',
    marginLeft: 2,
    fontStyle: 'italic',
  },
  saveBtn: {
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    ...shadows.float,
  },
  saveBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },

  linksCard: { gap: 0 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkLabel: { flex: 1, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.onSurface },
  divider: { height: 1, backgroundColor: colors.outlineVariant + '30', marginHorizontal: 2 },

  signOutBtn: {
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderColor: colors.error + '60',
    backgroundColor: colors.errorContainer + '40',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  signOutText: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.error },
});
