import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { expensesAPI, settlementsAPI, friendsAPI } from '../api/services';
import type { Expense, Settlement, FriendWithRequest } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

type HistoryItem = 
  | { type: 'expense'; date: Date; data: Expense }
  | { type: 'settlement'; date: Date; data: Settlement };

export default function HistoryPage() {
  const { user } = useAuthStore();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const [expensesRes, settlementsRes, friendsRes] = await Promise.all([
        expensesAPI.list(0, 100),
        settlementsAPI.list(),
        friendsAPI.list()
      ]);

      const expensesList = expensesRes.data.expenses || [];
      const settlementsList = Array.isArray(settlementsRes.data) 
        ? settlementsRes.data 
        : (settlementsRes.data as any).settlements || [];
      
      setFriends(friendsRes.data.friends || []);

      const merged: HistoryItem[] = [
        ...expensesList.map(exp => ({
          type: 'expense' as const,
          date: new Date(exp.expense_date),
          data: exp
        })),
        ...settlementsList.map((s: Settlement) => ({
          type: 'settlement' as const,
          date: new Date(s.created_at),
          data: s
        }))
      ];

      merged.sort((a, b) => b.date.getTime() - a.date.getTime());
      setHistoryItems(merged);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load transaction history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await expensesAPI.delete(id);
      toast.success('Expense deleted');
      loadHistory();
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

  const getFriendName = (id: string) => {
    const f = friends.find(item => item.friend.id === id);
    return f ? f.friend.name : 'Unknown Friend';
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
        <h1 className="text-headline-lg font-bold text-primary px-1">History</h1>

        <div className="flex flex-col gap-3">
          {historyItems.length === 0 ? (
            <p className="py-12 text-center text-body-md text-on-surface-variant/60 italic glass-panel rounded-xl">
              No transactions recorded yet.
            </p>
          ) : (
            historyItems.map((item) => {
              if (item.type === 'expense') {
                const exp = item.data;
                const myUserId = user?.id;
                const isPaidUser = exp.paid_by === 'you' || exp.paid_by === myUserId;
                return (
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
                        {/* Show user's share amount (or full amount if personal) */}
                        {(() => {
                          const mySplit = exp.splits?.find((s: any) => s.user_id === myUserId);
                          const displayAmt = mySplit ? mySplit.share_amount : exp.amount;
                          const isFullExpense = !mySplit || mySplit.share_amount === exp.amount;
                          return (
                            <>
                              <p className="font-bold text-monetary-md text-primary">₹{displayAmt.toLocaleString('en-IN')}</p>
                              {!isFullExpense && (
                                <p className="text-[10px] text-on-surface-variant/60">of ₹{exp.amount.toLocaleString('en-IN')} total</p>
                              )}
                              <p className="text-[10px] text-on-surface-variant">
                                {isPaidUser ? (
                                  <span className="text-secondary font-medium">You paid</span>
                                ) : (
                                  <span className="text-error font-medium">You owe</span>
                                )}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      {isPaidUser && (
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="text-on-surface-variant/30 hover:text-error hover:bg-error/5 p-1.5 rounded-lg transition-colors md:opacity-0 group-hover:opacity-100"
                          title="Delete Expense"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              } else {
                const s = item.data;
                const isPayer = s.payer_id === 'you' || s.payer_id === user?.id;
                const otherPartyName = isPayer ? getFriendName(s.receiver_id) : getFriendName(s.payer_id);
                return (
                  <div
                    key={s.id}
                    className="bg-white rounded-xl p-4 border border-outline-variant/20 shadow-[0_2px_10px_rgba(0,0,0,0.02)] flex items-center justify-between hover:shadow-md transition-shadow group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary-container text-secondary flex items-center justify-center">
                        <span className="material-symbols-outlined">handshake</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-body-md text-primary truncate max-w-[160px]">
                          {isPayer ? `Settled to ${otherPartyName}` : `Received from ${otherPartyName}`}
                        </h3>
                        <p className="text-xs text-on-surface-variant/80">
                          {item.date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} • {s.payment_method}
                          {s.status === 'pending' && (
                            <span className="ml-2 text-[10px] text-error font-medium bg-error/10 px-1.5 py-0.5 rounded-full">Pending</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-bold text-monetary-md ${isPayer ? 'text-primary' : 'text-secondary'}`}>
                          {isPayer ? '-' : '+'}₹{s.amount.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-on-surface-variant/60">
                          Settlement
                        </p>
                      </div>
                      <div className="w-[30px]" />
                    </div>
                  </div>
                );
              }
            })
          )}
        </div>
      </div>
    </Layout>
  );
}
