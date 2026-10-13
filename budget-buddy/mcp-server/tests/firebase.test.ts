import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { FirebaseStore } from '../src/firebase-store.js';
import { BudgetService } from '../src/service.js';
import { seed } from './helpers.js';

// Explicit demo project + loopback guard prevents tests ever writing live data.
const host = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
const enabled = Boolean(host);
if (enabled && !/^127\.0\.0\.1:\d+$/.test(host!)) throw new Error('Emulator tests require a loopback database host.');
describe.skipIf(!enabled)('actual Firebase Realtime Database', () => {
  const app = initializeApp({ projectId: 'demo-budgetbuddy', databaseURL: 'https://demo-budgetbuddy-default-rtdb.firebaseio.com' }, 'mcp-tests');
  const database = getDatabase(app), store = new FirebaseStore(database);
  const service = new BudgetService(store, { currency: 'INR', timezone: 'Asia/Kolkata', appUrl: 'http://localhost:5173' });
  const actor = { uid: 'alice', scopes: ['budgetbuddy:read', 'budgetbuddy:write'] };
  beforeAll(async () => { await database.ref('/').set(seed()); });
  afterAll(async () => { await database.ref('/').remove(); await deleteApp(app); });
  it('retries cold-cache transactions, atomically deduplicates writes, and preserves unrelated records', async () => {
    const input = { title: 'Emulator lunch', amount: 100, category: 'Food', payment_method: 'Cash', expense_date: '2026-10-12', request_id: 'emulator-create-1' };
    const [a, b] = await Promise.all([service.execute('create_expense', input, actor), service.execute('create_expense', input, actor)]) as any[];
    expect(a.id).toBe(b.id);
    expect(Object.keys((await database.ref('expenses').get()).val())).toHaveLength(1);
    expect((await database.ref('users/bob/name').get()).val()).toBe('Bob');
    await database.ref(`expenses/${a.id}/amount`).set(101);
    await expect(service.execute('delete_expense', { id: a.id, expected_revision: a.revision }, actor)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect((await database.ref(`expenses/${a.id}/amount`).get()).val()).toBe(101);
    await store.transaction<Record<string, unknown>, string>('mcp_private/example', () => ({ value: { value: 42 }, result: 'saved' }));
    expect(await store.read('mcp_private/example')).toEqual({ value: 42 });
    await expect(store.transaction('mcp_private/example', () => { throw new Error('refused'); })).rejects.toThrow('refused');
    expect(await store.read('mcp_private/example')).toEqual({ value: 42 });
  });
  it('denies unauthenticated access to private grant storage', async () => {
    const response = await fetch(`http://${host}/mcp_private.json?ns=demo-budgetbuddy-default-rtdb`);
    expect(response.status).toBe(401);
  });
});
