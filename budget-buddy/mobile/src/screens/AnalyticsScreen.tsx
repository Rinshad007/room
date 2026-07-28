/**
 * AnalyticsScreen — upgraded with responsive layout and advanced insights features (iOS 27 style)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import TopBar from '../components/TopBar';
import Card from '../components/Card';
import Skeleton from '../components/Skeleton';
import { DonutChart, BarChartSVG, AreaChartSVG } from '../components/ChartComponents';
import { analyticsAPI, budgetsAPI } from '../api/services';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { CATEGORY_COLORS } from '../utils/categoryHelpers';
import { colors, fontSizes, fontWeights, radius, spacing } from '../theme';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (n: number) =>
  n >= 1_000_000 ? `₹${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `₹${(n / 1_000).toFixed(1)}K`
  : `₹${n.toFixed(0)}`;

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuthStore();
  const { summary: realtimeSummary } = useRealtimeStore(user?.id);
  const now = new Date();
  
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);

  // Data states
  const [categoriesData, setCategoriesData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ name: string; amount: number; month: number }[]>([]);
  const [trendData, setTrendData] = useState<{ label: string; total: number }[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPaidByMe, setTotalPaidByMe] = useState(0);
  const [budgetStatus, setBudgetStatus] = useState<any>(null);

  // Responsive sizes
  const chartWidth = Math.min(windowWidth - (spacing.pagePadding * 2) - 40, 640);
  const cardWidth = windowWidth > 768 
    ? (windowWidth - (spacing.pagePadding * 2) - 36) / 4 
    : (windowWidth - (spacing.pagePadding * 2) - 12) / 2;

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [catRes, monthlyRes, trendRes, dashRes, budgetRes] = await Promise.allSettled([
          analyticsAPI.categories(month, year),
          analyticsAPI.monthly(year),
          analyticsAPI.trends(6),
          analyticsAPI.dashboard(),
          budgetsAPI.summary(month, year),
        ]);

        if (!alive) return;

        if (catRes.status === 'fulfilled') {
          const raw = catRes.value.data;
          const arr: { name: string; value: number; color: string }[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const name = item.category || item.name || 'Others';
              const value = parseFloat(item.total ?? item.amount ?? item.value ?? 0);
              if (value > 0) arr.push({ name, value, color: CATEGORY_COLORS[name] ?? '#6B7280' });
            });
          }
          setCategoriesData(arr);
        }

        if (monthlyRes.status === 'fulfilled') {
          const raw = monthlyRes.value.data;
          const arr: { name: string; amount: number; month: number }[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const m = parseInt(item.month ?? 0);
              arr.push({ name: MONTH_NAMES[m - 1] ?? '?', month: m, amount: parseFloat(item.total ?? item.amount ?? 0) });
            });
          }
          setMonthlyData(arr);
        }

        if (trendRes.status === 'fulfilled') {
          const raw = trendRes.value.data;
          const arr: { label: string; total: number }[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const m = parseInt(item.month ?? 0);
              arr.push({ label: `${MONTH_NAMES[m - 1] ?? '?'} ${item.year ?? ''}`, total: parseFloat(item.total ?? 0) });
            });
          }
          setTrendData(arr);
        }

        if (dashRes.status === 'fulfilled') {
          const d = dashRes.value.data;
          setTotalExpenses(d?.total_expenses ?? 0);
          setTotalPaidByMe(d?.total_spent ?? 0);
        }

        if (budgetRes.status === 'fulfilled') {
          setBudgetStatus(budgetRes.value.data);
        }
      } catch {}
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [month, year]);

  const totalSpent = useMemo(() => categoriesData.reduce((s, c) => s + c.value, 0), [categoriesData]);
  const topCategory = useMemo(() => [...categoriesData].sort((a, b) => b.value - a.value)[0], [categoriesData]);

  const prevMonthAmt = useMemo(() => {
    const prev = month === 1 ? 12 : month - 1;
    return monthlyData.find(d => d.month === prev)?.amount ?? 0;
  }, [monthlyData, month]);

  const vsLastMonth = totalSpent - prevMonthAmt;
  const vsLastMonthPct = prevMonthAmt ? Math.abs(Math.round((vsLastMonth / prevMonthAmt) * 100)) : null;

  // Daily average spending velocity calculations
  const dailyAverage = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const isCurrentMonth = year === now.getFullYear() && month === (now.getMonth() + 1);
    const divisor = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
    return totalSpent / divisor;
  }, [totalSpent, month, year]);

  const prevMth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  if (loading) {
    return (
      <View style={styles.root}>
        <TopBar title="Analytics" showBack={false} />
        <ScrollView contentContainerStyle={styles.scroll}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} height={i === 0 ? 56 : 200} borderRadius={radius.xl} />)}
        </ScrollView>
      </View>
    );
  }

  // Define stat cards configuration
  const statItems = [
    { icon: 'receipt', label: 'Total Expenses', value: String(totalExpenses), sub: 'all time', accent: '#6366f1' },
    { icon: 'cash', label: 'Total Spent', value: fmt(totalPaidByMe), sub: 'all time', accent: '#F97316' },
    { icon: 'grid', label: 'Top Category', value: topCategory?.name ?? '—', sub: topCategory ? fmt(topCategory.value) : undefined, accent: topCategory?.color ?? '#A855F7' },
    {
      icon: vsLastMonth >= 0 ? 'arrow-up' : 'arrow-down',
      label: 'vs Last Month',
      value: vsLastMonthPct != null ? `${vsLastMonthPct}%` : '—',
      sub: vsLastMonth >= 0 ? `↑ ${fmt(Math.abs(vsLastMonth))} more` : `↓ ${fmt(Math.abs(vsLastMonth))} less`,
      accent: vsLastMonth >= 0 ? '#EF4444' : '#22c55e',
    },
  ];

  return (
    <View style={styles.root}>
      <TopBar title="Analytics" showBack={false} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Month Navigator (Top Placement) ─────────────────────────── */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={prevMth} style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{FULL_MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity onPress={nextMth} style={styles.navBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-forward" size={22} color={colors.onSurfaceVariant} />
          </TouchableOpacity>
        </View>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Analytics</Text>
          <View style={styles.insightsBadge}>
            <Ionicons name="bar-chart" size={14} color="#6366f1" />
            <Text style={styles.insightsBadgeText}>Live Insights</Text>
          </View>
        </View>

        {/* ── Stat Cards (Responsive Grid) ───────────────────────────── */}
        <View style={styles.statGrid}>
          {statItems.map((s, i) => (
            <Card glass key={i} style={[styles.statCard, { width: cardWidth, minWidth: cardWidth - 6 }]}>
              <View style={styles.statHeaderRow}>
                <Ionicons name={s.icon as any} size={16} color={s.accent} />
                <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              </View>
              <Text style={styles.statValue} numberOfLines={1}>{s.value}</Text>
              {s.sub && <Text style={styles.statSub} numberOfLines={1}>{s.sub}</Text>}
            </Card>
          ))}
        </View>

        {/* ── Donut Chart ─────────────────────────────────────────────── */}
        <Card glass>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            <Text style={styles.sectionSub}>{MONTH_NAMES[month - 1]} {year}</Text>
          </View>
          {categoriesData.length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="pie-chart-outline" size={48} color={colors.onSurfaceVariant + '40'} />
              <Text style={styles.emptyText}>No spending data for this month</Text>
            </View>
          ) : (
            <>
              <View style={styles.donutCenter}>
                <DonutChart data={categoriesData} size={200} />
              </View>
              {/* Legend */}
              {categoriesData.map(c => (
                <View key={c.name} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: c.color }]} />
                  <Text style={styles.legendName}>{c.name}</Text>
                  <Text style={styles.legendPct}>{pct(c.value, totalSpent)}%</Text>
                  <View style={styles.legendBar}>
                    <View style={[styles.legendBarFill, { width: `${pct(c.value, totalSpent)}%`, backgroundColor: c.color }]} />
                  </View>
                  <Text style={styles.legendAmt}>{fmt(c.value)}</Text>
                </View>
              ))}
            </>
          )}
        </Card>

        {/* ── Monthly Bar Chart ────────────────────────────────────────── */}
        <Card glass>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Monthly Overview</Text>
            <Text style={styles.sectionSub}>{year}</Text>
          </View>
          {monthlyData.filter(d => d.amount > 0).length === 0 ? (
            <View style={styles.emptyChart}>
              <Ionicons name="bar-chart-outline" size={48} color={colors.onSurfaceVariant + '40'} />
              <Text style={styles.emptyText}>No monthly data for {year}</Text>
            </View>
          ) : (
            <BarChartSVG data={monthlyData} activeMonth={month} width={chartWidth} height={180} />
          )}
        </Card>

        {/* ── Trend Area Chart ─────────────────────────────────────────── */}
        {trendData.length > 0 && (
          <Card glass>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Spending Trend</Text>
              <Text style={styles.sectionSub}>Last 6 months</Text>
            </View>
            <AreaChartSVG data={trendData} width={chartWidth} height={160} />
            {/* Summary row */}
            <View style={styles.trendSummary}>
              {trendData.slice(-3).map((d, i) => (
                <View key={i} style={styles.trendSummaryItem}>
                  <Text style={styles.trendMonth}>{d.label.split(' ')[0]}</Text>
                  <Text style={styles.trendAmt}>{fmt(d.total)}</Text>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* ── Spending Insights (Expanded Features) ───────────────────── */}
        <Card glass>
          <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>Smart Spending Insights</Text>
          <View style={styles.insightsList}>
            {/* 1. Monthly Budget Status */}
            {budgetStatus && budgetStatus.total_budget > 0 ? (
              <View style={[styles.insightRow, { backgroundColor: budgetStatus.is_over_budget ? '#fef2f2' : '#f0fdf4' }]}>
                <View style={[styles.insightIcon, { backgroundColor: budgetStatus.is_over_budget ? '#fee2e2' : '#dcfce7' }]}>
                  <Ionicons name="wallet-outline" size={18} color={budgetStatus.is_over_budget ? '#ef4444' : '#22c55e'} />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>Budget Progress</Text>
                  <Text style={styles.insightValue}>
                    {fmt(budgetStatus.total_spent)} of {fmt(budgetStatus.total_budget)} spent
                  </Text>
                  <View style={styles.progressBarBg}>
                    <View style={[
                      styles.progressBarFill, 
                      { 
                        width: `${Math.min(budgetStatus.percentage_used, 100)}%`,
                        backgroundColor: budgetStatus.is_over_budget ? '#ef4444' : '#22c55e'
                      }
                    ]} />
                  </View>
                </View>
                <Text style={[styles.insightPct, { color: budgetStatus.is_over_budget ? '#ef4444' : '#22c55e' }]}>
                  {budgetStatus.percentage_used}%
                </Text>
              </View>
            ) : (
              <View style={[styles.insightRow, { backgroundColor: '#f8f9fa' }]}>
                <View style={[styles.insightIcon, { backgroundColor: '#e9ecef' }]}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.onSurfaceVariant} />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>No Budget Configured</Text>
                  <Text style={styles.insightValue}>Configure a monthly budget in Profile to track savings.</Text>
                </View>
              </View>
            )}

            {/* 2. Spending Velocity */}
            {totalSpent > 0 && (
              <View style={[styles.insightRow, { backgroundColor: '#fff7ed' }]}>
                <View style={[styles.insightIcon, { backgroundColor: '#ffedd5' }]}>
                  <Ionicons name="speedometer-outline" size={18} color="#f97316" />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>Daily Spending Velocity</Text>
                  <Text style={styles.insightValue}>
                    You are spending an average of <Text style={{ color: '#c2410c' }}>₹{Math.round(dailyAverage)}</Text> daily.
                  </Text>
                </View>
              </View>
            )}

            {/* 3. Financial Health / Settle Up Suggestion */}
            {realtimeSummary && (realtimeSummary.total_payable > 0 || realtimeSummary.total_receivable > 0) ? (
              <View style={[
                styles.insightRow, 
                { backgroundColor: realtimeSummary.net_balance >= 0 ? '#f0fdf4' : '#fef2f2' }
              ]}>
                <View style={[
                  styles.insightIcon, 
                  { backgroundColor: realtimeSummary.net_balance >= 0 ? '#dcfce7' : '#fee2e2' }
                ]}>
                  <Ionicons 
                    name={realtimeSummary.net_balance >= 0 ? 'checkmark-circle-outline' : 'warning-outline'} 
                    size={18} 
                    color={realtimeSummary.net_balance >= 0 ? '#22c55e' : '#ef4444'} 
                  />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>Debt Summary</Text>
                  <Text style={styles.insightValue}>
                    {realtimeSummary.net_balance >= 0 
                      ? `Friends owe you ₹${Math.round(realtimeSummary.total_receivable)}. Gentle nudge recommended!`
                      : `You owe friends ₹${Math.round(realtimeSummary.total_payable)}. Settle up to clear debt!`
                    }
                  </Text>
                </View>
              </View>
            ) : (
              <View style={[styles.insightRow, { backgroundColor: '#f0fdf4' }]}>
                <View style={[styles.insightIcon, { backgroundColor: '#dcfce7' }]}>
                  <Ionicons name="happy-outline" size={18} color="#22c55e" />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>Financial Standing</Text>
                  <Text style={styles.insightValue}>All settled up! Excellent cashflow management.</Text>
                </View>
              </View>
            )}

            {/* 4. Biggest category */}
            {categoriesData.length > 0 && (
              <View style={[styles.insightRow, { backgroundColor: '#f5f3ff' }]}>
                <View style={[styles.insightIcon, { backgroundColor: '#ddd6fe' }]}>
                  <Ionicons name="pie-chart-outline" size={18} color="#7c3aed" />
                </View>
                <View style={styles.insightInfo}>
                  <Text style={styles.insightLabel}>Biggest Spending Sink</Text>
                  <Text style={styles.insightValue}>
                    {topCategory?.name} accounts for {pct(topCategory?.value ?? 0, totalSpent)}% of your expenses this month.
                  </Text>
                </View>
                <Text style={[styles.insightPct, { color: '#7c3aed' }]}>
                  {pct(topCategory?.value ?? 0, totalSpent)}%
                </Text>
              </View>
            )}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

// Helper auth store mock import (resolves auth store dynamically)
import { useAuthStore } from '../store/auth';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: spacing.pagePadding, paddingTop: spacing.md, gap: spacing.md },

  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pageTitle: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold, color: colors.onSurface },
  insightsBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#eef2ff', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5,
  },
  insightsBadgeText: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: '#6366f1' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Platform.OS === 'android' ? '#ffffff' : 'rgba(255,255,255,0.78)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Platform.OS === 'android' ? 'rgba(198,198,202,0.6)' : 'rgba(198,198,202,0.4)',
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  monthLabel: { fontSize: fontSizes.md, fontWeight: fontWeights.semibold, color: colors.primary },

  statGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between',
    width: '100%',
  },
  statCard: {
    padding: 14, 
    marginBottom: 12,
    gap: 4,
  },
  statHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statLabel: { fontSize: 10, fontWeight: fontWeights.semibold, color: colors.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 },
  statValue: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.onSurface },
  statSub: { fontSize: 11, color: colors.onSurfaceVariant + '99' },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, color: colors.onSurface },
  sectionSub: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant + '99', fontWeight: fontWeights.medium },

  donutCenter: { alignItems: 'center', marginBottom: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendName: { fontSize: fontSizes.sm, color: colors.onSurface, fontWeight: fontWeights.medium, flex: 1 },
  legendPct: { fontSize: fontSizes.xs, color: colors.onSurfaceVariant + '99', width: 28, textAlign: 'right' },
  legendBar: { width: 60, height: 6, backgroundColor: colors.bgSurfaceContainer, borderRadius: 4, overflow: 'hidden' },
  legendBarFill: { height: '100%', borderRadius: 4 },
  legendAmt: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onSurface, width: 48, textAlign: 'right' },

  emptyChart: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: fontSizes.sm, color: colors.onSurfaceVariant + '99', fontStyle: 'italic' },

  trendSummary: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.outlineVariant + '30', paddingTop: 10, marginTop: 4 },
  trendSummaryItem: { alignItems: 'center', gap: 2 },
  trendMonth: { fontSize: 10, color: colors.onSurfaceVariant + '99', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: fontWeights.medium },
  trendAmt: { fontSize: fontSizes.sm, fontWeight: fontWeights.bold, color: colors.onSurface },

  insightsList: { gap: 10 },
  insightRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 12 },
  insightIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  insightInfo: { flex: 1 },
  insightLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.onSurfaceVariant },
  insightValue: { fontSize: fontSizes.sm, color: colors.onSurface, fontWeight: fontWeights.semibold, marginTop: 2, lineHeight: 18 },
  insightPct: { fontSize: fontSizes.sm, fontWeight: '800' },

  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
