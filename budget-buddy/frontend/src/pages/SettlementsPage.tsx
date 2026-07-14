import { useState, useRef } from 'react';
import Layout from '../components/layout/Layout';
import { settlementsAPI } from '../api/services';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────
interface ActiveSettlement {
  friendId: string;
  name: string;
  amount: number;
  upiId?: string;
  upiLoading?: boolean;
}

export default function SettlementsPage() {
  const { user } = useAuthStore();

  // ── Real-time data ────────────────────────────────────────────────────────
  const {
    ready,
    mySettlements,
    perUserBalances,
    resolveName,
    users,
  } = useRealtimeStore(user?.id);

  // ── Modal state ───────────────────────────────────────────────────────────
  const [activeSettlement, setActiveSettlement] = useState<ActiveSettlement | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pendingRef = useRef<HTMLElement>(null);

  // ── Derived: pending / completed / balances ───────────────────────────────
  const pendingSettlements = mySettlements.filter(s => s.status === 'pending');
  const completedSettlements = mySettlements.filter(s => s.status === 'completed');

  // Set of receiver IDs where I already have a pending settlement (blocks re-settle)
  const pendingByMe = new Set(
    pendingSettlements.filter(s => s.payer_id === user?.id).map(s => s.receiver_id)
  );

  const toSettleList = perUserBalances
    .filter(b => b.balance < 0)
    .map(b => ({ friendId: b.user_id, name: resolveName(b.user_id), balance: b.balance }));

  const owedToYouList = perUserBalances
    .filter(b => b.balance > 0)
    .map(b => ({ friendId: b.user_id, name: resolveName(b.user_id), balance: b.balance }));

  // ── Open modal ────────────────────────────────────────────────────────────
  const openSettlementModal = (friendId: string, name: string, amount: number) => {
    // Fast path: get UPI from in-memory users map (already real-time)
    const upiId = users[friendId]?.upi_id || undefined;
    setActiveSettlement({ friendId, name, amount, upiId });
    setSubmitting(false);
  };

  // ── Settle ────────────────────────────────────────────────────────────────
  const handleSettleUp = async (
    friendId: string,
    amount: number,
    paymentMethod = 'GPay',
    status: 'pending' | 'completed' = 'pending'
  ) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await settlementsAPI.create({ receiver_id: friendId, amount, payment_method: paymentMethod, status });
      const friendName = activeSettlement?.name || resolveName(friendId);
      toast.success(`Payment recorded! Awaiting ${friendName}'s confirmation.`, { duration: 4000 });
      setActiveSettlement(null);
      // Data auto-updates via onValue listener — no manual reload needed
      setTimeout(() => pendingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async (settlementId: string) => {
    try {
      await settlementsAPI.approve(settlementId);
      toast.success('Settlement confirmed! Balances updated.');
      // Real-time update handles UI refresh automatically
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve settlement');
    }
  };

  // ── UPI helpers ───────────────────────────────────────────────────────────
  const getUpiLink = (a: ActiveSettlement) => {
    if (!a.upiId) return '';
    const formattedAmount = Number(a.amount).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(a.upiId.trim())}&pn=${encodeURIComponent(a.name.trim())}&am=${formattedAmount}&cu=INR&tn=${encodeURIComponent('BudgetBuddy Settlement')}`;
  };
  const getUpiAppIntentLink = (a: ActiveSettlement) => {
    if (!a.upiId) return '';
    return `upi://pay?pa=${encodeURIComponent(a.upiId.trim())}&pn=${encodeURIComponent(a.name.trim())}&cu=INR&tn=${encodeURIComponent('BudgetBuddy Settlement')}`;
  };
  const getQrUrl = (a: ActiveSettlement) =>
    a.upiId
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getUpiLink(a))}`
      : '';

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (!ready) {
    return (
      <Layout>
        <div className="page-container space-y-4">
          <div className="skeleton h-12 w-full" />
          <div className="skeleton h-32 w-full" />
          <div className="skeleton h-48 w-full" />
        </div>
      </Layout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout title="Settle Up" hideBottomNav={!!activeSettlement}>
      <div className="page-container page-enter pb-24 space-y-6">


        {/* ── Balance Cards ───────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* You owe */}
          <section className="glass-panel rounded-2xl p-5 space-y-4">
            <h2 className="text-monetary-md text-primary font-bold">Balances to Settle</h2>
            {toSettleList.length === 0 ? (
              <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
                No outstanding balances. 🎉
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {toSettleList.map(item => {
                  const isPending = pendingByMe.has(item.friendId);
                  return (
                    <div key={item.friendId} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-sm">
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

          {/* Owed to you */}
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
                      <div className="w-9 h-9 shrink-0 rounded-full bg-secondary-container text-secondary flex items-center justify-center font-bold text-sm">
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

        {/* ── Pending Confirmation ────────────────────────────────────── */}
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
              {pendingSettlements.map(settlement => {
                const isPayer = settlement.payer_id === user?.id;
                const otherName = isPayer ? resolveName(settlement.receiver_id) : resolveName(settlement.payer_id);
                return (
                  <div key={settlement.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200/60">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                        <span className="material-symbols-outlined text-sm">pending_actions</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherName}` : `${otherName} paid you`}
                        </p>
                        <p className="text-xs text-on-surface-variant/80">
                          {new Date(settlement.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} • {settlement.payment_method}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm text-primary">₹{settlement.amount.toLocaleString('en-IN')}</span>
                      {!isPayer ? (
                        <button
                          onClick={() => handleApprove(settlement.id)}
                          className="btn-primary h-8 px-3 text-xs py-0 shadow-none rounded-lg bg-secondary text-on-secondary"
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

        {/* ── Past Settlements ────────────────────────────────────────── */}
        <section className="glass-panel rounded-2xl p-5 space-y-4">
          <h2 className="text-monetary-md text-on-surface-variant font-semibold">Past Settlements</h2>
          {completedSettlements.length === 0 ? (
            <p className="py-4 text-center text-body-md text-on-surface-variant/60 italic">
              No completed settlements yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {completedSettlements.map(settlement => {
                const isPayer = settlement.payer_id === user?.id;
                const otherName = isPayer ? resolveName(settlement.receiver_id) : resolveName(settlement.payer_id);
                return (
                  <div key={settlement.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 shrink-0 rounded-full bg-surface-container flex items-center justify-center text-primary">
                        <span className="material-symbols-outlined text-sm">payments</span>
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-primary">
                          {isPayer ? `You paid ${otherName}` : `${otherName} paid you`}
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

      </div>

      {/* ── Settlement Modal ─────────────────────────────────────────────── */}
      {activeSettlement && (
        <SettlementModal
          settlement={activeSettlement}
          submitting={submitting}
          onConfirm={method => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, method, 'pending')}
          onClose={() => { setActiveSettlement(null); setSubmitting(false); }}
          getQrUrl={getQrUrl}
          getUpiLink={getUpiAppIntentLink}
        />
      )}
    </Layout>
  );
}

// ─── Modal component ──────────────────────────────────────────────────────────
interface ModalProps {
  settlement: ActiveSettlement;
  submitting: boolean;
  gpayOpened: boolean;
  onGpayOpen: () => void;
  onConfirm: (method: string) => void;
  onClose: () => void;
  getUpiLink: (a: ActiveSettlement) => string;
  getQrUrl: (a: ActiveSettlement) => string;
}

function SettlementModal({ settlement, submitting, onConfirm, onClose, getQrUrl, getUpiLink }: Omit<ModalProps, 'gpayOpened' | 'onGpayOpen'>) {
  const qrCodeUrl = getQrUrl(settlement);
  const upiLink = getUpiLink(settlement);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-4 shadow-2xl border border-outline-variant/20 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
          <h3 className="text-lg font-bold text-primary">Settle up</h3>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col items-center text-center gap-1.5">
          <div className="w-14 h-14 rounded-full bg-primary-container text-primary flex items-center justify-center font-bold text-2xl shadow-sm">
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

        {settlement.upiId ? (
          <div className="space-y-3">

            {/* ── Primary: QR Code — works on ALL UPI apps without alerts ── */}
            <div className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-2xl border-2 border-primary/30 shadow-inner">
              <p className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">qr_code_2</span>
                Scan QR to Pay (Recommended)
              </p>
              <img src={qrCodeUrl} alt="UPI QR Code" className="w-44 h-44" />
              <p className="text-[10px] text-zinc-500 font-semibold">Works with GPay · PhonePe · Paytm · BHIM · any UPI app</p>
            </div>

            {/* ── Copy UPI ID ── */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Or enter UPI ID manually</p>
              <div className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl">
                <span className="text-sm font-semibold text-primary truncate mr-2 select-all">{settlement.upiId}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(settlement.upiId || '');
                    toast.success('UPI ID copied!');
                  }}
                  className="shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy
                </button>
              </div>
            </div>

            {/* ── Option to launch UPI App (for mobile browsers) ── */}
            <div className="space-y-1">
              <a
                href={upiLink}
                rel="noreferrer noopener"
                referrerPolicy="no-referrer"
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl border border-outline-variant/30 text-on-surface-variant text-xs font-semibold hover:bg-surface-variant/10 active:scale-95 transition-all cursor-pointer"
                style={{ textDecoration: 'none' }}
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open UPI App directly
              </a>
            </div>

            {/* ── Confirm ── */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">After paying, tap confirm</p>
              <button
                onClick={() => onConfirm('GPay')}
                disabled={submitting}
                className="btn-primary w-full h-11 text-sm shadow-none rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording…</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">check_circle</span> I've Paid — Confirm</>
                )}
              </button>
            </div>

            <div className="border-t border-outline-variant/10 pt-2 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant/60">Paying cash instead?</span>
              <button onClick={() => onConfirm('Cash')} disabled={submitting} className="text-primary font-bold hover:underline disabled:opacity-50">
                Record Cash
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-center">
              <p className="text-xs text-error font-medium">{settlement.name} hasn't added a UPI ID yet.</p>
            </div>
            <button
              onClick={() => onConfirm('Cash')}
              disabled={submitting}
              className="btn-primary w-full h-12 text-sm shadow-none rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording…</> : 'Record as Cash Payment'}
            </button>
            <button onClick={() => onConfirm('GPay')} disabled={submitting} className="btn-secondary w-full h-10 text-xs text-primary border-primary/20 disabled:opacity-50">
              Record pending GPay request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
