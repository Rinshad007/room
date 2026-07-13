/**
 * useRealtimeStore
 * ─────────────────────────────────────────────────────────────────────────────
 * Single Firebase onValue listener that pushes live data to all subscribers.
 * Components call useRealtimeStore() and get instantly-fresh data whenever
 * Firebase emits a change — no polling, no manual reload needed.
 *
 * Architecture:
 *   • One onValue listener per node (expenses, settlements, friendships, users)
 *   • Computed balances recalculate whenever raw data changes
 *   • All components read from this shared store — zero redundant fetches
 *
 * BUG-001/BUG-007 fixes:
 *   • Firebase off() unsubscribe functions are stored and called on logout
 *   • _subscribed is reset to false in resetRealtimeStore() so the next
 *     user gets a clean listener set (prevents stale data cross-contamination)
 */

import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { db } from '../firebase';
import type { Expense, Settlement, User, FriendWithRequest } from '../types';

// ─── Raw store state ──────────────────────────────────────────────────────────
interface StoreState {
  expenses: Expense[];
  settlements: Settlement[];
  users: Record<string, User>;
  friendships: any[];
  ready: boolean;          // true once all four nodes have fired at least once
}

// ─── Per-user computed view ───────────────────────────────────────────────────
export interface UserBalance {
  user_id: string;
  balance: number;       // positive = they owe me, negative = I owe them
}

export interface BalanceSummary {
  total_payable: number;
  total_receivable: number;
  net_balance: number;
}

// ─── Load initial state from Cache (Stale-While-Revalidate) ───────────────────
const getCachedState = (): StoreState => {
  try {
    const cached = localStorage.getItem('bb_realtime_cache');
    if (cached) {
      const parsed = JSON.parse(cached);
      return {
        expenses: parsed.expenses || [],
        settlements: parsed.settlements || [],
        users: parsed.users || {},
        friendships: parsed.friendships || [],
        ready: true, // instantly ready from cache!
      };
    }
  } catch (e) {
    console.error('Failed to parse cached store state:', e);
  }
  return {
    expenses: [],
    settlements: [],
    users: {},
    friendships: [],
    ready: false,
  };
};

const saveCache = (state: StoreState) => {
  try {
    localStorage.setItem('bb_realtime_cache', JSON.stringify({
      expenses: state.expenses,
      settlements: state.settlements,
      users: state.users,
      friendships: state.friendships,
    }));
  } catch (e) {
    console.error('Failed to save store cache:', e);
  }
};

// ─── Singleton raw data (shared across all hook instances) ────────────────────
let _state: StoreState = getCachedState();
let _listeners = new Set<() => void>();
let _subscribed = false;

// BUG-001 fix: Track Firebase database refs so we can call off() on logout
const _dbRefs: Array<ReturnType<typeof ref>> = [];

function notify() {
  _listeners.forEach(l => l());
}

// ─── Compute user balances from raw data ──────────────────────────────────────
function computeBalances(userId: string, state: StoreState): {
  summary: BalanceSummary;
  perUser: UserBalance[];
  friends: FriendWithRequest[];
} {
  const net: Record<string, number> = {};

  // Expenses: others owe you (you paid) / you owe others (you're split)
  for (const exp of state.expenses) {
    if (exp.paid_by === userId) {
      for (const s of exp.splits || []) {
        if (s.user_id !== userId) {
          net[s.user_id] = (net[s.user_id] || 0) + s.share_amount;
        }
      }
    } else {
      const mySplit = (exp.splits || []).find(s => s.user_id === userId);
      if (mySplit && mySplit.status === 'accepted') {
        net[exp.paid_by] = (net[exp.paid_by] || 0) - mySplit.share_amount;
      }
    }
  }

  // Settlements (both pending & completed reduce the balance)
  for (const s of state.settlements) {
    if (s.status !== 'pending' && s.status !== 'completed') continue;
    if (s.payer_id === userId) {
      net[s.receiver_id] = (net[s.receiver_id] || 0) + s.amount;
    } else if (s.receiver_id === userId) {
      net[s.payer_id] = (net[s.payer_id] || 0) - s.amount;
    }
  }

  const perUser: UserBalance[] = Object.entries(net)
    .map(([uid, bal]) => ({ user_id: uid, balance: Math.round(bal * 100) / 100 }))
    .filter(b => Math.abs(b.balance) > 0.01);

  let totalPayable = 0;
  let totalReceivable = 0;
  for (const b of perUser) {
    if (b.balance < 0) totalPayable += Math.abs(b.balance);
    else totalReceivable += b.balance;
  }

  const summary: BalanceSummary = {
    total_payable: Math.round(totalPayable * 100) / 100,
    total_receivable: Math.round(totalReceivable * 100) / 100,
    net_balance: Math.round((totalReceivable - totalPayable) * 100) / 100,
  };

  // Build friends list from accepted friendships
  const friends: FriendWithRequest[] = [];
  for (const f of state.friendships) {
    if (f.status !== 'accepted') continue;
    const friendId = f.sender_id === userId ? f.receiver_id : f.sender_id;
    if (f.sender_id !== userId && f.receiver_id !== userId) continue;
    const friendUser = state.users[friendId];
    if (friendUser) {
      friends.push({
        friendship_id: f.id,
        friend: friendUser,
        status: f.status,
        created_at: f.created_at,
      });
    }
  }

  return { summary, perUser, friends };
}

// ─── Start Firebase listeners once ───────────────────────────────────────────
function startListeners() {
  if (_subscribed) return;
  _subscribed = true;

  const loadedNodes = new Set<string>();
  const checkReady = (nodeName: string) => {
    loadedNodes.add(nodeName);
    if (loadedNodes.size >= 4 && !_state.ready) {
      _state = { ..._state, ready: true };
      notify();
    }
    if (_state.ready) {
      saveCache(_state);
    }
  };

  // BUG-001 fix: store refs so we can call off() when logging out
  const expensesRef = ref(db, 'expenses');
  const settlementsRef = ref(db, 'settlements');
  const usersRef = ref(db, 'users');
  const friendshipsRef = ref(db, 'friendships');
  _dbRefs.push(expensesRef, settlementsRef, usersRef, friendshipsRef);

  // Expenses
  onValue(expensesRef, snap => {
    _state = {
      ..._state,
      expenses: snap.exists() ? Object.values(snap.val()) as Expense[] : [],
    };
    checkReady('expenses');
    notify();
  });

  // Settlements
  onValue(settlementsRef, snap => {
    _state = {
      ..._state,
      settlements: snap.exists() ? Object.values(snap.val()) as Settlement[] : [],
    };
    checkReady('settlements');
    notify();
  });

  // Users
  onValue(usersRef, snap => {
    _state = {
      ..._state,
      users: snap.exists() ? (snap.val() as Record<string, User>) : {},
    };
    checkReady('users');
    notify();
  });

  // Friendships
  onValue(friendshipsRef, snap => {
    _state = {
      ..._state,
      friendships: snap.exists() ? Object.values(snap.val()) : [],
    };
    checkReady('friendships');
    notify();
  });
}

// ─── React hook ──────────────────────────────────────────────────────────────
export function useRealtimeStore(userId?: string) {
  const [, setTick] = useState(0); // force re-render on store update

  useEffect(() => {
    startListeners();

    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  const state = _state;

  // User-specific derived data
  const derived = userId ? computeBalances(userId, state) : null;

  // My expenses (paid by me or I'm a split participant)
  const myExpenses = userId
    ? state.expenses.filter(
        e => e.paid_by === userId || (e.splits || []).some(s => s.user_id === userId)
      ).sort((a, b) => b.expense_date.localeCompare(a.expense_date))
    : [];

  // My settlements
  const mySettlements = userId
    ? [...state.settlements]
        .filter(s => s.payer_id === userId || s.receiver_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

  // Resolve a user's display name
  const resolveName = (id: string): string => {
    if (id === userId) return 'You';
    const u = state.users[id];
    return u?.name || 'Unknown';
  };

  return {
    ready: state.ready,
    rawExpenses: state.expenses,
    rawSettlements: state.settlements,
    users: state.users,
    friendships: state.friendships,
    // Computed
    myExpenses,
    mySettlements,
    summary: derived?.summary ?? null,
    perUserBalances: derived?.perUser ?? [],
    friends: derived?.friends ?? [],
    resolveName,
  };
}

// ─── Clear cache and unsubscribe all listeners on logout ─────────────────────
export function resetRealtimeStore() {
  // BUG-001 fix: detach all Firebase onValue listeners to prevent memory leaks
  _dbRefs.forEach(dbRef => { try { off(dbRef); } catch {} });
  _dbRefs.length = 0;

  // BUG-007 fix: reset _subscribed so startListeners() runs fresh for the next
  // user and they don't see the previous user's stale cached data
  _subscribed = false;

  try {
    localStorage.removeItem('bb_realtime_cache');
  } catch {}

  _state = {
    expenses: [],
    settlements: [],
    users: {},
    friendships: [],
    ready: false,
  };
  notify();
}
