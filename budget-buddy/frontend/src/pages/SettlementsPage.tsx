import { useState, useEffect } from 'react';
import Layout from '../components/layout/Layout';
import { settlementsAPI, friendsAPI, usersAPI } from '../api/services';
import type { Settlement, FriendWithRequest, UserBalance } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

export default function SettlementsPage() {
  const { user } = useAuthStore();
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSettlement, setActiveSettlement] = useState<{
    friendId: string;
    name: string;
    amount: number;
    upiId?: string;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const friendsRes = await friendsAPI.list();
      setFriends(friendsRes.data.friends || []);

      const balancesRes = await settlementsAPI.balances();
      setBalances(balancesRes.data.per_user || []);

      const historyRes = await settlementsAPI.list();
      const settlementsList = Array.isArray(historyRes.data) 
        ? historyRes.data 
        : (historyRes.data as any).settlements || [];
      setHistory(settlementsList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settlements data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openSettlementModal = async (friendId: string, name: string, amount: number) => {
    const localFriend = friends.find(item => item.friend.id === friendId);
    const upiId = localFriend?.friend.upi_id;

    setActiveSettlement({ friendId, name, amount, upiId });

    try {
      const res = await usersAPI.getById(friendId);
      setActiveSettlement(prev =>
        prev && prev.friendId === friendId ? { ...prev, upiId: res.data.upi_id } : prev
      );
    } catch (err) {
      console.error('Failed to fetch payee UPI ID:', err);
    }
  };

  const handleSettleUp = async (
    friendId: string,
    amount: number,
    paymentMethod: string = 'GPay',
    status: 'pending' | 'completed' = 'completed'
  ) => {
    try {
      await settlementsAPI.create({
        receiver_id: friendId,
        amount,
        payment_method: paymentMethod,
        status
      });
      if (status === 'completed') {
        toast.success(`Settlement of ₹${amount} completed successfully!`);
      } else {
        toast.success('Settlement recorded! Awaiting friend\'s confirmation.');
      }
      setActiveSettlement(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to record settlement');
    }
  };

  const handleApprove = async (settlementId: string) => {
    try {
      await settlementsAPI.approve(settlementId);
      toast.success('Settlement approved!');
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to approve settlement');
    }
  };

  const getFriendName = (id: string) => {
    const f = friends.find(item => item.friend.id === id);
    return f ? f.friend.name : 'Unknown Friend';
  };

  const toSettleList = balances
    .filter(b => b.balance < 0)
    .map(b => ({
      friendId: b.user_id,
      name: getFriendName(b.user_id),
      balance: b.balance
    }));

  const owedToYouList = balances
    .filter(b => b.balance > 0)
    .map(b => ({
      friendId: b.user_id,
      name: getFriendName(b.user_id),
      balance: b.balance
    }));

  const pendingSettlements = history.filter(s => s.status === 'pending');
  const completedSettlements = history.filter(s => s.status === 'completed');

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

  return (
    <Layout showBack title="Settle Up">
      <div className="page-container page-enter pb-24 space-y-6">
        
        {/* Outstanding Balances */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Balances to Settle */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-monetary-md text-primary font-bold">Balances to Settle</h2>
            {toSettleList.length === 0 ? (
              <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
                No outstanding balances to settle.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {toSettleList.map(item => (
                  <div key={item.friendId} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
                        {item.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">{item.name}</p>
                        <p className="text-xs text-error font-semibold">You owe: ₹{Math.abs(item.balance).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => openSettlementModal(item.friendId, item.name, Math.abs(item.balance))}
                      className="btn-primary h-8 px-3 text-xs shadow-none rounded-lg"
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Owed to You */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-monetary-md text-secondary font-bold">Owed to You</h2>
            {owedToYouList.length === 0 ? (
              <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
                No outstanding receivables.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {owedToYouList.map(item => (
                  <div key={item.friendId} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-sm">
                        {item.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">{item.name}</p>
                        <p className="text-xs text-secondary font-semibold">Owes you: ₹{item.balance.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant/70 italic bg-surface-variant/30 px-2 py-0.5 rounded-full">Awaiting payment</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Pending Approval */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h2 className="text-monetary-md text-primary font-bold">Pending Confirmation</h2>
          {pendingSettlements.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
              No settlements pending confirmation.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingSettlements.map(settlement => {
                const isPayer = settlement.payer_id === 'you' || settlement.payer_id === user?.id;
                const otherPartyName = isPayer ? getFriendName(settlement.receiver_id) : getFriendName(settlement.payer_id);
                return (
                  <div key={settlement.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">pending_actions</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherPartyName}` : `${otherPartyName} paid you`}
                        </p>
                        <p className="text-xs text-on-surface-variant/80">
                          {new Date(settlement.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {settlement.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-primary">
                        ₹{settlement.amount.toLocaleString('en-IN')}
                      </span>
                      {!isPayer ? (
                        <button
                          onClick={() => handleApprove(settlement.id)}
                          className="btn-primary h-8 px-3 text-xs py-0 shadow-none rounded-lg bg-secondary text-on-secondary hover:bg-secondary/95"
                        >
                          Confirm
                        </button>
                      ) : (
                        <span className="text-[10px] text-on-surface-variant/70 italic bg-surface-variant/30 px-2 py-0.5 rounded-full">Awaiting confirm</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Past Settlements */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h2 className="text-monetary-md text-on-surface-variant font-semibold">Past Settlements</h2>
          {completedSettlements.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
              No completed settlements yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {completedSettlements.map((settlement) => {
                const isPayer = settlement.payer_id === 'you' || settlement.payer_id === user?.id;
                const otherPartyName = isPayer ? getFriendName(settlement.receiver_id) : getFriendName(settlement.payer_id);
                return (
                  <div key={settlement.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">payments</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherPartyName}` : `${otherPartyName} paid you`}
                        </p>
                        <p className="text-xs text-on-surface-variant/80">
                          {new Date(settlement.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })} • {settlement.payment_method}
                        </p>
                      </div>
                    </div>

                    <span className={`font-bold text-sm ${isPayer ? 'text-error' : 'text-secondary'}`}>
                      {isPayer ? '-' : '+'} ₹{settlement.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Settlement Payment Modal */}
        {activeSettlement && (() => {
          const upiLink = activeSettlement.upiId
            ? `upi://pay?pa=${activeSettlement.upiId}&pn=${encodeURIComponent(activeSettlement.name)}&am=${activeSettlement.amount}&cu=INR&tn=BudgetBuddy%20Settlement`
            : '';
          const qrCodeUrl = activeSettlement.upiId
            ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`
            : '';

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-6 shadow-2xl border border-outline-variant/20">
                <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
                  <h3 className="text-lg font-bold text-primary">Settle up</h3>
                  <button
                    onClick={() => setActiveSettlement(null)}
                    className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>

                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-2xl shadow-sm">
                    {activeSettlement.name[0].toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-base text-primary">{activeSettlement.name}</h4>
                    <p className="text-xs text-on-surface-variant/80">Outstanding balance settlement</p>
                  </div>
                  <div className="text-2xl font-bold text-error mt-2">
                    ₹{activeSettlement.amount.toLocaleString('en-IN')}
                  </div>
                </div>

                {activeSettlement.upiId ? (
                  <div className="space-y-4">
                    {/* Deep link button (for mobile/tablet) */}
                    <a
                      href={upiLink}
                      onClick={() => {
                        toast.success("Opening UPI payment app...", { duration: 3000 });
                      }}
                      className="btn-primary w-full h-12 flex items-center justify-center gap-2 shadow-none rounded-xl bg-gradient-to-r from-primary to-primary-container hover:shadow-lg transition-all"
                    >
                      <span className="material-symbols-outlined">qr_code_scanner</span>
                      Pay via UPI / GPay App
                    </a>

                    {/* QR Code container (for desktop) */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-outline-variant/10 shadow-inner">
                      <img src={qrCodeUrl} alt="UPI QR Code" className="w-40 h-40" />
                      <p className="text-[10px] text-zinc-500 font-semibold mt-2">
                        Scan this QR with Google Pay, PhonePe, Paytm
                      </p>
                    </div>

                    <div className="text-center space-y-2">
                      <p className="text-xs text-on-surface-variant/70 italic">
                        Once paid, tap below to complete and reflect in balances:
                      </p>
                      <button
                        onClick={() => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, 'GPay', 'completed')}
                        className="btn-primary w-full h-10 text-xs shadow-none bg-secondary text-on-secondary hover:bg-secondary/95"
                      >
                        Confirm Payment Sent
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-center">
                      <p className="text-xs text-error font-medium">
                        This user hasn't added a UPI ID to their profile yet.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <button
                        onClick={() => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, 'Cash', 'completed')}
                        className="btn-primary w-full h-12 text-sm shadow-none rounded-xl"
                      >
                        Record as Cash Payment
                      </button>
                      
                      <button
                        onClick={() => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, 'GPay', 'pending')}
                        className="btn-secondary w-full h-10 text-xs text-primary border-primary/20"
                      >
                        Record pending GPay request
                      </button>
                    </div>
                  </div>
                )}

                {activeSettlement.upiId && (
                  <div className="border-t border-outline-variant/10 pt-3 flex justify-between items-center text-xs">
                    <span className="text-on-surface-variant/60">Paying with Cash instead?</span>
                    <button
                      onClick={() => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, 'Cash', 'completed')}
                      className="text-primary font-bold hover:underline"
                    >
                      Record Cash
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </Layout>
  );
}
