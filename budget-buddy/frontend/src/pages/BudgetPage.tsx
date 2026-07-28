import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { budgetsAPI } from '../api/services';
import type { BudgetSummary, CategorySpend } from '../types';
import toast from 'react-hot-toast';
import { matchCategoryIcon } from '../utils/categoryHelpers';

export default function BudgetPage() {
  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState(now.getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(now.getFullYear());

  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBudget = async (m: number, y: number) => {
    try {
      setLoading(true);
      const res = await budgetsAPI.summary(m, y);
      setBudget(res.data);
      if (res.data && res.data.total_budget > 0) {
        setAmountInput(res.data.total_budget);
      } else {
        setAmountInput(0);
      }
    } catch (err) {
      console.error(err);
      setBudget(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget(currentMonth, currentYear);
  }, [currentMonth, currentYear]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountInput <= 0) return;
    setSaving(true);
    try {
      await budgetsAPI.create({ amount: amountInput, month: currentMonth, year: currentYear });
      toast.success('Budget limit saved!');
      loadBudget(currentMonth, currentYear);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  const handlePrevMonth = () => {
    let m = currentMonth - 1;
    let y = currentYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  const handleNextMonth = () => {
    let m = currentMonth + 1;
    let y = currentYear;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    setCurrentMonth(m);
    setCurrentYear(y);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getCategoryIcon = (category: string) => {
    return matchCategoryIcon(category);
  };

  // Ring calculation
  const pct = budget?.percentage_used || 0;
  const clampedPct = Math.min(pct, 100);
  const ringColor = pct >= 100 ? '#ba1a1a' : pct >= 80 ? '#f9a825' : '#006e2a';
  const strokeDasharray = 251.2; // 2 * pi * 40
  const strokeDashoffset = strokeDasharray - (strokeDasharray * clampedPct) / 100;

  return (
    <Layout showBack title="Budgeting" hideBottomNav>
      <div className="page-container page-enter">
        
        {/* Month Navigator */}
        <div className="flex justify-between items-center glass-panel rounded-full px-4 py-2">
          <button onClick={handlePrevMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-all text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="font-semibold text-primary">
            {monthNames[currentMonth - 1]} {currentYear}
          </span>
          <button onClick={handleNextMonth} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container active:scale-95 transition-all text-on-surface-variant">
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="skeleton h-48 w-full" />
            <div className="skeleton h-32 w-full" />
            <div className="skeleton h-48 w-full" />
          </div>
        ) : (
          <>
            {/* Budget Status Ring & Cards */}
            {budget && budget.total_budget > 0 ? (
              <div className="flex flex-col gap-4">
                
                {/* Hero Ring */}
                <section className="glass-panel rounded-2xl p-6 flex flex-col items-center justify-center relative">
                  {budget.is_over_budget && (
                    <div className="absolute top-4 right-4 bg-error/10 text-error px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                      <span className="material-symbols-outlined text-[14px]">warning</span>
                      Over Budget
                    </div>
                  )}
                  
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="var(--color-surface-variant, #e1e3e4)" strokeWidth="12" fill="none" />
                      <circle 
                        cx="50" cy="50" r="40" 
                        stroke={ringColor} 
                        strokeWidth="12" 
                        fill="none" 
                        strokeLinecap="round"
                        strokeDasharray={strokeDasharray}
                        strokeDashoffset={strokeDashoffset}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-bold text-primary">{pct}%</span>
                      <span className="text-xs text-on-surface-variant font-medium uppercase">Used</span>
                    </div>
                  </div>
                </section>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase font-semibold">Total Spent</span>
                    <span className="text-monetary-md font-bold text-primary">
                      ₹{budget.total_spent.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="glass-panel rounded-2xl p-4 flex flex-col gap-1">
                    <span className="text-xs text-on-surface-variant uppercase font-semibold">Remaining</span>
                    <span className={`text-monetary-md font-bold ${budget.remaining > 0 ? 'text-secondary' : 'text-error'}`}>
                      ₹{budget.remaining.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Category Breakdown */}
                <section className="glass-panel rounded-2xl p-5 space-y-4">
                  <h3 className="text-sm font-bold text-primary uppercase">Category Breakdown</h3>
                  {budget.categories.length === 0 ? (
                    <p className="text-sm text-on-surface-variant/70 italic text-center py-2">No expenses yet this month.</p>
                  ) : (
                    <div className="space-y-4">
                      {budget.categories.map((cat: CategorySpend) => {
                        const catPct = (cat.spent / budget.total_budget) * 100;
                        return (
                          <div key={cat.category} className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-base">{getCategoryIcon(cat.category)}</span>
                                <span className="text-sm font-semibold text-primary">{cat.category}</span>
                              </div>
                              <span className="text-sm font-bold text-primary">₹{cat.spent.toLocaleString('en-IN')}</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-surface-variant overflow-hidden">
                              <div 
                                className="h-full rounded-full bg-primary transition-all duration-500"
                                style={{ width: `${Math.min(catPct, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

              </div>
            ) : (
              <section className="glass-panel rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-[48px] text-primary/20 mb-2">account_balance_wallet</span>
                <p className="text-body-md text-primary font-bold">
                  No budget set
                </p>
                <p className="text-sm text-on-surface-variant/70">
                  Set a limit for {monthNames[currentMonth - 1]} to start tracking your spending.
                </p>
              </section>
            )}

            {/* Set / Update Budget Form */}
            <section className="glass-panel rounded-2xl p-5 space-y-4 mt-4">
              <h2 className="text-sm text-primary font-bold uppercase">
                {budget && budget.total_budget > 0 ? 'Update Limit' : 'Set Limit'}
              </h2>
              
              <form onSubmit={handleSaveBudget} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center p-1 bg-surface-container-low rounded-xl border border-transparent focus-within:border-primary focus-within:bg-white transition-all">
                    <span className="px-3 text-on-surface-variant font-bold">₹</span>
                    <input
                      type="number"
                      placeholder="e.g. 15,000"
                      value={amountInput || ''}
                      onChange={(e) => setAmountInput(parseFloat(e.target.value) || 0)}
                      className="w-full h-10 bg-transparent text-sm outline-none text-primary font-semibold"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary w-full h-12 text-sm shadow-none mt-2"
                >
                  {saving ? 'Saving...' : budget && budget.total_budget > 0 ? 'Save Changes' : 'Start Budgeting'}
                </button>
              </form>
            </section>
          </>
        )}

      </div>
    </Layout>
  );
}
