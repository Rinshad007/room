import type { Params } from '../catalog.js';
import { digest, notify, page } from './expenses.js';
import { balances } from './analytics.js';
import { amount, cents } from './money.js';
import { areFriends, ensure, getGroup, members, publicUser, splits, userExists, values, type State } from './model.js';

export const defaultCategories = [{ name: 'Food', icon: '🍔' }, { name: 'Travel', icon: '🚌' }, { name: 'Shopping', icon: '🛍️' }, { name: 'Rent', icon: '🏠' }, { name: 'Entertainment', icon: '🎬' }, { name: 'Others', icon: '📦' }];
export function socialAction(name: string, p: Params, state: State, uid: string, operationId: string, now: string): unknown {
  const user = userExists(state, uid);
  if (name === 'get_profile') return { id: uid, name: user.name, email: user.email, created_at: user.created_at, ...(user.upi_id ? { upi_id: user.upi_id } : {}), ...(user.mobile_number ? { mobile_number: user.mobile_number } : {}), ...(user.avatar_url ? { avatar_url: user.avatar_url } : {}) };
  if (name === 'get_user') return publicUser(userExists(state, p.id!));
  if (name === 'update_profile') {
    ensure(Object.keys(p).length, 'INVALID_INPUT', 'Supply a profile field to update.');
    for (const key of ['name', 'upi_id', 'mobile_number', 'avatar_url'] as const) if (p[key] !== undefined) user[key] = p[key]!;
    return socialAction('get_profile', {}, state, uid, operationId, now);
  }
  if (name === 'search_users') {
    const query = p.query!.toLowerCase();
    return page(values(state.users).filter(u => u.id !== uid && `${u.name} ${u.email}`.toLowerCase().includes(query)).sort((a, b) => a.id.localeCompare(b.id)).map(publicUser), p);
  }
  if (name === 'list_categories') return { items: [...defaultCategories, ...Object.values(user.custom_categories ?? {})] };
  if (name === 'create_category' || name === 'delete_category') {
    const normalized = p.name!.toLowerCase();
    ensure(!defaultCategories.some(c => c.name.toLowerCase() === normalized), 'CONFLICT', 'Built-in categories cannot be changed.');
    user.custom_categories ??= {};
    const existing = Object.entries(user.custom_categories).find(([, category]) => category.name.toLowerCase() === normalized);
    if (name === 'create_category') {
      ensure(!existing, 'CONFLICT', 'Category already exists.');
      user.custom_categories[operationId] = { name: p.name!, icon: p.icon! };
      return user.custom_categories[operationId];
    }
    ensure(existing, 'NOT_FOUND', 'Custom category not found.');
    delete user.custom_categories[existing[0]];
    return { deleted: true, name: p.name };
  }
  if (name === 'list_groups') return page(values(state.groups).filter(g => members(g).includes(uid)).sort((a, b) => a.id.localeCompare(b.id)).map(g => ({ ...g, members: members(g).map(id => state.users[id] ? publicUser(state.users[id]!) : { id, name: 'Deleted user' }) })), p);
  if (name === 'create_group') {
    const group = { id: operationId, name: p.name!, description: p.description!, created_by: uid, created_at: now, members: { [uid]: true } };
    state.groups[operationId] = group;
    return group;
  }
  if (['get_group', 'update_group', 'delete_group', 'add_group_member', 'remove_group_member'].includes(name)) {
    const group = getGroup(state, p.id!, uid, name !== 'get_group');
    if (name === 'get_group') return { ...group, members: members(group).map(id => state.users[id] ? publicUser(state.users[id]!) : { id, name: 'Deleted user' }) };
    if (name === 'update_group') {
      ensure(p.name !== undefined || p.description !== undefined, 'INVALID_INPUT', 'Supply a group field to update.');
      if (p.name !== undefined) group.name = p.name;
      if (p.description !== undefined) group.description = p.description;
      return group;
    }
    const expenses = values(state.expenses).filter(e => e.group_id === group.id);
    if (name === 'delete_group') {
      ensure(!expenses.length, 'CONFLICT', 'Group still has expenses. Preserve or remove those records first.');
      delete state.groups[group.id]; return { deleted: true, id: group.id };
    }
    const ids = new Set(members(group));
    if (name === 'add_group_member') {
      userExists(state, p.user_id!);
      ensure(areFriends(state, uid, p.user_id!), 'FORBIDDEN', 'Only accepted friends can be added.');
      ids.add(p.user_id!);
    } else {
      ensure(p.user_id !== group.created_by, 'CONFLICT', 'The group creator cannot be removed.');
      ensure(!expenses.some(e => e.paid_by === p.user_id || splits(e).some(s => s.user_id === p.user_id)), 'CONFLICT', 'This member has group expenses; retain them to preserve shared history.');
      ids.delete(p.user_id!);
    }
    group.members = Object.fromEntries([...ids].map(id => [id, true]));
    return group;
  }
  const ownFriendships = values(state.friendships).filter(f => f.sender_id === uid || f.receiver_id === uid);
  const withFriend = (f: typeof ownFriendships[number]) => ({ ...f, friend: state.users[f.sender_id === uid ? f.receiver_id : f.sender_id] ? publicUser(state.users[f.sender_id === uid ? f.receiver_id : f.sender_id]!) : null });
  if (name === 'list_friends') return page(ownFriendships.filter(f => f.status === 'accepted').sort((a, b) => a.id.localeCompare(b.id)).map(withFriend), p);
  if (name === 'list_friend_requests') return { received: ownFriendships.filter(f => f.status === 'pending' && f.receiver_id === uid).map(withFriend), sent: ownFriendships.filter(f => f.status === 'pending' && f.sender_id === uid).map(withFriend) };
  if (name === 'send_friend_request') {
    userExists(state, p.user_id!);
    ensure(uid !== p.user_id, 'INVALID_INPUT', 'Cannot send yourself a friend request.');
    const existing = ownFriendships.find(f => (f.sender_id === p.user_id || f.receiver_id === p.user_id) && f.status !== 'rejected');
    if (existing) return existing;
    const request = { id: operationId, sender_id: uid, receiver_id: p.user_id!, status: 'pending' as const, created_at: now };
    state.friendships[operationId] = request;
    notify(state, p.user_id!, operationId, 'Friend Request', `${user.name} sent you a friend request.`, 'friend_request', now);
    return request;
  }
  if (['accept_friend_request', 'reject_friend_request', 'remove_friend'].includes(name)) {
    const friendship = state.friendships[p.id!];
    ensure(friendship && (friendship.sender_id === uid || friendship.receiver_id === uid), 'NOT_FOUND', 'Friendship not found.');
    if (name === 'remove_friend') { delete state.friendships[friendship.id]; return { deleted: true, id: friendship.id }; }
    ensure(friendship.receiver_id === uid, 'FORBIDDEN', 'Only the recipient can respond to this request.');
    const status = name === 'accept_friend_request' ? 'accepted' : 'rejected';
    ensure(friendship.status === 'pending' || friendship.status === status, 'CONFLICT', 'This request was already answered.');
    friendship.status = status;
    return friendship;
  }
  if (name === 'list_settlements') return page(values(state.settlements).filter(s => s.payer_id === uid || s.receiver_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id)), p);
  if (name === 'record_settlement') {
    userExists(state, p.receiver_id!);
    ensure(p.receiver_id !== uid, 'INVALID_INPUT', 'Cannot settle with yourself.');
    const b = balances(state, uid);
    const owed = -cents(b.per_user.find(b => b.user_id === p.receiver_id)?.balance ?? 0);
    const pending = cents(b.pending_payments.per_user.find(b => b.user_id === p.receiver_id)?.outgoing ?? 0);
    ensure(cents(p.amount!) <= owed - pending, 'INVALID_AMOUNT', `Payment exceeds the confirmed debt available after pending payments (${amount(Math.max(0, owed - pending))}).`);
    const settlement = { id: operationId, payer_id: uid, receiver_id: p.receiver_id!, amount: p.amount!, payment_method: p.payment_method!, status: 'pending' as const, created_at: now };
    state.settlements[operationId] = settlement;
    notify(state, p.receiver_id!, operationId, 'Settlement Pending Confirmation', `${user.name} recorded a payment of ${p.amount}. Please confirm receipt.`, 'settlement_pending', now);
    return settlement;
  }
  if (name === 'approve_settlement') {
    const settlement = state.settlements[p.id!];
    ensure(settlement && settlement.receiver_id === uid, 'NOT_FOUND', 'Receivable settlement not found.');
    if (settlement.status === 'completed') return settlement;
    settlement.status = 'completed'; settlement.settled_at = now;
    notify(state, settlement.payer_id, operationId, 'Settlement Approved', `${user.name} confirmed your payment.`, 'settlement_completed', now);
    return settlement;
  }
  if (name === 'list_notifications') {
    const own = values(state.notifications).filter(n => n.user_id === uid).sort((a, b) => b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id));
    return { ...page(own, p), unread_count: own.filter(n => !n.is_read).length };
  }
  if (name === 'mark_notifications_read') {
    if (p.ids) for (const id of p.ids) ensure(state.notifications[id]?.user_id === uid, 'NOT_FOUND', 'Notification not found.');
    let count = 0;
    for (const notification of values(state.notifications)) if (notification.user_id === uid && !notification.is_read && (!p.ids || p.ids.includes(notification.id))) { notification.is_read = true; count++; }
    return { marked_read: count };
  }
  if (name === 'get_telegram_status') return { available: false, reason: 'The external Telegram bot authenticated linking API has not been integrated. Use the existing BudgetBuddy app integration when configured.' };
  ensure(false, 'UNKNOWN_TOOL', 'Unknown operation.');
}
