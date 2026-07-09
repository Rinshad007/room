import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from 'react-native-toast-message';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const store = useAuthStore();
  const [name, setName] = useState(store.user?.name ?? '');
  const [upiId, setUpiId] = useState(store.user?.upi_id ?? '');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await usersAPI.me();
      setName(res.data.name);
      setUpiId(res.data.upi_id ?? '');
      await store.setUser(res.data);
    } catch {}
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name cannot be empty'); return; }
    setSaving(true);
    try {
      const res = await usersAPI.update({ name: name.trim(), upi_id: upiId.trim() || undefined });
      await store.setUser(res.data);
      Toast.show({ type: 'success', text1: 'Profile updated!' });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
    setSaving(false);
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          await store.logout();
        }
      }
    ]);
  };

  const avatarLetter = (store.user?.name ?? 'U').charAt(0).toUpperCase();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          <Text style={styles.displayName}>{store.user?.name}</Text>
          <Text style={styles.email}>{store.user?.email}</Text>
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.badgeText}>Firebase Account</Text>
          </View>
        </View>

        {/* Edit Form */}
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Edit Profile</Text>
          <Input label="Full Name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" icon="person-outline" />
          <Input label="UPI ID (optional)" value={upiId} onChangeText={setUpiId} placeholder="yourname@upi" icon="card-outline" />
          <Button title="Save Changes" onPress={handleSave} loading={saving} fullWidth />
        </Card>

        {/* Info */}
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>{store.user?.email}</Text>
          </View>
          {store.user?.upi_id && (
            <View style={styles.infoRow}>
              <Ionicons name="card-outline" size={18} color={colors.textMuted} />
              <Text style={styles.infoText}>{store.user.upi_id}</Text>
            </View>
          )}
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>Member since {new Date(store.user?.created_at ?? '').toLocaleDateString()}</Text>
          </View>
        </Card>

        <Button title="Sign Out" variant="danger" onPress={handleLogout} fullWidth style={styles.signOutBtn} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  avatarSection: { alignItems: 'center', paddingVertical: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.primary, marginBottom: spacing.md },
  avatarText: { fontSize: fontSizes.xxxl, fontWeight: fontWeights.bold, color: colors.primary },
  displayName: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  email: { fontSize: fontSizes.sm, color: colors.textMuted, marginTop: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, backgroundColor: colors.success + '18', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full },
  badgeText: { color: colors.success, fontSize: fontSizes.xs, fontWeight: '600' },
  formCard: { marginBottom: spacing.md },
  formTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  infoCard: { marginBottom: spacing.md, gap: spacing.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoText: { color: colors.textSecondary, fontSize: fontSizes.sm },
  signOutBtn: {},
});
