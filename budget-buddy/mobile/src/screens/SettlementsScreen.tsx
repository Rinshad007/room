import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { settlementsAPI, friendsAPI, usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from 'react-native-toast-message';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';
import type { Settlement } from '../types';

export default function SettlementsScreen() {
  const insets = useSafeAreaInsets();
  const store = useAuthStore();
  const [balances, setBalances] = useState<any>(null);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [settleReceiver, setSettleReceiver] = useState('');
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState<'GPay' | 'Cash'>('GPay');
  const [settling, setSettling] = useState(false);

  const load = useCallback(async () => {
    try {
      const [b, s, f] = await Promise.all([settlementsAPI.balances(), settlementsAPI.list(), friendsAPI.list()]);
      setBalances(b.data);
      setSettlements(s.data);
      setFriends(f.data.friends);
      const ids = new Set<string>();
      b.data.per_user.forEach((u: any) => ids.add(u.user_id));
      s.data.forEach((s: any) => { ids.add(s.payer_id); ids.add(s.receiver_id); });
      const map: Record<string, string> = {};
      map[store.user?.id ?? ''] = 'You';
      for (const id of ids) {
        if (id !== store.user?.id) {
          try { const u = await usersAPI.getById(id); map[id] = u.data.name; } catch {}
        }
      }
      setUserMap(map);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [store.user]);

  useEffect(() => { load(); }, []);

  const handleSettle = async () => {
    if (!settleReceiver || !settleAmount) { Alert.alert('Error', 'Fill all fields'); return; }
    setSettling(true);
    try {
      await settlementsAPI.create({ receiver_id: settleReceiver, amount: parseFloat(settleAmount), payment_method: settleMethod, status: 'completed' });
      Toast.show({ type: 'success', text1: 'Settlement recorded!' });
      setShowSettle(false); setSettleReceiver(''); setSettleAmount('');
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSettling(false);
  };

  const handleApprove = async (id: string) => {
    await settlementsAPI.approve(id);
    Toast.show({ type: 'success', text1: 'Settlement approved!' });
    load();
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settlements</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowSettle(true)}>
          <Ionicons name="swap-horizontal" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={settlements}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
        ListHeaderComponent={
          <>
            {/* Balance Summary */}
            <View style={styles.summaryRow}>
              <Card style={[styles.summaryCard, { borderColor: colors.success + '50' }]}>
                <Text style={styles.summaryLabel}>Owed to You</Text>
                <Text style={[styles.summaryAmount, { color: colors.success }]}>₹{(balances?.summary.total_receivable ?? 0).toFixed(2)}</Text>
              </Card>
              <Card style={[styles.summaryCard, { borderColor: colors.danger + '50' }]}>
                <Text style={styles.summaryLabel}>You Owe</Text>
                <Text style={[styles.summaryAmount, { color: colors.danger }]}>₹{(balances?.summary.total_payable ?? 0).toFixed(2)}</Text>
              </Card>
            </View>

            {/* Per-user balances */}
            {(balances?.per_user ?? []).map((u: any) => (
              <Card key={u.user_id} style={styles.balanceRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={styles.avatar}><Text style={styles.avatarText}>{(userMap[u.user_id] || 'U').charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.userName}>{userMap[u.user_id] ?? u.user_id}</Text>
                    <Text style={[styles.balanceText, { color: u.balance > 0 ? colors.success : colors.danger }]}>
                      {u.balance > 0 ? `Owes you ₹${u.balance.toFixed(2)}` : `You owe ₹${Math.abs(u.balance).toFixed(2)}`}
                    </Text>
                  </View>
                  {u.balance < 0 && (
                    <Button title="Settle" onPress={() => { setSettleReceiver(u.user_id); setSettleAmount(Math.abs(u.balance).toFixed(2)); setShowSettle(true); }} style={{ paddingHorizontal: spacing.md }} />
                  )}
                </View>
              </Card>
            ))}
            <Text style={styles.sectionTitle}>Recent Settlements</Text>
          </>
        }
        ListEmptyComponent={<EmptyState icon="swap-horizontal-outline" title="No settlements yet" />}
        renderItem={({ item }) => {
          const isPayer = item.payer_id === store.user?.id;
          const otherName = userMap[isPayer ? item.receiver_id : item.payer_id] ?? 'User';
          return (
            <Card style={styles.settlementCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={[styles.dirIcon, { backgroundColor: isPayer ? colors.danger + '22' : colors.success + '22' }]}>
                  <Ionicons name={isPayer ? 'arrow-up' : 'arrow-down'} size={18} color={isPayer ? colors.danger : colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settleName}>{isPayer ? `Paid ${otherName}` : `${otherName} paid you`}</Text>
                  <Text style={styles.settleDate}>{item.payment_method} · {new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.settleAmount, { color: isPayer ? colors.danger : colors.success }]}>₹{item.amount.toFixed(2)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: item.status === 'completed' ? colors.success + '22' : colors.warning + '22' }]}>
                    <Text style={[styles.statusText, { color: item.status === 'completed' ? colors.success : colors.warning }]}>{item.status}</Text>
                  </View>
                </View>
              </View>
              {!isPayer && item.status === 'pending' && (
                <Button title="Approve" variant="outline" onPress={() => handleApprove(item.id)} style={{ marginTop: spacing.sm }} />
              )}
            </Card>
          );
        }}
      />

      {/* Settle Modal */}
      <Modal visible={showSettle} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Record Settlement</Text>
            <Text style={styles.sectionLabel}>Settle With</Text>
            <View style={styles.chipRow}>
              {friends.map(f => (
                <TouchableOpacity key={f.friendship_id} style={[styles.chip, settleReceiver === f.friend.id && styles.chipActive]} onPress={() => setSettleReceiver(f.friend.id)}>
                  <Text style={[styles.chipLabel, settleReceiver === f.friend.id && styles.chipLabelActive]}>{f.friend.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input label="Amount (₹)" value={settleAmount} onChangeText={setSettleAmount} keyboardType="decimal-pad" icon="cash-outline" />
            <Text style={styles.sectionLabel}>Payment Method</Text>
            <View style={styles.chipRow}>
              {(['GPay', 'Cash'] as const).map(m => (
                <TouchableOpacity key={m} style={[styles.chip, settleMethod === m && styles.chipActive]} onPress={() => setSettleMethod(m)}>
                  <Text style={[styles.chipLabel, settleMethod === m && styles.chipLabelActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <Button title="Cancel" variant="ghost" onPress={() => setShowSettle(false)} style={{ flex: 1 }} />
              <Button title="Settle" onPress={handleSettle} loading={settling} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryLabel: { color: colors.textSecondary, fontSize: fontSizes.xs, marginBottom: spacing.xs },
  summaryAmount: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  balanceRow: { marginBottom: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '33', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontWeight: fontWeights.bold, fontSize: fontSizes.md },
  userName: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: '500' },
  balanceText: { fontSize: fontSizes.sm, marginTop: 2 },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold, marginVertical: spacing.sm },
  sectionLabel: { color: colors.textSecondary, fontSize: fontSizes.sm, fontWeight: '500', marginBottom: spacing.sm },
  settlementCard: {},
  dirIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  settleName: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: '500' },
  settleDate: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2 },
  settleAmount: { fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, marginTop: 2 },
  statusText: { fontSize: fontSizes.xs, fontWeight: '600', textTransform: 'capitalize' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bgCard, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl },
  modalTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary, marginBottom: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bgInput, borderWidth: 1.5, borderColor: colors.border },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
  chipLabel: { color: colors.textSecondary, fontSize: fontSizes.sm },
  chipLabelActive: { color: colors.primary, fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
