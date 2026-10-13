import type { Params } from '../catalog.js';
import { amount, cents } from './money.js';
import { ensure, ownExpenses, splits, values, type State } from './model.js';
import { page } from './expenses.js';

export function localDate(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(kind => parts.find(p => p.type === kind)!.value).join('-');
}
export function balances(state: State, uid: string) {
  const net: Record<string, number> = Object.create(null);
  const pending: Record<string, { incoming: number; outgoing: number }> = Object.create(null);
  const add = (other: string, value: number) => { net[other] = (net[other] ?? 0) + value; };
  for (const expense of ownExpenses(state, uid)) {
    if (expense.paid_by === uid) for (const s of splits(expense)) { if (s.user_id !== uid && s.status === 'accepted') add(s.user_id, cents(s.share_amount)); }
    else { const own = splits(expense).find(s => s.user_id === uid && s.status === 'accepted'); if (own) add(expense.paid_by, -cents(own.share_amount)); }
  }
  for (const s of values(state.settlements)) {
    if (s.payer_id !== uid && s.receiver_id !== uid) continue;
    const other = s.payer_id === uid ? s.receiver_id : s.payer_id;
    if (s.status === 'completed') add(other, (s.payer_id === uid ? 1 : -1) * cents(s.amount));
    else if (s.status === 'pending') {
      pending[other] ??= { incoming: 0, outgoing: 0 };
      pending[other]![s.payer_id === uid ? 'outgoing' : 'incoming'] += cents(s.amount);
    }
  }
  const per_user = Object.entries(net).filter(([, value]) => value !== 0).map(([user_id, value]) => ({ user_id, balance: amount(value) })).sort((a, b) => a.user_id.localeCompare(b.user_id));
  const receivable = Object.values(net).reduce((n, value) => n + Math.max(0, value), 0);
  const payable = Object.values(net).reduce((n, value) => n + Math.max(0, -value), 0);
  return { summary: { total_receivable: amount(receivable), total_payable: amount(payable), net_balance: amount(receivable - payable) }, per_user,
    pending_payments: { incoming: amount(Object.values(pending).reduce((n, p) => n + p.incoming, 0)), outgoing: amount(Object.values(pending).reduce((n, p) => n + p.outgoing, 0)), per_user: Object.entries(pending).map(([user_id, p]) => ({ user_id, incoming: amount(p.incoming), outgoing: amount(p.outgoing) })) } };
}
function spending(state: State, uid: string, prefix = '') {
  return ownExpenses(state, uid).filter(e => e.expense_date.startsWith(prefix)).map(e => ({ expense: e, share: splits(e).find(s => s.user_id === uid && s.status === 'accepted')?.share_amount ?? 0 }));
}
const total = (rows: ReturnType<typeof spending>) => amount(rows.reduce((n, r) => n + cents(r.share), 0));
const monthPrefix = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;
function categories(state: State, uid: string, year: number, month: number) {
  const sums: Record<string, number> = Object.create(null);
  for (const row of spending(state, uid, monthPrefix(year, month))) if (row.share) sums[row.expense.category] = (sums[row.expense.category] ?? 0) + cents(row.share);
  return Object.entries(sums).map(([category, value]) => ({ category, total: amount(value) })).sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
}
export function analyticsAction(name: string, p: Params, state: State, uid: string, today: string): unknown {
  if (name === 'get_balances') return balances(state, uid);
  if (name === 'get_dashboard') return { total_expenses: ownExpenses(state, uid).length, total_spent: total(spending(state, uid)), ...balances(state, uid) };
  if (name === 'get_monthly_spending') return { year: p.year, data: Array.from({ length: 12 }, (_, i) => ({ month: i + 1, total: total(spending(state, uid, monthPrefix(p.year!, i + 1))) })) };
  if (name === 'get_category_spending') return { month: p.month, year: p.year, data: categories(state, uid, p.year!, p.month!) };
  if (name === 'get_spending_trends') {
    const date = new Date(`${today}T00:00:00Z`);
    return { data: Array.from({ length: p.months! }, (_, i) => { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - p.months! + 1 + i, 1)); const year = d.getUTCFullYear(), month = d.getUTCMonth() + 1; return { year, month, total: total(spending(state, uid, monthPrefix(year, month))) }; }) };
  }
  if (name === 'list_budgets') return page(values(state.budgets).filter(b => b.user_id === uid).sort((a, b) => b.year - a.year || b.month - a.month), p);
  const id = `${uid}_${p.month}_${p.year}`;
  if (name === 'create_budget') {
    ensure(!state.budgets[id], 'CONFLICT', 'Budget already exists. Use update_budget.');
    state.budgets[id] = { id, user_id: uid, month: p.month!, year: p.year!, amount: p.amount!, spent: 0, remaining: p.amount! };
    return state.budgets[id];
  }
  const budget = state.budgets[id];
  if (name === 'get_budget_summary') {
    const spent = total(spending(state, uid, monthPrefix(p.year!, p.month!))), limit = budget?.amount ?? 0;
    return { month: p.month, year: p.year, has_budget: Boolean(budget), total_budget: limit, total_spent: spent, remaining: amount(cents(limit) - cents(spent)), percentage_used: limit ? Math.round(spent / limit * 10000) / 100 : 0, is_over_budget: Boolean(budget && spent > limit), categories: categories(state, uid, p.year!, p.month!) };
  }
  ensure(budget && budget.user_id === uid, 'NOT_FOUND', 'Budget not found.');
  if (name === 'update_budget') { budget.amount = p.amount!; budget.spent = total(spending(state, uid, monthPrefix(p.year!, p.month!))); budget.remaining = amount(cents(budget.amount) - cents(budget.spent)); }
  return budget;
}
