import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { analyticsAPI } from '../api/services';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import toast from 'react-hot-toast';

interface CategoryData {
  name: string;
  value: number;
}

interface MonthlyData {
  name: string;
  amount: number;
}

export default function AnalyticsPage() {
  const [categoriesData, setCategoriesData] = useState<CategoryData[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAnalytics() {
      try {
        setLoading(true);
        // Load category-wise details
        const catRes = await analyticsAPI.categories();
        const catRaw = catRes.data;
        const formattedCats: CategoryData[] = [];
        
        if (catRaw && typeof catRaw === 'object') {
          if (Array.isArray(catRaw)) {
            catRaw.forEach((item: any) => {
              formattedCats.push({
                name: item.category || item.name || 'Other',
                value: parseFloat(item.amount || item.value || 0)
              });
            });
          } else {
            Object.entries(catRaw).forEach(([key, value]) => {
              formattedCats.push({ name: key, value: parseFloat(value as any) });
            });
          }
        }
        setCategoriesData(formattedCats.filter(c => c.value > 0));

        // Load monthly trends
        const monthlyRes = await analyticsAPI.monthly();
        const monthlyRaw = monthlyRes.data;
        const formattedMonthly: MonthlyData[] = [];

        if (monthlyRaw && typeof monthlyRaw === 'object') {
          if (Array.isArray(monthlyRaw)) {
            monthlyRaw.forEach((item: any) => {
              formattedMonthly.push({
                name: item.month_name || item.month || 'Jan',
                amount: parseFloat(item.total_spent || item.amount || 0)
              });
            });
          } else {
            Object.entries(monthlyRaw).forEach(([key, value]) => {
              formattedMonthly.push({ name: key, amount: parseFloat(value as any) });
            });
          }
        }
        setMonthlyData(formattedMonthly);
      } catch (err) {
        console.error('Failed to load analytics', err);
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }
    loadAnalytics();
  }, []);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A3'];

  if (loading) {
    return (
      <Layout>
        <div className="page-container space-y-6">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container page-enter pb-24">
        <h1 className="text-headline-lg font-bold text-primary px-1">Analytics</h1>

        {/* Category Breakdown Chart */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-monetary-md text-primary font-bold">Category Breakdown</h2>
          
          {categoriesData.length === 0 ? (
            <p className="py-12 text-center text-body-md text-on-surface-variant/60 italic">
              No categories spending data recorded.
            </p>
          ) : (
            <div className="h-64 w-full flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height="80%">
                <PieChart>
                  <Pie
                    data={categoriesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoriesData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value}`} />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-2 w-full mt-4">
                {categoriesData.map((entry, idx) => (
                  <div key={entry.name} className="flex items-center gap-1.5 text-[10px] text-on-surface-variant font-medium">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="truncate">{entry.name}: ₹{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Monthly Spending History Chart */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-monetary-md text-primary font-bold">Monthly Spending</h2>

          {monthlyData.length === 0 ? (
            <p className="py-12 text-center text-body-md text-on-surface-variant/60 italic">
              No monthly trends data available.
            </p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value) => `₹${value}`} />
                  <Bar dataKey="amount" fill="#000000" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
