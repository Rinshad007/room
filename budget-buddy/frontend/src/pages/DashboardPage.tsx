import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { useAuthStore } from '../store/auth';
import { matchCategoryIcon } from '../utils/categoryHelpers';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ── Real-time data from Firebase ──────────────────────────────────────────
  const { ready, summary, myExpenses } = useRealtimeStore(user?.id);

  // ── Derived values (memoized) ─────────────────────────────────────────────
  const totalSpent = useMemo(() => {
    if (!user?.id) return 0;
    return myExpenses.reduce((sum, exp) => {
      const mySplit = (exp.splits || []).find((s: any) => s.user_id === user.id);
      return sum + (mySplit ? mySplit.share_amount : 0);
    }, 0);
  }, [myExpenses, user?.id]);

  const netBalance  = summary?.net_balance     ?? 0;
  const youOwe      = summary?.total_payable   ?? 0;
  const youAreOwed  = summary?.total_receivable ?? 0;

  const recentTransactions = useMemo(
    () =>
      [...myExpenses]
        .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        .slice(0, 3),
    [myExpenses]
  );

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
            { label: 'Budget', icon: 'account_balance_wallet', path: '/budget', color: 'bg-surface-container text-primary border border-outline-variant/30' },
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

        {/* ── Recent Transactions ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3 mt-2 px-1">
            <span className="text-base font-bold text-primary">Recent Transactions</span>
            <button
              onClick={() => navigate('/history')}
              className="text-[13px] font-semibold text-secondary hover:opacity-80 active:scale-95 transition-all"
            >
              View All
            </button>
          </div>

          <div className="glass-panel rounded-2xl p-4 flex flex-col divide-y divide-outline-variant/10">
            {recentTransactions.length === 0 ? (
              <p className="text-center text-sm text-on-surface-variant/50 italic py-3">
                No transactions yet.
              </p>
            ) : (
              recentTransactions.map((exp) => {
                const isPayer = exp.paid_by === 'you' || exp.paid_by === user?.id;
                const mySplit = (exp.splits || []).find((s: any) => s.user_id === user?.id);
                const displayAmt = mySplit ? mySplit.share_amount : exp.amount;

                return (
                  <div key={exp.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center flex-shrink-0 text-lg">
                      {matchCategoryIcon(exp.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-primary truncate">{exp.title}</p>
                      <p className="text-xs text-on-surface-variant/70 mt-0.5">
                        {new Date(exp.expense_date).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        · {exp.category}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-sm font-bold text-primary">
                        ₹{displayAmt.toLocaleString('en-IN')}
                      </span>
                      <span className={`text-[11px] font-medium mt-0.5 ${isPayer ? 'text-secondary' : 'text-error'}`}>
                        {isPayer ? 'You paid' : 'You owe'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
