import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { analyticsAPI, notificationsAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';


function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: string }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation<any>();
  const store = useAuthStore();
  const [data, setData] = useState<any>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [dash, notif] = await Promise.all([analyticsAPI.dashboard(), notificationsAPI.list()]);
      setData(dash.data);
      setUnread(notif.data.unread_count);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greet}>{greet()},</Text>
          <Text style={styles.userName}>{store.user?.name?.split(' ')[0] ?? 'User'} 👋</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => { /* notifications panel */ }}>
          <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
          {unread > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text></View>}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Net Balance */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Net Balance</Text>
          <Text style={[styles.balanceAmount, { color: (data?.net_balance ?? 0) >= 0 ? colors.success : colors.danger }]}>
            ₹{Math.abs(data?.net_balance ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.balanceSub}>{(data?.net_balance ?? 0) >= 0 ? 'You are owed overall' : 'You owe overall'}</Text>
        </Card>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <StatCard label="Total Spent" value={`₹${(data?.total_spent ?? 0).toFixed(0)}`} color={colors.textPrimary} icon="💸" />
          <StatCard label="You Owe" value={`₹${(data?.total_payable ?? 0).toFixed(0)}`} color={colors.danger} icon="📤" />
          <StatCard label="Owed to You" value={`₹${(data?.total_receivable ?? 0).toFixed(0)}`} color={colors.success} icon="📥" />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actions}>
          {[
            { label: 'Groups', icon: 'people', screen: 'Groups' },
            { label: 'Settle Up', icon: 'swap-horizontal', screen: 'Settlements' },
            { label: 'Analytics', icon: 'bar-chart', screen: 'Analytics' },
            { label: 'Budget', icon: 'wallet', screen: 'Budget' },
          ].map(item => (
            <TouchableOpacity key={item.label} style={styles.actionBtn} onPress={() => nav.navigate(item.screen)}>
              <View style={styles.actionIcon}>
                <Ionicons name={item.icon as any} size={22} color={colors.primary} />
              </View>
              <Text style={styles.actionLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Total Expenses */}
        <Card style={styles.totalCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.totalLabel}>Total Expenses</Text>
            <Text style={styles.totalCount}>{data?.total_expenses ?? 0}</Text>
          </View>
          <TouchableOpacity onPress={() => nav.navigate('History')} style={styles.viewAll}>
            <Text style={styles.viewAllText}>View All History →</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: spacing.sm },
  greet: { color: colors.textSecondary, fontSize: fontSizes.sm },
  userName: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: colors.danger, borderRadius: 8, paddingHorizontal: 4, minWidth: 16, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 100 },
  balanceCard: { marginBottom: spacing.md, alignItems: 'center', backgroundColor: colors.bgSurface, borderColor: colors.primaryDark },
  balanceLabel: { color: colors.textSecondary, fontSize: fontSizes.sm, marginBottom: spacing.xs },
  balanceAmount: { fontSize: fontSizes.xxxl, fontWeight: fontWeights.bold },
  balanceSub: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statIcon: { fontSize: 22, marginBottom: spacing.xs },
  statValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold },
  statLabel: { color: colors.textMuted, fontSize: fontSizes.xs, textAlign: 'center', marginTop: 2 },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold, marginBottom: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  actionBtn: { flex: 1, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgSurface, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  actionLabel: { color: colors.textSecondary, fontSize: fontSizes.xs, fontWeight: '500' },
  totalCard: { marginBottom: spacing.md },
  totalLabel: { color: colors.textSecondary, fontSize: fontSizes.md },
  totalCount: { color: colors.textPrimary, fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  viewAll: { marginTop: spacing.sm },
  viewAllText: { color: colors.primary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
});
