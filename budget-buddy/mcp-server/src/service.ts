import type { Store } from './store.js';
import { randomUUID } from 'node:crypto';
import { catalog, id, type Params } from './catalog.js';
import { ensure, normalizeState, userExists, type State } from './domain/model.js';
import { digest, expenseAction } from './domain/expenses.js';
import { analyticsAction, localDate } from './domain/analytics.js';
import { socialAction } from './domain/social.js';
export interface Actor { uid: string; scopes: string[] }
export interface ServiceOptions { currency: string; timezone: string; appUrl: string; now?: () => Date }
export class BudgetService {
  constructor(readonly store: Store, readonly options: ServiceOptions) {}
  async execute(name: string, input: unknown, actor: Actor): Promise<unknown> {
    const tool = catalog.find(t => t.name === name);
    ensure(tool, 'UNKNOWN_TOOL', 'Unknown tool.');
    id.parse(actor.uid);
    ensure(actor.scopes.includes(tool.write ? 'budgetbuddy:write' : 'budgetbuddy:read'), 'INSUFFICIENT_SCOPE', 'Your connection lacks the required scope. Reconnect with the requested permissions.');
    const p = tool.schema.parse(input) as Params;
    const now = (this.options.now ?? (() => new Date()))();
    const operationId = randomUUID();
    const today = localDate(now, this.options.timezone);
    const apply = (state: State): unknown => {
      userExists(state, actor.uid);
      if (name === 'get_account_context') return { user_id: actor.uid, email: state.users[actor.uid]!.email, currency: this.options.currency, timezone: this.options.timezone, today, app_url: this.options.appUrl, capabilities: catalog.map(t => t.name), telegram_available: false, spending_basis: 'Your accepted expense shares; confirmed balances exclude pending payments.' };
      if (['list_expenses', 'get_expense', 'create_expense', 'update_expense', 'delete_expense', 'update_split_status'].includes(name)) return expenseAction(name, p, state, actor.uid, operationId, now.toISOString());
      if (['get_balances', 'get_dashboard', 'get_monthly_spending', 'get_category_spending', 'get_spending_trends', 'list_budgets', 'get_budget', 'create_budget', 'update_budget', 'get_budget_summary'].includes(name)) return analyticsAction(name, p, state, actor.uid, today);
      return socialAction(name, p, state, actor.uid, operationId, now.toISOString());
    };
    if (!tool.write) return apply(normalizeState(await this.store.read<State>('')));
    return this.store.transaction<State, unknown>('', current => {
      const state = normalizeState(current);
      const key = p.request_id ? digest([actor.uid, name, p.request_id]) : undefined;
      const hash = digest(p);
      const previous = key ? state.mcp_private?.operations?.[key] : undefined;
      if (previous) {
        ensure(previous.hash === hash, 'IDEMPOTENCY_CONFLICT', 'This request ID was already used with different input.');
        return { value: state, result: previous.result };
      }
      const result = apply(state);
      if (key) {
        state.mcp_private ??= {};
        state.mcp_private.operations ??= {};
        state.mcp_private.operations[key] = { hash, result, created_at: now.toISOString() };
      }
      return { value: state, result };
    });
  }
}
