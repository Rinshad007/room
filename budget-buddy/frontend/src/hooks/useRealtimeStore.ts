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

// ─── Singleton raw data (shared across all hook instances) ────────────────────
let _state: StoreState = {
  expenses: [],
  settlements: [],
  users: {},
  friendships: [],
  ready: false,
};
let _listeners = new Set<() => void>();
let _subscribed = false;

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

  let readyCount = 0;
  const checkReady = () => {
    readyCount++;
    if (readyCount >= 4 && !_state.ready) {
      _state = { ..._state, ready: true };
      notify();
    }
  };

  // Expenses
  onValue(ref(db, 'expenses'), snap => {
    _state = {
      ..._state,
      expenses: snap.exists() ? Object.values(snap.val()) as Expense[] : [],
    };
    checkReady();
    notify();
  });

  // Settlements
  onValue(ref(db, 'settlements'), snap => {
    _state = {
      ..._state,
      settlements: snap.exists() ? Object.values(snap.val()) as Settlement[] : [],
    };
    checkReady();
    notify();
  });

  // Users
  onValue(ref(db, 'users'), snap => {
    _state = {
      ..._state,
      users: snap.exists() ? (snap.val() as Record<string, User>) : {},
    };
    checkReady();
    notify();
  });

  // Friendships
  onValue(ref(db, 'friendships'), snap => {
    _state = {
      ..._state,
      friendships: snap.exists() ? Object.values(snap.val()) : [],
    };
    checkReady();
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
