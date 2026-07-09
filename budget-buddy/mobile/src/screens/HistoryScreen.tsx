import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { expensesAPI, usersAPI } from '../api/services';
import { useAuthStore } from '../store/auth';
import Card from '../components/Card';
import EmptyState from '../components/EmptyState';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';
import { matchCategoryIcon, matchCategoryColor } from '../utils/categoryHelpers';
import type { Expense } from '../types';

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const store = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (reset = false) => {
    const s = reset ? 0 : skip;
    try {
      const res = await expensesAPI.list(s, 20);
      const newExpenses = res.data.expenses;
      setTotal(res.data.total);
      setExpenses(prev => reset ? newExpenses : [...prev, ...newExpenses]);
      setSkip(s + 20);
      // Fetch user names
      const ids = new Set<string>();
      newExpenses.forEach((e: Expense) => { ids.add(e.paid_by); e.splits.forEach((s: any) => ids.add(s.user_id)); });
      const map = { ...userMap, [store.user?.id ?? '']: 'You' };
      for (const id of ids) {
        if (!map[id]) { try { const u = await usersAPI.getById(id); map[id] = u.data.name; } catch {} }
      }
      setUserMap(map);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(true); }, []);

  const handleDelete = (id: string) => {
    Alert.alert('Delete Expense', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await expensesAPI.delete(id); load(true); } }
    ]);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Expense History</Text>
        <Text style={styles.total}>{total} total</Text>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={e => e.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={colors.primary} />}
        onEndReached={() => { if (expenses.length < total) load(); }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<EmptyState icon="receipt-outline" title="No Expenses Yet" subtitle="Start adding expenses to track your spending" />}
        renderItem={({ item }) => {
          const isPayer = item.paid_by === store.user?.id;
          const mySplit = item.splits.find((s: any) => s.user_id === store.user?.id);
          const myShare = mySplit?.share_amount ?? 0;
          const payerName = userMap[item.paid_by] ?? 'Someone';
          const catColor = matchCategoryColor(item.category);
          const catIcon = matchCategoryIcon(item.category);
          return (
            <Card style={styles.expCard}>
              <View style={styles.expRow}>
                <View style={[styles.catBadge, { backgroundColor: catColor + '22' }]}>
                  <Text style={styles.catIcon}>{catIcon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.expTitle}>{item.title}</Text>
                  <Text style={styles.expMeta}>
                    {isPayer ? 'You paid' : `${payerName} paid`} · {new Date(item.expense_date).toLocaleDateString()}
                  </Text>
                  <View style={[styles.splitChip, { backgroundColor: catColor + '15' }]}>
                    <Text style={[styles.splitChipText, { color: catColor }]}>{item.category}</Text>
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.expTotal}>₹{item.amount.toFixed(2)}</Text>
                  <Text style={[styles.expShare, { color: isPayer ? colors.success : colors.danger }]}>
                    {isPayer ? `+₹${(item.amount - myShare).toFixed(2)}` : `-₹${myShare.toFixed(2)}`}
                  </Text>
                  <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <Ionicons name="trash-outline" size={14} color={colors.textMuted} style={{ marginTop: spacing.xs }} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  total: { color: colors.textMuted, fontSize: fontSizes.sm },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: 100 },
  expCard: {},
  expRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  catBadge: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  catIcon: { fontSize: 22 },
  expTitle: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
  expMeta: { color: colors.textMuted, fontSize: fontSizes.xs, marginTop: 2 },
  splitChip: { marginTop: 4, alignSelf: 'flex-start', paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full },
  splitChipText: { fontSize: fontSizes.xs, fontWeight: '600' },
  expTotal: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.bold },
  expShare: { fontSize: fontSizes.sm, fontWeight: '600', marginTop: 2 },
});
