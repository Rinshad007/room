import { createHash } from 'node:crypto';
import type { Params } from '../catalog.js';
import { allocate, amount, cents } from './money.js';
import { areFriends, ensure, getGroup, members, splits, userExists, values, visibleExpense, type Expense, type State, type Split } from './model.js';

export function digest(value: unknown): string {
  const canonical = (item: unknown): unknown => Array.isArray(item) ? item.map(canonical) : item && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])) : item;
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
export const revised = <T extends object>(record: T) => ({ ...record, revision: digest(record) });
export function page<T>(items: T[], p: Params) {
  const offset = p.offset ?? 0, limit = p.limit ?? 25;
  return { items: items.slice(offset, offset + limit), total: items.length, next_offset: offset + limit < items.length ? offset + limit : null };
}
export function notify(state: State, user: string, operationId: string, title: string, message: string, type: string, now: string) {
  const id = `${operationId}_${user}`;
  state.notifications[id] = { id, user_id: user, title, message, notification_type: type, is_read: false, created_at: now };
}

function splitAmounts(total: number, participants: string[], kind: Expense['split_type'], details: Params['split_details']): number[] {
  if (kind === 'equal') return allocate(cents(total), participants.map(() => 1));
  ensure(details && details.length === participants.length && new Set(details.map(d => d.user_id)).size === participants.length, 'INVALID_SPLIT', 'Supply one split allocation per participant.');
  const weights = participants.map(uid => {
    const detail = details.find(d => d.user_id === uid);
    ensure(detail, 'INVALID_SPLIT', 'Every participant needs a split allocation.');
    return cents(detail.value);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  ensure(sum === (kind === 'percentage' ? 10000 : cents(total)), 'INVALID_SPLIT', kind === 'percentage' ? 'Split percentages must total 100.' : 'Custom split amounts must equal the expense amount.');
  return kind === 'custom' ? weights : allocate(cents(total), weights);
}

export function expenseAction(name: string, p: Params, state: State, uid: string, operationId: string, now: string): unknown {
  if (name === 'list_expenses') {
    ensure(!p.start_date || !p.end_date || p.start_date <= p.end_date, 'INVALID_DATE_RANGE', 'Start date must not follow end date.');
    if (p.group_id) getGroup(state, p.group_id, uid);
    const items = values(state.expenses).filter(e => visibleExpense(state, e, uid))
      .filter(e => !p.group_id || e.group_id === p.group_id).filter(e => !p.category || e.category.toLowerCase() === p.category.toLowerCase())
      .filter(e => !p.query || `${e.title} ${e.description ?? ''}`.toLowerCase().includes(p.query.toLowerCase()))
      .filter(e => !p.start_date || e.expense_date >= p.start_date).filter(e => !p.end_date || e.expense_date <= p.end_date)
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date) || a.id.localeCompare(b.id));
    return page(items.map(revised), p);
  }
  if (name === 'create_expense') {
    const participants = p.participants ?? [uid];
    ensure(new Set(participants).size === participants.length, 'INVALID_SPLIT', 'Participants must be distinct.');
    const group = p.group_id ? getGroup(state, p.group_id, uid) : undefined;
    for (const participant of participants) {
      userExists(state, participant);
      ensure(group ? members(group).includes(participant) : areFriends(state, uid, participant), 'FORBIDDEN', 'Participants must be friends or members of this group.');
    }
    const shares = splitAmounts(p.amount!, participants, p.split_type!, p.split_details);
    const expense: Expense = {
      id: operationId, title: p.title!, description: p.description ?? '', amount: p.amount!, paid_by: uid,
      category: p.category!, payment_method: p.payment_method!, expense_date: p.expense_date!, created_at: now,
      split_type: p.split_type!, splits: participants.map((participant, i) => ({ id: `${operationId}_split_${i}`, user_id: participant, share_amount: amount(shares[i]!), status: participant === uid ? 'accepted' : 'pending' })),
      ...(p.group_id ? { group_id: p.group_id } : {}),
    };
    state.expenses[operationId] = expense;
    for (const participant of participants.filter(p => p !== uid)) notify(state, participant, operationId, 'Expense Added', `${userExists(state, uid).name} added expense "${expense.title}". Review your share.`, 'expense_added', now);
    return revised(expense);
  }
  const expense = state.expenses[p.id ?? p.expense_id!];
  ensure(visibleExpense(state, expense, uid), 'NOT_FOUND', 'Expense not found.');
  if (name === 'get_expense') return revised(expense);
  if (name === 'update_split_status') {
    ensure(digest(expense) === p.expected_revision, 'CONFLICT', 'Expense changed. Read its latest revision before acknowledging this share.');
    const own = splits(expense).find(s => s.user_id === uid);
    ensure(own && expense.paid_by !== uid, 'FORBIDDEN', 'Only a non-payer participant can acknowledge their own share.');
    own.status = p.status!;
    expense.splits = splits(expense);
    return revised(expense);
  }
  ensure(expense.paid_by === uid, 'FORBIDDEN', 'Only the payer can change this expense.');
  ensure(digest(expense) === p.expected_revision, 'CONFLICT', 'Expense changed. Read its latest revision before retrying.');
  if (name === 'delete_expense') {
    delete state.expenses[expense.id];
    for (const s of splits(expense).filter(s => s.user_id !== uid)) notify(state, s.user_id, operationId, 'Expense Removed', `${expense.title} was removed by its payer.`, 'expense_deleted', now);
    return { deleted: true, id: expense.id };
  }
  ensure(name === 'update_expense', 'UNKNOWN_TOOL', 'Unknown expense operation.');
  ensure(Object.keys(p).some(k => k !== 'id' && k !== 'expected_revision'), 'INVALID_INPUT', 'Supply at least one field to update.');
  const old = splits(expense);
  const allocationChanged = (p.amount !== undefined && p.amount !== expense.amount) || p.split_details !== undefined;
  if (allocationChanged) {
    const shares = splitAmounts(p.amount ?? expense.amount, old.map(s => s.user_id), expense.split_type, p.split_details);
    expense.splits = old.map((s, i): Split => ({ ...s, share_amount: amount(shares[i]!), status: s.user_id === uid ? 'accepted' : cents(s.share_amount) === shares[i] ? s.status : 'pending' }));
  }
  for (const key of ['title', 'description', 'amount', 'category', 'payment_method', 'expense_date'] as const) {
    if (p[key] !== undefined) Object.assign(expense, { [key]: p[key] });
  }
  for (const s of old.filter(s => s.user_id !== uid)) notify(state, s.user_id, operationId, 'Expense Updated', `${expense.title} was updated. Review the latest details.`, 'expense_updated', now);
  return revised(expense);
}
