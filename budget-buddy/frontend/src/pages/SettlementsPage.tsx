import { useState, useMemo } from 'react';
import Layout from '../components/layout/Layout';
import { settlementsAPI } from '../api/services';
import { useRealtimeStore } from '../hooks/useRealtimeStore';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import { getUpiQrCodeUrl, launchUpiPayment } from '../utils/upi';
import type { Expense, User } from '../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Avatar({ name, size = 10, color = 'bg-primary-container text-primary' }: { name: string; size?: number; color?: string }) {
  return (
    <div
      className={`shrink-0 rounded-full ${color} flex items-center justify-center font-bold`}
      style={{ width: `${size * 4}px`, height: `${size * 4}px`, fontSize: `${size * 1.6}px` }}
    >
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatAmt(n: number) {
  return `₹${Math.abs(n).toLocaleString('en-IN')}`;
}

// ─── UPI Modal ────────────────────────────────────────────────────────────────
interface UpiModalProps {
  name: string;
  amount: number;
  upiId?: string;
  submitting: boolean;
  onConfirm: (method: string) => void;
  onClose: () => void;
}

function UpiModal({ name, amount, upiId, submitting, onConfirm, onClose }: UpiModalProps) {
  const [gpayOpened, setGpayOpened] = useState(false);

  const handlePayClick = (app: Parameters<typeof launchUpiPayment>[1]) => {
    const result = launchUpiPayment({ upiId: upiId!, name, amount }, app);
    setGpayOpened(true);
    if (result === 'copied') {
      toast.success(`UPI ID copied! Paste it in your ${app === 'gpay' ? 'GPay' : app === 'phonepe' ? 'PhonePe' : 'UPI'} app.`, { duration: 5000 });
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-sm glass-panel rounded-3xl p-6 space-y-5 shadow-2xl border border-outline-variant/20"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
          <h3 className="text-lg font-bold text-primary">Settle up</h3>
          <button onClick={onClose} disabled={submitting} className="p-1 rounded-full hover:bg-surface-variant/20 text-on-surface-variant">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Recipient + Amount */}
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={name} size={10} />
          <div>
            <p className="font-bold text-base text-primary">{name}</p>
            <p className="text-xs text-on-surface-variant/70">Outstanding balance</p>
          </div>
          <p className="text-3xl font-bold text-error mt-1">{formatAmt(amount)}</p>
        </div>

        {upiId ? (
          <div className="space-y-4">
            {/* UPI ID */}
            <div className="flex items-center justify-between p-3 bg-surface-container-low border border-outline-variant/20 rounded-xl">
              <span className="text-sm font-semibold text-primary truncate mr-2 select-all">{upiId}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(upiId); toast.success('UPI ID copied!'); }}
                className="shrink-0 flex items-center gap-1 bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">content_copy</span>Copy
              </button>
            </div>

            {/* Pay buttons */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'GPay', app: 'gpay' as const, cls: 'bg-primary text-on-primary' },
                { label: 'PhonePe', app: 'phonepe' as const, cls: 'bg-purple-700 text-white' },
                { label: 'BHIM', app: 'bhim' as const, cls: 'bg-orange-600 text-white' },
              ].map(({ label, app, cls }) => (
                <button
                  key={app}
                  type="button"
                  onClick={() => handlePayClick(app)}
                  className={`h-11 rounded-xl font-semibold text-xs flex items-center justify-center active:scale-95 transition-transform ${cls}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handlePayClick('generic')}
              className="w-full h-10 rounded-xl border border-outline-variant/30 text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              Other UPI App
            </button>

            {/* QR */}
            <div className="flex flex-col items-center p-3 bg-white rounded-2xl border border-outline-variant/10 shadow-inner">
              <img id="upi-qr-img" src={getUpiQrCodeUrl({ upiId, name, amount })} alt="UPI QR" className="w-32 h-32" />
              <p className="text-[10px] text-zinc-500 font-semibold mt-1">Scan with any UPI App</p>
              
              <button
                type="button"
                onClick={async () => {
                  const qrUrl = getUpiQrCodeUrl({ upiId, name, amount }, 400);
                  try {
                    const response = await fetch(qrUrl);
                    const blob = await response.blob();
                    const file = new File([blob], `UPI_QR_${name.replace(/\s+/g, '_')}.png`, { type: blob.type });

                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                      await navigator.share({
                        title: `Pay ${name}`,
                        text: `Scan QR to pay ₹${amount} to ${name} (${upiId})`,
                        files: [file],
                      });
                    } else if (navigator.share) {
                      await navigator.share({
                        title: `Pay ${name}`,
                        text: `Pay ₹${amount} to ${name} via UPI ID: ${upiId}`,
                        url: qrUrl,
                      });
                    } else {
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `UPI_QR_${name.replace(/\s+/g, '_')}.png`;
                      a.click();
                      toast.success('QR Code downloaded!');
                    }
                  } catch (e: any) {
                    if (e.name !== 'AbortError') {
                      toast.error('Could not share QR image');
                    }
                  }
                }}
                className="mt-2.5 flex items-center gap-1.5 bg-secondary/15 hover:bg-secondary/25 text-secondary text-xs font-bold px-4 py-1.5 rounded-full active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                Share QR Code
              </button>
            </div>

            {/* Confirm */}
            {gpayOpened ? (
              <button
                onClick={() => onConfirm('GPay')}
                disabled={submitting}
                className="btn-primary w-full h-11 text-sm shadow-none rounded-xl bg-secondary text-on-secondary disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Recording…</>
                  : <><span className="material-symbols-outlined text-[18px]">check_circle</span>I've Paid — Confirm</>}
              </button>
            ) : (
              <p className="text-xs text-center text-on-surface-variant/50 italic py-1">Tap a pay button first, then confirm here.</p>
            )}

            <div className="border-t border-outline-variant/10 pt-3 flex justify-between items-center text-xs">
              <span className="text-on-surface-variant/60">Paying cash instead?</span>
              <button onClick={() => onConfirm('Cash')} disabled={submitting} className="text-primary font-bold hover:underline disabled:opacity-50">
                Record Cash
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-error/10 border border-error/20 text-center">
              <p className="text-xs text-error font-medium">{name} hasn't added a UPI ID yet.</p>
            </div>
            <button
              onClick={() => onConfirm('Cash')}
              disabled={submitting}
              className="btn-primary w-full h-12 text-sm shadow-none rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Recording…</> : 'Record as Cash Payment'}
            </button>
            <button onClick={() => onConfirm('GPay')} disabled={submitting} className="btn-secondary w-full h-10 text-xs text-primary border-primary/20 disabled:opacity-50">
              Record pending UPI request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Friend Conversation View ─────────────────────────────────────────────────
interface FriendConvProps {
  friend: User;
  myId: string;
  rawExpenses: Expense[];
  pendingSettlements: any[];
  perUserBalance: number;
  onSettle: (amount: number, upiId?: string) => void;
  onApprove: (id: string) => void;
  onBack: () => void;
}

function FriendConversation({ friend, myId, rawExpenses, pendingSettlements, perUserBalance, onSettle, onApprove, onBack }: FriendConvProps) {
  // Shared expenses between me and this friend
  const sharedExpenses = useMemo(() => {
    return rawExpenses
      .filter(exp => {
        const involvedIds = [exp.paid_by, ...(exp.splits || []).map(s => s.user_id)];
        return !exp.group_id && involvedIds.includes(myId) && involvedIds.includes(friend.id);
      })
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime());
  }, [rawExpenses, myId, friend.id]);

  // Pending settlements between us
  const pendingBetweenUs = pendingSettlements.filter(
    s => (s.payer_id === myId && s.receiver_id === friend.id) || (s.payer_id === friend.id && s.receiver_id === myId)
  );

  const iOwe = perUserBalance < 0;
  const theyOwe = perUserBalance > 0;

  return (
    <div className="flex flex-col min-h-full">
      {/* Conversation header */}
      <div className="flex items-center gap-3 p-4 glass-panel border-b border-outline-variant/20">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high/50 transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <Avatar name={friend.name} size={9} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-primary truncate">{friend.name}</p>
          {perUserBalance !== 0 && (
            <p className={`text-xs font-semibold ${iOwe ? 'text-error' : 'text-secondary'}`}>
              {iOwe ? `You owe ${formatAmt(perUserBalance)}` : `Owes you ${formatAmt(perUserBalance)}`}
            </p>
          )}
        </div>
      </div>

      {/* Chat bubbles */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Pending settlements between us */}
        {pendingBetweenUs.map(s => {
          const isPayer = s.payer_id === myId;
          return (
            <div key={s.id} className={`flex ${isPayer ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl p-3 space-y-1.5 ${isPayer ? 'bg-amber-50 border border-amber-200 rounded-br-sm' : 'bg-green-50 border border-green-200 rounded-bl-sm'}`}>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px] text-amber-600">pending_actions</span>
                  <p className="text-xs font-bold text-amber-700">{isPayer ? 'Payment sent — awaiting confirm' : 'Payment received — confirm?'}</p>
                </div>
                <p className="text-base font-bold text-primary">{formatAmt(s.amount)}</p>
                <p className="text-[10px] text-on-surface-variant/60">{formatDate(s.created_at)} · {s.payment_method}</p>
                {!isPayer && (
                  <button
                    onClick={() => onApprove(s.id)}
                    className="btn-primary h-7 px-3 text-[11px] py-0 shadow-none rounded-lg bg-secondary text-on-secondary w-full mt-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Confirm
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Expense bubbles */}
        {sharedExpenses.length === 0 && pendingBetweenUs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">receipt_long</span>
            </div>
            <p className="text-sm text-on-surface-variant/60">No shared expenses yet</p>
          </div>
        ) : sharedExpenses.map(exp => {
          const iPaid = exp.paid_by === myId;
          const myShare = exp.splits?.find(s => s.user_id === myId)?.share_amount ?? 0;
          const theirShare = exp.splits?.find(s => s.user_id === friend.id)?.share_amount ?? 0;
          const displayShare = iPaid ? theirShare : myShare;

          return (
            <div key={exp.id} className={`flex ${iPaid ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[82%] rounded-2xl p-3 space-y-1 border ${
                  iPaid
                    ? 'bg-primary/8 border-primary/15 rounded-br-sm'
                    : 'bg-surface-container border-outline-variant/20 rounded-bl-sm'
                }`}
              >
                <p className="text-xs font-semibold text-on-surface-variant/80 truncate">{exp.title}</p>
                <p className="text-base font-bold text-primary">{formatAmt(exp.amount)}</p>
                {displayShare > 0 && (
                  <p className={`text-xs font-semibold ${iPaid ? 'text-secondary' : 'text-error'}`}>
                    {iPaid ? `${friend.name} owes ${formatAmt(displayShare)}` : `Your share: ${formatAmt(displayShare)}`}
                  </p>
                )}
                <p className="text-[10px] text-on-surface-variant/50">{formatDate(exp.expense_date)} · {iPaid ? 'You paid' : `${friend.name} paid`}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Settle footer */}
      {iOwe && pendingBetweenUs.filter(s => s.payer_id === myId).length === 0 && (
        <div className="p-4 border-t border-outline-variant/20 bg-white/80 backdrop-blur-md">
          <button
            onClick={() => onSettle(Math.abs(perUserBalance), friend.upi_id)}
            className="btn-primary w-full h-12 text-sm shadow-none rounded-xl flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">payments</span>
            Settle {formatAmt(perUserBalance)}
          </button>
        </div>
      )}
      {theyOwe && (
        <div className="p-4 border-t border-outline-variant/20 bg-surface/80 backdrop-blur-md">
          <p className="text-xs text-center text-on-surface-variant/60 italic">
            <span className="material-symbols-outlined text-[14px] align-middle">schedule</span>{' '}
            Waiting for {friend.name} to settle {formatAmt(perUserBalance)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Group Conversation View ──────────────────────────────────────────────────
interface GroupConvProps {
  group: any;
  myId: string;
  rawExpenses: Expense[];
  mySettlements: any[];
  allUsers: Record<string, User>;
  onSettle: (amount: number, toUserId: string, upiId?: string) => void;
  onBack: () => void;
}

function GroupConversation({ group, myId, rawExpenses, mySettlements, allUsers, onSettle, onBack }: GroupConvProps) {
  const groupExpenses = useMemo(() =>
    rawExpenses
      .filter(e => e.group_id === group.id)
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime()),
    [rawExpenses, group.id]
  );

  const pendingSettlements = mySettlements.filter(s => s.status === 'pending');

  const resolveName = (id: string) => {
    if (id === myId) return 'You';
    return allUsers[id]?.name || 'Unknown';
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 glass-panel border-b border-outline-variant/20">
        <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-high/50 transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-on-primary text-[18px]">group</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-primary truncate">{group.name}</p>
          <p className="text-xs text-on-surface-variant/60">{group.members?.length || 0} members</p>
        </div>
      </div>

      {/* Expense cards */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupExpenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">receipt_long</span>
            </div>
            <p className="text-sm text-on-surface-variant/60">No group expenses yet</p>
          </div>
        ) : (
          groupExpenses.map(exp => {
            const iPaid = exp.paid_by === myId;
            const mySpilt = exp.splits?.find(s => s.user_id === myId);
            const myShare = mySpilt?.share_amount ?? 0;

            // Check if my share is already pending/settled
            const alreadyPending = pendingSettlements.some(s =>
              s.payer_id === myId && s.receiver_id === exp.paid_by
            );

            return (
              <div key={exp.id} className="glass-panel rounded-2xl overflow-hidden">
                {/* Expense header */}
                <div className="flex items-center justify-between p-4 border-b border-outline-variant/10">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-on-surface-variant">receipt</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-primary truncate">{exp.title}</p>
                      <p className="text-xs text-on-surface-variant/70">{formatDate(exp.expense_date)} · paid by {resolveName(exp.paid_by)}</p>
                    </div>
                  </div>
                  <p className="font-bold text-base text-primary shrink-0 ml-2">{formatAmt(exp.amount)}</p>
                </div>

                {/* Splits */}
                <div className="p-3 space-y-2">
                  {(exp.splits || []).map(split => {
                    const isMe = split.user_id === myId;
                    const userName = resolveName(split.user_id);
                    return (
                      <div key={split.user_id} className="flex items-center justify-between text-xs">
                        <span className={`font-semibold ${isMe ? 'text-primary' : 'text-on-surface-variant'}`}>
                          {userName}
                        </span>
                        <span className={`font-bold ${isMe && !iPaid ? 'text-error' : iPaid && !isMe ? 'text-secondary' : 'text-on-surface-variant/60'}`}>
                          {formatAmt(split.share_amount)}
                          {isMe && !iPaid ? ' (you owe)' : iPaid && !isMe ? ' (owes you)' : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Per-expense settle button — GPay style */}
                {!iPaid && myShare > 0 && (
                  <div className="px-3 pb-3">
                    {alreadyPending ? (
                      <div className="h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px] text-amber-600">pending_actions</span>
                        <span className="text-xs text-amber-700 font-semibold">Payment pending confirmation</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const payeeUser = allUsers[exp.paid_by];
                          onSettle(myShare, exp.paid_by, payeeUser?.upi_id);
                        }}
                        className="btn-primary w-full h-9 text-xs shadow-none rounded-xl flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">payments</span>
                        Settle {formatAmt(myShare)}
                      </button>
                    )}
                  </div>
                )}
                {iPaid && (exp.splits || []).some(s => s.user_id !== myId) && (
                  <div className="px-3 pb-3">
                    <div className="h-9 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px] text-secondary">check_circle</span>
                      <span className="text-xs text-secondary font-semibold">You paid — awaiting others</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type View =
  | { kind: 'list' }
  | { kind: 'friend'; friendId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'pending' };

export default function SettlementsPage() {
  const { user } = useAuthStore();
  const {
    ready,
    mySettlements,
    perUserBalances,
    resolveName,
    users,
    rawExpenses,
    groups,
  } = useRealtimeStore(user?.id);

  const [view, setView] = useState<View>({ kind: 'list' });

  // ── UPI modal state ───────────────────────────────────────────────────────
  const [upiModal, setUpiModal] = useState<{ name: string; amount: number; upiId?: string; receiverId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  const pendingSettlements = mySettlements.filter(s => s.status === 'pending');
  const completedSettlements = mySettlements.filter(s => s.status === 'completed');

  // Friends with non-zero balances
  const friendBalances = useMemo(() => {
    return perUserBalances
      .filter(b => Math.abs(b.balance) > 0.01)
      .map(b => ({
        userId: b.user_id,
        name: resolveName(b.user_id),
        balance: b.balance,
        user: users[b.user_id],
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [perUserBalances, users, resolveName]);
  // Groups from the store — derive from expenses
  const groupSummaries = useMemo(() => {
    const grps: Record<string, { id: string; name: string; expenseCount: number; memberIds: Set<string>; lastDate: string }> = {};
    rawExpenses.forEach(e => {
      const gId = e.group_id;
      if (!gId) return;
      if (!grps[gId]) {
        // Look up actual group name from the groups node; fall back to ID only if not found
        const groupName = groups[gId]?.name || gId;
        grps[gId] = { id: gId, name: groupName, expenseCount: 0, memberIds: new Set(), lastDate: e.expense_date };
      }
      grps[gId].expenseCount++;
      grps[gId].memberIds.add(e.paid_by);
      (e.splits || []).forEach(s => grps[gId].memberIds.add(s.user_id));
      if (e.expense_date > grps[gId].lastDate) grps[gId].lastDate = e.expense_date;
    });
    return Object.values(grps).filter(g => g.memberIds.has(user?.id || ''));
  }, [rawExpenses, user?.id, groups]);

  // Pending confirmations count
  const pendingForMe = pendingSettlements.filter(s => s.receiver_id === user?.id);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openUpiModal = (name: string, amount: number, receiverId: string, upiId?: string) => {
    setUpiModal({ name, amount, upiId, receiverId });
    setSubmitting(false);
  };

  const handleSettle = async (method: string) => {
    if (!upiModal || submitting) return;
    setSubmitting(true);
    try {
      await settlementsAPI.create({
        receiver_id: upiModal.receiverId,
        amount: upiModal.amount,
        payment_method: method,
        status: 'pending',
      });
      toast.success(`Payment recorded! Awaiting confirmation.`, { duration: 4000 });
      setUpiModal(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (settlementId: string) => {
    try {
      await settlementsAPI.approve(settlementId);
      toast.success('Settlement confirmed! Balances updated.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to approve settlement');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!ready) {
    return (
      <Layout title="Settle Up">
        <div className="page-container space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton h-16 w-full rounded-2xl" />
          ))}
        </div>
      </Layout>
    );
  }

  // ── Views ─────────────────────────────────────────────────────────────────
  const currentFriendUser = view.kind === 'friend' ? users[view.friendId] : null;
  const currentFriendBalance = view.kind === 'friend'
    ? (perUserBalances.find(b => b.user_id === view.friendId)?.balance ?? 0)
    : 0;

  const currentGroup = view.kind === 'group'
    ? groupSummaries.find(g => g.id === view.groupId) ?? null
    : null;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Layout
      title={view.kind === 'list' ? 'Settle Up' : view.kind === 'pending' ? 'Confirmations' : undefined}
      hideBottomNav={view.kind !== 'list'}
    >
      {/* ── FRIEND CONVERSATION ── */}
      {view.kind === 'friend' && currentFriendUser && (
        <div className="flex flex-col min-h-screen">
          <FriendConversation
            friend={currentFriendUser}
            myId={user!.id}
            rawExpenses={rawExpenses}
            pendingSettlements={pendingSettlements}
            perUserBalance={currentFriendBalance}
            onSettle={(amt, upiId) => openUpiModal(currentFriendUser.name, amt, currentFriendUser.id, upiId)}
            onApprove={handleApprove}
            onBack={() => setView({ kind: 'list' })}
          />
        </div>
      )}

      {/* ── GROUP CONVERSATION ── */}
      {view.kind === 'group' && currentGroup && (
        <div className="flex flex-col min-h-screen">
          <GroupConversation
            group={currentGroup}
            myId={user!.id}
            rawExpenses={rawExpenses}
            mySettlements={mySettlements}
            allUsers={users}
            onSettle={(amt, receiverId, upiId) => openUpiModal(resolveName(receiverId), amt, receiverId, upiId)}
            onBack={() => setView({ kind: 'list' })}
          />
        </div>
      )}

      {/* ── PENDING CONFIRMATIONS VIEW ── */}
      {view.kind === 'pending' && (
        <div className="page-container page-enter space-y-3">
          <button onClick={() => setView({ kind: 'list' })} className="flex items-center gap-2 text-sm text-on-surface-variant mb-2">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
          </button>
          <h2 className="font-bold text-base text-primary">Pending Confirmations</h2>
          {pendingSettlements.length === 0 ? (
            <p className="text-center text-sm text-on-surface-variant/60 py-8 italic">No pending confirmations.</p>
          ) : (
            pendingSettlements.map(s => {
              const isPayer = s.payer_id === user?.id;
              const otherName = isPayer ? resolveName(s.receiver_id) : resolveName(s.payer_id);
              return (
                <div key={s.id} className="glass-panel rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-sm text-amber-600">pending_actions</span>
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-primary">{isPayer ? `You paid ${otherName}` : `${otherName} paid you`}</p>
                      <p className="text-xs text-on-surface-variant/70">{formatDate(s.created_at)} · {s.payment_method}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-sm text-primary">{formatAmt(s.amount)}</span>
                    {!isPayer && (
                      <button
                        onClick={() => handleApprove(s.id)}
                        className="btn-primary h-8 px-3 text-xs shadow-none rounded-lg bg-secondary text-on-secondary"
                      >
                        Confirm
                      </button>
                    )}
                    {isPayer && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                        Awaiting
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── MAIN LIST ── */}
      {view.kind === 'list' && (
        <div className="page-container page-enter">

          {/* Pending confirmation banner */}
          {pendingForMe.length > 0 && (
            <button
              onClick={() => setView({ kind: 'pending' })}
              className="w-full glass-panel rounded-2xl p-4 flex items-center justify-between border border-amber-200/60 bg-amber-50/60 active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm text-amber-600">notifications_active</span>
                </div>
                <div className="text-left">
                  <p className="font-bold text-sm text-amber-800">Payments to confirm</p>
                  <p className="text-xs text-amber-700/80">{pendingForMe.length} payment{pendingForMe.length > 1 ? 's' : ''} need your confirmation</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {pendingForMe.length}
                </span>
                <span className="material-symbols-outlined text-amber-600 text-[18px]">chevron_right</span>
              </div>
            </button>
          )}

          {/* All pending settlements link */}
          {pendingSettlements.length > 0 && (
            <button
              onClick={() => setView({ kind: 'pending' })}
              className="w-full text-left px-1 -mt-2"
            >
              <p className="text-xs text-on-surface-variant/60 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[12px] align-middle">circle</span>{' '}
                {pendingSettlements.length} settlement{pendingSettlements.length > 1 ? 's' : ''} pending · <span className="font-semibold text-primary">View all</span>
              </p>
            </button>
          )}

          {/* ── Friends with balances ── */}
          {friendBalances.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider px-1">Friends</h2>
              <div className="flex flex-col gap-0 glass-panel rounded-2xl overflow-hidden divide-y divide-outline-variant/10">
                {friendBalances.map((item) => {
                  const iOwe = item.balance < 0;
                  const hasPending = pendingSettlements.some(
                    s => s.payer_id === user?.id && s.receiver_id === item.userId
                  );
                  const pendingConfirmCount = pendingSettlements.filter(
                    s => s.payer_id === item.userId && s.receiver_id === user?.id
                  ).length;

                  return (
                    <button
                      key={item.userId}
                      onClick={() => setView({ kind: 'friend', friendId: item.userId })}
                      className="w-full flex items-center gap-3 p-4 hover:bg-surface-container/50 active:bg-surface-container transition-colors text-left"
                    >
                      <div className="relative">
                        <Avatar
                          name={item.name}
                          size={9}
                          color={iOwe ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}
                        />
                        {pendingConfirmCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {pendingConfirmCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-primary truncate">{item.name}</p>
                        <p className={`text-xs font-semibold ${iOwe ? 'text-error' : 'text-secondary'}`}>
                          {iOwe ? `You owe ${formatAmt(item.balance)}` : `Owes you ${formatAmt(item.balance)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasPending && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                            Pending
                          </span>
                        )}
                        <span className="material-symbols-outlined text-on-surface-variant/30 text-[18px]">chevron_right</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ── Groups ── */}
          {groupSummaries.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider px-1">Groups</h2>
              <div className="flex flex-col gap-0 glass-panel rounded-2xl overflow-hidden divide-y divide-outline-variant/10">
                {groupSummaries.map(group => {
                  // Count my unsettled shares in this group
                  const myUnsettledCount = rawExpenses.filter(e => {
                    if (e.group_id !== group.id) return false;
                    if (e.paid_by === user?.id) return false;
                    const mySpilt = (e.splits || []).find(s => s.user_id === user?.id);
                    return mySpilt && mySpilt.share_amount > 0;
                  }).length;

                  return (
                    <button
                      key={group.id}
                      onClick={() => setView({ kind: 'group', groupId: group.id })}
                      className="w-full flex items-center gap-3 p-4 hover:bg-surface-container/50 active:bg-surface-container transition-colors text-left"
                    >
                      <div className="relative">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-on-primary text-[18px]">group</span>
                        </div>
                        {myUnsettledCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-error text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                            {myUnsettledCount}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-primary truncate">{group.name}</p>
                        <p className="text-xs text-on-surface-variant/70">
                          {group.expenseCount} expense{group.expenseCount !== 1 ? 's' : ''} · {group.memberIds.size} members
                          {myUnsettledCount > 0 && <span className="text-error font-semibold"> · {myUnsettledCount} to settle</span>}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant/30 text-[18px]">chevron_right</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* All settled / empty state */}
          {friendBalances.length === 0 && groupSummaries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
              <div className="w-20 h-20 rounded-full bg-secondary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-secondary">check_circle</span>
              </div>
              <div>
                <p className="font-bold text-base text-primary">All settled up!</p>
                <p className="text-sm text-on-surface-variant/60 mt-1">No outstanding balances with anyone.</p>
              </div>
            </div>
          )}

          {/* Past settlements */}
          {completedSettlements.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-bold text-on-surface-variant/60 uppercase tracking-wider px-1">Past Settlements</h2>
              <div className="flex flex-col gap-0 glass-panel rounded-2xl overflow-hidden divide-y divide-outline-variant/10">
                {completedSettlements.slice(0, 5).map(s => {
                  const isPayer = s.payer_id === user?.id;
                  const otherName = isPayer ? resolveName(s.receiver_id) : resolveName(s.payer_id);
                  return (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
                          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">payments</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm text-primary">
                            {isPayer ? `You paid ${otherName}` : `${otherName} paid you`}
                          </p>
                          <p className="text-[10px] text-on-surface-variant/60">{formatDate(s.created_at)} · {s.payment_method}</p>
                        </div>
                      </div>
                      <span className={`font-bold text-sm ${isPayer ? 'text-error' : 'text-secondary'}`}>
                        {isPayer ? '-' : '+'}{formatAmt(s.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── UPI Modal ── */}
      {upiModal && (
        <UpiModal
          name={upiModal.name}
          amount={upiModal.amount}
          upiId={upiModal.upiId}
          submitting={submitting}
          onConfirm={handleSettle}
          onClose={() => setUpiModal(null)}
        />
      )}
    </Layout>
  );
}
