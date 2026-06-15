import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { expensesAPI } from '../api/services';
import type { Expense } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await expensesAPI.list(0, 50);
      setExpenses(res.data.expenses || []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load expense history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      toast.success('Expense deleted');
      loadExpenses();
    } catch (err) {
      toast.error('Failed to delete expense');
    }
  };

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
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-24 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="page-container page-enter pb-24">
        <h1 className="text-headline-lg font-bold text-primary px-1">Expense History</h1>

        <div className="flex flex-col gap-3">
          {expenses.length === 0 ? (
            <p className="py-12 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
              No expenses recorded yet.
            </p>
          ) : (
            expenses.map((exp) => (
              <div
                key={exp.id}
                className="bg-white rounded-xl p-4 border border-outline-variant/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between hover:shadow-md transition-shadow group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant">
                    <span className="material-symbols-outlined">{getCategoryIcon(exp.category)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-body-md text-primary truncate max-w-[160px]">{exp.title}</h3>
                    <p className="text-xs text-on-surface-variant/80">
                      {new Date(exp.expense_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} • {exp.category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-monetary-md text-primary">₹{exp.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {exp.paid_by === 'you' || exp.paid_by === user?.id ? (
                        <span className="text-secondary font-medium">You paid</span>
                      ) : (
                        <span className="text-error font-medium">You owe</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="text-on-surface-variant/30 hover:text-error hover:bg-error/5 p-1.5 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100"
                    title="Delete Expense"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
