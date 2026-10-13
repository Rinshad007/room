import { z } from 'zod';

export const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/, 'Use a returned BudgetBuddy identifier.').refine(v => !['__proto__', 'constructor', 'prototype'].includes(v), 'Reserved identifier.');
const text = z.string().trim().min(1).max(200);
const money = z.number().finite().positive().max(1_000_000_000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Use at most two decimal places.');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => { const d = new Date(`${v}T00:00:00Z`); return Number.isFinite(d.valueOf()) && d.toISOString().slice(0, 10) === v; }, 'Use a real ISO calendar date.');
const page = { offset: z.number().int().min(0).max(50000).default(0), limit: z.number().int().min(1).max(100).default(25) };
const period = { month: z.number().int().min(1).max(12), year: z.number().int().min(1900).max(2200) };
const details = z.array(z.strictObject({ user_id: id, value: z.number().finite().min(0).max(1_000_000_000) })).min(1).max(100);
const payment = z.enum(['Cash', 'GPay']);
const requestId = id.describe('A unique ID for this operation. Reuse exactly on a retry; use a new ID for a new record.');
const revision = z.string().regex(/^[a-f0-9]{64}$/).describe('revision returned by the latest get/list/create call; protects concurrent edits.');
const fields = { title: text, description: z.string().max(2000), amount: money, category: z.string().trim().min(1).max(80), payment_method: payment, expense_date: date };
const define = (name: string, description: string, shape: z.ZodRawShape, write = false, destructive = false) => ({
  name, description, schema: z.strictObject(shape), write,
  annotations: { readOnlyHint: !write, destructiveHint: destructive, idempotentHint: !write || !['create_expense', 'create_group', 'record_settlement'].includes(name), openWorldHint: write && !['update_profile', 'create_category', 'delete_category', 'create_budget', 'update_budget', 'mark_notifications_read'].includes(name) },
});
export const catalog = [
  define('get_account_context', 'Get authenticated BudgetBuddy identity, currency, timezone, today and capability limits. Resolve relative dates with this tool.', {}),
  define('get_profile', 'Read your own BudgetBuddy profile and private payment details.', {}),
  define('update_profile', 'Update your name, UPI ID, phone or avatar. Credential/email changes require the BudgetBuddy account page.', { name: text.optional(), upi_id: z.string().max(100).optional(), mobile_number: z.string().max(30).optional(), avatar_url: z.url().max(2000).optional() }, true),
  define('search_users', 'Find BudgetBuddy users by name or email. Returns minimal public profiles; clarify ambiguous matches before writing.', { query: z.string().trim().min(2).max(100), ...page }),
  define('get_user', 'Read minimal public profile for a resolved user ID.', { id }),
  define('list_categories', 'List built-in and your custom expense categories.', {}),
  define('create_category', 'Add your own custom expense category.', { name: text, icon: z.string().min(1).max(20) }, true),
  define('delete_category', 'Remove your custom category; existing expenses are retained.', { name: text }, true, true),
  define('list_expenses', 'Find visible expenses by date, title, category or group. Returns stable IDs and revisions; disambiguate before update/delete.', { ...page, query: z.string().max(200).optional(), category: text.optional(), group_id: id.optional(), start_date: date.optional(), end_date: date.optional() }),
  define('get_expense', 'Read a visible expense, its split details and current revision.', { id }),
  define('create_expense', 'Add a personal or shared expense. Personal defaults to you. Shared participants must be friends or members of the chosen group; others acknowledge their shares. Use exact dates and account currency. Does not transfer money.', { title: fields.title, amount: money, category: fields.category, payment_method: payment, expense_date: date, description: fields.description.default(''), participants: z.array(id).min(1).max(100).optional(), split_type: z.enum(['equal', 'percentage', 'custom']).default('equal'), split_details: details.optional(), group_id: id.optional(), request_id: requestId }, true),
  define('update_expense', 'Update an expense you paid. Get its latest revision first. Amount changes update shares atomically; non-equal splits require replacement split_details. Changed shares require renewed acknowledgement.', { id, expected_revision: revision, title: fields.title.optional(), description: fields.description.optional(), amount: money.optional(), category: fields.category.optional(), payment_method: payment.optional(), expense_date: date.optional(), split_details: details.optional() }, true, true),
  define('delete_expense', 'Permanently delete a resolved expense you paid. Clarify ambiguous requests and use the latest revision. Removes its contribution to spending and balances.', { id, expected_revision: revision }, true, true),
  define('update_split_status', 'Accept or dispute your own share of an expense using its latest revision. Cannot acknowledge another participant’s debt.', { expense_id: id, expected_revision: revision, status: z.enum(['accepted', 'disputed']) }, true),
  define('list_groups', 'List groups you belong to.', page),
  define('get_group', 'Read a group you belong to and its members.', { id }),
  define('create_group', 'Create a group with yourself as creator and initial member.', { name: text, description: z.string().max(2000).default(''), request_id: requestId }, true),
  define('update_group', 'Change name/description of a group you created.', { id, name: text.optional(), description: z.string().max(2000).optional() }, true),
  define('delete_group', 'Delete a group you created only if no expenses remain; preserves financial history.', { id }, true, true),
  define('add_group_member', 'Add an accepted friend to a group you created.', { id, user_id: id }, true),
  define('remove_group_member', 'Remove a non-creator member only if they have no expenses in this group.', { id, user_id: id }, true, true),
  define('list_friends', 'List your accepted friends and public profiles.', page),
  define('list_friend_requests', 'List your sent and received pending requests.', {}),
  define('send_friend_request', 'Send a friend request to a resolved BudgetBuddy user. Does not auto-accept.', { user_id: id }, true),
  define('accept_friend_request', 'Accept a pending friendship request addressed to you.', { id }, true),
  define('reject_friend_request', 'Reject a pending friendship request addressed to you.', { id }, true),
  define('remove_friend', 'Remove a friendship involving you. Financial records remain.', { id }, true, true),
  define('list_settlements', 'List your pending and confirmed payment records. These are records, not payment execution.', page),
  define('get_balances', 'Get confirmed per-person debts plus pending recorded payments separately. Positive per-user balance means they owe you.', {}),
  define('record_settlement', 'Record a payment you made toward a confirmed debt; receiver must approve. Does not initiate a payment or bank transfer.', { receiver_id: id, amount: money, payment_method: payment, request_id: requestId }, true),
  define('approve_settlement', 'As receiver, confirm a recorded payment was received. Updates confirmed balances; no money is transferred.', { id }, true),
  define('list_budgets', 'List your monthly spending budgets.', page),
  define('get_budget', 'Read your budget for a calendar month and year.', period),
  define('create_budget', 'Create a monthly budget. Fails if that month already exists; use update_budget to change it.', { ...period, amount: money }, true),
  define('update_budget', 'Set a new amount on an existing monthly budget.', { ...period, amount: money }, true),
  define('get_budget_summary', 'Compare your accepted expense shares with the monthly budget; negative remaining means overspent.', period),
  define('get_dashboard', 'Summarize your accepted-share spending and confirmed debts. Pending payments are separately reported.', {}),
  define('get_monthly_spending', 'Return all 12 months of accepted-share spending for a year, including zero months.', { year: period.year }),
  define('get_category_spending', 'Break down your accepted-share spending by category for a calendar month.', period),
  define('get_spending_trends', 'Return consecutive calendar months ending in the current month, including months with no spending.', { months: z.number().int().min(1).max(60).default(6) }),
  define('list_notifications', 'List your notifications and total unread count.', page),
  define('mark_notifications_read', 'Mark only your notifications as read. Omit ids to mark all yours.', { ids: z.array(id).max(100).optional() }, true),
  define('get_telegram_status', 'Report whether Telegram integration is available. This MCP build cannot link Telegram until the separate bot’s authenticated contract is integrated.', {}),
];
export type Params = {
  id?: string; user_id?: string; expense_id?: string; receiver_id?: string; request_id?: string; expected_revision?: string;
  title?: string; name?: string; description?: string; amount?: number; category?: string; payment_method?: string;
  expense_date?: string; participants?: string[]; split_type?: 'equal' | 'percentage' | 'custom'; split_details?: { user_id: string; value: number }[];
  group_id?: string; query?: string; start_date?: string; end_date?: string; offset?: number; limit?: number;
  month?: number; year?: number; months?: number; status?: 'accepted' | 'disputed'; icon?: string; ids?: string[];
  upi_id?: string; mobile_number?: string; avatar_url?: string;
};
