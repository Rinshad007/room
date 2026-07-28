import { auth, db } from '../firebase';
import {
  ref, set, get, update, remove, push
} from 'firebase/database';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, getIdToken, GoogleAuthProvider, signInWithCredential, PhoneAuthProvider
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  User, Group, Expense, ExpenseCreate,
  Settlement, Budget, Category, ExpenseSplit, GroupMember, Notification, PaymentMethod, SplitType
} from '../types';

// ─── Response wrapper ──────────────────────────────────────────────────────────
const wrapResponse = <T>(data: T, status = 200) => {
  return { data, status, statusText: 'OK', headers: {}, config: {} as any };
};

// Coerce Firebase database values to safe arrays to avoid crashes if saved as objects
function safeArray<T>(val: any): T[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'object') return Object.values(val);
  return [];
}

// ─── Auth helpers ──────────────────────────────────────────────────────────────
async function getCurrentUserId(): Promise<string> {
  if (auth.currentUser) return auth.currentUser.uid;
  const storedUser = await AsyncStorage.getItem('user');
  if (storedUser) {
    try {
      const parsed = JSON.parse(storedUser);
      if (parsed && parsed.id) return parsed.id;
    } catch {}
  }
  throw new Error('User not authenticated');
}

/**
 * Ownership guard — throws if currentUser doesn't match expected owner.
 * Centralised here so every delete/mutate operation uses identical logic.
 */
function assertOwner(ownerId: string, currentUserId: string, label = 'resource') {
  if (ownerId !== currentUserId) {
    throw new Error(`Unauthorized: you do not own this ${label}`);
  }
}

// ─── Auth ──────────────────────────────────────────────────────────────────────
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
    return wrapResponse({ access_token: idToken, refresh_token: idToken, user: userData }, 201);
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
    return wrapResponse({ access_token: idToken, refresh_token: idToken, user: userData });
  },

  googleLogin: async (idToken: string) => {
    const credential = GoogleAuthProvider.credential(idToken);
    const userCredential = await signInWithCredential(auth, credential);
    const fbUser = userCredential.user;
    const snapshot = await get(ref(db, `users/${fbUser.uid}`));

    const userData: User = snapshot.exists() ? (snapshot.val() as User) : {
      id: fbUser.uid,
      name: fbUser.displayName || fbUser.email || 'User',
      email: fbUser.email || '',
      created_at: new Date().toISOString()
    };

    if (!snapshot.exists()) {
      await set(ref(db, `users/${fbUser.uid}`), userData);
    }

    const token = await getIdToken(fbUser);
    return wrapResponse({ access_token: token, refresh_token: token, user: userData });
  },

  phoneLogin: async (data: { verificationId: string; code: string; name?: string }) => {
    const credential = PhoneAuthProvider.credential(data.verificationId, data.code);
    const userCredential = await signInWithCredential(auth, credential);
    const fbUser = userCredential.user;
    const snapshot = await get(ref(db, `users/${fbUser.uid}`));

    const userData: User = snapshot.exists() ? (snapshot.val() as User) : {
      id: fbUser.uid,
      name: data.name || fbUser.displayName || fbUser.phoneNumber || 'User',
      email: fbUser.email || '',
      created_at: new Date().toISOString()
    };

    if (!snapshot.exists()) {
      await set(ref(db, `users/${fbUser.uid}`), userData);
    }

    const token = await getIdToken(fbUser);
    return wrapResponse({ access_token: token, refresh_token: token, user: userData });
  },

  me: async () => {
    try {
      const uid = await getCurrentUserId();
      const snapshot = await get(ref(db, `users/${uid}`));
      if (snapshot.exists()) return wrapResponse(snapshot.val() as User);
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

// ─── Users ─────────────────────────────────────────────────────────────────────
export const usersAPI = {
  me: async () => authAPI.me(),

  update: async (data: Partial<User>) => {
    const uid = await getCurrentUserId();
    const userRef = ref(db, `users/${uid}`);
    await update(userRef, data);
    const updatedSnap = await get(userRef);
    return wrapResponse(updatedSnap.val() as User);
  },

  /**
   * Search users by name or email using case-insensitive client-side filtering.
   * Firebase RTDB orderByChild range queries are case-sensitive and require
   * deployed .indexOn rules. Client-side filtering is safer and more flexible.
   *
   * SECURITY: Search results strip private fields (upi_id) before returning.
   */
  search: async (q: string) => {
    if (!q.trim()) return wrapResponse({ users: [], total: 0 });
    const uid = await getCurrentUserId();
    const qLower = q.trim().toLowerCase();

    const snapshot = await get(ref(db, 'users'));
    const matchedUsers: User[] = [];

    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((u: any) => {
        if (!u || !u.id || u.id === uid) return;
        const nameMatch = (u.name || '').toLowerCase().includes(qLower);
        const emailMatch = (u.email || '').toLowerCase().includes(qLower);
        if (nameMatch || emailMatch) {
          // Strip private fields — never expose upi_id in search results
          matchedUsers.push({ id: u.id, name: u.name, email: u.email, created_at: u.created_at } as User);
        }
      });
    }

    return wrapResponse({ users: matchedUsers, total: matchedUsers.length });
  },

  getById: async (id: string) => {
    const snapshot = await get(ref(db, `users/${id}`));
    if (!snapshot.exists()) throw new Error('User not found');
    return wrapResponse(snapshot.val() as User);
  },

  getCustomCategories: async () => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `users/${uid}/custom_categories`));
    if (snap.exists()) {
      return wrapResponse(Object.values(snap.val()) as { name: string; icon: string }[]);
    }
    return wrapResponse([] as { name: string; icon: string }[]);
  },

  addCustomCategory: async (name: string, icon: string) => {
    const uid = await getCurrentUserId();
    const categoriesRef = ref(db, `users/${uid}/custom_categories`);
    const snap = await get(categoriesRef);
    if (snap.exists()) {
      const existing = Object.values(snap.val()) as { name: string; icon: string }[];
      if (existing.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Category already exists');
      }
    }
    const newRef = push(categoriesRef);
    const catData = { name, icon };
    await set(newRef, catData);
    return wrapResponse(catData);
  },

  deleteCustomCategory: async (name: string) => {
    const uid = await getCurrentUserId();
    const categoriesRef = ref(db, `users/${uid}/custom_categories`);
    const snap = await get(categoriesRef);
    if (snap.exists()) {
      const data = snap.val();
      for (const [key, val] of Object.entries(data)) {
        if ((val as any).name.toLowerCase() === name.toLowerCase()) {
          await remove(ref(db, `users/${uid}/custom_categories/${key}`));
          break;
        }
      }
    }
    return wrapResponse({ success: true });
  }
};

// ─── Friends ───────────────────────────────────────────────────────────────────
export const friendsAPI = {
  /**
   * List accepted friends. Uses full scan + client-side filter to avoid
   * requiring Firebase .indexOn rules that may not be deployed yet.
   */
  list: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'friendships'));
    const friendsWithRequest: any[] = [];

    if (snapshot.exists()) {
      for (const f of Object.values(snapshot.val()) as any[]) {
        if (!f || f.status !== 'accepted') continue;
        if (f.sender_id !== uid && f.receiver_id !== uid) continue;
        const friendId = f.sender_id === uid ? f.receiver_id : f.sender_id;
        const friendSnap = await get(ref(db, `users/${friendId}`));
        if (friendSnap.exists()) {
          friendsWithRequest.push({
            friendship_id: f.id,
            friend: friendSnap.val() as User,
            status: f.status,
            created_at: f.created_at,
          });
        }
      }
    }
    return wrapResponse({ friends: friendsWithRequest, total: friendsWithRequest.length });
  },

  sendRequest: async (receiver_id: string) => {
    const uid = await getCurrentUserId();

    // Prevent self-friending
    if (uid === receiver_id) throw new Error('Cannot send friend request to yourself');

    // Bidirectional duplicate check — prevents both A→B and B→A duplicates
    const [existAB, existBA] = await Promise.all([
      get(ref(db, `friendships/${uid}_${receiver_id}`)),
      get(ref(db, `friendships/${receiver_id}_${uid}`)),
    ]);
    if (existAB.exists() || existBA.exists()) {
      throw new Error('A friendship or pending request already exists with this user');
    }

    const friendshipId = `${uid}_${receiver_id}`;
    const friendshipData = {
      id: friendshipId, sender_id: uid, receiver_id,
      status: 'pending', created_at: new Date().toISOString()
    };
    await set(ref(db, `friendships/${friendshipId}`), friendshipData);
    return wrapResponse(friendshipData);
  },

  pending: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'friendships'));
    const received: any[] = [];
    const sent: any[] = [];

    if (snapshot.exists()) {
      for (const f of Object.values(snapshot.val()) as any[]) {
        if (!f || f.status !== 'pending') continue;
        if (f.receiver_id === uid) {
          const s = await get(ref(db, `users/${f.sender_id}`));
          if (s.exists()) received.push({ friendship_id: f.id, friend: s.val(), status: f.status, created_at: f.created_at });
        } else if (f.sender_id === uid) {
          const s = await get(ref(db, `users/${f.receiver_id}`));
          if (s.exists()) sent.push({ friendship_id: f.id, friend: s.val(), status: f.status, created_at: f.created_at });
        }
      }
    }
    return wrapResponse({ received, sent });
  },

  /**
   * SECURITY FIX (BUG-003): Verifies that only the friendship RECEIVER
   * can accept a friend request. Previously, any user could accept any
   * friendship by knowing its ID (IDOR vulnerability).
   */
  accept: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) throw new Error('Friend request not found');
    const f = snap.val();
    if (f.receiver_id !== uid) throw new Error('Unauthorized: only the recipient can accept this request');
    if (f.status === 'accepted') return wrapResponse({ success: true });
    await update(ref(db, `friendships/${id}`), { status: 'accepted' });
    return wrapResponse({ success: true });
  },

  /** Alias used by FriendsScreen — same security guard */
  acceptRequest: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) throw new Error('Friend request not found');
    const f = snap.val();
    if (f.receiver_id !== uid) throw new Error('Unauthorized: only the recipient can accept this request');
    if (f.status === 'accepted') return wrapResponse({ success: true });
    await update(ref(db, `friendships/${id}`), { status: 'accepted' });
    return wrapResponse({ success: true });
  },

  /** SECURITY FIX (BUG-003): Only receiver can reject */
  reject: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) throw new Error('Friend request not found');
    const f = snap.val();
    if (f.receiver_id !== uid) throw new Error('Unauthorized: only the recipient can reject this request');
    await update(ref(db, `friendships/${id}`), { status: 'rejected' });
    return wrapResponse({ success: true });
  },

  /** Alias used by FriendsScreen */
  declineRequest: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) throw new Error('Friend request not found');
    const f = snap.val();
    if (f.receiver_id !== uid) throw new Error('Unauthorized: only the recipient can decline this request');
    await update(ref(db, `friendships/${id}`), { status: 'rejected' });
    return wrapResponse({ success: true });
  },

  /** Either party can remove an accepted friendship; sender can cancel their own pending request */
  remove: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) return wrapResponse({ success: true }); // idempotent
    const f = snap.val();
    if (f.sender_id !== uid && f.receiver_id !== uid) {
      throw new Error('Unauthorized: you are not part of this friendship');
    }
    await remove(ref(db, `friendships/${id}`));
    return wrapResponse({ success: true });
  },

  /** Alias used by FriendsScreen */
  removeFriend: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `friendships/${id}`));
    if (!snap.exists()) return wrapResponse({ success: true });
    const f = snap.val();
    if (f.sender_id !== uid && f.receiver_id !== uid) {
      throw new Error('Unauthorized: you are not part of this friendship');
    }
    await remove(ref(db, `friendships/${id}`));
    return wrapResponse({ success: true });
  },

  pendingRequests: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'friendships'));
    const pending: any[] = [];

    if (snapshot.exists()) {
      for (const f of Object.values(snapshot.val()) as any[]) {
        if (!f || f.status !== 'pending') continue;
        if (f.sender_id !== uid && f.receiver_id !== uid) continue;
        const otherId = f.sender_id === uid ? f.receiver_id : f.sender_id;
        const userSnap = await get(ref(db, `users/${otherId}`));
        if (userSnap.exists()) {
          pending.push({
            friendship_id: f.id, id: f.id, friend: userSnap.val(),
            sender_id: f.sender_id, receiver_id: f.receiver_id,
            status: f.status, created_at: f.created_at,
          });
        }
      }
    }
    return wrapResponse({ pending_requests: pending });
  }
};

// ─── Groups ────────────────────────────────────────────────────────────────────
export const groupsAPI = {
  list: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'groups'));
    const groups: Group[] = [];
    if (snapshot.exists()) {
      for (const groupData of Object.values(snapshot.val()) as any[]) {
        const membersList = safeArray<string>(groupData.members);
        if (membersList.includes(uid)) {
          const memberDetails: GroupMember[] = [];
          for (const memberId of membersList) {
            const userSnap = await get(ref(db, `users/${memberId}`));
            if (userSnap.exists()) {
              memberDetails.push({ id: `${groupData.id}_${memberId}`, user: userSnap.val(), joined_at: groupData.created_at });
            }
          }
          groups.push({ id: groupData.id, name: groupData.name, description: groupData.description, created_by: groupData.created_by, created_at: groupData.created_at, members: memberDetails });
        }
      }
    }
    return wrapResponse({ groups, total: groups.length });
  },

  create: async (data: { name: string; description?: string }) => {
    const uid = await getCurrentUserId();
    const groupRef = push(ref(db, 'groups'));
    const groupId = groupRef.key!;
    const groupData = { id: groupId, name: data.name, description: data.description || '', created_by: uid, created_at: new Date().toISOString(), members: [uid] };
    await set(groupRef, groupData);
    const userSnap = await get(ref(db, `users/${uid}`));
    const creatorUser = userSnap.exists() ? userSnap.val() : { id: uid, name: 'User', email: '', created_at: '' };
    return wrapResponse({ ...groupData, members: [{ id: `${groupId}_${uid}`, user: creatorUser, joined_at: groupData.created_at }] });
  },

  get: async (id: string) => {
    const groupSnap = await get(ref(db, `groups/${id}`));
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val();
    const memberDetails: GroupMember[] = [];
    const membersList = safeArray<string>(groupData.members);
    for (const memberId of membersList) {
      const userSnap = await get(ref(db, `users/${memberId}`));
      if (userSnap.exists()) memberDetails.push({ id: `${id}_${memberId}`, user: userSnap.val(), joined_at: groupData.created_at });
    }
    return wrapResponse({ id, name: groupData.name, description: groupData.description, created_by: groupData.created_by, created_at: groupData.created_at, members: memberDetails } as Group);
  },

  addMember: async (id: string, user_id: string) => {
    const uid = await getCurrentUserId();
    const groupRef = ref(db, `groups/${id}`);
    const groupSnap = await get(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val();
    if (groupData.created_by !== uid) throw new Error('Unauthorized: only the group creator can add members');
    const members = safeArray<string>(groupData.members);
    if (!members.includes(user_id)) {
      members.push(user_id);
      await update(groupRef, { members });
    }
    return wrapResponse({ success: true });
  },

  /**
   * Creator can remove any member. Members can remove themselves (leave group).
   */
  removeMember: async (id: string, user_id: string) => {
    const uid = await getCurrentUserId();
    const groupRef = ref(db, `groups/${id}`);
    const groupSnap = await get(groupRef);
    if (!groupSnap.exists()) throw new Error('Group not found');
    const groupData = groupSnap.val();
    if (groupData.created_by !== uid && uid !== user_id) {
      throw new Error('Unauthorized: only the group creator can remove other members');
    }
    const members = safeArray<string>(groupData.members).filter((m: string) => m !== user_id);
    await update(groupRef, { members });
    return wrapResponse({ success: true });
  },

  /**
   * SECURITY FIX (BUG-005): Only the group creator can delete a group.
   * Previously any authenticated user could delete any group by knowing its ID.
   */
  delete: async (id: string) => {
    const uid = await getCurrentUserId();
    const groupSnap = await get(ref(db, `groups/${id}`));
    if (!groupSnap.exists()) throw new Error('Group not found');
    assertOwner(groupSnap.val().created_by, uid, 'group');
    await remove(ref(db, `groups/${id}`));
    return wrapResponse({ success: true });
  }
};

// ─── Expenses ──────────────────────────────────────────────────────────────────
export const expensesAPI = {
  create: async (data: ExpenseCreate) => {
    const uid = await getCurrentUserId();
    const expenseRef = push(ref(db, 'expenses'));
    const expenseId = expenseRef.key!;
    const resolvedParticipants = data.participants.map(p => p === 'you' ? uid : p);
    let splits: ExpenseSplit[] = [];

    if (data.split_type === 'equal') {
      const share = data.amount / resolvedParticipants.length;
      splits = resolvedParticipants.map((pId, idx) => ({
        id: `${expenseId}_split_${idx}`, user_id: pId,
        share_amount: Math.round(share * 100) / 100, status: 'accepted' as const
      }));
    } else if (data.split_type === 'percentage') {
      splits = resolvedParticipants.map((pId, idx) => {
        const detail = data.split_details?.find(d => (d.user_id === 'you' ? uid : d.user_id) === pId);
        return { id: `${expenseId}_split_${idx}`, user_id: pId, share_amount: Math.round(data.amount * ((detail?.value ?? 0) / 100) * 100) / 100, status: 'accepted' as const };
      });
    } else {
      splits = resolvedParticipants.map((pId, idx) => {
        const detail = data.split_details?.find(d => (d.user_id === 'you' ? uid : d.user_id) === pId);
        return { id: `${expenseId}_split_${idx}`, user_id: pId, share_amount: Math.round((detail?.value ?? 0) * 100) / 100, status: 'accepted' as const };
      });
    }

    const expenseData: Expense = {
      id: expenseId, title: data.title, description: data.description || '',
      amount: data.amount, paid_by: uid, payment_method: data.payment_method,
      category: data.category, split_type: data.split_type as SplitType,
      expense_date: data.expense_date, created_at: new Date().toISOString(), splits,
      ...(data.group_id ? { group_id: data.group_id } : {})
    };

    await set(expenseRef, expenseData);
    const senderSnap = await get(ref(db, `users/${uid}`));
    const senderName = senderSnap.exists() ? senderSnap.val().name : 'Someone';
    for (const split of splits) {
      if (split.user_id !== uid) {
        await createNotification(split.user_id, 'Expense Added', `${senderName} added expense "${data.title}"`, 'expense_added');
      }
    }
    return wrapResponse(expenseData);
  },

  list: async (skip = 0, limitVal = 20) => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'expenses'));
    const allExpenses: Expense[] = [];
    if (snapshot.exists()) Object.values(snapshot.val()).forEach((exp: any) => allExpenses.push(exp));
    allExpenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    const userExpenses = allExpenses.filter(exp => {
      if (!exp) return false;
      const splits = safeArray<any>(exp.splits);
      return exp.paid_by === uid || splits.some(s => s && s.user_id === uid);
    });
    return wrapResponse({ expenses: userExpenses.slice(skip, skip + limitVal), total: userExpenses.length });
  },

  get: async (id: string) => {
    const snapshot = await get(ref(db, `expenses/${id}`));
    if (!snapshot.exists()) throw new Error('Expense not found');
    return wrapResponse(snapshot.val() as Expense);
  },

  byGroup: async (group_id: string) => {
    const snapshot = await get(ref(db, 'expenses'));
    const expenses: Expense[] = [];
    if (snapshot.exists()) Object.values(snapshot.val()).forEach((exp: any) => { if (exp.group_id === group_id) expenses.push(exp); });
    expenses.sort((a, b) => b.expense_date.localeCompare(a.expense_date));
    return wrapResponse({ expenses, total: expenses.length });
  },

  /**
   * SECURITY FIX (BUG-004): Only the expense creator (paid_by) can delete.
   * Previously any authenticated user could delete any expense by ID (IDOR).
   */
  delete: async (id: string) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `expenses/${id}`));
    if (!snap.exists()) throw new Error('Expense not found');
    assertOwner(snap.val().paid_by, uid, 'expense');
    await remove(ref(db, `expenses/${id}`));
    return wrapResponse({ success: true });
  },

  /**
   * SECURITY FIX: Only the expense creator can edit fields.
   */
  update: async (id: string, data: Partial<Pick<Expense, 'title' | 'description' | 'category' | 'amount' | 'expense_date'>>) => {
    const uid = await getCurrentUserId();
    const expenseRef = ref(db, `expenses/${id}`);
    const snap = await get(expenseRef);
    if (!snap.exists()) throw new Error('Expense not found');
    assertOwner(snap.val().paid_by, uid, 'expense');
    await update(expenseRef, data);
    const updated = await get(expenseRef);
    return wrapResponse(updated.val() as Expense);
  }
};

// ─── Settlements ───────────────────────────────────────────────────────────────
export const settlementsAPI = {
  create: async (data: { receiver_id: string; amount: number; payment_method: string; status?: 'pending' | 'completed' }) => {
    const uid = await getCurrentUserId();

    // Prevent self-settlement
    if (uid === data.receiver_id) throw new Error('Cannot record a settlement with yourself');

    // Duplicate detection: match on payer, receiver, amount, AND pending status
    const existingSnap = await get(ref(db, 'settlements'));
    if (existingSnap.exists()) {
      const duplicate = Object.values(existingSnap.val()).find((s: any) =>
        s.payer_id === uid &&
        s.receiver_id === data.receiver_id &&
        s.status === 'pending' &&
        Math.abs(s.amount - data.amount) < 0.01
      );
      if (duplicate) return wrapResponse(duplicate as Settlement);
    }

    const settlementRef = push(ref(db, 'settlements'));
    const settleId = settlementRef.key!;
    const requestedStatus = data.status || 'pending';
    const settleData: Settlement = {
      id: settleId, payer_id: uid, receiver_id: data.receiver_id,
      amount: data.amount, payment_method: data.payment_method as PaymentMethod,
      status: requestedStatus, created_at: new Date().toISOString(),
      ...(requestedStatus === 'completed' ? { settled_at: new Date().toISOString() } : {})
    };
    await set(settlementRef, settleData);
    const senderSnap = await get(ref(db, `users/${uid}`));
    const senderName = senderSnap.exists() ? senderSnap.val().name : 'Someone';
    if (requestedStatus === 'completed') {
      await createNotification(data.receiver_id, 'Settlement Completed', `${senderName} settled ₹${data.amount} with you via ${data.payment_method}.`, 'settlement_completed');
    } else {
      await createNotification(data.receiver_id, 'Settlement Pending Confirmation', `${senderName} recorded a payment of ₹${data.amount}. Please confirm.`, 'settlement_pending');
    }
    return wrapResponse(settleData);
  },

  list: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'settlements'));
    const settlements: Settlement[] = [];
    if (snapshot.exists()) Object.values(snapshot.val()).forEach((s: any) => { if (s.payer_id === uid || s.receiver_id === uid) settlements.push(s); });
    settlements.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return wrapResponse(settlements);
  },

  approve: async (id: string) => {
    const uid = await getCurrentUserId();
    const settleRef = ref(db, `settlements/${id}`);
    const snap = await get(settleRef);
    if (!snap.exists()) throw new Error('Settlement not found');
    const settlement = snap.val() as Settlement;
    if (settlement.receiver_id !== uid) throw new Error('Only the receiver can approve');
    if (settlement.status === 'completed') return wrapResponse(settlement);
    await update(settleRef, { status: 'completed', settled_at: new Date().toISOString() });
    const updated = (await get(settleRef)).val() as Settlement;
    const receiverSnap = await get(ref(db, `users/${uid}`));
    const receiverName = receiverSnap.exists() ? receiverSnap.val().name : 'Your friend';
    await createNotification(settlement.payer_id, 'Settlement Approved', `${receiverName} confirmed your payment of ₹${settlement.amount}.`, 'settlement_completed');
    return wrapResponse(updated);
  },

  balances: async () => {
    const uid = await getCurrentUserId();
    const summary = await computeBalanceSummary(uid);
    const perUser = await computeUserBalances(uid);
    return wrapResponse({ summary, per_user: perUser });
  }
};

// ─── Balance helpers ───────────────────────────────────────────────────────────
/**
 * BUG-007 FIX: Only settlements with status === 'completed' reduce balances.
 * Pending settlements (awaiting receiver confirmation) are excluded to
 * prevent premature/optimistic balance reduction.
 */
async function computeBalanceSummary(userId: string) {
  const snapExp = await get(ref(db, 'expenses'));
  let totalReceivable = 0;
  let totalPayable = 0;
  if (snapExp.exists()) {
    Object.values(snapExp.val()).forEach((exp: any) => {
      if (!exp) return;
      const splits = safeArray<any>(exp.splits);
      if (exp.paid_by === userId) {
        totalReceivable += splits.filter((s: any) => s && s.user_id !== userId).reduce((acc: number, s: any) => acc + s.share_amount, 0);
      } else {
        const mySplit = splits.find((s: any) => s && s.user_id === userId);
        if (mySplit && mySplit.status === 'accepted') totalPayable += mySplit.share_amount;
      }
    });
  }
  const snapSettle = await get(ref(db, 'settlements'));
  if (snapSettle.exists()) {
    Object.values(snapSettle.val()).forEach((s: any) => {
      // BUG-007: was `|| s.status === 'pending'` — removed to fix premature balance reduction
      if (s.status === 'completed') {
        if (s.payer_id === userId) totalPayable -= s.amount;
        else if (s.receiver_id === userId) totalReceivable -= s.amount;
      }
    });
  }
  totalPayable = Math.max(0, Math.round(totalPayable * 100) / 100);
  totalReceivable = Math.max(0, Math.round(totalReceivable * 100) / 100);
  return { total_payable: totalPayable, total_receivable: totalReceivable, net_balance: Math.round((totalReceivable - totalPayable) * 100) / 100 };
}

async function computeUserBalances(userId: string) {
  const net: Record<string, number> = {};
  const snapExp = await get(ref(db, 'expenses'));
  if (snapExp.exists()) {
    Object.values(snapExp.val()).forEach((exp: any) => {
      if (!exp) return;
      const splits = safeArray<any>(exp.splits);
      if (exp.paid_by === userId) {
        splits.forEach((s: any) => { if (s && s.user_id !== userId) net[s.user_id] = (net[s.user_id] || 0) + s.share_amount; });
      } else {
        const mySplit = splits.find((s: any) => s && s.user_id === userId);
        if (mySplit && mySplit.status === 'accepted') net[exp.paid_by] = (net[exp.paid_by] || 0) - mySplit.share_amount;
      }
    });
  }
  const snapSettle = await get(ref(db, 'settlements'));
  if (snapSettle.exists()) {
    Object.values(snapSettle.val()).forEach((s: any) => {
      // BUG-007: only completed settlements
      if (s.status === 'completed') {
        if (s.payer_id === userId) net[s.receiver_id] = (net[s.receiver_id] || 0) + s.amount;
        else if (s.receiver_id === userId) net[s.payer_id] = (net[s.payer_id] || 0) - s.amount;
      }
    });
  }
  return Object.entries(net).map(([uid, bal]) => ({ user_id: uid, balance: Math.round(bal * 100) / 100 })).filter(item => Math.abs(item.balance) > 0.01);
}

// ─── Budgets ───────────────────────────────────────────────────────────────────
export const budgetsAPI = {
  /**
   * BUG-008 FIX: Budget object no longer stores computed `spent` / `remaining`.
   * Those values go stale the moment an expense is added or deleted.
   * summary() always derives them fresh from live expense data.
   */
  create: async (data: { month: number; year: number; amount: number }) => {
    const uid = await getCurrentUserId();
    const budgetId = `${uid}_${data.month}_${data.year}`;
    const budgetData: Budget = {
      id: budgetId, user_id: uid,
      month: data.month, year: data.year,
      amount: data.amount,
      // spent & remaining are stored as 0 here — always use summary() for live values
      spent: 0,
      remaining: data.amount,
    };
    await set(ref(db, `budgets/${budgetId}`), budgetData);
    return wrapResponse(budgetData);
  },

  list: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'budgets'));
    const budgets: Budget[] = [];
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((b: any) => {
        if (b && b.user_id === uid) budgets.push(b);
      });
    }
    return wrapResponse(budgets);
  },

  get: async (month: number, year: number) => {
    const uid = await getCurrentUserId();
    const snap = await get(ref(db, `budgets/${uid}_${month}_${year}`));
    if (!snap.exists()) throw new Error('Budget not found');
    return wrapResponse(snap.val() as Budget);
  },

  update: async (month: number, year: number, amount: number) => {
    const uid = await getCurrentUserId();
    const budgetRef = ref(db, `budgets/${uid}_${month}_${year}`);
    const snap = await get(budgetRef);
    if (!snap.exists()) throw new Error('Budget not found');
    assertOwner(snap.val().user_id, uid, 'budget');
    await update(budgetRef, { amount });
    const updated = await get(budgetRef);
    return wrapResponse(updated.val() as Budget);
  },

  summary: async (month: number, year: number) => {
    const uid = await getCurrentUserId();
    const budgetSnap = await get(ref(db, `budgets/${uid}_${month}_${year}`));
    const budgetAmount = budgetSnap.exists() ? budgetSnap.val().amount : 0;
    const snapExp = await get(ref(db, 'expenses'));
    let totalSpent = 0;
    const categorySpentMap: Record<string, number> = {};
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        if (!exp) return;
        const expDate = new Date(exp.expense_date);
        if (expDate.getMonth() + 1 === month && expDate.getFullYear() === year) {
          const splits = safeArray<any>(exp.splits);
          const mySplit = splits.find((s: any) => s && s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') {
            totalSpent += mySplit.share_amount;
            categorySpentMap[exp.category] = (categorySpentMap[exp.category] || 0) + mySplit.share_amount;
          }
        }
      });
    }
    const remaining = Math.max(0, budgetAmount - totalSpent);
    const pct = budgetAmount > 0 ? (totalSpent / budgetAmount) * 100 : 0;
    const categories = Object.entries(categorySpentMap).map(([category, spent]) => ({ category: category as Category, spent: Math.round(spent * 100) / 100 })).sort((a, b) => b.spent - a.spent);
    return wrapResponse({ month, year, total_budget: budgetAmount, total_spent: Math.round(totalSpent * 100) / 100, monthly_net_balance: 0, net_spent: Math.round(totalSpent * 100) / 100, remaining: Math.round(remaining * 100) / 100, percentage_used: Math.round(pct * 100) / 100, is_over_budget: totalSpent > budgetAmount && budgetAmount > 0, categories });
  }
};

// ─── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  dashboard: async () => {
    const uid = await getCurrentUserId();
    const snapExp = await get(ref(db, 'expenses'));
    let totalExpenses = 0;
    let totalSpent = 0;
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        if (!exp) return;
        const splits = safeArray<any>(exp.splits);
        if (exp.paid_by === uid || splits.some((s: any) => s && s.user_id === uid)) totalExpenses++;
        const mySplit = splits.find((s: any) => s && s.user_id === uid);
        if (mySplit && mySplit.status === 'accepted') totalSpent += mySplit.share_amount;
      });
    }
    const balance = await computeBalanceSummary(uid);
    return wrapResponse({ total_expenses: totalExpenses, total_spent: Math.round(totalSpent * 100) / 100, ...balance });
  },

  monthly: async (year?: number) => {
    const uid = await getCurrentUserId();
    const y = year ?? new Date().getFullYear();
    const snapExp = await get(ref(db, 'expenses'));
    const monthlySum: Record<number, number> = {};
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        if (!exp) return;
        const expDate = new Date(exp.expense_date);
        if (expDate.getFullYear() === y) {
          const splits = safeArray<any>(exp.splits);
          const mySplit = splits.find((s: any) => s && s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') {
            const m = expDate.getMonth() + 1;
            monthlySum[m] = (monthlySum[m] || 0) + mySplit.share_amount;
          }
        }
      });
    }
    const data = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: Math.round((monthlySum[i + 1] || 0) * 100) / 100 }));
    return wrapResponse({ year: y, data });
  },

  categories: async (month?: number, year?: number) => {
    const uid = await getCurrentUserId();
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();
    const snapExp = await get(ref(db, 'expenses'));
    const categorySum: Record<string, number> = {};
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        if (!exp) return;
        const expDate = new Date(exp.expense_date);
        if (expDate.getMonth() + 1 === m && expDate.getFullYear() === y) {
          const splits = safeArray<any>(exp.splits);
          const mySplit = splits.find((s: any) => s && s.user_id === uid);
          if (mySplit && mySplit.status === 'accepted') categorySum[exp.category] = (categorySum[exp.category] || 0) + mySplit.share_amount;
        }
      });
    }
    return wrapResponse({ month: m, year: y, data: Object.entries(categorySum).map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 })) });
  },

  trends: async (months = 6) => {
    const uid = await getCurrentUserId();
    const snapExp = await get(ref(db, 'expenses'));
    const monthlySum: Record<string, number> = {};
    if (snapExp.exists()) {
      Object.values(snapExp.val()).forEach((exp: any) => {
        if (!exp) return;
        const expDate = new Date(exp.expense_date);
        const splits = safeArray<any>(exp.splits);
        const mySplit = splits.find((s: any) => s && s.user_id === uid);
        if (mySplit && mySplit.status === 'accepted') {
          const key = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
          monthlySum[key] = (monthlySum[key] || 0) + mySplit.share_amount;
        }
      });
    }
    const sorted = Object.entries(monthlySum).sort((a, b) => a[0].localeCompare(b[0])).slice(-months).map(([key, total]) => {
      const [y, mon] = key.split('-');
      return { year: parseInt(y), month: parseInt(mon), total: Math.round(total * 100) / 100 };
    });
    return wrapResponse({ data: sorted });
  }
};

// ─── Notifications ─────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'notifications'));
    const notifications: Notification[] = [];
    let unreadCount = 0;
    if (snapshot.exists()) {
      Object.values(snapshot.val()).forEach((n: any) => {
        if (n && n.user_id === uid) {
          notifications.push(n);
          if (!n.is_read) unreadCount++;
        }
      });
    }
    notifications.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return wrapResponse({ notifications, unread_count: unreadCount });
  },

  readAll: async () => {
    const uid = await getCurrentUserId();
    const snapshot = await get(ref(db, 'notifications'));
    if (snapshot.exists()) {
      const updates: Record<string, any> = {};
      Object.entries(snapshot.val()).forEach(([key, n]: [string, any]) => {
        if (n.user_id === uid && !n.is_read) updates[`notifications/${key}/is_read`] = true;
      });
      if (Object.keys(updates).length > 0) await update(ref(db), updates);
    }
    return wrapResponse({ success: true });
  }
};

// ─── Internal helpers ──────────────────────────────────────────────────────────
async function createNotification(userId: string, title: string, message: string, type: string) {
  try {
    const notificationRef = push(ref(db, 'notifications'));
    const notificationId = notificationRef.key;
    if (notificationId) {
      await set(notificationRef, {
        id: notificationId, user_id: userId, title, message,
        notification_type: type, is_read: false, created_at: new Date().toISOString()
      });
    }
    // Push notification — fire-and-forget, never blocks caller
    const userSnap = await get(ref(db, `users/${userId}`));
    if (userSnap.exists()) {
      const recipient = userSnap.val();
      if (recipient?.push_token) {
        fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Accept-encoding': 'gzip, deflate', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: recipient.push_token,
            sound: 'default',
            title,
            body: message,
            data: { type },
            channelId: 'default',
            priority: 'high'
          }),
        }).catch(() => { /* push failure never crashes parent */ });
      }
    }
  } catch (err) {
    console.error('[Notification] Failed to create in-app notification:', err);
  }
}
