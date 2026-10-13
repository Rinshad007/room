import { beforeEach, describe, expect, it } from 'vitest';
import { BudgetService } from '../src/service.js';
import { MemoryStore, seed } from './helpers.js';

const alice = { uid: 'alice', scopes: ['budgetbuddy:read', 'budgetbuddy:write'] };
const bob = { ...alice, uid: 'bob' };
const eve = { ...alice, uid: 'eve' };
let store: MemoryStore, service: BudgetService;
const expense = (extra = {}) => ({ title: 'Lunch', amount: 100, category: 'Food', payment_method: 'Cash', expense_date: '2026-10-12', request_id: 'expense-001', ...extra });
const run = (name: string, input: unknown = {}, actor = alice) => service.execute(name, input, actor);
beforeEach(() => {
  store = new MemoryStore(seed());
  service = new BudgetService(store, { currency: 'INR', timezone: 'Asia/Kolkata', appUrl: 'https://app.example.test', now: () => new Date('2026-10-12T20:00:00Z') });
});

describe('expense lifecycle and identity', () => {
  it('creates a personal expense visible to the app and accepted-share analytics', async () => {
    const created = await run('create_expense', expense());
    expect(created).toMatchObject({ amount: 100, paid_by: 'alice', splits: [{ user_id: 'alice', share_amount: 100, status: 'accepted' }] });
    expect(store.data.expenses[created.id].title).toBe('Lunch');
    expect(await run('get_dashboard')).toMatchObject({ total_expenses: 1, total_spent: 100 });
  });
  it('never leaks a personal expense to a different authenticated account', async () => {
    const created = await run('create_expense', expense());
    expect(await run('list_expenses', {}, eve)).toMatchObject({ items: [], total: 0 });
    await expect(run('get_expense', { id: created.id }, eve)).rejects.toThrow(/not found/i);
    await expect(run('delete_expense', { id: created.id, expected_revision: created.revision }, eve)).rejects.toThrow();
  });
  it('does not allow caller spoofing or arbitrary property writes', async () => {
    await expect(run('create_expense', { ...expense(), paid_by: 'eve' })).rejects.toThrow();
    await expect(run('update_profile', { id: 'eve', name: 'Imposter' })).rejects.toThrow();
    await expect(run('get_expense', { id: '../users/alice' })).rejects.toThrow();
    await expect(run('get_user', { id: '__proto__' })).rejects.toThrow();
  });
  it('rejects writes with a read-only scope', async () => {
    await expect(run('create_expense', expense(), { uid: 'alice', scopes: ['budgetbuddy:read'] })).rejects.toThrow(/scope/i);
  });
  it('makes concurrent retries idempotent and detects a conflicting request payload', async () => {
    const results = await Promise.all([run('create_expense', expense()), run('create_expense', expense())]);
    expect(results[0].id).toBe(results[1].id);
    expect(Object.keys(store.data.expenses)).toHaveLength(1);
    await expect(run('create_expense', expense({ amount: 2 }))).rejects.toThrow(/request|idempoten/i);
  });
  it('rejects invalid amounts and calendar dates before writing', async () => {
    for (const input of [{ amount: 0 }, { amount: -1 }, { amount: 1.001 }, { amount: Infinity }, { expense_date: '2026-02-30' }]) {
      await expect(run('create_expense', expense(input))).rejects.toThrow();
    }
    expect(store.data.expenses).toBeUndefined();
  });
  it('updates total and personal share together, then deletes by revision', async () => {
    const created = await run('create_expense', expense());
    const updated = await run('update_expense', { id: created.id, expected_revision: created.revision, amount: 200 });
    expect(updated.splits[0].share_amount).toBe(200);
    expect((await run('get_dashboard')).total_spent).toBe(200);
    await expect(run('update_expense', { id: created.id, expected_revision: created.revision, title: 'Stale' })).rejects.toThrow(/changed|revision|stale/i);
    await run('delete_expense', { id: updated.id, expected_revision: updated.revision });
    expect((await run('get_dashboard')).total_spent).toBe(0);
  });
  it('detects edits by the legacy app which does not set a version field', async () => {
    const created = await run('create_expense', expense());
    store.data.expenses[created.id].description = 'Changed in the web app';
    await expect(run('delete_expense', { id: created.id, expected_revision: created.revision })).rejects.toThrow(/changed|revision|stale/i);
  });
  it('filters, sorts and paginates without returning another account records', async () => {
    await run('create_expense', expense());
    await run('create_expense', expense({ request_id: 'expense-002', title: 'Train', category: 'Travel', expense_date: '2026-09-01' }));
    expect(await run('list_expenses', { category: 'Food', start_date: '2026-10-01', end_date: '2026-10-31', query: 'lun', limit: 1 })).toMatchObject({ total: 1, items: [{ title: 'Lunch' }], next_offset: null });
  });
});

describe('shared expenses', () => {
  it('allocates every cent and makes new other-user obligations pending', async () => {
    store.data.groups.trip.members.eve = true;
    const shared = await run('create_expense', expense({ group_id: 'trip', participants: ['alice', 'bob', 'eve'] }));
    expect(shared.splits.map((s: any) => s.share_amount)).toEqual([33.34, 33.33, 33.33]);
    expect(shared.splits.map((s: any) => s.status)).toEqual(['accepted', 'pending', 'pending']);
    expect(Object.values(store.data.notifications)).toHaveLength(2);
    expect((await run('get_dashboard', {}, bob)).total_spent).toBe(0);
    await run('update_split_status', { expense_id: shared.id, expected_revision: shared.revision, status: 'accepted' }, bob);
    expect((await run('get_dashboard', {}, bob)).total_spent).toBe(33.33);
  });
  it('checks participants, ownership, percentages and custom totals', async () => {
    await expect(run('create_expense', expense({ participants: ['alice', 'eve'] }))).rejects.toThrow();
    await expect(run('create_expense', expense({ participants: ['alice', 'alice'] }))).rejects.toThrow();
    await expect(run('create_expense', expense({ participants: ['alice', 'bob'], split_type: 'percentage', split_details: [{ user_id: 'alice', value: 70 }, { user_id: 'bob', value: 20 }] }))).rejects.toThrow();
    await expect(run('create_expense', expense({ participants: ['alice', 'bob'], split_type: 'custom', split_details: [{ user_id: 'alice', value: 30 }, { user_id: 'bob', value: 30 }] }))).rejects.toThrow();
    const shared = await run('create_expense', expense({ participants: ['alice', 'bob'] }));
    await expect(run('update_expense', { id: shared.id, expected_revision: shared.revision, title: 'Bob changed' }, bob)).rejects.toThrow();
    await expect(run('update_split_status', { expense_id: shared.id, expected_revision: shared.revision, status: 'accepted' }, eve)).rejects.toThrow();
  });
  it('requires replacement allocation when changing a custom total', async () => {
    const shared = await run('create_expense', expense({ participants: ['alice', 'bob'], split_type: 'custom', split_details: [{ user_id: 'alice', value: 30 }, { user_id: 'bob', value: 70 }] }));
    await expect(run('update_expense', { id: shared.id, expected_revision: shared.revision, amount: 200 })).rejects.toThrow(/allocation|split/i);
    const updated = await run('update_expense', { id: shared.id, expected_revision: shared.revision, amount: 200, split_details: [{ user_id: 'alice', value: 50 }, { user_id: 'bob', value: 150 }] });
    expect(updated.splits.map((s: any) => s.share_amount)).toEqual([50, 150]);
  });
  it('allocates valid percentages and resets only the shares that change', async () => {
    const shared = await run('create_expense', expense({ participants: ['alice', 'bob'], split_type: 'percentage', split_details: [{ user_id: 'alice', value: 25 }, { user_id: 'bob', value: 75 }] }));
    expect(shared.splits.map((s: any) => s.share_amount)).toEqual([25, 75]);
    const accepted = await run('update_split_status', { expense_id: shared.id, expected_revision: shared.revision, status: 'accepted' }, bob);
    const updated = await run('update_expense', { id: shared.id, expected_revision: accepted.revision, amount: 200, split_details: [{ user_id: 'alice', value: 25 }, { user_id: 'bob', value: 75 }] });
    expect(updated.splits[1]).toMatchObject({ share_amount: 150, status: 'pending' });
  });
  it('never accepts a changed debt using an old revision', async () => {
    const shared = await run('create_expense', expense({ participants: ['alice', 'bob'] }));
    await run('update_expense', { id: shared.id, expected_revision: shared.revision, amount: 200 });
    await expect(run('update_split_status', { expense_id: shared.id, expected_revision: shared.revision, status: 'accepted' }, bob)).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('analytics and budgets', () => {
  it('uses timezone for today and returns zero-filled months and year boundaries', async () => {
    expect(await run('get_account_context')).toMatchObject({ today: '2026-10-13', currency: 'INR' });
    await run('create_expense', expense({ expense_date: '2026-01-01' }));
    const monthly = await run('get_monthly_spending', { year: 2026 });
    expect(monthly.data).toHaveLength(12);
    expect(monthly.data[0]).toMatchObject({ month: 1, total: 100 });
    expect(monthly.data[9]).toMatchObject({ month: 10, total: 0 });
    expect((await run('get_spending_trends', { months: 12 })).data[0]).toMatchObject({ year: 2025, month: 11, total: 0 });
  });
  it('preserves budget identifiers, reports overspend, and updates existing budgets', async () => {
    await run('create_expense', expense());
    await run('create_budget', { month: 10, year: 2026, amount: 50 });
    expect(store.data.budgets.alice_10_2026.amount).toBe(50);
    expect(await run('get_budget_summary', { month: 10, year: 2026 })).toMatchObject({ total_spent: 100, remaining: -50, is_over_budget: true, percentage_used: 200 });
    await run('update_budget', { month: 10, year: 2026, amount: 200 });
    expect((await run('get_budget', { month: 10, year: 2026 })).amount).toBe(200);
    expect(await run('list_budgets', {}, bob)).toMatchObject({ items: [] });
    expect(await run('get_category_spending', { month: 10, year: 2026 })).toMatchObject({ data: [{ category: 'Food', total: 100 }] });
  });
});

describe('social features and settlements', () => {
  it('redacts private profiles and limits profile update fields', async () => {
    expect((await run('get_profile')).upi_id).toBe('private@bank');
    expect(await run('get_user', { id: 'alice' }, bob)).not.toHaveProperty('upi_id');
    const search = await run('search_users', { query: 'alice' }, bob);
    expect(search.items[0]).not.toHaveProperty('upi_id');
    await run('update_profile', { name: 'Alice Smith' });
    expect((await run('get_profile')).name).toBe('Alice Smith');
    await expect(run('update_profile', { email: 'other@example.test' })).rejects.toThrow();
  });
  it('manages custom categories without deleting expenses', async () => {
    await run('create_category', { name: 'Books', icon: '📚' });
    expect((await run('list_categories')).items).toContainEqual(expect.objectContaining({ name: 'Books' }));
    await run('create_expense', expense({ category: 'Books' }));
    await run('delete_category', { name: 'Books' });
    expect((await run('list_expenses')).total).toBe(1);
  });
  it('enforces friend request recipient and removes only own friendships', async () => {
    const request = await run('send_friend_request', { user_id: 'eve' });
    await expect(run('accept_friend_request', { id: request.id })).rejects.toThrow();
    expect((await run('list_friend_requests', {}, eve)).received).toHaveLength(1);
    await run('accept_friend_request', { id: request.id }, eve);
    expect((await run('list_friends')).items).toHaveLength(2);
    await expect(run('remove_friend', { id: 'ab' }, eve)).rejects.toThrow();
    await run('remove_friend', { id: request.id });
    expect((await run('list_friends')).items).toHaveLength(1);
  });
  it('keeps group administration owner-only and prevents stranded shared records', async () => {
    const group = await run('create_group', { name: 'Home', request_id: 'group-001' });
    await run('add_group_member', { id: group.id, user_id: 'bob' });
    await expect(run('update_group', { id: group.id, name: 'Taken' }, bob)).rejects.toThrow();
    await run('update_group', { id: group.id, name: 'House' });
    expect((await run('get_group', { id: group.id })).name).toBe('House');
    await run('create_expense', expense({ group_id: group.id, participants: ['alice', 'bob'] }));
    await expect(run('remove_group_member', { id: group.id, user_id: 'bob' })).rejects.toThrow();
    await expect(run('delete_group', { id: group.id })).rejects.toThrow();
  });
  it('supports legacy group members and safe empty-group cleanup', async () => {
    store.data.groups.trip.members = [{ user: { id: 'alice' } }, 'bob'];
    expect((await run('list_groups', {}, bob)).items).toHaveLength(1);
    await run('remove_group_member', { id: 'trip', user_id: 'bob' });
    expect((await run('list_groups', {}, bob)).items).toHaveLength(0);
    await run('delete_group', { id: 'trip' });
    expect(store.data.groups.trip).toBeUndefined();
  });
  it('records pending payment separately from confirmed debt and only receiver approves', async () => {
    const shared = await run('create_expense', expense({ participants: ['alice', 'bob'] }));
    await run('update_split_status', { expense_id: shared.id, expected_revision: shared.revision, status: 'accepted' }, bob);
    const recorded = await run('record_settlement', { receiver_id: 'alice', amount: 50, payment_method: 'Cash', request_id: 'settlement-001' }, bob);
    expect(recorded.status).toBe('pending');
    expect(await run('get_balances', {}, bob)).toMatchObject({ summary: { total_payable: 50 }, pending_payments: { outgoing: 50 } });
    await expect(run('approve_settlement', { id: recorded.id }, bob)).rejects.toThrow();
    await run('approve_settlement', { id: recorded.id });
    expect(await run('get_balances', {}, bob)).toMatchObject({ summary: { total_payable: 0 } });
    expect((await run('list_settlements', {}, eve)).items).toHaveLength(0);
    expect((await run('list_notifications')).unread_count).toBeGreaterThan(0);
    await run('mark_notifications_read', {});
    expect((await run('list_notifications')).unread_count).toBe(0);
  });
  it('reports unavailable Telegram dependency truthfully', async () => {
    expect(await run('get_telegram_status')).toMatchObject({ available: false });
  });
});
