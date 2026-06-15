import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { analyticsAPI, expensesAPI, budgetsAPI } from '../api/services';
import type { DashboardData, Expense, Budget } from '../types';
import { useAuthStore } from '../store/auth';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [currentBudget, setCurrentBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load analytics summary
        const dRes = await analyticsAPI.dashboard();
        setDashboardData(dRes.data);

        // Load recent expenses
        const eRes = await expensesAPI.list(0, 5);
        setRecentExpenses(eRes.data.expenses || []);

        // Load monthly budget (current month/year)
        try {
          const now = new Date();
          const bRes = await budgetsAPI.get(now.getMonth() + 1, now.getFullYear());
          setCurrentBudget(bRes.data);
        } catch {
          setCurrentBudget(null);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Food': return 'restaurant';
      case 'Travel': return 'flight';
      case 'Shopping': return 'shopping_cart';
      case 'Rent': return 'home';
      case 'Entertainment': return 'movie';
      default: return 'payments';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container space-y-6">
          <div className="skeleton h-32 w-full" />
          <div className="grid grid-cols-3 gap-4">
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
            <div className="skeleton h-20" />
          </div>
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  // Fallback data if API returns empty
  const netBalance = dashboardData?.net_balance ?? 0;
  const youOwe = dashboardData?.total_payable ?? 0;
  const youAreOwed = dashboardData?.total_receivable ?? 0;

  const budgetSpent = currentBudget?.spent ?? 0;
  const budgetAmount = currentBudget?.amount ?? 0;
  const budgetPct = budgetAmount > 0 ? Math.min(Math.round((budgetSpent / budgetAmount) * 100), 100) : 0;

  return (
    <Layout>
      <div className="page-container page-enter">
        {/* Net Balance Card */}
        <section className="glass-panel rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-35"></div>
          
          <div className="flex flex-col">
            <span className="text-body-md text-on-surface-variant font-medium">Net Balance</span>
            <span className={`font-display-currency text-display-currency ${netBalance >= 0 ? 'text-primary' : 'text-error'}`}>
              ₹{Math.abs(netBalance).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="w-full h-px bg-outline-variant/30 my-1" />

          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">You owe</span>
              <span className="text-monetary-md text-error">₹{youOwe.toLocaleString('en-IN')}</span>
            </div>
            <div className="w-px h-8 bg-outline-variant/30" />
            <div className="flex flex-col text-right">
              <span className="text-label-caps text-on-surface-variant uppercase">You are owed</span>
              <span className="text-monetary-md text-secondary">₹{youAreOwed.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="grid grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/add-expense')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-label-caps text-primary text-center">Add Expense</span>
          </button>
          
          <button
            onClick={() => navigate('/settlements')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center border border-outline-variant/30">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="text-label-caps text-primary text-center">Settle Up</span>
          </button>

          <button
            onClick={() => navigate('/groups?create=true')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center border border-outline-variant/30">
              <span className="material-symbols-outlined">group_add</span>
            </div>
            <span className="text-label-caps text-primary text-center">New Group</span>
          </button>
        </section>

        {/* Monthly Budget */}
        <section
          onClick={() => navigate('/budget')}
          className="glass-panel rounded-2xl p-4 flex flex-col gap-3 cursor-pointer hover:bg-white transition-colors"
        >
          <div className="flex justify-between items-end">
            <span className="text-monetary-md text-primary font-semibold">Monthly Budget</span>
            <span className="text-body-md text-on-surface-variant font-medium">
              ₹{budgetSpent.toLocaleString('en-IN')} / {budgetAmount > 0 ? `₹${budgetAmount.toLocaleString('en-IN')}` : 'Not set'}
            </span>
          </div>
          {budgetAmount > 0 ? (
            <>
              <div className="w-full h-2 rounded-full bg-surface-variant overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${budgetPct >= 90 ? 'bg-error' : 'bg-secondary'}`}
                  style={{ width: `${budgetPct}%` }}
                />
              </div>
              <span className="text-label-caps text-on-surface-variant self-end uppercase">{budgetPct}% Used</span>
            </>
          ) : (
            <span className="text-body-md text-on-surface-variant/60 italic text-sm">Tap to set up a monthly budget</span>
          )}
        </section>

        {/* Recent Activity */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-headline-lg-mobile text-primary font-bold">Recent Activity</h2>
            <button onClick={() => navigate('/history')} className="text-body-md text-primary hover:underline font-semibold">
              See All
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex flex-col gap-0">
            {recentExpenses.length === 0 ? (
              <p className="py-6 text-center text-body-md text-on-surface-variant/60 italic">No recent expenses</p>
            ) : (
              recentExpenses.map((exp, idx) => (
                <div key={exp.id}>
                  {idx > 0 && <div className="w-full h-px bg-outline-variant/30 my-3" />}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant">
                        <span className="material-symbols-outlined">{getCategoryIcon(exp.category)}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-body-md text-primary font-semibold truncate max-w-[150px]">{exp.title}</span>
                        <span className="text-label-caps text-on-surface-variant">
                          {new Date(exp.expense_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {exp.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-monetary-md text-primary font-bold">₹{exp.amount.toLocaleString('en-IN')}</span>
                      <span className="text-label-caps text-on-surface-variant mt-0.5">
                        {exp.paid_by === 'you' || exp.paid_by === user?.id ? (
                          <span className="text-secondary-fixed-dim bg-secondary/15 px-2 py-0.5 rounded-full">Paid</span>
                        ) : (
                          <span className="text-error bg-error/10 px-2 py-0.5 rounded-full">Borrowed</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
