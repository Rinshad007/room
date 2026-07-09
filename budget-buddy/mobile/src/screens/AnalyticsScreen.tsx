import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { analyticsAPI } from '../api/services';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { colors, fontSizes, fontWeights, spacing } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const CAT_COLORS = ['#7C3AED','#06B6D4','#10B981','#F59E0B','#EF4444','#8B5CF6'];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [m, c, t] = await Promise.all([analyticsAPI.monthly(), analyticsAPI.categories(), analyticsAPI.trends(6)]);
      setMonthlyData(m.data.data.map((d: any) => ({ value: d.total, label: MONTH_LABELS[d.month - 1], frontColor: colors.primary + 'BB' })));
      setCategoryData(c.data.data.map((d: any, i: number) => ({ value: d.total, color: CAT_COLORS[i % CAT_COLORS.length], text: d.category })));
      setTrends(t.data.data.map((d: any, i: number) => ({ value: d.total, label: MONTH_LABELS[d.month - 1], frontColor: colors.secondary + 'BB' })));
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingSpinner />;

  const hasData = monthlyData.some(d => d.value > 0);
  const hasCatData = categoryData.length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />}
      >
        {/* Monthly Spending */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Monthly Spending ({new Date().getFullYear()})</Text>
          {hasData ? (
            <BarChart
              data={monthlyData}
              barWidth={20}
              spacing={12}
              roundedTop
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 9 }}
              noOfSections={4}
              maxValue={Math.max(...monthlyData.map(d => d.value), 100)}
              barBorderRadius={4}
              width={SCREEN_WIDTH - 80}
              height={160}
            />
          ) : (
            <Text style={styles.noData}>No spending data this year</Text>
          )}
        </Card>

        {/* Category Breakdown */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>Category Breakdown (This Month)</Text>
          {hasCatData ? (
            <>
              <View style={styles.pieWrapper}>
                <PieChart
                  data={categoryData}
                  donut
                  innerRadius={60}
                  radius={90}
                  centerLabelComponent={() => (
                    <Text style={styles.pieCenter}>
                      ₹{categoryData.reduce((s, d) => s + d.value, 0).toFixed(0)}
                    </Text>
                  )}
                />
              </View>
              <View style={styles.legend}>
                {categoryData.map((d, i) => (
                  <View key={i} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                    <Text style={styles.legendText}>{d.text}</Text>
                    <Text style={styles.legendValue}>₹{d.value.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.noData}>No category data this month</Text>
          )}
        </Card>

        {/* 6-Month Trend */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>6-Month Trend</Text>
          {trends.length > 0 ? (
            <BarChart
              data={trends}
              barWidth={28}
              spacing={14}
              roundedTop
              hideRules
              xAxisThickness={0}
              yAxisThickness={0}
              yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...trends.map(d => d.value), 100)}
              barBorderRadius={4}
              width={SCREEN_WIDTH - 80}
              height={160}
            />
          ) : (
            <Text style={styles.noData}>Not enough data yet</Text>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold, color: colors.textPrimary },
  scroll: { padding: spacing.md, paddingBottom: 100 },
  chartCard: { marginBottom: spacing.md },
  chartTitle: { color: colors.textPrimary, fontSize: fontSizes.md, fontWeight: fontWeights.semibold, marginBottom: spacing.md },
  noData: { color: colors.textMuted, fontSize: fontSizes.sm, textAlign: 'center', paddingVertical: spacing.xl },
  pieWrapper: { alignItems: 'center', marginBottom: spacing.md },
  pieCenter: { color: colors.textPrimary, fontSize: fontSizes.lg, fontWeight: fontWeights.bold },
  legend: { gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { flex: 1, color: colors.textSecondary, fontSize: fontSizes.sm },
  legendValue: { color: colors.textPrimary, fontSize: fontSizes.sm, fontWeight: '600' },
});
