/**
 * useRealtimeStore — production-hardened realtime data layer.
 *
 * Key fixes applied:
 *   - BUG-010: Firebase listeners are now stored and properly unsubscribed
 *     when resetRealtimeStore() is called on logout. Previously listeners
 *     kept firing after logout, leaking the previous user's data to the
 *     next session.
 *   - BUG-007: computeBalances() now only counts COMPLETED settlements
 *     in balance reduction. Pending settlements (unconfirmed by receiver)
 *     no longer optimistically reduce balances.
 *
 * Architecture:
 *   • One onValue listener per node (expenses, settlements, users, friendships)
 *   • Listener unsubscribe functions are stored in _unsubscribers array
 *   • resetRealtimeStore() calls every unsubscriber before clearing state
 *   • Components call useRealtimeStore(userId) and get live data
 */

import { useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import type { Expense, Settlement, User, FriendWithRequest } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Raw store state ──────────────────────────────────────────────────────────
interface StoreState {
  expenses: Expense[];
  settlements: Settlement[];
  users: Record<string, User>;
  friendships: any[];
  ready: boolean;
}

// ─── Per-user computed view ───────────────────────────────────────────────────
export interface UserBalance {
  user_id: string;
  balance: number; // positive = they owe me, negative = I owe them
}

export interface BalanceSummary {
  total_payable: number;
  total_receivable: number;
  net_balance: number;
}

// ─── Singleton raw data ───────────────────────────────────────────────────────
let _state: StoreState = {
  expenses: [],
  settlements: [],
  users: {},
  friendships: [],
  ready: false,
};
let _listeners = new Set<() => void>();
let _subscribed = false;

/**
 * BUG-010 FIX: Store the unsubscribe functions returned by onValue().
 * resetRealtimeStore() iterates over these and calls each one before
 * resetting state, ensuring Firebase WebSocket messages stop arriving
 * for the logged-out user.
 */
let _unsubscribers: Array<() => void> = [];

function notify() {
  _listeners.forEach(l => l());
}

const saveCache = async (state: StoreState) => {
  try {
    await AsyncStorage.setItem('bb_realtime_cache', JSON.stringify({
      expenses: state.expenses,
      settlements: state.settlements,
      users: state.users,
      friendships: state.friendships,
    }));
  } catch (e) {
    console.error('Failed to save mobile store cache:', e);
  }
};

// ─── Balance computation ──────────────────────────────────────────────────────
function computeBalances(userId: string, state: StoreState): {
  summary: BalanceSummary;
  perUser: UserBalance[];
  friends: FriendWithRequest[];
} {
  const net: Record<string, number> = {};

  // Expenses: who owes whom from splits
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

  /**
   * BUG-007 FIX: Only COMPLETED settlements reduce balances.
   * Previously, pending settlements (where the receiver hasn't confirmed)
   * were also counted, causing balances to drop prematurely before the
   * payment was verified by the recipient.
   */
  for (const s of state.settlements) {
    if (s.status !== 'completed') continue; // ← was: !== 'pending' && !== 'completed'
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

  // Friends from accepted friendships only
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

// ─── Start Firebase listeners ─────────────────────────────────────────────────
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
    if (_state.ready) {
      saveCache(_state);
    }
  };

  /**
   * BUG-010 FIX: Each onValue() call returns an unsubscribe function.
   * We store all four in _unsubscribers so resetRealtimeStore() can
   * cleanly tear them down on logout.
   */
  const unsubExpenses = onValue(ref(db, 'expenses'), snap => {
    _state = { ..._state, expenses: snap.exists() ? Object.values(snap.val()) as Expense[] : [] };
    checkReady();
    notify();
  });

  const unsubSettlements = onValue(ref(db, 'settlements'), snap => {
    _state = { ..._state, settlements: snap.exists() ? Object.values(snap.val()) as Settlement[] : [] };
    checkReady();
    notify();
  });

  const unsubUsers = onValue(ref(db, 'users'), snap => {
    _state = { ..._state, users: snap.exists() ? (snap.val() as Record<string, User>) : {} };
    checkReady();
    notify();
  });

  const unsubFriendships = onValue(ref(db, 'friendships'), snap => {
    _state = { ..._state, friendships: snap.exists() ? Object.values(snap.val()) : [] };
    checkReady();
    notify();
  });

  _unsubscribers = [unsubExpenses, unsubSettlements, unsubUsers, unsubFriendships];
}

// ─── React hook ───────────────────────────────────────────────────────────────
export function useRealtimeStore(userId?: string) {
  const [, setTick] = useState(0);

  useEffect(() => {
    startListeners();

    const listener = () => setTick(t => t + 1);
    _listeners.add(listener);

    // Load async cache on mount
    if (!_state.ready) {
      AsyncStorage.getItem('bb_realtime_cache')
        .then(cached => {
          if (cached && !_state.ready) {
            const parsed = JSON.parse(cached);
            _state = {
              expenses: parsed.expenses || [],
              settlements: parsed.settlements || [],
              users: parsed.users || {},
              friendships: parsed.friendships || [],
              ready: true,
            };
            notify();
          }
        })
        .catch(() => {});
    }

    return () => { _listeners.delete(listener); };
  }, []);

  const state = _state;
  const derived = userId ? computeBalances(userId, state) : null;

  const myExpenses = userId
    ? state.expenses
        .filter(e => e.paid_by === userId || (e.splits || []).some(s => s.user_id === userId))
        .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
    : [];

  const mySettlements = userId
    ? [...state.settlements]
        .filter(s => s.payer_id === userId || s.receiver_id === userId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

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
    myExpenses,
    mySettlements,
    summary: derived?.summary ?? null,
    perUserBalances: derived?.perUser ?? [],
    friends: derived?.friends ?? [],
    resolveName,
  };
}

// ─── Logout cleanup ───────────────────────────────────────────────────────────
/**
 * BUG-010 FIX: Calls every stored Firebase unsubscribe function before
 * resetting state. This stops all WebSocket callbacks immediately,
 * preventing previous user data from leaking into the next session.
 */
export function resetRealtimeStore() {
  // Unsubscribe all Firebase listeners first
  _unsubscribers.forEach(unsub => {
    try { unsub(); } catch { /* ignore cleanup errors */ }
  });
  _unsubscribers = [];

  // Clear cache from storage
  AsyncStorage.removeItem('bb_realtime_cache').catch(() => {});

  // Reset all state
  _state = { expenses: [], settlements: [], users: {}, friendships: [], ready: false };
  _subscribed = false;

  // Notify any mounted components to re-render with empty state
  notify();
}
