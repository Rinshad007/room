import { useState, useEffect, useRef, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { expensesAPI } from '../api/services';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import type { Expense, Settlement, Category } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

import { matchCategoryIcon } from '../utils/categoryHelpers';

// ─── Types ───────────────────────────────────────────────────────────────────

interface EditState {
  id: string;
  title: string;
  description: string;
  category: Category;
  amount: number;
  expense_date: string;
}

const CATEGORIES: Category[] = ['Food', 'Travel', 'Shopping', 'Rent', 'Entertainment', 'Others'];

const getCategoryIcon = (cat: string) => {
  return matchCategoryIcon(cat);
};

// ─── Swipeable Row ────────────────────────────────────────────────────────────
interface SwipeRowProps {
  onDelete: () => void;
  children: React.ReactNode;
  disabled?: boolean; // when true = no swipe actions (paid expenses)
}

function SwipeRow({ onDelete, children, disabled }: SwipeRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number | null>(null);
  const currentXRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const THRESHOLD = 72;

  const reset = () => {
    setOffset(0);
    setSwiped(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offset;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled || startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    const newOffset = Math.max(-THRESHOLD * 1.2, Math.min(0, dx));
    setOffset(newOffset);
  };

  const onTouchEnd = () => {
    if (disabled) return;
    if (offset < -THRESHOLD * 0.6) {
      setOffset(-THRESHOLD);
      setSwiped(true);
    } else {
      reset();
    }
    startXRef.current = null;
  };

  // Close if user taps elsewhere
  useEffect(() => {
    if (!swiped) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        reset();
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [swiped]);

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl">
      {/* Red delete background */}
      {!disabled && (
        <div className="absolute inset-y-0 right-0 w-[72px] flex items-center justify-center bg-error rounded-xl">
          <button
            onClick={() => { reset(); onDelete(); }}
            className="flex flex-col items-center gap-1 text-white"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
            <span className="text-[10px] font-bold">Delete</span>
          </button>
        </div>
      )}

      {/* Sliding content */}
      <div
        style={{ transform: `translateX(${offset}px)`, transition: startXRef.current === null ? 'transform 0.2s ease' : 'none' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function HistoryPage() {
  const { user } = useAuthStore();

  // ── Real-time data ────────────────────────────────────────────────────────
  const { ready, myExpenses, mySettlements, resolveName } = useRealtimeStore(user?.id);

  // Merge + sort newest-first
  const historyItems = useMemo(() => {
    type HItem =
      | { type: 'expense'; date: Date; data: Expense }
      | { type: 'settlement'; date: Date; data: Settlement };

    const merged: HItem[] = [
      ...myExpenses.map(exp => ({ type: 'expense' as const, date: new Date(exp.expense_date), data: exp })),
      ...mySettlements.map(s => ({ type: 'settlement' as const, date: new Date(s.created_at), data: s })),
    ];
    return merged.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [myExpenses, mySettlements]);

  // Edit modal
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (exp: Expense) => {
    setEditState({
      id: exp.id,
      title: exp.title,
      description: exp.description || '',
      category: exp.category,
      amount: exp.amount,
      expense_date: exp.expense_date.split('T')[0],
    });
  };

  const handleSaveEdit = async () => {
    if (!editState) return;
    setSaving(true);
    try {
      await expensesAPI.update(editState.id, {
        title: editState.title,
        description: editState.description,
        category: editState.category,
        amount: editState.amount,
        expense_date: new Date(editState.expense_date).toISOString(),
      });
      toast.success('Expense updated!');
      setEditState(null);
      // Real-time store auto-refreshes — no manual reload
    } catch {
      toast.error('Failed to update expense');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const confirmDelete = (id: string) => setDeleteTarget(id);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await expensesAPI.delete(deleteTarget);
      toast.success('Expense deleted');
      setDeleteTarget(null);
      // Real-time store auto-refreshes — no manual reload
    } catch {
      toast.error('Failed to delete expense');
    } finally {
      setDeleting(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────
  // resolveName comes from real-time store

  if (!ready) {
    return (
      <Layout showBack title="History" hideBottomNav>
        <div className="page-container space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout showBack title="History" hideBottomNav>
      <div className="page-container page-enter">
        <h1 className="text-headline-lg font-bold text-primary px-1">History</h1>

        {historyItems.length === 0 ? (
          <p className="py-12 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
            No transactions recorded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {historyItems.map((item) => {
              if (item.type === 'expense') {
                const exp = item.data;
                const myUserId = user?.id;
                const isPaidUser = exp.paid_by === 'you' || exp.paid_by === myUserId;
                const mySplit = exp.splits?.find((s: any) => s.user_id === myUserId);
                const displayAmt = mySplit ? mySplit.share_amount : exp.amount;
                const isFullExpense = !mySplit || mySplit.share_amount === exp.amount;

                // Determine if any split is "paid" — i.e. all non-payer splits are
                // covered by a completed settlement. In Firebase model, once the
                // payer created the expense every split status starts as 'accepted'.
                // We consider an expense "settled" if the current user is NOT the
                // payer AND their split amount is effectively covered (best effort).
                // Simple rule: hide edit/delete for non-payer users (they can't edit).
                // For payer: always show edit/delete (they own the expense).
                const canEditDelete = isPaidUser;

                return (
                  <SwipeRow
                    key={exp.id}
                    onDelete={() => confirmDelete(exp.id)}
                    disabled={!canEditDelete}
                  >
                    <div className="bg-white rounded-xl p-4 border border-outline-variant/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between hover:shadow-md transition-shadow">
                      {/* Left: icon + info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="icon-circle bg-surface-variant text-xl" style={{ width: 40, height: 40 }}>
                          {getCategoryIcon(exp.category)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-body-md text-primary truncate max-w-[140px] sm:max-w-[200px]">
                            {exp.title}
                          </h3>
                          <p className="text-xs text-on-surface-variant/80 truncate">
                            {new Date(exp.expense_date).toLocaleDateString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}{' '}
                            • {exp.category}
                          </p>
                        </div>
                      </div>

                      {/* Right: amount + actions */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <div className="text-right">
                          <p className="font-bold text-monetary-md text-primary">
                            ₹{displayAmt.toLocaleString('en-IN')}
                          </p>
                          {!isFullExpense && (
                            <p className="text-[10px] text-on-surface-variant/60">
                              of ₹{exp.amount.toLocaleString('en-IN')}
                            </p>
                          )}
                          <p className="text-[10px]">
                            {isPaidUser ? (
                              <span className="text-secondary font-medium">You paid</span>
                            ) : (
                              <span className="text-error font-medium">You owe</span>
                            )}
                          </p>
                        </div>

                        {/* Edit button — only for payer (the expense owner) */}
                        {canEditDelete && (
                          <button
                            onClick={() => openEdit(exp)}
                            className="p-2 rounded-lg text-on-surface-variant/40 hover:text-primary hover:bg-primary/5 transition-colors"
                            title="Edit"
                          >
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </SwipeRow>
                );
              } else {
                // Settlement row
                const s = item.data;
                const isPayer = s.payer_id === 'you' || s.payer_id === user?.id;
                const otherPartyName = isPayer
                  ? resolveName(s.receiver_id)
                  : resolveName(s.payer_id);

                const isCompleted = s.status === 'completed';

                return (
                  // Settlements: no swipe/edit (they represent confirmed payments)
                  <div
                    key={s.id}
                    className="bg-white rounded-xl p-4 border border-outline-variant/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${isCompleted ? 'bg-secondary-container text-secondary' : 'bg-amber-100 text-amber-600'}`}>
                        <span className="material-symbols-outlined">
                          {isCompleted ? 'handshake' : 'pending_actions'}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-body-md text-primary truncate max-w-[140px] sm:max-w-[200px]">
                          {isPayer ? `Settled to ${otherPartyName}` : `Received from ${otherPartyName}`}
                        </h3>
                        <p className="text-xs text-on-surface-variant/80 flex items-center gap-1 flex-wrap">
                          {item.date.toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          • {s.payment_method}
                          {!isCompleted && (
                            <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                              Pending
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <p className={`font-bold text-monetary-md ${isPayer ? 'text-error' : 'text-secondary'}`}>
                        {isPayer ? '-' : '+'}₹{s.amount.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/60">Settlement</p>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* ── Edit Modal ────────────────────────────────────────────────────── */}
      {editState && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-primary">Edit Expense</h3>
              <button
                onClick={() => setEditState(null)}
                disabled={saving}
                className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase">Title</label>
              <input
                type="text"
                value={editState.title}
                onChange={(e) => setEditState((s) => s && { ...s, title: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant uppercase">Description</label>
              <input
                type="text"
                value={editState.description}
                onChange={(e) => setEditState((s) => s && { ...s, description: e.target.value })}
                placeholder="Optional"
                className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {/* Amount + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Amount (₹)</label>
                <input
                  type="number"
                  value={editState.amount}
                  onChange={(e) => setEditState((s) => s && { ...s, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant uppercase">Date</label>
                <input
                  type="date"
                  value={editState.expense_date}
                  onChange={(e) => setEditState((s) => s && { ...s, expense_date: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-outline-variant/40 bg-surface-container-low text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-on-surface-variant uppercase">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEditState((s) => s && { ...s, category: cat })}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      editState.category === cat
                        ? 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:border-primary/40'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Save */}
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="w-full h-12 bg-primary text-on-primary rounded-xl font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-transform"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ───────────────────────────────────────────── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs bg-white rounded-3xl shadow-2xl p-6 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-primary">Delete Expense?</h3>
              <p className="text-sm text-on-surface-variant/70 mt-1">
                This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 h-11 rounded-xl bg-error text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
              >
                {deleting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
