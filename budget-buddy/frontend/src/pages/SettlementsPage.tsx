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
  mobileNumber?: string;
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
  const [gpayOpened, setGpayOpened] = useState(false);
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
    // Fast path: get UPI and mobile from in-memory users map (already real-time)
    const upiId = users[friendId]?.upi_id || undefined;
    const mobileNumber = users[friendId]?.mobile_number || undefined;
    setActiveSettlement({ friendId, name, amount, upiId, mobileNumber });
    setGpayOpened(false);
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
      setGpayOpened(false);
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
  const getUpiParams = (a: ActiveSettlement, overrideUpiId?: string) => {
    const upiId = overrideUpiId || a.mobileNumber || a.upiId;
    if (!upiId) return '';
    return `pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(a.name.trim())}`;
  };
  const getUpiLink    = (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId);
    return params ? `upi://pay?${params}` : '';
  };
  const getGpayLink   = (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId);
    return params ? `tez://upi/pay?${params}` : '';
  };
  const getPhonePeLink= (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId);
    return params ? `phonepe://pay?${params}` : '';
  };
  const getPaytmLink  = (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId);
    return params ? `paytmmp://pay?${params}` : '';
  };
  const getGpayMobileLink = (a: ActiveSettlement, overrideUpiId?: string) => {
    const params = getUpiParams(a, overrideUpiId);
    return params ? `https://pay.google.com/gp/p/ui/pay?${params}` : '';
  };
  const getQrUrl = (a: ActiveSettlement, overrideUpiId?: string) => {
    const link = getUpiLink(a, overrideUpiId);
    return link ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(link)}` : '';
  };

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
    <Layout showBack title="Settle Up" hideBottomNav>
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
          gpayOpened={gpayOpened}
          onGpayOpen={() => setGpayOpened(true)}
          onConfirm={method => handleSettleUp(activeSettlement.friendId, activeSettlement.amount, method, 'pending')}
          onClose={() => { setActiveSettlement(null); setGpayOpened(false); setSubmitting(false); }}
          getUpiLink={getUpiLink}
          getGpayLink={getGpayLink}
          getPhonePeLink={getPhonePeLink}
          getPaytmLink={getPaytmLink}
          getGpayMobileLink={getGpayMobileLink}
          getQrUrl={getQrUrl}
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
  getUpiLink:     (a: ActiveSettlement, overrideUpiId?: string) => string;
  getGpayLink:    (a: ActiveSettlement, overrideUpiId?: string) => string;
  getPhonePeLink: (a: ActiveSettlement, overrideUpiId?: string) => string;
  getPaytmLink:   (a: ActiveSettlement, overrideUpiId?: string) => string;
  getGpayMobileLink: (a: ActiveSettlement, overrideUpiId?: string) => string;
  getQrUrl:       (a: ActiveSettlement, overrideUpiId?: string) => string;
}

function SettlementModal({ settlement, submitting, gpayOpened, onGpayOpen, onConfirm, onClose, getUpiLink, getGpayLink, getPhonePeLink, getPaytmLink, getGpayMobileLink, getQrUrl }: ModalProps) {
  const [customUpiInput, setCustomUpiInput] = useState('');
  const [customUpiSuffix, setCustomUpiSuffix] = useState('@okaxis');

  const isMobileNumber = /^\d{10}$/.test(customUpiInput.trim());
  const effectiveUpiId = settlement.mobileNumber || settlement.upiId || (customUpiInput.trim() ? (isMobileNumber ? `${customUpiInput.trim()}${customUpiSuffix}` : customUpiInput.trim()) : undefined);

  const upiLink     = getUpiLink(settlement, effectiveUpiId);
  const gpayLink    = getGpayLink(settlement, effectiveUpiId);
  const phonePeLink = getPhonePeLink(settlement, effectiveUpiId);
  const paytmLink   = getPaytmLink(settlement, effectiveUpiId);
  const gpayMobileLink = getGpayMobileLink(settlement, effectiveUpiId);
  const qrCodeUrl   = getQrUrl(settlement, effectiveUpiId);

  const [linkCopied, setLinkCopied] = useState(false);
  const [gpayLinkCopied, setGpayLinkCopied] = useState(false);
  const [sharingQr, setSharingQr] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(upiLink);
      setLinkCopied(true);
      toast.success('UPI payment link copied!');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: upiLink });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyGpayLink = async () => {
    try {
      await navigator.clipboard.writeText(gpayMobileLink);
      setGpayLinkCopied(true);
      toast.success('GPay mobile link copied!');
      setTimeout(() => setGpayLinkCopied(false), 3000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShareGpayLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: gpayMobileLink });
      } catch {
        // User cancelled share
      }
    } else {
      handleCopyGpayLink();
    }
  };

  const handleShareQr = async () => {
    if (!qrCodeUrl) return;
    setSharingQr(true);
    try {
      const response = await fetch(qrCodeUrl);
      const blob = await response.blob();
      const file = new File([blob], 'payment-qr.png', { type: 'image/png' });
      
      const shareData = {
        files: [file],
        title: 'UPI Payment QR',
        text: `Scan to pay ₹${settlement.amount} to ${settlement.name}`,
      };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback: download the file
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${settlement.name}_payment_qr.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('QR Code downloaded!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to share or download QR Code');
    } finally {
      setSharingQr(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 shadow-2xl border border-outline-variant/20">
        <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
          <h3 className="text-lg font-bold text-primary">Settle up</h3>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant disabled:opacity-50">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

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

        {/* If the friend has no UPI and no mobile number, show the custom input field at the top */}
        {!settlement.upiId && !settlement.mobileNumber && (
          <div className="space-y-3 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10">
            <p className="text-xs font-semibold text-on-surface-variant/80 uppercase">
              {settlement.name} hasn't added payment details
            </p>
            <p className="text-xs text-on-surface-variant/60">
              Enter their UPI ID or Mobile Number to enable GPay / UPI payments:
            </p>
            <input
              type="text"
              placeholder="e.g. 9876543210 or name@okaxis"
              value={customUpiInput}
              onChange={(e) => setCustomUpiInput(e.target.value)}
              className="w-full h-11 text-sm rounded-xl px-3 border border-outline-variant/20 focus:border-primary/50 bg-surface-variant/10 focus:outline-none"
            />

            {/* If they typed a 10-digit number, show the app (suffix) selector */}
            {isMobileNumber && (
              <div className="space-y-1.5 pt-2 border-t border-outline-variant/10">
                <p className="text-[10px] font-bold text-on-surface-variant/50 uppercase">Select their UPI application:</p>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => setCustomUpiSuffix('@okaxis')}
                    className={`h-8 text-[10px] font-bold rounded-lg border transition-all ${customUpiSuffix === '@okaxis' ? 'bg-[#1a73e8]/10 border-[#1a73e8] text-[#1a73e8]' : 'border-outline-variant/20 text-on-surface-variant/70'}`}
                  >
                    GPay (@okaxis)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomUpiSuffix('@ybl')}
                    className={`h-8 text-[10px] font-bold rounded-lg border transition-all ${customUpiSuffix === '@ybl' ? 'bg-[#5f259f]/10 border-[#5f259f] text-[#5f259f]' : 'border-outline-variant/20 text-on-surface-variant/70'}`}
                  >
                    PhonePe (@ybl)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomUpiSuffix('@paytm')}
                    className={`h-8 text-[10px] font-bold rounded-lg border transition-all ${customUpiSuffix === '@paytm' ? 'bg-[#00BAF2]/10 border-[#00BAF2] text-[#00BAF2]' : 'border-outline-variant/20 text-on-surface-variant/70'}`}
                  >
                    Paytm (@paytm)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {effectiveUpiId ? (
          <div className="space-y-4">
            {/* UPI ID / Mobile Number display + copy */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">
                {/^\d{10}$/.test(effectiveUpiId) ? 'Mobile Number' : 'UPI ID'}
              </p>
              <div className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl">
                <span className="text-sm font-semibold text-primary truncate mr-2 select-all">{effectiveUpiId}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(effectiveUpiId || '');
                    toast.success(`${/^\d{10}$/.test(effectiveUpiId) ? 'Mobile Number' : 'UPI ID'} copied!`);
                  }}
                  className="shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  Copy
                </button>
              </div>
            </div>

            {/* Step 1 — Pay */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Step 1 — Choose your UPI app</p>
              <div className="grid grid-cols-3 gap-2">
                {/* Google Pay */}
                <button
                  onClick={() => { window.location.href = gpayLink; onGpayOpen(); }}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border-2 border-[#1a73e8]/30 bg-[#1a73e8]/5 hover:bg-[#1a73e8]/10 active:scale-95 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-[10px] font-bold text-[#1a73e8]">GPay</span>
                </button>
                {/* PhonePe */}
                <button
                  onClick={() => { window.location.href = phonePeLink; onGpayOpen(); }}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border-2 border-[#5f259f]/30 bg-[#5f259f]/5 hover:bg-[#5f259f]/10 active:scale-95 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#5f259f">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.5h-2v-5H9.5v-2H11V8h2v1.5h1.5c1.1 0 2 .9 2 2s-.9 2-2 2H13v3z"/>
                  </svg>
                  <span className="text-[10px] font-bold text-[#5f259f]">PhonePe</span>
                </button>
                {/* Paytm */}
                <button
                  onClick={() => { window.location.href = paytmLink; onGpayOpen(); }}
                  className="flex flex-col items-center justify-center gap-1.5 h-16 rounded-2xl border-2 border-[#00BAF2]/30 bg-[#00BAF2]/5 hover:bg-[#00BAF2]/10 active:scale-95 transition-all"
                >
                  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#00BAF2">
                    <path d="M3 3h18v18H3V3zm9 3a6 6 0 100 12A6 6 0 0012 6zm0 2a4 4 0 110 8 4 4 0 010-8z"/>
                  </svg>
                  <span className="text-[10px] font-bold text-[#00BAF2]">Paytm</span>
                </button>
              </div>
              {/* Generic UPI fallback */}
              <button
                onClick={() => { window.location.href = upiLink; onGpayOpen(); }}
                className="w-full h-9 flex items-center justify-center gap-2 text-xs font-semibold text-on-surface-variant/70 border border-outline-variant/30 rounded-xl hover:bg-surface-variant/20 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">payments</span>
                Other UPI App
              </button>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center p-3 bg-white rounded-2xl border border-outline-variant/10 shadow-inner space-y-2">
              <div 
                onClick={() => { window.location.href = upiLink; onGpayOpen(); }}
                className="cursor-pointer hover:opacity-90 active:scale-[0.98] transition-all relative group"
                title="Tap to pay directly in app"
              >
                <img src={qrCodeUrl} alt="UPI QR Code" className="w-36 h-36" />
                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 rounded-2xl flex items-center justify-center transition-opacity">
                  <span className="material-symbols-outlined text-white text-3xl drop-shadow">open_in_new</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 font-semibold text-center">Scan QR or tap it to open payment app</p>
              <button
                onClick={handleShareQr}
                disabled={sharingQr}
                className="h-8 flex items-center justify-center gap-1.5 px-3 rounded-lg border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/5 active:scale-95 transition-all w-full"
              >
                <span className="material-symbols-outlined text-[15px]">{sharingQr ? 'sync' : 'share'}</span>
                {sharingQr ? 'Preparing...' : 'Share QR Code'}
              </button>
            </div>

            {/* Generate & Share Link */}
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wide">Or share UPI payment link</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyLink}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">{linkCopied ? 'check' : 'content_copy'}</span>
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  onClick={handleShareLink}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[15px]">share</span>
                  Share
                </button>
              </div>
            </div>

            {/* Share GPay Mobile Link */}
            <div className="rounded-xl bg-surface-container-low border border-outline-variant/10 p-3 space-y-2">
              <p className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wide">Or share GPay mobile link</p>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyGpayLink}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg border border-[#1a73e8]/30 text-[#1a73e8] text-xs font-semibold hover:bg-[#1a73e8]/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">{gpayLinkCopied ? 'check' : 'content_copy'}</span>
                  {gpayLinkCopied ? 'Copied!' : 'Copy GPay Link'}
                </button>
                <button
                  onClick={handleShareGpayLink}
                  className="flex-1 h-9 flex items-center justify-center gap-1.5 rounded-lg bg-[#1a73e8] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[15px]">share</span>
                  Share GPay
                </button>
              </div>
            </div>

            {/* Step 2 — Confirm */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-on-surface-variant/60 uppercase tracking-wide">Step 2 — Confirm after paying</p>
              {gpayOpened ? (
                <button
                  onClick={() => onConfirm('GPay')}
                  disabled={submitting}
                  className="btn-primary w-full h-11 text-sm shadow-none rounded-xl bg-secondary text-on-secondary disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Recording…</>
                  ) : (
                    <><span className="material-symbols-outlined text-[18px]">check_circle</span> I've Paid — Confirm</>
                  )}
                </button>
              ) : (
                <p className="text-xs text-center text-on-surface-variant/50 italic py-2">
                  Tap "Open Google Pay" first, then confirm here.
                </p>
              )}
            </div>

            <div className="border-t border-outline-variant/10 pt-3 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant/60">Paying cash instead?</span>
              <button onClick={() => onConfirm('Cash')} disabled={submitting} className="text-primary font-bold hover:underline disabled:opacity-50">
                Record Cash
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
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
