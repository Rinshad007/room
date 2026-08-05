import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { expensesAPI } from '../api/services';
import type { Expense, Category, ExpenseUpdate } from '../types';
import toast from 'react-hot-toast';

const CATEGORIES: Category[] = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Others'];


export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [initialExpense, setInitialExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<Category>('Others');

  const [expenseDate, setExpenseDate] = useState('');

  useEffect(() => {
    if (!id) return;
    expensesAPI.get(id)
      .then((res) => {
        const exp = res.data;
        setInitialExpense(exp);
        setTitle(exp.title);
        setDescription(exp.description || '');
        setAmount(exp.amount.toString());
        setCategory(exp.category as Category);

        setExpenseDate(exp.expense_date ? exp.expense_date.split('T')[0] : new Date().toISOString().split('T')[0]);
      })
      .catch((err) => {
        toast.error('Failed to load expense details');
        console.error(err);
        navigate('/history');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !initialExpense) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const updates: Partial<ExpenseUpdate> = {};

    if (title.trim() !== initialExpense.title) {
      updates.title = title.trim();
    }
    if (description.trim() !== (initialExpense.description || '')) {
      updates.description = description.trim();
    }
    if (numAmount !== initialExpense.amount) {
      updates.amount = numAmount;
    }
    if (category !== initialExpense.category) {
      updates.category = category;
    }

    const origDate = initialExpense.expense_date ? initialExpense.expense_date.split('T')[0] : '';
    if (expenseDate !== origDate) {
      updates.expense_date = expenseDate;
    }

    if (Object.keys(updates).length === 0) {
      toast('No changes detected');
      navigate('/history');
      return;
    }

    setSaving(true);
    try {
      await expensesAPI.update(id, updates);
      toast.success('Expense updated!');
      navigate('/history');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update expense');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout showBack title="Edit Expense" hideBottomNav>
        <div className="page-container space-y-4">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  const numAmount = parseFloat(amount) || 0;
  const isAmountChanged = initialExpense && numAmount !== initialExpense.amount && !isNaN(numAmount);

  return (
    <Layout showBack title="Edit Expense" hideBottomNav>
      <div className="page-container page-enter pb-20">
        <h1 className="text-headline-lg font-bold text-primary px-1 mb-4">Edit Expense</h1>

        <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-5">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label-caps text-on-surface-variant uppercase ml-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field h-12 text-sm bg-surface-container-low"
              placeholder="e.g. Dinner at Olive"
              required
            />
          </div>

          {/* Amount & Diff Note */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center ml-1">
              <label className="text-label-caps text-on-surface-variant uppercase">Amount (₹)</label>
              {isAmountChanged && (
                <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  Was ₹{initialExpense.amount.toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="input-field h-12 text-sm bg-surface-container-low font-bold text-lg"
              placeholder="0.00"
              required
            />
          </div>

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label-caps text-on-surface-variant uppercase ml-1">Date</label>
            <input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="input-field h-12 text-sm bg-surface-container-low"
              required
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-2">
            <label className="text-label-caps text-on-surface-variant uppercase ml-1">Category</label>
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all ${
                    category === cat
                      ? 'bg-primary text-on-primary border-primary shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:border-primary/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-label-caps text-on-surface-variant uppercase ml-1">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field min-h-[80px] p-3 text-sm bg-surface-container-low resize-none"
              placeholder="Notes, remarks..."
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => navigate('/history')}
              disabled={saving}
              className="flex-1 h-12 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary h-12 text-sm shadow-none font-semibold flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
