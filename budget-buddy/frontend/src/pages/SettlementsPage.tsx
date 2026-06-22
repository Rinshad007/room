import { useState, useEffect, useRef, useCallback } from 'react';
import Layout from '../components/layout/Layout';
import { settlementsAPI, friendsAPI, usersAPI } from '../api/services';
import type { Settlement, FriendWithRequest, UserBalance } from '../types';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ActiveSettlement {
  friendId: string;
  name: string;
  amount: number;
  upiId?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function SettlementsPage() {
  const { user } = useAuthStore();

  // Data state
  const [friends, setFriends] = useState<FriendWithRequest[]>([]);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [history, setHistory] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  // Name resolution cache (for users not in friends list)
  const [nameCache, setNameCache] = useState<Record<string, string>>({});

  // Modal state
  const [activeSettlement, setActiveSettlement] = useState<ActiveSettlement | null>(null);
  const [upiLoading, setUpiLoading] = useState(false);

  // UX guards
  const [submitting, setSubmitting] = useState(false);
  const [gpayOpened, setGpayOpened] = useState(false);

  // Ref to scroll to pending section
  const pendingRef = useRef<HTMLElement>(null);

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [friendsRes, balancesRes, historyRes] = await Promise.all([
        friendsAPI.list(),
        settlementsAPI.balances(),
        settlementsAPI.list(),
      ]);

      const friendsList = friendsRes.data.friends || [];
      setFriends(friendsList);
      setBalances(balancesRes.data.per_user || []);

      const settlementsList: Settlement[] = Array.isArray(historyRes.data)
        ? historyRes.data
        : (historyRes.data as any).settlements || [];
      setHistory(settlementsList);

      // Resolve names for unknown IDs that appear in settlement history
      const knownIds = new Set(friendsList.map((f: FriendWithRequest) => f.friend.id));
      if (user?.id) knownIds.add(user.id);

      const unknownIds = new Set<string>();
      settlementsList.forEach((s) => {
        if (!knownIds.has(s.payer_id) && s.payer_id !== user?.id) unknownIds.add(s.payer_id);
        if (!knownIds.has(s.receiver_id) && s.receiver_id !== user?.id) unknownIds.add(s.receiver_id);
      });

      if (unknownIds.size > 0) {
        const entries = await Promise.all(
          Array.from(unknownIds).map(async (id) => {
            try {
              const res = await usersAPI.getById(id);
              return [id, res.data.name || 'Unknown'] as [string, string];
            } catch {
              return [id, 'Unknown'] as [string, string];
            }
          })
        );
        setNameCache((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settlements data');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Name resolution ────────────────────────────────────────────────────────
  const resolveName = (id: string): string => {
    if (id === user?.id) return 'You';
    const f = friends.find((item) => item.friend.id === id);
    if (f) return f.friend.name;
    return nameCache[id] || 'Unknown';
  };

  // ── Open modal ─────────────────────────────────────────────────────────────
  const openSettlementModal = async (friendId: string, name: string, amount: number) => {
    // Pre-fill with name/amount, reset GPay state
    setActiveSettlement({ friendId, name, amount });
    setGpayOpened(false);
    setSubmitting(false);

    // Try to get UPI ID from friends list first (fast path)
    const localFriend = friends.find((item) => item.friend.id === friendId);
    if (localFriend?.friend.upi_id) {
      setActiveSettlement({ friendId, name, amount, upiId: localFriend.friend.upi_id });
      return;
    }

    // Fetch from DB if not in local state
    setUpiLoading(true);
    try {
      const res = await usersAPI.getById(friendId);
      setActiveSettlement({ friendId, name, amount, upiId: res.data.upi_id || undefined });
    } catch (err) {
      console.error('Failed to fetch payee UPI ID:', err);
      setActiveSettlement({ friendId, name, amount, upiId: undefined });
    } finally {
      setUpiLoading(false);
    }
  };

  // ── Core settle action ─────────────────────────────────────────────────────
  const handleSettleUp = async (
    friendId: string,
    amount: number,
    paymentMethod: string = 'GPay',
    status: 'pending' | 'completed' = 'pending'
  ) => {
    if (submitting) return; // Guard against double-click
    setSubmitting(true);
    try {
      await settlementsAPI.create({
        receiver_id: friendId,
        amount,
        payment_method: paymentMethod,
        status,
      });

      const friendName = activeSettlement?.name || resolveName(friendId);
      toast.success(`Payment recorded! Awaiting ${friendName}'s confirmation.`, { duration: 4000 });

      setActiveSettlement(null);
      setGpayOpened(false);

      // Reload data, then scroll to pending section
      await loadData();
      setTimeout(() => {
        pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to record settlement';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve (receiver confirms) ────────────────────────────────────────────
  const handleApprove = async (settlementId: string) => {
    try {
      await settlementsAPI.approve(settlementId);
      toast.success('Settlement confirmed! Balances updated.');
      loadData();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to approve settlement';
      toast.error(msg);
    }
  };

  // ── Derived lists ─────────────────────────────────────────────────────────
  const pendingSettlements = history.filter((s) => s.status === 'pending');
  const completedSettlements = history.filter((s) => s.status === 'completed');

  // IDs where I'm the payer and settlement is still pending
  const pendingByMe = new Set(
    pendingSettlements
      .filter((s) => s.payer_id === user?.id)
      .map((s) => s.receiver_id)
  );

  const toSettleList = balances
    .filter((b) => b.balance < 0)
    .map((b) => ({
      friendId: b.user_id,
      name: resolveName(b.user_id),
      balance: b.balance,
    }));

  const owedToYouList = balances
    .filter((b) => b.balance > 0)
    .map((b) => ({
      friendId: b.user_id,
      name: resolveName(b.user_id),
      balance: b.balance,
    }));

  // ── GPay UPI link ─────────────────────────────────────────────────────────
  const getUpiLink = (a: ActiveSettlement) =>
    a.upiId
      ? `upi://pay?pa=${encodeURIComponent(a.upiId)}&pn=${encodeURIComponent(a.name)}&am=${a.amount}&cu=INR&tn=BudgetBuddy%20Settlement`
      : '';

  const getQrUrl = (a: ActiveSettlement) =>
    a.upiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiLink(a))}`
      : '';

  // ── Loading skeleton ──────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout showBack title="Settle Up">
      <div className="page-container page-enter pb-24 space-y-6">

        {/* ── Outstanding Balances ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Balances to Settle */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-monetary-md text-primary font-bold">Balances to Settle</h2>
            {toSettleList.length === 0 ? (
              <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
                No outstanding balances to settle. 🎉
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {toSettleList.map((item) => {
                  const isPending = pendingByMe.has(item.friendId);
                  return (
                    <div
                      key={item.friendId}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
                          {item.name[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-primary">{item.name}</p>
                          <p className="text-xs text-error font-semibold">
                            You owe: ₹{Math.abs(item.balance).toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      {isPending ? (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-full font-semibold flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">pending_actions</span>
                          Pending
                        </span>
                      ) : (
                        <button
                          onClick={() => openSettlementModal(item.friendId, item.name, Math.abs(item.balance))}
                          className="btn-primary h-8 px-3 text-xs shadow-none rounded-lg"
                        >
                          Settle
                        </button>
                      )}
                    </div>
                  );
                })}
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
                {owedToYouList.map((item) => (
                  <div
                    key={item.friendId}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-sm">
                        {item.name[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">{item.name}</p>
                        <p className="text-xs text-secondary font-semibold">
                          Owes you: ₹{item.balance.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-on-surface-variant/70 italic bg-surface-variant/30 px-2 py-0.5 rounded-full">
                      Awaiting payment
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ── Pending Confirmation ────────────────────────────────────────── */}
        <section ref={pendingRef} className="glass-panel rounded-2xl p-5 space-y-4 scroll-mt-4">
          <h2 className="text-monetary-md text-primary font-bold flex items-center gap-2">
            Pending Confirmation
            {pendingSettlements.length > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {pendingSettlements.length}
              </span>
            )}
          </h2>
          {pendingSettlements.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
              No settlements pending confirmation.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {pendingSettlements.map((settlement) => {
                const isPayer = settlement.payer_id === user?.id;
                const otherPartyName = isPayer
                  ? resolveName(settlement.receiver_id)
                  : resolveName(settlement.payer_id);
                return (
                  <div
                    key={settlement.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200/60"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <span className="material-symbols-outlined text-sm">pending_actions</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherPartyName}` : `${otherPartyName} paid you`}
                        </p>
                        <p className="text-xs text-on-surface-variant/80">
                          {new Date(settlement.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          • {settlement.payment_method}
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
                        <span className="text-[10px] text-amber-700 italic bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Awaiting confirm
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Past Settlements ────────────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h2 className="text-monetary-md text-on-surface-variant font-semibold">Past Settlements</h2>
          {completedSettlements.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
              No completed settlements yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {completedSettlements.map((settlement) => {
                const isPayer = settlement.payer_id === user?.id;
                const otherPartyName = isPayer
                  ? resolveName(settlement.receiver_id)
                  : resolveName(settlement.payer_id);
                return (
                  <div
                    key={settlement.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">payments</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherPartyName}` : `${otherPartyName} paid you`}
                        </p>
                        <p className="text-xs text-on-surface-variant/80">
                          {new Date(settlement.created_at).toLocaleDateString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          • {settlement.payment_method}
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

      </div>

      {/* ── Settlement Modal ─────────────────────────────────────────────── */}
      {activeSettlement && (
        <SettlementModal
          settlement={activeSettlement}
          upiLoading={upiLoading}
          submitting={submitting}
          gpayOpened={gpayOpened}
          onGpayOpen={() => setGpayOpened(true)}
          onConfirm={(method) =>
            handleSettleUp(activeSettlement.friendId, activeSettlement.amount, method, 'pending')
          }
          onClose={() => {
            setActiveSettlement(null);
            setGpayOpened(false);
            setSubmitting(false);
          }}
          getUpiLink={getUpiLink}
          getQrUrl={getQrUrl}
        />
      )}
    </Layout>
  );
}

// ─── Settlement Modal ────────────────────────────────────────────────────────
interface ModalProps {
  settlement: ActiveSettlement;
  upiLoading: boolean;
  submitting: boolean;
  gpayOpened: boolean;
  onGpayOpen: () => void;
  onConfirm: (method: string) => void;
  onClose: () => void;
  getUpiLink: (a: ActiveSettlement) => string;
  getQrUrl: (a: ActiveSettlement) => string;
}

function SettlementModal({
  settlement,
  upiLoading,
  submitting,
  gpayOpened,
  onGpayOpen,
  onConfirm,
  onClose,
  getUpiLink,
  getQrUrl,
}: ModalProps) {
  const upiLink = getUpiLink(settlement);
  const qrCodeUrl = getQrUrl(settlement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 shadow-2xl border border-outline-variant/20">

        {/* Header */}
        <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
          <h3 className="text-lg font-bold text-primary">Settle up</h3>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Payee info */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-16 h-16 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-2xl shadow-sm">
            {settlement.name[0]?.toUpperCase() || '?'}
          </div>
          <div>
            <h4 className="font-bold text-base text-primary">{settlement.name}</h4>
            <p className="text-xs text-on-surface-variant/80">Outstanding balance settlement</p>
          </div>
          <div className="text-2xl font-bold text-error mt-1">
            ₹{settlement.amount.toLocaleString('en-IN')}
          </div>
        </div>

        {upiLoading ? (
          <div className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : settlement.upiId ? (
          /* ─── Has UPI ID: 2-step GPay flow ─── */
          <div className="space-y-4">

            {/* Step 1 */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">
                Step 1 — Pay via GPay
              </p>
              <a
                href={upiLink}
                onClick={onGpayOpen}
                className="btn-primary w-full h-12 flex items-center justify-center gap-2 shadow-none rounded-xl"
                style={{ textDecoration: 'none' }}
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
                Open Google Pay / UPI App
              </a>
            </div>

            {/* QR Code (desktop fallback) */}
            <div className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl border border-outline-variant/10 shadow-inner">
              <img src={qrCodeUrl} alt="UPI QR Code" className="w-36 h-36" />
              <p className="text-[10px] text-zinc-500 font-semibold mt-1 text-center">
                Scan with GPay · PhonePe · Paytm
              </p>
            </div>

            {/* Step 2 */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">
                Step 2 — Confirm after paying
              </p>
              {gpayOpened ? (
                <button
                  onClick={() => onConfirm('GPay')}
                  disabled={submitting}
                  className="btn-primary w-full h-11 text-sm shadow-none rounded-xl bg-secondary text-on-secondary hover:bg-secondary/95 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Recording…
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">check_circle</span>
                      I've Paid — Confirm Payment
                    </>
                  )}
                </button>
              ) : (
                <p className="text-xs text-center text-on-surface-variant/50 italic py-2">
                  Tap "Open Google Pay" above first, then confirm here.
                </p>
              )}
            </div>

            {/* Cash fallback */}
            <div className="border-t border-outline-variant/10 pt-3 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant/60">Paying cash instead?</span>
              <button
                onClick={() => onConfirm('Cash')}
                disabled={submitting}
                className="text-primary font-bold hover:underline disabled:opacity-50"
              >
                Record Cash
              </button>
            </div>
          </div>
        ) : (
          /* ─── No UPI ID ─── */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-center">
              <p className="text-xs text-error font-medium">
                {settlement.name} hasn't added a UPI ID yet.
              </p>
            </div>
            <button
              onClick={() => onConfirm('Cash')}
              disabled={submitting}
              className="btn-primary w-full h-12 text-sm shadow-none rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Recording…
                </>
              ) : (
                'Record as Cash Payment'
              )}
            </button>
            <button
              onClick={() => onConfirm('GPay')}
              disabled={submitting}
              className="btn-secondary w-full h-10 text-xs text-primary border-primary/20 disabled:opacity-50"
            >
              Record pending GPay request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
