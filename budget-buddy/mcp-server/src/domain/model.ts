export interface User { id: string; name: string; email: string; created_at: string; avatar_url?: string; upi_id?: string; mobile_number?: string; custom_categories?: Record<string, { name: string; icon: string }> }
export interface Split { id: string; user_id: string; share_amount: number; status: 'pending' | 'accepted' | 'disputed' }
export interface Expense { id: string; title: string; description: string; amount: number; paid_by: string; category: string; payment_method: string; expense_date: string; created_at: string; group_id?: string; split_type: 'equal' | 'percentage' | 'custom'; splits: Split[]; }
export interface Group { id: string; name: string; description?: string; created_by: string; created_at: string; members: unknown }
export interface Friendship { id: string; sender_id: string; receiver_id: string; status: 'pending' | 'accepted' | 'rejected'; created_at: string }
export interface Settlement { id: string; payer_id: string; receiver_id: string; amount: number; payment_method: string; status: 'pending' | 'completed'; created_at: string; settled_at?: string }
export interface Budget { id: string; user_id: string; month: number; year: number; amount: number; spent: number; remaining: number }
export interface Notification { id: string; user_id: string; title: string; message: string; notification_type: string; is_read: boolean; created_at: string }
export interface State {
  users: Record<string, User>;
  expenses: Record<string, Expense>;
  groups: Record<string, Group>;
  friendships: Record<string, Friendship>;
  settlements: Record<string, Settlement>;
  budgets: Record<string, Budget>;
  notifications: Record<string, Notification>;
  mcp_private?: { operations?: Record<string, { hash: string; result: unknown; created_at: string }>; [key: string]: unknown };
  [key: string]: unknown;
}
export class DomainError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}
export function ensure(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message);
}
export function normalizeState(current: State | null): State {
  const state = current ?? {} as State;
  for (const key of ['users', 'expenses', 'groups', 'friendships', 'settlements', 'budgets', 'notifications'] as const) state[key] ??= {};
  ensure(['users', 'expenses', 'groups', 'friendships', 'settlements', 'budgets', 'notifications'].reduce((n, key) => n + Object.keys(state[key] as object).length, 0) <= 50000, 'DATASET_LIMIT', 'This database exceeds the 50,000-record scan limit. Indexed storage is required; no partial totals were returned.');
  return state;
}
export function members(group: Group): string[] {
  const value = group.members;
  if (Array.isArray(value)) return value.map(item => typeof item === 'string' ? item : item?.user?.id ?? item?.user_id ?? item?.id).filter((item): item is string => typeof item === 'string');
  return value && typeof value === 'object' ? Object.entries(value).filter(([, v]) => Boolean(v)).map(([k]) => k) : [];
}
export const splits = (expense: Expense): Split[] => Object.values(expense.splits ?? {}).filter(Boolean);
export const values = <T>(table: Record<string, T>): T[] => Object.values(table).filter(Boolean);
export const publicUser = (user: User) => ({ id: user.id, name: user.name, email: user.email, created_at: user.created_at });
export function userExists(state: State, uid: string): User {
  const user = state.users[uid];
  ensure(user, 'NOT_FOUND', 'User not found. Register in BudgetBuddy first.');
  return user;
}
export const areFriends = (state: State, a: string, b: string) => a === b || values(state.friendships).some(f => f.status === 'accepted' && ((f.sender_id === a && f.receiver_id === b) || (f.sender_id === b && f.receiver_id === a)));
export function visibleExpense(state: State, expense: Expense | undefined, uid: string): expense is Expense {
  return Boolean(expense && (expense.paid_by === uid || splits(expense).some(s => s.user_id === uid) || (expense.group_id && state.groups[expense.group_id] && members(state.groups[expense.group_id]!).includes(uid))));
}
export const ownExpenses = (state: State, uid: string) => values(state.expenses).filter(e => e.paid_by === uid || splits(e).some(s => s.user_id === uid));
export function getGroup(state: State, id: string, uid: string, owner = false): Group {
  const group = state.groups[id];
  ensure(group && members(group).includes(uid), 'NOT_FOUND', 'Group not found.');
  ensure(!owner || group.created_by === uid, 'FORBIDDEN', 'Only the group creator can change this group.');
  return group;
}
