import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import Layout from '../components/layout/Layout';
import Skeleton from '../components/Skeleton';
import { useAuthStore } from '../store/auth';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { budgetsAPI } from '../api/services';
import { colors, shadows } from '../theme';
import { matchCategoryIcon } from '../utils/categoryHelpers';

export default function DashboardScreen() {
  const nav = useNavigation<any>();
  const { user } = useAuthStore();

  // ── Real-time data from Firebase ──────────────────────────────────────────
  const { ready, summary, myExpenses } = useRealtimeStore(user?.id);

  // ── Derived values (memoized) ─────────────────────────────────────────────
  const totalSpent = useMemo(() => {
    if (!user?.id) return 0;
    return myExpenses.reduce((sum, exp) => {
      const mySplit = (exp.splits || []).find(s => s.user_id === user.id);
      return sum + (mySplit ? mySplit.share_amount : 0);
    }, 0);
  }, [myExpenses, user?.id]);

  const netBalance = summary?.net_balance ?? 0;
  const youOwe = summary?.total_payable ?? 0;
  const youAreOwed = summary?.total_receivable ?? 0;

  const recentTransactions = useMemo(() => {
    return [...myExpenses]
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
      .slice(0, 3);
  }, [myExpenses]);

  const [budget, setBudget] = useState<{ total_budget: number; total_spent: number; percentage_used: number; remaining?: number; is_over_budget?: boolean } | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const now = new Date();
    budgetsAPI.summary(now.getMonth() + 1, now.getFullYear())
      .then(res => setBudget(res.data))
      .catch(() => setBudget(null));
  }, [myExpenses, user?.id]);

  const fmt = (n: number) =>
    n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <Layout title="Budget Buddy">
        <View style={styles.skeletonContainer}>
          <Skeleton height={144} borderRadius={16} />
          <View style={styles.skeletonGrid}>
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} height={80} borderRadius={16} style={styles.skeletonCol} />
            ))}
          </View>
          <Skeleton height={72} borderRadius={16} />
        </View>
      </Layout>
    );
  }

  return (
    <Layout title="Budget Buddy">
      <View style={styles.screenContainer}>
        {/* ── Net Balance Card ──────────────────────────────────────────── */}
        <View style={styles.netBalanceCard}>
          {/* Decorative Blur Circle Top-Right */}
          <View style={styles.decorativeCircle} />

          <View style={styles.headerRow}>
            <View style={styles.labelCol}>
              <Text style={styles.cardLabel}>Total Expense</Text>
              <Text style={styles.cardValue}>₹{fmt(totalSpent)}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* You Owe / Owed / Net 3-col Grid */}
          <View style={styles.balanceGrid}>
            <View style={styles.balanceColLeft}>
              <Text style={styles.miniLabel}>You owe</Text>
              <Text style={styles.miniValueOwe}>₹{fmt(youOwe)}</Text>
            </View>
            <View style={styles.balanceColCenter}>
              <Text style={styles.miniLabel}>Owed to you</Text>
              <Text style={styles.miniValueOwed}>₹{fmt(youAreOwed)}</Text>
            </View>
            <View style={styles.balanceColRight}>
              <Text style={styles.miniLabel}>Net</Text>
              <Text style={[styles.miniValueNet, { color: netBalance >= 0 ? colors.secondary : colors.error }]}>
                {netBalance >= 0 ? `+₹${fmt(netBalance)}` : `-₹${fmt(Math.abs(netBalance))}`}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <View style={styles.actionsGrid}>
          {[
            {
              label: 'Add',
              icon: 'add',
              screen: 'AddExpense',
              bgClass: colors.primary,
              textClass: colors.onPrimary,
              border: false,
            },
            {
              label: 'Budget',
              icon: 'account-balance-wallet',
              screen: 'Budget',
              bgClass: colors.bgSurfaceContainer,
              textClass: colors.primary,
              border: true,
            },
            {
              label: 'Groups',
              icon: 'groups',
              screen: 'Groups',
              bgClass: colors.bgSurfaceContainer,
              textClass: colors.primary,
              border: true,
            },
            {
              label: 'History',
              icon: 'history',
              screen: 'History',
              bgClass: colors.bgSurfaceContainer,
              textClass: colors.primary,
              border: true,
            },
          ].map(({ label, icon, screen, bgClass, textClass, border }) => (
            <TouchableOpacity
              key={screen}
              onPress={() => nav.navigate(screen)}
              style={styles.actionBtn}
              activeOpacity={0.7}
            >
              <View style={[
                styles.actionIconContainer,
                { backgroundColor: bgClass },
                border && { borderWidth: 1, borderColor: colors.outlineVariant + '4c' }
              ]}>
                {icon === 'add' ? (
                  <Ionicons name="add" size={24} color={textClass} />
                ) : icon === 'account-balance-wallet' ? (
                  <MaterialIcons name="account-balance-wallet" size={24} color={textClass} />
                ) : icon === 'groups' ? (
                  <MaterialIcons name="groups" size={24} color={textClass} />
                ) : (
                  <MaterialIcons name="history" size={24} color={textClass} />
                )}
              </View>
              <Text style={styles.actionLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Recent Transactions ──────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={() => nav.navigate('History')} activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsCard}>
          {recentTransactions.length === 0 ? (
            <Text style={styles.emptyText}>No transactions yet.</Text>
          ) : (
            recentTransactions.map((exp, index) => {
              const isPayer = exp.paid_by === 'you' || exp.paid_by === user?.id;
              const mySplit = (exp.splits || []).find((s: any) => s.user_id === user?.id);
              const displayAmt = mySplit ? mySplit.share_amount : exp.amount;

              return (
                <View key={exp.id} style={[
                  styles.transactionRow,
                  index > 0 && styles.transactionDivider
                ]}>
                  <View style={styles.categoryIconWrap}>
                    <Text style={styles.categoryIconText}>{matchCategoryIcon(exp.category)}</Text>
                  </View>
                  <View style={styles.transactionMeta}>
                    <Text style={styles.transactionTitle} numberOfLines={1}>{exp.title}</Text>
                    <Text style={styles.transactionDate}>
                      {new Date(exp.expense_date).toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric'
                      })} · {exp.category}
                    </Text>
                  </View>
                  <View style={styles.transactionRight}>
                    <Text style={styles.transactionAmt}>₹{displayAmt.toLocaleString('en-IN')}</Text>
                    <Text style={[
                      styles.transactionStatus,
                      { color: isPayer ? colors.secondary : colors.error }
                    ]}>
                      {isPayer ? 'You paid' : 'You owe'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* ── Budget Used Indicator ──────────────────────────────────── */}
        {budget && budget.total_budget > 0 ? (
          <TouchableOpacity
            onPress={() => nav.navigate('Budget')}
            style={styles.budgetCard}
            activeOpacity={0.75}
          >
            <View style={styles.budgetHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="wallet-outline" size={18} color={colors.secondary} />
                <Text style={styles.budgetTitle}>Monthly Budget</Text>
              </View>
              <Text style={styles.budgetValue}>
                ₹{Math.round(budget.total_spent).toLocaleString('en-IN')} / ₹{Math.round(budget.total_budget).toLocaleString('en-IN')}
              </Text>
            </View>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.min(100, budget.percentage_used)}%`,
                    backgroundColor: budget.is_over_budget ? colors.error : colors.secondary 
                  }
                ]} 
              />
            </View>
            <View style={styles.budgetFooter}>
              <Text style={styles.budgetFooterText}>
                {budget.is_over_budget 
                  ? 'Over budget! ⚠️' 
                  : `${Math.round(budget.percentage_used)}% used · ₹${Math.max(0, Math.round(budget.remaining || 0)).toLocaleString('en-IN')} remaining`}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.onSurfaceVariant} />
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => nav.navigate('Budget')}
            style={styles.budgetCardEmpty}
            activeOpacity={0.75}
          >
            <Ionicons name="wallet-outline" size={20} color={colors.onSurfaceVariant + '80'} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.budgetEmptyTitle}>Set Monthly Budget</Text>
              <Text style={styles.budgetEmptySub}>Track spending & stay on budget</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceVariant + '80'} />
          </TouchableOpacity>
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  skeletonContainer: {
    gap: 24,
  },
  skeletonGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCol: {
    flex: 1,
  },
  screenContainer: {
    gap: 24,
  },
  // Net Balance Card
  netBalanceCard: {
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 202, 0.4)',
    position: 'relative',
    overflow: 'hidden',
    ...shadows.card,
  },
  decorativeCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: colors.secondaryContainer,
    opacity: 0.15,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  labelCol: {
    flexDirection: 'column',
  },
  cardLabel: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    color: colors.onSurfaceVariant,
  },
  cardValue: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.outlineVariant + '4c',
    marginVertical: 12,
  },
  balanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceColLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  balanceColCenter: {
    flex: 1,
    alignItems: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.outlineVariant + '33',
  },
  balanceColRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  miniLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniValueOwe: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.error,
    marginTop: 2,
  },
  miniValueOwed: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    color: colors.secondary,
    marginTop: 2,
  },
  miniValueNet: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  // Quick Actions Grid
  actionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: Platform.select({ ios: 12, android: 4, default: 8 }),
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 202, 0.4)',
    ...shadows.card,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  // Budget Card Styles
  budgetCard: {
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 202, 0.4)',
    gap: 10,
    ...shadows.card,
  },
  budgetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  budgetValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.onSurfaceVariant,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgSurfaceContainer,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  budgetFooterText: {
    fontSize: 12,
    color: colors.onSurfaceVariant + 'cc',
    fontWeight: '500',
  },
  budgetCardEmpty: {
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 202, 0.4)',
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  budgetEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  budgetEmptySub: {
    fontSize: 12,
    color: colors.onSurfaceVariant + 'b2',
    marginTop: 2,
  },
  // Recent Transactions Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.secondary,
  },
  transactionsCard: {
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255, 255, 255, 0.75)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(198, 198, 202, 0.40)',
    ...shadows.card,
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  transactionDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant + '22',
    marginTop: 8,
    paddingTop: 12,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.bgSurfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 18,
  },
  transactionMeta: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.onSurfaceVariant + 'b2',
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmt: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  transactionStatus: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.onSurfaceVariant + '80',
    fontStyle: 'italic',
    paddingVertical: 12,
  },
});
