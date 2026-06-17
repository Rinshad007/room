import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { analyticsAPI } from '../api/services';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import toast from 'react-hot-toast';

// ─── Types ─────────────────────────────────────────────────────────────────

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface MonthlyPoint {
  name: string;     // "Jan", "Feb" …
  month: number;
  amount: number;
}

interface TrendPoint {
  label: string;
  total: number;
}

// ─── Palette ───────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const CATEGORY_COLORS: Record<string, string> = {
  Food:          '#F97316',
  Travel:        '#3B82F6',
  Shopping:      '#A855F7',
  Rent:          '#EF4444',
  Entertainment: '#EC4899',
  Others:        '#6B7280',
};

const CHART_GRADIENT = [
  { offset: '0%',   color: '#6366f1', opacity: 0.35 },
  { offset: '100%', color: '#6366f1', opacity: 0.0  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `₹${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `₹${(n / 1_000).toFixed(1)}K`
    : `₹${n.toFixed(0)}`;

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, sub, accent,
}: {
  icon: string; label: string; value: string; sub?: string; accent?: string;
}) {
  return (
    <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1.5 relative overflow-hidden">
      {/* Decorative gradient blob */}
      <div
        className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-15 blur-xl"
        style={{ backgroundColor: accent ?? '#6366f1' }}
      />
      <div className="flex items-center gap-2 text-on-surface-variant text-xs font-semibold uppercase tracking-wide">
        <span className="material-symbols-outlined text-[18px]" style={{ color: accent ?? '#6366f1' }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="text-2xl font-bold text-on-surface leading-tight">{value}</div>
      {sub && <div className="text-[11px] text-on-surface-variant/70">{sub}</div>}
    </div>
  );
}

function MonthNavigator({
  month, year, onChange,
}: {
  month: number; year: number; onChange: (m: number, y: number) => void;
}) {
  function prev() {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  }
  function next() {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  }
  const isLatest = (() => {
    const now = new Date();
    return year === now.getFullYear() && month === now.getMonth() + 1;
  })();

  return (
    <div className="flex items-center justify-between px-1 py-1">
      <button onClick={prev} className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors active:scale-90">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_left</span>
      </button>
      <div className="text-center">
        <div className="text-base font-bold text-on-surface tracking-wide">
          {MONTH_NAMES[month - 1]} {year}
        </div>
        <div className="text-[10px] text-on-surface-variant/60 font-medium uppercase tracking-widest mt-0.5">
          Monthly Report
        </div>
      </div>
      <button
        onClick={next}
        disabled={isLatest}
        className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-surface-container transition-colors active:scale-90 disabled:opacity-30"
      >
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">chevron_right</span>
      </button>
    </div>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string }>;
  label?: string;
}

function CustomBarTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/30 rounded-xl px-3 py-2 shadow-lg text-sm">
      <div className="text-on-surface-variant text-[11px] font-semibold mb-0.5">{label}</div>
      <div className="text-on-surface font-bold">{fmt(payload[0].value)}</div>
    </div>
  );
}

function CustomAreaTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/30 rounded-xl px-3 py-2 shadow-lg text-sm">
      <div className="text-on-surface-variant text-[11px] font-semibold mb-0.5">{label}</div>
      <div className="text-indigo-600 font-bold">{fmt(payload[0].value)}</div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);

  const [categoriesData, setCategoriesData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyPoint[]>([]);
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalPaidByMe, setTotalPaidByMe] = useState(0);

  // ── Fetch data whenever month/year changes ───────────────────────────────
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [catRes, monthlyRes, trendRes, dashRes] = await Promise.allSettled([
          analyticsAPI.categories(month, year),
          analyticsAPI.monthly(year),
          analyticsAPI.trends(6),
          analyticsAPI.dashboard(),
        ]);

        if (!alive) return;

        // Categories
        if (catRes.status === 'fulfilled') {
          const raw = catRes.value.data;
          const arr: CategoryData[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const name = item.category || item.name || 'Others';
              const value = parseFloat(item.total ?? item.amount ?? item.value ?? 0);
              if (value > 0)
                arr.push({ name, value, color: CATEGORY_COLORS[name] ?? '#6B7280' });
            });
          }
          setCategoriesData(arr);
        }

        // Monthly (for bar chart of selected year)
        if (monthlyRes.status === 'fulfilled') {
          const raw = monthlyRes.value.data;
          const arr: MonthlyPoint[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const m = parseInt(item.month ?? 0);
              arr.push({ name: MONTH_NAMES[m - 1] ?? '?', month: m, amount: parseFloat(item.total ?? item.amount ?? 0) });
            });
          }
          setMonthlyData(arr);
        }

        // Trend (area chart)
        if (trendRes.status === 'fulfilled') {
          const raw = trendRes.value.data;
          const arr: TrendPoint[] = [];
          if (raw?.data && Array.isArray(raw.data)) {
            raw.data.forEach((item: any) => {
              const m = parseInt(item.month ?? 0);
              arr.push({
                label: `${MONTH_NAMES[m - 1] ?? '?'} ${item.year ?? ''}`,
                total: parseFloat(item.total ?? 0),
              });
            });
          }
          setTrendData(arr);
        }

        // Dashboard totals
        if (dashRes.status === 'fulfilled') {
          const d = dashRes.value.data;
          setTotalExpenses(d?.total_expenses ?? 0);
          setTotalPaidByMe(d?.total_spent ?? 0);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to load analytics');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [month, year]);

  // ── Derived stats ────────────────────────────────────────────────────────
  // totalSpent = my share of expenses this month (from accepted category splits)
  const totalSpent = useMemo(() => categoriesData.reduce((s, c) => s + c.value, 0), [categoriesData]);
  const topCategory = useMemo(
    () => categoriesData.sort((a, b) => b.value - a.value)[0],
    [categoriesData]
  );



  // Compare to previous month from monthlyData
  const prevMonthAmount = useMemo(() => {
    const prev = month === 1 ? 12 : month - 1;
    return monthlyData.find(d => d.month === prev)?.amount ?? 0;
  }, [monthlyData, month]);

  const vsLastMonth = totalSpent - prevMonthAmount;
  const vsLastMonthPct = prevMonthAmount
    ? Math.abs(Math.round((vsLastMonth / prevMonthAmount) * 100))
    : null;

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="page-container space-y-4 pb-24">
          <div className="skeleton h-8 w-40 rounded-xl" />
          <div className="skeleton h-14 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-24 w-full rounded-2xl" />)}
          </div>
          <div className="skeleton h-52 w-full rounded-2xl" />
          <div className="skeleton h-64 w-full rounded-2xl" />
          <div className="skeleton h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="page-container page-enter pb-28">

        {/* Header */}
        <div className="flex items-center justify-between px-1">
          <h1 className="text-headline-lg font-bold text-on-surface">Analytics</h1>
          <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full text-xs font-bold">
            <span className="material-symbols-outlined text-[14px]">bar_chart_4_bars</span>
            Insights
          </div>
        </div>

        {/* Month Navigator */}
        <div className="glass-panel rounded-2xl px-4 py-2">
          <MonthNavigator month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon="receipt_long"
            label="Total Expenses"
            value={String(totalExpenses)}
            sub="all time"
            accent="#6366f1"
          />
          <StatCard
            icon="payments"
            label="Total Paid"
            value={fmt(totalPaidByMe)}
            sub="you paid"
            accent="#F97316"
          />
          <StatCard
            icon="category"
            label="Top Category"
            value={topCategory?.name ?? '—'}
            sub={topCategory ? fmt(topCategory.value) : undefined}
            accent={topCategory?.color ?? '#A855F7'}
          />
          <StatCard
            icon={vsLastMonth >= 0 ? 'arrow_upward' : 'arrow_downward'}
            label="vs Last Month"
            value={vsLastMonthPct != null ? `${vsLastMonthPct}%` : '—'}
            sub={vsLastMonth >= 0 ? `↑ ${fmt(Math.abs(vsLastMonth))} more` : `↓ ${fmt(Math.abs(vsLastMonth))} less`}
            accent={vsLastMonth >= 0 ? '#EF4444' : '#22c55e'}
          />
        </div>

        {/* Donut Category Breakdown */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Category Breakdown</h2>
            <span className="text-xs text-on-surface-variant/60 font-medium">{MONTH_NAMES[month - 1]} {year}</span>
          </div>

          {categoriesData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">donut_large</span>
              <p className="text-sm text-on-surface-variant/60 italic">No spending data for this month</p>
            </div>
          ) : (
            <>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {categoriesData.map((c, i) => (
                        <radialGradient key={i} id={`grad-${i}`} cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor={c.color} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={c.color} stopOpacity={0.65} />
                        </radialGradient>
                      ))}
                    </defs>
                    <Pie
                      data={categoriesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                      animationBegin={0}
                      animationDuration={600}
                    >
                      {categoriesData.map((_c, i) => (
                        <Cell key={i} fill={`url(#grad-${i})`} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0].payload as CategoryData;
                        return (
                          <div className="bg-white/90 backdrop-blur-sm border border-outline-variant/30 rounded-xl px-3 py-2 shadow-lg">
                            <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                              {d.name}
                            </div>
                            <div className="text-xs text-on-surface-variant mt-0.5">
                              {fmt(d.value)} · {pct(d.value, totalSpent)}%
                            </div>
                          </div>
                        );
                      }}
                    />
                    {/* Center text via foreignObject */}
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="flex flex-col gap-2.5">
                {categoriesData.map((c) => (
                  <div key={c.name} className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-sm text-on-surface font-medium flex-1">{c.name}</span>
                    <span className="text-xs text-on-surface-variant/70 w-10 text-right">{pct(c.value, totalSpent)}%</span>
                    <div className="flex-1 max-w-[80px] h-1.5 bg-surface-container rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct(c.value, totalSpent)}%`, backgroundColor: c.color }}
                      />
                    </div>
                    <span className="text-xs font-bold text-on-surface w-16 text-right">{fmt(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 12-Month Bar Chart */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-on-surface">Monthly Overview</h2>
            <span className="text-xs text-on-surface-variant/60 font-medium">{year}</span>
          </div>

          {monthlyData.filter(d => d.amount > 0).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">bar_chart</span>
              <p className="text-sm text-on-surface-variant/60 italic">No monthly data for {year}</p>
            </div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={monthlyData}
                  margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
                  barSize={16}
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity={0.7} />
                    </linearGradient>
                    <linearGradient id="barGradientActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F97316" stopOpacity={1} />
                      <stop offset="100%" stopColor="#FB923C" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="name"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280', fontWeight: 500 }}
                  />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af' }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)', radius: 4 }} />
                  <Bar
                    dataKey="amount"
                    radius={[5, 5, 0, 0]}
                    animationDuration={700}
                  >
                    {monthlyData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.month === month ? 'url(#barGradientActive)' : 'url(#barGradient)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* 6-Month Trend Area Chart */}
        {trendData.length > 0 && (
          <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-on-surface">Spending Trend</h2>
              <span className="text-xs text-on-surface-variant/60 font-medium">Last 6 months</span>
            </div>

            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      {CHART_GRADIENT.map((g, i) => (
                        <stop key={i} offset={g.offset} stopColor={g.color} stopOpacity={g.opacity} />
                      ))}
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                  <XAxis
                    dataKey="label"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: '#6b7280', fontWeight: 500 }}
                    tickFormatter={(v: string) => v.split(' ')[0]}
                  />
                  <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af' }} tickFormatter={(v) => fmt(v)} />
                  <Tooltip content={<CustomAreaTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#areaGradient)"
                    dot={{ fill: '#6366f1', r: 4, strokeWidth: 0 }}
                    activeDot={{ fill: '#4f46e5', r: 5, strokeWidth: 2, stroke: '#fff' }}
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Trend summary row */}
            <div className="flex justify-between pt-1 border-t border-outline-variant/20">
              {trendData.slice(-3).map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] text-on-surface-variant/60 font-medium uppercase tracking-wide">
                    {d.label.split(' ')[0]}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{fmt(d.total)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Spending Insights */}
        {categoriesData.length > 0 && (
          <section className="glass-panel rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="text-base font-bold text-on-surface">Spending Insights</h2>

            <div className="flex flex-col gap-2.5">
              {/* Insight 1: Largest category */}
              <div className="flex items-center gap-3 bg-orange-50 rounded-xl px-3 py-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: topCategory?.color + '22' }}>
                  <span className="material-symbols-outlined text-[18px]" style={{ color: topCategory?.color }}>
                    emoji_food_beverage
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-on-surface-variant">Biggest Category</div>
                  <div className="text-sm font-bold text-on-surface">
                    {topCategory?.name} · {fmt(topCategory?.value ?? 0)}
                  </div>
                </div>
                <div className="text-sm font-extrabold" style={{ color: topCategory?.color }}>
                  {pct(topCategory?.value ?? 0, totalSpent)}%
                </div>
              </div>

              {/* Insight 2: Savings vs prev */}
              <div className={`flex items-center gap-3 rounded-xl px-3 py-3 ${vsLastMonth >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${vsLastMonth >= 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                  <span className={`material-symbols-outlined text-[18px] ${vsLastMonth >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {vsLastMonth >= 0 ? 'trending_up' : 'trending_down'}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-on-surface-variant">
                    {vsLastMonth >= 0 ? 'Spending Up vs Last Month' : 'Spending Down vs Last Month'}
                  </div>
                  <div className={`text-sm font-bold ${vsLastMonth >= 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {vsLastMonthPct != null ? `${vsLastMonthPct}% ${vsLastMonth >= 0 ? 'increase' : 'savings'}` : 'First month recorded'}
                  </div>
                </div>
              </div>

              {/* Insight 3: Category count */}
              <div className="flex items-center gap-3 bg-indigo-50 rounded-xl px-3 py-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">pie_chart</span>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-on-surface-variant">Categories Used</div>
                  <div className="text-sm font-bold text-on-surface">
                    {categoriesData.length} out of 6 categories
                  </div>
                </div>
                <div className="text-sm font-extrabold text-indigo-600">
                  {categoriesData.length}/6
                </div>
              </div>
            </div>
          </section>
        )}

      </div>
    </Layout>
  );
}
