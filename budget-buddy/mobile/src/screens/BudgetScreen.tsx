/**
 * BudgetScreen — exact port of web's BudgetPage.tsx
 *
 * Features:
 *  - Month navigator
 *  - SVG ring progress chart
 *  - Stats row (Total Spent, Remaining)
 *  - Category breakdown with progress bars
 *  - Set/Update budget form
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { BudgetRing } from '../components/ChartComponents';
import { budgetsAPI } from '../api/services';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import type { BudgetSummary, CategorySpend } from '../types';
import { colors, fontSizes, fontWeights, radius, spacing, shadows } from '../theme';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBudget = async (m: number, y: number) => {
    try {
      setLoading(true);
      const res = await budgetsAPI.summary(m, y);
      setBudget(res.data);
      if (res.data?.total_budget > 0) {
        setAmountInput(String(res.data.total_budget));
      } else {
        setAmountInput('');
      }
    } catch {
      setBudget(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadBudget(month, year); }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleSave = async () => {
    const amt = parseFloat(amountInput);
    if (!amt || amt <= 0) return;
    setSaving(true);
    try {
      await budgetsAPI.create({ amount: amt, month, year });
      await loadBudget(month, year);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const pct = budget?.percentage_used || 0;

  return (
    <View style={styles.root}>
      <TopBar title="Budgeting" showBack />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Month Navigator ─────────────────────────────────────────── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <>
            <Skeleton height={192} borderRadius={radius.xxl} />
            <Skeleton height={80} borderRadius={radius.xl} />
            <Skeleton height={192} borderRadius={radius.xl} />
          </>
        ) : (
          <>
            {/* ── Budget Ring + Stats ──────────────────────────────────── */}
            {budget && budget.total_budget > 0 ? (
              <>
                <Card glass style={styles.ringCard}>
                  {budget.is_over_budget && (
                    <View style={styles.overBudgetBadge}>
                      <Ionicons name="warning-outline" size={14} color={colors.error} />
                      <Text style={styles.overBudgetText}>Over Budget</Text>
                    </View>
                  )}
                  <BudgetRing pct={pct} size={160} />
                </Card>

                {/* Stats row */}
                <View style={styles.statsRow}>
                  <Card glass style={styles.statCard}>
                    <Text style={styles.statLabel}>Total Spent</Text>
                    <Text style={styles.statAmount}>₹{budget.total_spent.toLocaleString('en-IN')}</Text>
                  </Card>
                  <Card glass style={styles.statCard}>
                    <Text style={styles.statLabel}>Remaining</Text>
                    <Text style={[styles.statAmount, { color: (budget.remaining ?? 0) > 0 ? colors.secondary : colors.error }]}>
                      ₹{(budget.remaining ?? 0).toLocaleString('en-IN')}
                    </Text>
                  </Card>
                </View>

                {/* Category breakdown */}
                <Card glass>
                  <Text style={styles.sectionTitle}>Category Breakdown</Text>
                  {budget.categories.length === 0 ? (
                    <Text style={styles.emptyText}>No expenses yet this month.</Text>
                  ) : (
                    <View style={styles.catList}>
                      {budget.categories.map((cat: CategorySpend) => {
                        const catPct = (cat.spent / budget.total_budget) * 100;
                        return (
                          <View key={cat.category} style={styles.catRow}>
                            <View style={styles.catRowTop}>
                              <View style={styles.catNameRow}>
                                <Text style={{ fontSize: 16 }}>{matchCategoryIcon(cat.category)}</Text>
                                <Text style={styles.catName}>{cat.category}</Text>
                              </View>
                              <Text style={styles.catAmount}>₹{cat.spent.toLocaleString('en-IN')}</Text>
                            </View>
                            <View style={styles.progressBar}>
                              <View style={[styles.progressFill, { width: `${Math.min(catPct, 100)}%`, backgroundColor: colors.primary }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              </>
            ) : (
              <Card glass style={styles.noBudgetCard}>
                <Ionicons name="wallet-outline" size={48} color={colors.onSurfaceVariant + '40'} />
                <Text style={styles.noBudgetTitle}>No budget set</Text>
                <Text style={styles.noBudgetSub}>
                  Set a limit for {MONTH_NAMES[month - 1]} to start tracking your spending.
                </Text>
              </Card>
            )}

            {/* ── Set / Update Budget Form ─────────────────────────────── */}
            <Card glass style={styles.formCard}>
              <Text style={styles.sectionTitle}>
                {budget && budget.total_budget > 0 ? 'Update Limit' : 'Set Limit'}
              </Text>
              <View style={styles.amountRow}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="e.g. 15000"
                  placeholderTextColor={colors.onSurfaceVariant + '80'}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  keyboardType="decimal-pad"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.65 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? 'Saving...' : budget && budget.total_budget > 0 ? 'Save Changes' : 'Start Budgeting'}
                </Text>
              </TouchableOpacity>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255,255,255,0.78)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Platform.OS === 'android' ? 'rgba(198,198,202,0.6)' : 'rgba(198,198,202,0.4)',
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  monthLabel: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.primary },

  ringCard: { alignItems: 'center', paddingVertical: 28, position: 'relative' },
  overBudgetBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.errorContainer, borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4,
  },
  overBudgetText: { fontSize: fontSizes.xs, color: colors.error, fontWeight: fontWeights.bold },

  statsRow: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1 },
  statLabel: {
    fontSize: fontSizes.xs, fontWeight: fontWeights.semibold,
    color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  statAmount: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.primary, marginTop: 4 },

  sectionTitle: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 },
  emptyText: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant + '99', fontStyle: 'italic', textAlign: 'center', paddingVertical: 8 },

  catList: { gap: 16 },
  catRow: { gap: 6 },
  catRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catName: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.primary },
  catAmount: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.primary },
  progressBar: { height: 6, backgroundColor: colors.surfaceVariant, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  noBudgetCard: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  noBudgetTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.primary },
  noBudgetSub: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant, textAlign: 'center' },

  formCard: { gap: spacing.md },
  amountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgSurfaceContainerLow, borderRadius: radius.lg,
    paddingHorizontal: 14, height: 48,
  },
  rupeeSymbol: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.onSurfaceVariant, marginRight: 6 },
  amountInput: { flex: 1, fontSize: fontSizes.md, color: colors.primary, fontWeight: fontWeights.semibold },
  saveBtn: {
    height: 48, borderRadius: radius.xl, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', ...shadows.float,
  },
  saveBtnText: { color: colors.onPrimary, fontSize: fontSizes.sm, fontWeight: fontWeights.semibold },
});
