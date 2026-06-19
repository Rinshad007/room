import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { analyticsAPI, budgetsAPI } from '../api/services';
import type { DashboardData, BudgetSummary } from '../types';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [currentBudget, setCurrentBudget] = useState<BudgetSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load analytics summary
        const dRes = await analyticsAPI.dashboard();
        setDashboardData(dRes.data);

        // Load monthly budget (current month/year)
        try {
          const now = new Date();
          const bRes = await budgetsAPI.summary(now.getMonth() + 1, now.getFullYear());
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

  const netSpent = currentBudget?.net_spent ?? 0;
  const budgetAmount = currentBudget?.total_budget ?? 0;
  const budgetPct = currentBudget?.percentage_used ?? 0;

  return (
    <Layout>
      <div className="page-container page-enter">
        {/* Net Balance Card */}
        <section className="glass-panel rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-35"></div>
          
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <span className="text-body-md text-on-surface-variant font-medium">Total Expense</span>
              <span className="font-display-currency text-display-currency text-primary">
                ₹{(dashboardData?.total_spent ?? 0).toLocaleString('en-IN')}
              </span>
            </div>
            {budgetAmount > 0 && (
              <div className="flex flex-col items-end text-right">
                <span className="text-body-sm text-on-surface-variant font-medium">Monthly Budget Used</span>
                <span className="text-sm font-bold text-primary">
                  ₹{netSpent.toLocaleString('en-IN')} / ₹{budgetAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-on-surface-variant/85 font-semibold">{budgetPct}% Used</span>
              </div>
            )}
          </div>

          <div className="w-full h-px bg-outline-variant/30 my-1" />

          <div className="flex justify-between items-center">
            <div className="flex flex-col">
              <span className="text-label-caps text-on-surface-variant uppercase">You owe</span>
              <span className="text-monetary-md text-error">₹{youOwe.toLocaleString('en-IN')}</span>
            </div>
            <div className="w-px h-8 bg-outline-variant/30" />
            <div className="flex flex-col text-center">
              <span className="text-label-caps text-on-surface-variant uppercase">You are owed</span>
              <span className="text-monetary-md text-secondary">₹{youAreOwed.toLocaleString('en-IN')}</span>
            </div>
            <div className="w-px h-8 bg-outline-variant/30" />
            <div className="flex flex-col text-right">
              <span className="text-label-caps text-on-surface-variant uppercase">Net Balance</span>
              <span className={`text-monetary-md font-bold ${netBalance >= 0 ? 'text-secondary' : 'text-error'}`}>
                {netBalance >= 0 ? `+₹${netBalance.toLocaleString('en-IN')}` : `-₹${Math.abs(netBalance).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>
        </section>



        {/* Quick Actions */}
        <section className="grid grid-cols-4 gap-3">
          <button
            onClick={() => navigate('/add-expense')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-primary text-on-primary flex items-center justify-center">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span className="text-label-caps text-primary text-center">Add</span>
          </button>
          
          <button
            onClick={() => navigate('/settlements')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center border border-outline-variant/30">
              <span className="material-symbols-outlined">payments</span>
            </div>
            <span className="text-label-caps text-primary text-center">Settle</span>
          </button>

          <button
            onClick={() => navigate('/groups')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center border border-outline-variant/30">
              <span className="material-symbols-outlined">groups</span>
            </div>
            <span className="text-label-caps text-primary text-center">Groups</span>
          </button>

          <button
            onClick={() => navigate('/history')}
            className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
          >
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center border border-outline-variant/30">
              <span className="material-symbols-outlined">history</span>
            </div>
            <span className="text-label-caps text-primary text-center">History</span>
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
              {budgetAmount > 0 ? (
                <span>₹{netSpent.toLocaleString('en-IN')} / ₹{budgetAmount.toLocaleString('en-IN')}</span>
              ) : (
                <span className="text-on-surface-variant/60 italic text-sm">Not set</span>
              )}
            </span>
          </div>
          {budgetAmount > 0 ? (
            <>
              <div className="w-full h-2 rounded-full bg-surface-variant overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${budgetPct >= 90 ? 'bg-error' : 'bg-secondary'}`}
                  style={{ width: `${Math.min(budgetPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between w-full">
                {currentBudget?.is_over_budget ? (
                  <span className="text-label-caps text-error uppercase font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span> Over Budget!
                  </span>
                ) : (
                  <span></span>
                )}
                <span className="text-label-caps text-on-surface-variant self-end uppercase">{budgetPct}% Used</span>
              </div>
            </>
          ) : (
            <span className="text-body-md text-on-surface-variant/60 italic text-sm">Tap to set up a monthly budget</span>
          )}
        </section>

        {/* Analytics Banner */}
        <button
          onClick={() => navigate('/analytics')}
          className="glass-panel rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-white transition-colors active:scale-95 group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-indigo-600">bar_chart_4_bars</span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-sm font-bold text-on-surface">Monthly Analytics</span>
              <span className="text-xs text-on-surface-variant/70">Charts · Trends · Insights</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-indigo-600 font-semibold text-sm group-hover:translate-x-0.5 transition-transform">
            View
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </div>
        </button>


      </div>
    </Layout>
  );
}
