import { auth, db } from '../firebase';
import { 
  ref, set, get, update, remove, push 
} from 'firebase/database';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, 
  updateProfile, getIdToken 
} from 'firebase/auth';
import type {
  User, Group, Expense, ExpenseCreate,
  Settlement, Budget, Category, ExpenseSplit, GroupMember, Notification, PaymentMethod, SplitType
} from '../types';

// Helper to wrap Database results in a structure that matches Axios response objects
const wrapResponse = <T>(data: T, status = 200) => {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {} as any
  };
};

// Helper to safely obtain the logged-in user's UID even if Firebase Auth hasn't fully initialized
function getCurrentUserId(): string {
  if (auth.currentUser) return auth.currentUser.uid;
  const storedUser = localStorage.getItem('user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.id) return parsed.id;
    } catch {}
  }
  throw new Error('User not authenticated');
}

// ─── Auth ──────────────────────────────────────────────────────────────
export const authAPI = {
  register: async (data: { name: string; email: string; password: string }) => {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const fbUser = userCredential.user;
    
    await updateProfile(fbUser, { displayName: data.name });

    const userData: User = {
      id: fbUser.uid,
      name: data.name,
      email: data.email,
      created_at: new Date().toISOString()
    };
    
    await set(ref(db, `users/${fbUser.uid}`), userData);
    const idToken = await getIdToken(fbUser);
    
    return wrapResponse({
      access_token: idToken,
      refresh_token: idToken,
      user: userData
    }, 201);
  },

  login: async (data: { email: string; password: string }) => {
    const userCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
    const fbUser = userCredential.user;

    const snapshot = await get(ref(db, `users/${fbUser.uid}`));
    const userData: User = snapshot.exists() ? (snapshot.val() as User) : {
      id: fbUser.uid,
      name: fbUser.displayName || fbUser.email || 'User',
      email: fbUser.email || '',
      created_at: new Date().toISOString()
    };

    const idToken = await getIdToken(fbUser);

    return wrapResponse({
      access_token: idToken,
      refresh_token: idToken,
      user: userData
    });
  },

  me: async () => {
    try {
      const uid = getCurrentUserId();
      const snapshot = await get(ref(db, `users/${uid}`));
      if (snapshot.exists()) {
        return wrapResponse(snapshot.val() as User);
      }
    } catch {}
    
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Not authenticated');
    const snapshot = await get(ref(db, `users/${fbUser.uid}`));
    const userData: User = snapshot.exists() ? (snapshot.val() as User) : {
      id: fbUser.uid,
      name: fbUser.displayName || '',
      email: fbUser.email || '',
      created_at: new Date().toISOString()
    };
    return wrapResponse(userData);
  },

  refresh: async (_refresh_token: string) => {
    const fbUser = auth.currentUser;
    if (!fbUser) throw new Error('Not authenticated');
    const idToken = await getIdToken(fbUser, true);
    return wrapResponse({ access_token: idToken });
  }
};

// ─── Users ─────────────────────────────────────────────────────────────
export const usersAPI = {
  me: async () => {
    return authAPI.me();
  },

  update: async (data: Partial<User>) => {
    const uid = getCurrentUserId();
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, data);
    const updatedSnap = await get(userRef);
    return wrapResponse(updatedSnap.val() as User);
  },

  search: async (q: string) => {
    const qLower = q.toLowerCase();
    const snapshot = await get(ref(db, 'users'));
    const matchedUsers: User[] = [];
    if (snapshot.exists()) {
      const allUsers = snapshot.val();
      Object.values(allUsers).forEach((u: any) => {
        if (u.name.toLowerCase().includes(qLower) || u.email.toLowerCase().includes(qLower)) {
          matchedUsers.push(u as User);
        }
      });
    }
    return wrapResponse({ users: matchedUsers, total: matchedUsers.length });
  },

  getById: async (id: string) => {
    const snapshot = await get(ref(db, `users/${id}`));
    if (!snapshot.exists()) throw new Error('User not found');
    return wrapResponse(snapshot.val() as User);
  }
};

// ─── Friends ───────────────────────────────────────────────────────────
export const friendsAPI = {
  list: async () => {
    const uid = getCurrentUserId();
    
    const snapshot = await get(ref(db, 'friendships'));
    const friendships: any[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((f: any) => {
        if (f.sender_id === uid || f.receiver_id === uid) {
          friendships.push(f);
        }
      });
    }
    
    const friendsWithRequest: any[] = [];
    for (const f of friendships) {
      if (f.status !== 'accepted') continue;
      const friendId = f.sender_id === uid ? f.receiver_id : f.sender_id;
      const friendSnap = await get(ref(db, `users/${friendId}`));
      if (friendSnap.exists()) {
        friendsWithRequest.push({
          friendship_id: f.id,
          friend: friendSnap.val() as User,
          status: f.status,
          created_at: f.created_at
        });
      }
    }
    
    return wrapResponse({
      friends: friendsWithRequest,
      total: friendsWithRequest.length
    });
  },

  sendRequest: async (receiver_id: string) => {
    const uid = getCurrentUserId();
    const friendshipId = `${uid}_${receiver_id}`;
    const friendshipData = {
      id: friendshipId,
      sender_id: uid,
      receiver_id,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    await set(ref(db, `friendships/${friendshipId}`), friendshipData);
    return wrapResponse(friendshipData);
  },

  pending: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'friendships'));
    const received: any[] = [];
    const sent: any[] = [];
    
    if (snapshot.exists()) {
      const friendships = Object.values(snapshot.val());
      for (const f of friendships as any[]) {
        if (f.status === 'pending') {
          if (f.receiver_id === uid) {
            const senderSnap = await get(ref(db, `users/${f.sender_id}`));
            if (senderSnap.exists()) {
              received.push({
                friendship_id: f.id,
                friend: senderSnap.val() as User,
                status: f.status,
                created_at: f.created_at
              });
            }
          } else if (f.sender_id === uid) {
            const receiverSnap = await get(ref(db, `users/${f.receiver_id}`));
            if (receiverSnap.exists()) {
              sent.push({
                friendship_id: f.id,
                friend: receiverSnap.val() as User,
                status: f.status,
                created_at: f.created_at
              });
            }
          }
        }
      }
    }

    return wrapResponse({ received, sent });
  },

  accept: async (id: string) => {
    await update(ref(db, `friendships/${id}`), { status: 'accepted' });
    return wrapResponse({ success: true });
  },

  reject: async (id: string) => {
    await update(ref(db, `friendships/${id}`), { status: 'rejected' });
    return wrapResponse({ success: true });
  },

  remove: async (id: string) => {
    await remove(ref(db, `friendships/${id}`));
    return wrapResponse({ success: true });
  }
};

// ─── Groups ────────────────────────────────────────────────────────────
export const groupsAPI = {
  list: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'groups'));
    const groups: Group[] = [];
    
    if (snapshot.exists()) {
      const allGroups = Object.values(snapshot.val());
      for (const groupData of allGroups as any[]) {
        const membersList = groupData.members || [];
        if (membersList.includes(uid)) {
          const memberDetails: GroupMember[] = [];
          for (const memberId of membersList) {
            const userSnap = await get(ref(db, `users/${memberId}`));
            if (userSnap.exists()) {
              memberDetails.push({
                id: `${groupData.id}_${memberId}`,
                user: userSnap.val() as User,
                joined_at: groupData.created_at
              });
            }
          }
          groups.push({
            id: groupData.id,
            name: groupData.name,
            description: groupData.description,
            created_by: groupData.created_by,
            created_at: groupData.created_at,
            members: memberDetails
          });
        }
      }
    }
    
    return wrapResponse({
      groups,
      total: groups.length
    });
  },

  create: async (data: { name: string; description?: string }) => {
    const uid = getCurrentUserId();
    const groupRef = push(ref(db, 'groups'));
    const groupId = groupRef.key;
    if (!groupId) throw new Error('Failed to generate group ID');
    
    const groupData = {
      id: groupId,
      name: data.name,
      description: data.description || '',
      created_by: uid,
      created_at: new Date().toISOString(),
      members: [uid]
    };
    
    await set(groupRef, groupData);
    
    const userSnap = await get(ref(db, `users/${uid}`));
    const creatorUser = userSnap.exists() ? (userSnap.val() as User) : {
      id: uid, name: 'User', email: '', created_at: ''
    };
    
    return wrapResponse({
      ...groupData,
      members: [{
        id: `${groupId}_${uid}`,
        user: creatorUser,
        joined_at: groupData.created_at
      }]
    });
  },

  get: async (id: string) => {
    const groupSnap = await get(ref(db, `groups/${id}`));
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val() as any;
    
    const memberDetails: GroupMember[] = [];
    for (const memberId of groupData.members || []) {
      const userSnap = await get(ref(db, `users/${memberId}`));
      if (userSnap.exists()) {
        memberDetails.push({
          id: `${id}_${memberId}`,
          user: userSnap.val() as User,
          joined_at: groupData.created_at
        });
      }
    }
    return wrapResponse({
      id,
      name: groupData.name,
      description: groupData.description,
      created_by: groupData.created_by,
      created_at: groupData.created_at,
      members: memberDetails
    } as Group);
  },

  update: async (id: string, data: Partial<Group>) => {
    await update(ref(db, `groups/${id}`), data);
    const updated = await groupsAPI.get(id);
    return wrapResponse(updated.data);
  },

  delete: async (id: string) => {
    await remove(ref(db, `groups/${id}`));
    return wrapResponse({ success: true });
  },

  addMember: async (id: string, user_id: string) => {
    const groupRef = ref(db, `groups/${id}`);
    const groupSnap = await get(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val();
    const members = groupData.members || [];
    if (!members.includes(user_id)) {
      members.push(user_id);
      await update(groupRef, { members });
    }
    return wrapResponse({ success: true });
  },

  removeMember: async (id: string, user_id: string) => {
    const groupRef = ref(db, `groups/${id}`);
    const groupSnap = await get(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val();
    const members = (groupData.members || []).filter((m: string) => m !== user_id);
    await update(groupRef, { members });
    return wrapResponse({ success: true });
  }
};

// ─── Expenses ──────────────────────────────────────────────────────────
export const expensesAPI = {
  create: async (data: ExpenseCreate) => {
    const uid = getCurrentUserId();
    const expenseRef = push(ref(db, 'expenses'));
    const expenseId = expenseRef.key;
    if (!expenseId) throw new Error('Failed to generate expense ID');
    
    const resolvedParticipants = data.participants.map(p => p === 'you' ? uid : p);

    let splits: ExpenseSplit[] = [];
    if (data.split_type === 'equal') {
      const share = data.amount / resolvedParticipants.length;
      splits = resolvedParticipants.map((pId, idx) => ({
        id: `${expenseId}_split_${idx}`,
        user_id: pId,
        share_amount: Math.round(share * 100) / 100,
        status: 'accepted' as const
      }));
    } else if (data.split_type === 'percentage') {
      splits = resolvedParticipants.map((pId, idx) => {
        const detail = data.split_details?.find(d => (d.user_id === 'you' ? uid : d.user_id) === pId);
        const pct = detail ? detail.value : 0;
        const share = data.amount * (pct / 100);
        return ({
          id: `${expenseId}_split_${idx}`,
          user_id: pId,
          share_amount: Math.round(share * 100) / 100,
          status: 'accepted' as const
        });
      });
    } else if (data.split_type === 'custom') {
      splits = resolvedParticipants.map((pId, idx) => {
        const detail = data.split_details?.find(d => (d.user_id === 'you' ? uid : d.user_id) === pId);
        const share = detail ? detail.value : 0;
        return ({
          id: `${expenseId}_split_${idx}`,
          user_id: pId,
          share_amount: Math.round(share * 100) / 100,
          status: 'accepted' as const
        });
      });
    }
    
    const expenseData: Expense = {
      id: expenseId,
      title: data.title,
      description: data.description || '',
      amount: data.amount,
      paid_by: uid,
      payment_method: data.payment_method,
      category: data.category,
      split_type: data.split_type as SplitType,
      expense_date: data.expense_date,
      created_at: new Date().toISOString(),
      splits
    };
    
    if (data.group_id) {
      expenseData.group_id = data.group_id;
    }
    
    await set(expenseRef, expenseData);
    
    const senderSnap = await get(ref(db, `users/${uid}`));
    const senderName = senderSnap.exists() ? (senderSnap.val() as User).name : 'Someone';
    for (const split of splits) {
      if (split.user_id !== uid) {
        await createNotification(split.user_id, 'Expense Added', `${senderName} added expense "${data.title}"`, 'expense_added');
      }
    }

    return wrapResponse(expenseData);
  },

  list: async (skip = 0, limitVal = 20) => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'expenses'));
    const allExpenses: Expense[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((exp: any) => {
        allExpenses.push(exp as Expense);
      });
    }
    
    allExpenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    
    const userExpenses = allExpenses.filter(exp => 
      exp.paid_by === uid || exp.splits.some(s => s.user_id === uid)
    );
    
    const paged = userExpenses.slice(skip, skip + limitVal);
    return wrapResponse({
      expenses: paged,
      total: userExpenses.length
    });
  },

  get: async (id: string) => {
    const snapshot = await get(ref(db, `expenses/${id}`));
    if (!snapshot.exists()) throw new Error('Expense not found');
    return wrapResponse(snapshot.val() as Expense);
  },

  byGroup: async (group_id: string) => {
    const snapshot = await get(ref(db, 'expenses'));
    const expenses: Expense[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((exp: any) => {
        if (exp.group_id === group_id) {
          expenses.push(exp as Expense);
        }
      });
    }
    expenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    return wrapResponse({
      expenses,
      total: expenses.length
    });
  },

  delete: async (id: string) => {
    await remove(ref(db, `expenses/${id}`));
    return wrapResponse({ success: true });
  },

  updateSplitStatus: async (split_id: string, status: string) => {
    const snapshot = await get(ref(db, 'expenses'));
    let matchedExpense: Expense | null = null;
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((exp: any) => {
        if (exp.splits && exp.splits.some((s: any) => s.id === split_id)) {
          matchedExpense = exp as Expense;
        }
      });
    }
    
    if (!matchedExpense) throw new Error('Split not found');
    
    const updatedSplits = (matchedExpense as Expense).splits.map((s) => {
      if (s.id === split_id) {
        return { ...s, status: status as any };
      }
      return s;
    });
    
    await update(ref(db, `expenses/${(matchedExpense as Expense).id}`), { splits: updatedSplits });
    return wrapResponse({ success: true });
  }
};

// ─── Settlements ───────────────────────────────────────────────────────
export const settlementsAPI = {
  create: async (data: { receiver_id: string; amount: number; payment_method: string; status?: 'pending' | 'completed' }) => {
    const uid = getCurrentUserId();
    const requestedStatus = data.status || 'pending';

    // ── Duplicate guard ─────────────────────────────────────────────────
    // Prevent creating a duplicate settlement if one already exists between
    // the same payer → receiver with 'pending' status.
    const existingSnap = await get(ref(db, 'settlements'));
    if (existingSnap.exists()) {
      const existing = Object.values(existingSnap.val()) as any[];
      const duplicate = existing.find(
        (s) =>
          s.payer_id === uid &&
          s.receiver_id === data.receiver_id &&
          s.status === 'pending'
      );
      if (duplicate) {
        // Return the existing record instead of creating a new one
        return wrapResponse(duplicate as Settlement);
      }
    }

    const settlementRef = push(ref(db, 'settlements'));
    const settleId = settlementRef.key;
    if (!settleId) throw new Error('Failed to generate settlement ID');

    const settleData: Settlement = {
      id: settleId,
      payer_id: uid,
      receiver_id: data.receiver_id,
      amount: data.amount,
      payment_method: data.payment_method as PaymentMethod,
      status: requestedStatus,
      created_at: new Date().toISOString()
    };

    if (requestedStatus === 'completed') {
      settleData.settled_at = new Date().toISOString();
    }

    await set(settlementRef, settleData);

    const senderSnap = await get(ref(db, `users/${uid}`));
    const senderName = senderSnap.exists() ? (senderSnap.val() as User).name : 'Someone';

    if (requestedStatus === 'completed') {
      await createNotification(
        data.receiver_id,
        'Settlement Completed',
        `${senderName} settled ₹${data.amount} with you via ${data.payment_method}.`,
        'settlement_completed'
      );
    } else {
      await createNotification(
        data.receiver_id,
        'Settlement Pending Confirmation',
        `${senderName} recorded a payment of ₹${data.amount} via ${data.payment_method}. Please confirm.`,
        'settlement_pending'
      );
    }

    return wrapResponse(settleData);
  },

  list: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'settlements'));
    const settlements: Settlement[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((s: any) => {
        if (s.payer_id === uid || s.receiver_id === uid) {
          settlements.push(s as Settlement);
        }
      });
    }
    // Newest first
    settlements.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return wrapResponse(settlements);
  },

  approve: async (id: string) => {
    const uid = getCurrentUserId();
    const settleRef = ref(db, `settlements/${id}`);
    const snap = await get(settleRef);
    if (!snap.exists()) throw new Error('Settlement not found');
    const settlement = snap.val() as Settlement;

    // Only the receiver can approve
    if (settlement.receiver_id !== uid) {
      throw new Error('Only the receiver can approve this settlement');
    }
    // Idempotent — already completed
    if (settlement.status === 'completed') {
      return wrapResponse(settlement);
    }

    await update(settleRef, {
      status: 'completed',
      settled_at: new Date().toISOString()
    });
    const updated = (await get(settleRef)).val() as Settlement;

    // Notify the payer
    const receiverSnap = await get(ref(db, `users/${uid}`));
    const receiverName = receiverSnap.exists() ? (receiverSnap.val() as User).name : 'Your friend';
    await createNotification(
      settlement.payer_id,
      'Settlement Approved',
      `${receiverName} confirmed your payment of ₹${settlement.amount}.`,
      'settlement_completed'
    );

    return wrapResponse(updated);
  },

  balances: async () => {
    const uid = getCurrentUserId();
    const summary = await computeBalanceSummary(uid);
    const perUser = await computeUserBalances(uid);
    return wrapResponse({
      summary,
      per_user: perUser
    });
  }
};

async function computeBalanceSummary(userId: string) {
  const snapExp = await get(ref(db, 'expenses'));
  let totalReceivable = 0;
  let totalPayable = 0;

  if (snapExp.exists()) {
    Object.values(snapExp.val()).forEach((exp: any) => {
      if (exp.paid_by === userId) {
        const othersSplits = (exp.splits || []).filter((s: any) => s.user_id !== userId);
        totalReceivable += othersSplits.reduce((acc: number, s: any) => acc + s.share_amount, 0);
      } else {
        const mySplit = (exp.splits || []).find((s: any) => s.user_id === userId);
        if (mySplit && mySplit.status === 'accepted') {
          totalPayable += mySplit.share_amount;
        }
      }
    });
  }

  // Deduct BOTH completed AND pending settlements so the displayed balance
  // reflects in-flight payments (prevents reappearing "You owe" cards).
  const snapSettle = await get(ref(db, 'settlements'));
  if (snapSettle.exists()) {
    Object.values(snapSettle.val()).forEach((s: any) => {
      if (s.status === 'completed' || s.status === 'pending') {
        if (s.payer_id === userId) {
          totalPayable -= s.amount;
        } else if (s.receiver_id === userId) {
          totalReceivable -= s.amount;
        }
      }
    });
  }

  totalPayable = Math.max(0, Math.round(totalPayable * 100) / 100);
  totalReceivable = Math.max(0, Math.round(totalReceivable * 100) / 100);
  const netBalance = Math.round((totalReceivable - totalPayable) * 100) / 100;

  return {
    total_payable: totalPayable,
    total_receivable: totalReceivable,
    net_balance: netBalance
  };
}

async function computeUserBalances(userId: string) {
  const net: Record<string, number> = {};

  const snapExp = await get(ref(db, 'expenses'));
  if (snapExp.exists()) {
    Object.values(snapExp.val()).forEach((exp: any) => {
      if (exp.paid_by === userId) {
        (exp.splits || []).forEach((s: any) => {
          if (s.user_id !== userId) {
            net[s.user_id] = (net[s.user_id] || 0) + s.share_amount;
          }
        });
      } else {
        const mySplit = (exp.splits || []).find((s: any) => s.user_id === userId);
        if (mySplit && mySplit.status === 'accepted') {
          net[exp.paid_by] = (net[exp.paid_by] || 0) - mySplit.share_amount;
        }
      }
    });
  }

  // Deduct BOTH completed AND pending settlements.
  // Pending = payer has recorded a payment but receiver hasn't confirmed yet.
  // We still reduce their balance to prevent duplicate settles.
  const snapSettle = await get(ref(db, 'settlements'));
  if (snapSettle.exists()) {
    Object.values(snapSettle.val()).forEach((s: any) => {
      if (s.status === 'completed' || s.status === 'pending') {
        if (s.payer_id === userId) {
          // I paid them → they owe me less → net[them] goes up (toward 0)
          net[s.receiver_id] = (net[s.receiver_id] || 0) + s.amount;
        } else if (s.receiver_id === userId) {
          // They paid me → I owe them less → net[them] goes toward 0
          net[s.payer_id] = (net[s.payer_id] || 0) - s.amount;
        }
      }
    });
  }

  return Object.entries(net)
    .map(([uid, bal]) => ({
      user_id: uid,
      balance: Math.round(bal * 100) / 100
    }))
    .filter(item => Math.abs(item.balance) > 0.01);
}

// ─── Budgets ───────────────────────────────────────────────────────────
export const budgetsAPI = {
  create: async (data: { month: number; year: number; amount: number }) => {
    const uid = getCurrentUserId();
    const budgetId = `${uid}_${data.month}_${data.year}`;
    const budgetData: Budget = {
      id: budgetId,
      user_id: uid,
      month: data.month,
      year: data.year,
      amount: data.amount,
      spent: 0,
      remaining: data.amount
    };
    await set(ref(db, `budgets/${budgetId}`), budgetData);
    return wrapResponse(budgetData);
  },

  list: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'budgets'));
    const budgets: Budget[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((b: any) => {
        if (b.user_id === uid) {
          budgets.push(b as Budget);
        }
      });
    }
    return wrapResponse(budgets);
  },

  get: async (month: number, year: number) => {
    const uid = getCurrentUserId();
    const budgetId = `${uid}_${month}_${year}`;
    const budgetSnap = await get(ref(db, `budgets/${budgetId}`));
    if (!budgetSnap.exists()) throw new Error('Budget not found');
    return wrapResponse(budgetSnap.val() as Budget);
  },

  update: async (month: number, year: number, amount: number) => {
    const uid = getCurrentUserId();
    const budgetId = `${uid}_${month}_${year}`;
    const budgetRef = ref(db, `budgets/${budgetId}`);
    await update(budgetRef, { amount });
    const updated = await get(budgetRef);
    return wrapResponse(updated.val() as Budget);
  },

  summary: async (month: number, year: number) => {
    const uid = getCurrentUserId();
    const budgetId = `${uid}_${month}_${year}`;
    const budgetSnap = await get(ref(db, `budgets/${budgetId}`));
    const budgetAmount = budgetSnap.exists() ? (budgetSnap.val() as Budget).amount : 0;
    
    const snapExp = await get(ref(db, 'expenses'));
    let totalSpent = 0;
    const categorySpentMap: Record<string, number> = {};
    
    let totalReceivable = 0;
    let totalPayable = 0;

    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        const expDate = new Date(exp.expense_date);
        if (expDate.getMonth() + 1 === month && expDate.getFullYear() === year) {
          const mySplit = (exp.splits || []).find((s: any) => s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') {
            totalSpent += mySplit.share_amount;
            categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + mySplit.share_amount;
          }

          if (exp.paid_by === uid) {
            const othersSplits = (exp.splits || []).filter((s: any) => s.user_id !== uid);
            totalReceivable += othersSplits.reduce((acc: number, s: any) => acc + s.share_amount, 0);
          } else {
            if (mySplit && mySplit.status === 'accepted') {
              totalPayable += mySplit.share_amount;
            }
          }
        }
      });
    }

    const snapSettle = await get(ref(db, 'settlements'));
    if (snapSettle.exists()) {
      Object.values(snapSettle.val()).forEach((s: any) => {
        const sDate = new Date(s.created_at);
        if (sDate.getMonth() + 1 === month && sDate.getFullYear() === year && s.status === 'completed') {
          if (s.payer_id === uid) {
            totalPayable -= s.amount;
          } else if (s.receiver_id === uid) {
            totalReceivable -= s.amount;
          }
        }
      });
    }

    const monthlyNetBalance = Math.round((totalReceivable - totalPayable) * 100) / 100;
    const remaining = Math.max(0, budgetAmount - totalSpent);
    const pct = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;

    const categoriesList = Object.entries(categorySpentMap).map(([category, spent]) => ({
      category: category as Category,
      spent: Math.round(spent * 100) / 100
    })).sort((a, b) => b.spent - a.spent);

    return wrapResponse({
      month,
      year,
      total_budget: budgetAmount,
      total_spent: Math.round(totalSpent * 100) / 100,
      monthly_net_balance: monthlyNetBalance,
      net_spent: Math.round(totalSpent * 100) / 100,
      remaining: Math.round(remaining * 100) / 100,
      percentage_used: Math.round(pct * 100) / 100,
      is_over_budget: totalSpent > budgetAmount && budgetAmount > 0,
      categories: categoriesList
    });
  }
};

// ─── Analytics ─────────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: async () => {
    const uid = getCurrentUserId();
    const snapExp = await get(ref(db, 'expenses'));
    let totalExpenses = 0;
    let totalSpentMyShare = 0;
    
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        const isPayer = exp.paid_by === uid;
        const isSplitter = exp.splits && exp.splits.some((s: any) => s.user_id === uid);
        if (isPayer || isSplitter) {
          totalExpenses++;
        }
        const mySplit = (exp.splits || []).find((s: any) => s.user_id === uid);
        if (mySplit && mySplit.status === 'accepted') {
          totalSpentMyShare += mySplit.share_amount;
        }
      });
    }
    
    const balance = await computeBalanceSummary(uid);
    
    return wrapResponse({
      total_expenses: totalExpenses,
      total_spent: Math.round(totalSpentMyShare * 100) / 100,
      ...balance
    });
  },

  monthly: async (year?: number) => {
    const uid = getCurrentUserId();
    const y = year ?? new Date().getFullYear();
    const snapExp = await get(ref(db, 'expenses'));
    const monthlySum: Record<number, number> = {};
    
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        const expDate = new Date(exp.expense_date);
        if (expDate.getFullYear() === y) {
          const mySplit = (exp.splits || []).find((s: any) => s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') {
            const m = expDate.getMonth() + 1;
            monthlySum[m] = (monthlySum[m] || 0) + mySplit.share_amount;
          }
        }
      });
    }
    
    const data = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return {
        month: m,
        total: Math.round((monthlySum[m] || 0) * 100) / 100
      };
    });
    
    return wrapResponse({
      year: y,
      data
    });
  },

  categories: async (month?: number, year?: number) => {
    const uid = getCurrentUserId();
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    
    const snapExp = await get(ref(db, 'expenses'));
    const categorySum: Record<string, number> = {};
    
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        const expDate = new Date(exp.expense_date);
        if (expDate.getMonth() + 1 === m && expDate.getFullYear() === y) {
          const mySplit = (exp.splits || []).find((s: any) => s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') {
            categorySum[exp.category] = (categorySum[exp.category] || 0) + mySplit.share_amount;
          }
        }
      });
    }
    
    const data = Object.entries(categorySum).map(([category, total]) => ({
      category: category as Category,
      total: Math.round(total * 100) / 100
    }));
    
    return wrapResponse({
      month: m,
      year: y,
      data
    });
  },

  trends: async (months = 6) => {
    const uid = getCurrentUserId();
    const snapExp = await get(ref(db, 'expenses'));
    const monthlySum: Record<string, number> = {};
    
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        const expDate = new Date(exp.expense_date);
        const mySplit = (exp.splits || []).find((s: any) => s.user_id === uid);
        if (mySplit && mySplit.status === 'accepted') {
          const key = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
          monthlySum[key] = (monthlySum[key] || 0) + mySplit.share_amount;
        }
      });
    }
    
    const sorted = Object.entries(monthlySum)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-months)
      .map(([key, total]) => {
        const [y, m] = key.split('-');
        return {
          year: parseInt(y),
          month: parseInt(m),
          total: Math.round(total * 100) / 100
        };
      });
      
    return wrapResponse({ data: sorted });
  }
};

// ─── Notifications ─────────────────────────────────────────────────────
export const notificationsAPI = {
  list: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'notifications'));
    const notifications: Notification[] = [];
    let unreadCount = 0;
    
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((n: any) => {
        if (n.user_id === uid) {
          notifications.push(n as Notification);
          if (!n.is_read) unreadCount++;
        }
      });
    }
    
    notifications.sort((a, b) => b.created_at.localeCompare(a.created_at));
    
    return wrapResponse({
      notifications,
      unread_count: unreadCount
    });
  },

  readAll: async () => {
    const uid = getCurrentUserId();
    const snapshot = await get(ref(db, 'notifications'));
    if (snapshot.exists()) {
      const updates: Record<string, any> = {};
      Object.entries(snapshot.val()).forEach(([key, n]: [string, any]) => {
        if (n.user_id === uid && !n.is_read) {
          updates[`notifications/${key}/is_read`] = true;
        }
      });
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
      }
    }
    return wrapResponse({ success: true });
  }
};

async function createNotification(userId: string, title: string, message: string, type: string) {
  try {
    const notificationRef = push(ref(db, 'notifications'));
    const notificationId = notificationRef.key;
    if (notificationId) {
      const notificationData = {
        id: notificationId,
        user_id: userId,
        title,
        message,
        notification_type: type,
        is_read: false,
        created_at: new Date().toISOString()
      };
      await set(notificationRef, notificationData);
    }
  } catch (err) {
    console.error('Failed to create notification', err);
  }
}
