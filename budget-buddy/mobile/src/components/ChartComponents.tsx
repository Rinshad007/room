/**
 * SVG Chart Components — React Native equivalents of web's recharts components.
 * Pure SVG — no external chart library required (uses react-native-svg).
 *
 * Exports:
 *   - DonutChart       (replaces PieChart / Pie from recharts)
 *   - BarChartSVG      (replaces BarChart from recharts)
 *   - AreaChartSVG     (replaces AreaChart from recharts)
 */
import React from 'react';
import Svg, {
  G, Circle, Path, Line, Rect, Text as SvgText, Defs,
  LinearGradient, Stop, Polyline,
} from 'react-native-svg';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { colors, fontSizes, fontWeights } from '../theme';

const W = Dimensions.get('window').width - 64; // default chart width

// ─── Helper ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n >= 1_000_000
    ? `₹${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `₹${(n / 1_000).toFixed(1)}K`
    : `₹${n.toFixed(0)}`;

// ─── Donut Chart (Pie) ────────────────────────────────────────────────────────
interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  innerRadius?: number;
  outerRadius?: number;
}

export function DonutChart({ data, size = 200, innerRadius = 58, outerRadius = 88 }: DonutChartProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;

  const cx = size / 2;
  const cy = size / 2;

  // Build arcs
  const slices: { path: string; color: string; name: string; value: number }[] = [];
  let startAngle = -Math.PI / 2;

  data.forEach(slice => {
    const frac = slice.value / total;
    const endAngle = startAngle + frac * 2 * Math.PI - 0.02; // gap = 0.02 rad

    const x1 = cx + outerRadius * Math.cos(startAngle);
    const y1 = cy + outerRadius * Math.sin(startAngle);
    const x2 = cx + outerRadius * Math.cos(endAngle);
    const y2 = cy + outerRadius * Math.sin(endAngle);
    const ix1 = cx + innerRadius * Math.cos(endAngle);
    const iy1 = cy + innerRadius * Math.sin(endAngle);
    const ix2 = cx + innerRadius * Math.cos(startAngle);
    const iy2 = cy + innerRadius * Math.sin(startAngle);

    const large = frac > 0.5 ? 1 : 0;

    const path = [
      `M ${x1} ${y1}`,
      `A ${outerRadius} ${outerRadius} 0 ${large} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerRadius} ${innerRadius} 0 ${large} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    slices.push({ path, color: slice.color, name: slice.name, value: slice.value });
    startAngle += frac * 2 * Math.PI;
  });

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => (
        <Path key={i} d={s.path} fill={s.color} opacity={0.88} />
      ))}
    </Svg>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
interface BarPoint {
  name: string;
  amount: number;
  month?: number;
  highlighted?: boolean;
}

interface BarChartSVGProps {
  data: BarPoint[];
  activeMonth?: number;
  width?: number;
  height?: number;
}

export function BarChartSVG({ data, activeMonth, width = W, height = 180 }: BarChartSVGProps) {
  if (!data.length) return null;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.amount), 1);
  const barW = Math.max(8, (chartW / data.length) * 0.55);
  const barGap = chartW / data.length;

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: padT + chartH - f * chartH,
    label: fmt(f * maxVal),
  }));

  return (
    <Svg width={width} height={height}>
      {/* Grid lines */}
      {ticks.map((t, i) => (
        <G key={i}>
          <Line
            x1={padL}
            y1={t.y}
            x2={width - padR}
            y2={t.y}
            stroke="rgba(0,0,0,0.06)"
            strokeWidth={1}
            strokeDasharray="3,3"
          />
          <SvgText
            x={padL - 4}
            y={t.y + 4}
            fontSize={9}
            fill="#9ca3af"
            textAnchor="end"
          >
            {i > 0 ? t.label : ''}
          </SvgText>
        </G>
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const isActive = d.month === activeMonth;
        const barH = (d.amount / maxVal) * chartH;
        const x = padL + i * barGap + barGap / 2 - barW / 2;
        const y = padT + chartH - barH;
        return (
          <G key={i}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(barH, 2)}
              rx={4}
              fill={isActive ? '#F97316' : '#6366f1'}
              opacity={isActive ? 0.95 : 0.75}
            />
            <SvgText
              x={x + barW / 2}
              y={padT + chartH + 14}
              fontSize={9}
              fill="#6b7280"
              textAnchor="middle"
            >
              {d.name}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// ─── Area Chart ───────────────────────────────────────────────────────────────
interface AreaPoint {
  label: string;
  total: number;
}

interface AreaChartSVGProps {
  data: AreaPoint[];
  width?: number;
  height?: number;
}

export function AreaChartSVG({ data, width = W, height = 160 }: AreaChartSVGProps) {
  if (!data.length) return null;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 24;
  const chartW = width - padL - padR;
  const chartH = height - padT - padB;

  const maxVal = Math.max(...data.map(d => d.total), 1);
  const step = chartW / (data.length - 1 || 1);

  const points = data.map((d, i) => ({
    x: padL + i * step,
    y: padT + chartH - (d.total / maxVal) * chartH,
    label: d.label.split(' ')[0],
    total: d.total,
  }));

  const linePts = points.map(p => `${p.x},${p.y}`).join(' ');
  const areaPath = [
    `M ${points[0].x} ${padT + chartH}`,
    ...points.map(p => `L ${p.x} ${p.y}`),
    `L ${points[points.length - 1].x} ${padT + chartH}`,
    'Z',
  ].join(' ');

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
        </LinearGradient>
      </Defs>

      {/* Grid */}
      {[0, 0.5, 1].map((f, i) => (
        <Line
          key={i}
          x1={padL}
          y1={padT + chartH - f * chartH}
          x2={width - padR}
          y2={padT + chartH - f * chartH}
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
          strokeDasharray="3,3"
        />
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <Polyline
        points={linePts}
        fill="none"
        stroke="#6366f1"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots + labels */}
      {points.map((p, i) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={4} fill="#6366f1" />
          <SvgText
            x={p.x}
            y={padT + chartH + 14}
            fontSize={9}
            fill="#6b7280"
            textAnchor="middle"
          >
            {p.label}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}

// ─── Budget Ring (web's SVG ring in BudgetPage) ───────────────────────────────
interface BudgetRingProps {
  pct: number; // 0–100
  size?: number;
}

export function BudgetRing({ pct, size = 160 }: BudgetRingProps) {
  const clampedPct = Math.min(pct, 100);
  const ringColor =
    pct >= 100 ? colors.error : pct >= 80 ? '#f9a825' : colors.secondary;
  const r = 40;
  const cx = size / 2;
  const cy = size / 2;
  const scale = size / 100;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference - (circumference * clampedPct) / 100;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Track */}
        <Circle
          cx={cx}
          cy={cy}
          r={r * scale}
          stroke={colors.surfaceVariant}
          strokeWidth={12 * scale}
          fill="none"
        />
        {/* Progress */}
        <Circle
          cx={cx}
          cy={cy}
          r={r * scale}
          stroke={ringColor}
          strokeWidth={12 * scale}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * scale} ${circumference * scale}`}
          strokeDashoffset={dashOffset * scale}
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>
      <View style={{ alignItems: 'center' }}>
        <Text style={[styles.ringPct, { color: colors.primary }]}>{Math.round(pct)}%</Text>
        <Text style={styles.ringLabel}>Used</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringPct: { fontSize: fontSizes.xl, fontWeight: fontWeights.bold },
  ringLabel: {
    fontSize: fontSizes.xs,
    color: colors.onSurfaceVariant,
    fontWeight: fontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
