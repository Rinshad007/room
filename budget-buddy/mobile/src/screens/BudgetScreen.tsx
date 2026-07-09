import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { budgetsAPI } from '../api/services';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';
import { colors, fontSizes, fontWeights, spacing, radius } from '../theme';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BudgetScreen() {
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newBudget, setNewBudget] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await budgetsAPI.summary(month, year);
      setSummary(res.data);
    } catch {
      setSummary(null);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, [month, year]);

  const handleSave = async () => {
    const amount = parseFloat(newBudget);
    if (!amount || amount <= 0) { Alert.alert('Error', 'Enter a valid budget amount'); return; }
    setSaving(true);
    try {
      if (summary?.total_budget > 0) {
        await budgetsAPI.update(month, year, amount);
      } else {
        await budgetsAPI.create({ month, year, amount });
      }
      setEditing(false); setNewBudget(''); load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setSaving(false);
  };

  const pct = summary?.percentage_used ?? 0;
  const isOver = summary?.is_over_budget;

  if (loading) return <LoadingSpinner />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Budget</Text>
        <Button title={editing ? 'Cancel' : 'Set Budget'} variant="outline" onPress={() => { setEditing(!editing); setNewBudget(''); }} style={{ paddingHorizontal: spacing.md }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Month Selector */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
            <Text style={styles.arrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity onPress={() => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Set Budget Input */}
        {editing && (
          <Card style={styles.editCard}>
            <Input label="Monthly Budget (₹)" value={newBudget} onChangeText={setNewBudget} keyboardType="decimal-pad" placeholder="e.g. 10000" icon="wallet-outline" />
            <Button title="Save Budget" onPress={handleSave} loading={saving} fullWidth />
          </Card>
        )}

        {/* Budget Overview */}
        {summary?.total_budget > 0 ? (
          <Card style={styles.budgetCard}>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Budget</Text>
              <Text style={styles.budgetAmount}>₹{summary.total_budget.toFixed(0)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Spent</Text>
              <Text style={[styles.budgetAmount, { color: isOver ? colors.danger : colors.textPrimary }]}>₹{summary.total_spent.toFixed(0)}</Text>
            </View>
            <View style={styles.budgetRow}>
              <Text style={styles.budgetLabel}>Remaining</Text>
              <Text style={[styles.budgetAmount, { color: isOver ? colors.danger : colors.success }]}>₹{summary.remaining.toFixed(0)}</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${Math.min(pct, 100)}%` as any,
                backgroundColor: isOver ? colors.danger : pct > 80 ? colors.warning : colors.success
              }]} />
            </View>
            <Text style={[styles.pctText, { color: isOver ? colors.danger : colors.textMuted }]}>
              {isOver ? '⚠️ Over budget!' : `${pct.toFixed(1)}% used`}
            </Text>
          </Card>
        ) : (
          <Card style={styles.noBudget}>
            <Text style={styles.noBudgetIcon}>💰</Text>
            <Text style={styles.noBudgetText}>No budget set for {MONTH_NAMES[month - 1]}</Text>
            <Button title="Set a Budget" onPress={() => setEditing(true)} style={{ marginTop: spacing.md }} />
          </Card>
        )}

        {/* Category Breakdown */}
        {summary?.categories?.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {summary.categories.map((cat: any, i: number) => (
              <Card key={i} style={styles.catCard}>
                <View style={styles.catRow}>
                  <Text style={styles.catLabel}>{cat.category}</Text>
                  <Text style={styles.catAmount}>₹{cat.spent.toFixed(2)}</Text>
                </View>
                {summary.total_budget > 0 && (
                  <View style={styles.catProgressBg}>
                    <View style={[styles.catProgressFill, { width: `${Math.min((cat.spent / summary.total_budget) * 100, 100)}%` as any }]} />
                  </View>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginBottom: spacing.md },
  arrow: { color: colors.primary, fontSize: 32, fontWeight: 'bold' },
  monthLabel: { color: colors.textPrimary, fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, minWidth: 160, textAlign: 'center' },
  editCard: { marginBottom: spacing.md },
  budgetCard: { marginBottom: spacing.md },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  budgetLabel: { color: colors.textSecondary, fontSize: fontSizes.md },
  budgetAmount: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold },
  progressBg: { height: 10, backgroundColor: colors.bgInput, borderRadius: radius.full, marginTop: spacing.sm, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  pctText: { fontSize: fontSizes.sm, textAlign: 'right', marginTop: spacing.xs },
  noBudget: { alignItems: 'center', paddingVertical: spacing.xl },
  noBudgetIcon: { fontSize: 48, marginBottom: spacing.md },
  noBudgetText: { color: colors.textSecondary, fontSize: fontSizes.md },
  sectionTitle: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold, marginBottom: spacing.sm },
  catCard: { marginBottom: spacing.sm },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  catLabel: { color: colors.textSecondary, fontSize: fontSizes.sm },
  catAmount: { color: colors.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
  catProgressBg: { height: 6, backgroundColor: colors.bgInput, borderRadius: radius.full, overflow: 'hidden' },
  catProgressFill: { height: '100%', backgroundColor: colors.primary, borderRadius: radius.full },
});
