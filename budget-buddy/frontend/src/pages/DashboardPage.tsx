import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { useAuthStore } from '../store/auth';
import { matchCategoryIcon } from '../utils/categoryHelpers';
import { budgetsAPI } from '../api/services';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // ── Real-time data from Firebase ──────────────────────────────────────────
  const { ready, summary, myExpenses } = useRealtimeStore(user?.id);

  // ── Budget for current month ───────────────────────────────────────────────
  const [monthBudget, setMonthBudget] = useState(0);
  useEffect(() => {
    const now = new Date();
    budgetsAPI.summary(now.getMonth() + 1, now.getFullYear())
      .then(r => setMonthBudget(r.data?.total_budget ?? 0))
      .catch(() => {});
  }, []);

  // ── Today's spend ─────────────────────────────────────────────────────────
  const todaySpent = useMemo(() => {
    if (!user?.id) return 0;
    const today = new Date().toISOString().split('T')[0];
    return myExpenses
      .filter(exp => exp.expense_date.startsWith(today))
      .reduce((sum, exp) => {
        const mySplit = (exp.splits || []).find((s: any) => s.user_id === user.id);
        return sum + (mySplit ? mySplit.share_amount : exp.amount);
      }, 0);
  }, [myExpenses, user?.id]);

  // ── This month's total spent (for budget bar) ─────────────────────────────
  const monthSpent = useMemo(() => {
    if (!user?.id) return 0;
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return myExpenses
      .filter(exp => exp.expense_date.startsWith(prefix) && exp.paid_by === user.id)
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [myExpenses, user?.id]);

  const budgetPct = monthBudget > 0 ? Math.min(100, Math.round((monthSpent / monthBudget) * 100)) : 0;
  const budgetColor = budgetPct >= 90 ? '#EF4444' : budgetPct >= 70 ? '#F97316' : '#22c55e';

  const netBalance  = summary?.net_balance     ?? 0;
  const youOwe      = summary?.total_payable   ?? 0;
  const youAreOwed  = summary?.total_receivable ?? 0;

  const recentTransactions = useMemo(
    () =>
      [...myExpenses]
        .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
        .slice(0, 6),
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
              <span className="text-body-md text-on-surface-variant font-medium">Today's Expense</span>
              <span className="font-display-currency text-display-currency text-primary">
                ₹{todaySpent.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-on-surface-variant/60 font-medium">This month</span>
              <span className="text-sm font-bold text-on-surface">₹{monthSpent.toLocaleString('en-IN')}</span>
            </div>
          </div>

          {/* Budget usage bar */}
          {monthBudget > 0 && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-on-surface-variant/70">Budget used</span>
                <span style={{ color: budgetColor }}>{budgetPct}% of ₹{monthBudget.toLocaleString('en-IN')}</span>
              </div>
              <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${budgetPct}%`, backgroundColor: budgetColor }}
                />
              </div>
            </div>
          )}

          <div className="w-full h-px bg-outline-variant/30" />

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



      </div>
    </Layout>
  );
}
