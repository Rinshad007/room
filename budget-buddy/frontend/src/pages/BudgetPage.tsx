import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { budgetsAPI } from '../api/services';
import type { Budget } from '../types';
import toast from 'react-hot-toast';

export default function BudgetPage() {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [amountInput, setAmountInput] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const loadBudget = async () => {
    try {
      setLoading(true);
      const res = await budgetsAPI.get(currentMonth, currentYear);
      setBudget(res.data);
      if (res.data) {
        setAmountInput(res.data.amount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBudget();
  }, []);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountInput <= 0) {
      toast.error('Budget amount must be greater than 0');
      return;
    }

    try {
      setSaving(true);
      if (budget) {
        // Update existing budget
        const res = await budgetsAPI.update(currentMonth, currentYear, amountInput);
        setBudget(res.data);
      } else {
        // Create new budget
        const res = await budgetsAPI.create({
          month: currentMonth,
          year: currentYear,
          amount: amountInput
        });
        setBudget(res.data);
      }
      toast.success('Budget saved successfully!');
    } catch (err) {
      toast.error('Failed to save budget');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="page-container space-y-6">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  const spent = budget?.spent ?? 0;
  const total = budget?.amount ?? 0;
  const remaining = budget?.remaining ?? 0;
  const pct = total > 0 ? Math.min(Math.round((spent / total) * 100), 100) : 0;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <Layout showBack title="Monthly Budget">
      <div className="page-container page-enter pb-24">
        
        {/* Budget Status Card */}
        {budget ? (
          <section className="glass-panel rounded-2xl p-6 flex flex-col gap-4 relative overflow-hidden">
            <div className="flex flex-col">
              <span className="text-body-md text-on-surface-variant font-medium">
                {monthNames[currentMonth - 1]} {currentYear} Budget
              </span>
              <span className="font-display-currency text-display-currency text-primary">
                ₹{total.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-surface-variant overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${pct >= 90 ? 'bg-error' : 'bg-secondary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="flex justify-between text-sm">
              <div className="flex flex-col">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">Spent</span>
                <span className="font-bold text-primary">₹{spent.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-xs text-on-surface-variant uppercase font-semibold">Remaining</span>
                <span className={`font-bold ${remaining >= 0 ? 'text-secondary' : 'text-error'}`}>
                  ₹{remaining.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <span className="text-label-caps text-on-surface-variant self-end uppercase font-bold">
              {pct}% Spent
            </span>
          </section>
        ) : (
          <section className="glass-panel rounded-2xl p-6 text-center">
            <p className="text-body-md text-on-surface-variant/70 italic mb-2">
              No budget set for {monthNames[currentMonth - 1]} {currentYear} yet.
            </p>
            <p className="text-xs text-on-surface-variant/50">
              Setting a budget helps you track shared and personal spending limits.
            </p>
          </section>
        )}

        {/* Set / Update Budget Form */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h2 className="text-monetary-md text-primary font-bold">
            {budget ? 'Adjust Budget Limit' : 'Set Budget Limit'}
          </h2>
          
          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-label-caps text-on-surface-variant uppercase ml-1">Limit (₹)</label>
              <input
                type="number"
                placeholder="e.g. 15,000"
                value={amountInput || ''}
                onChange={(e) => setAmountInput(parseFloat(e.target.value) || 0)}
                className="input-field h-12 text-sm bg-surface-container-low"
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="btn-primary w-full h-12 text-sm shadow-none mt-2"
            >
              {saving ? 'Saving...' : budget ? 'Update Budget' : 'Set Budget'}
            </button>
          </form>
        </section>

      </div>
    </Layout>
  );
}
