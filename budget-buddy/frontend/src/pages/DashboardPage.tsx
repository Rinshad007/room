import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { useAuthStore } from '../store/auth';
import type { BudgetSummary } from '../types';
import { useState, useEffect } from 'react';
import { budgetsAPI } from '../api/services';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ── Real-time data from Firebase ──────────────────────────────────────────
  const { ready, summary, myExpenses } = useRealtimeStore(user?.id);

  // ── Budget (not real-time, but refreshed on mount) ────────────────────────
  const [currentBudget, setCurrentBudget] = useState<BudgetSummary | null>(null);
  useEffect(() => {
    const now = new Date();
    budgetsAPI.summary(now.getMonth() + 1, now.getFullYear())
      .then(r => setCurrentBudget(r.data))
      .catch(() => setCurrentBudget(null));
  }, []);

  // ── Derived values (memoized) ─────────────────────────────────────────────
  const totalSpent = useMemo(() => {
    if (!user?.id) return 0;
    return myExpenses.reduce((sum, exp) => {
      const mySplit = (exp.splits || []).find(s => s.user_id === user.id);
      return sum + (mySplit ? mySplit.share_amount : 0);
    }, 0);
  }, [myExpenses, user?.id]);

  const netBalance  = summary?.net_balance     ?? 0;
  const youOwe      = summary?.total_payable   ?? 0;
  const youAreOwed  = summary?.total_receivable ?? 0;

  const budgetAmount = currentBudget?.total_budget    ?? 0;
  const netSpent     = currentBudget?.net_spent       ?? 0;
  const budgetPct    = currentBudget?.percentage_used ?? 0;

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <Layout>
        <div className="page-container space-y-6">
          <div className="skeleton h-36 w-full" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20" />)}
          </div>
          <div className="skeleton h-24 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container page-enter">

        {/* ── Net Balance Card ──────────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-5 flex flex-col gap-4 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-secondary-container rounded-full mix-blend-multiply filter blur-3xl opacity-35" />

          <div className="flex justify-between items-start flex-wrap gap-2">
            <div className="flex flex-col">
              <span className="text-body-md text-on-surface-variant font-medium">Total Expense</span>
              <span className="font-display-currency text-display-currency text-primary">
                ₹{totalSpent.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="w-full h-px bg-outline-variant/30 my-1" />

          {/* You owe / owed / net — responsive 3-col on all sizes */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="flex flex-col items-start">
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">You owe</span>
              <span className="text-base font-bold text-error leading-tight">₹{youOwe.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col items-center border-x border-outline-variant/20">
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Owed to you</span>
              <span className="text-base font-bold text-secondary leading-tight">₹{youAreOwed.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wide">Net</span>
              <span className={`text-base font-bold leading-tight ${netBalance >= 0 ? 'text-secondary' : 'text-error'}`}>
                {netBalance >= 0
                  ? `+₹${netBalance.toLocaleString('en-IN')}`
                  : `-₹${Math.abs(netBalance).toLocaleString('en-IN')}`}
              </span>
            </div>
          </div>


        </section>

        {/* ── Quick Actions ─────────────────────────────────────────────── */}
        <section className="grid grid-cols-4 gap-3">
          {[
            { label: 'Add', icon: 'add', path: '/add-expense', color: 'bg-primary text-on-primary' },
            { label: 'Settle', icon: 'payments', path: '/settlements', color: 'bg-surface-container text-primary border border-outline-variant/30' },
            { label: 'Groups', icon: 'groups', path: '/groups', color: 'bg-surface-container text-primary border border-outline-variant/30' },
            { label: 'History', icon: 'history', path: '/history', color: 'bg-surface-container text-primary border border-outline-variant/30' },
          ].map(({ label, icon, path, color }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex flex-col items-center justify-center gap-2 p-3 glass-panel rounded-2xl active:scale-95 transition-transform hover:bg-white"
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>
                <span className="material-symbols-outlined">{icon}</span>
              </div>
              <span className="text-label-caps text-primary text-center">{label}</span>
            </button>
          ))}
        </section>

        {/* ── Monthly Budget ────────────────────────────────────────────── */}
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
                ) : <span />}
                <span className="text-label-caps text-on-surface-variant self-end uppercase">{budgetPct}% Used</span>
              </div>
            </>
          ) : (
            <span className="text-body-md text-on-surface-variant/60 italic text-sm">Tap to set up a monthly budget</span>
          )}
        </section>

        {/* ── Analytics Banner ──────────────────────────────────────────── */}
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
