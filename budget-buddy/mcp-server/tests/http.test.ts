import { createHash } from 'node:crypto';
import { once } from 'node:events';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createApp } from '../src/http.js';
import { BudgetService } from '../src/service.js';
import { MemoryStore, seed } from './helpers.js';
import type { AuthOptions } from '../src/auth/index.js';

export function fixture(store = new MemoryStore(seed())) {
  const auth: AuthOptions = {
    store, config: { issuer: 'http://127.0.0.1:3001', resource: 'http://127.0.0.1:3001/mcp', frontendOrigin: 'http://127.0.0.1:5173', secureCookies: false, client: { id: 'chatgpt', secret: '12345678901234567890123456789012', name: 'ChatGPT', redirectUris: ['http://localhost:6274/oauth/callback'] } },
    verifyIdentity: async token => { if (!['alice', 'bob', 'eve'].includes(token)) throw new Error('bad identity'); return { uid: token, email: `${token}@example.test` }; },
  };
  const service = new BudgetService(store, { currency: 'INR', timezone: 'Asia/Kolkata', appUrl: auth.config.frontendOrigin });
  return { app: createApp(auth, service), auth, store };
}
export async function login(f: ReturnType<typeof fixture>, uid: string, scope = 'budgetbuddy:read budgetbuddy:write') {
  const verifier = 'x'.repeat(43), c = f.auth.config;
  const started = await request(f.app).get('/oauth/authorize').set('Host', '127.0.0.1:3001').query({ client_id: c.client.id, redirect_uri: c.client.redirectUris[0], response_type: 'code', state: 'test-state', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: c.resource, scope });
  expect(started.status).toBe(302);
  const consent = await request(f.app).post('/oauth/consent').set('Host', '127.0.0.1:3001').set('Cookie', started.headers['set-cookie']).set('Origin', c.frontendOrigin).set('Authorization', `Bearer ${uid}`).send({ request_id: new URL(started.headers.location).searchParams.get('request_id'), decision: 'approve' });
  expect(consent.status).toBe(200);
  const exchanged = await request(f.app).post('/oauth/token').set('Host', '127.0.0.1:3001').type('form').send({ client_id: c.client.id, client_secret: c.client.secret, grant_type: 'authorization_code', code: new URL(consent.body.redirect_url).searchParams.get('code'), code_verifier: verifier, redirect_uri: c.client.redirectUris[0], resource: c.resource });
  expect(exchanged.status).toBe(200);
  return exchanged.body.access_token as string;
}

describe('real HTTP MCP and OAuth', () => {
  it('rejects unauthenticated requests with discovery and protects host/origin', async () => {
    const f = fixture();
    const denied = await request(f.app).post('/mcp').set('Host', '127.0.0.1:3001').send({});
    expect(denied.status).toBe(401);
    expect(denied.headers['www-authenticate']).toContain('/.well-known/oauth-protected-resource/mcp');
    expect((await request(f.app).get('/health').set('Host', 'evil.example')).status).toBe(403);
    expect((await request(f.app).post('/mcp').set('Host', '127.0.0.1:3001').set('Origin', 'https://evil.example').send({})).status).toBe(403);
    expect((await request(f.app).post('/mcp').set('Host', '127.0.0.1:3001').set('Content-Type', 'application/json').send('{')).status).toBe(400);
    expect((await request(f.app).post('/mcp').set('Host', '127.0.0.1:3001').send({ text: 'x'.repeat(140000) })).status).toBe(413);
  });
  it('runs discovery and CRUD through official SDK clients, isolates users and enforces scopes', async () => {
    const f = fixture();
    const aliceToken = await login(f, 'alice'), eveToken = await login(f, 'eve'), readToken = await login(f, 'alice', 'budgetbuddy:read');
    const server = f.app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address() as { port: number };
    const clients: Client[] = [];
    const connect = async (token: string) => {
      const client = new Client({ name: 'budgetbuddy-integration', version: '1.0.0' });
      clients.push(client);
      await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
      return client;
    };
    try {
      const [alice, eve, reader] = await Promise.all([connect(aliceToken), connect(eveToken), connect(readToken)]);
      const list = await alice.listTools();
      expect(list.tools.length).toBeGreaterThan(40);
      expect(list.tools.find(t => t.name === 'delete_expense')?.annotations?.destructiveHint).toBe(true);
      const call = async (client: Client, name: string, args = {}) => client.callTool({ name, arguments: args }) as Promise<any>;
      const created = await call(alice, 'create_expense', { title: 'SDK Lunch', amount: 250, category: 'Food', payment_method: 'Cash', expense_date: '2026-10-12', request_id: 'sdk-expense-1' });
      expect(created.isError).not.toBe(true);
      const expense = created.structuredContent.data;
      expect(expense.paid_by).toBe('alice');
      expect((await call(eve, 'get_expense', { id: expense.id })).isError).toBe(true);
      expect((await call(reader, 'delete_expense', { id: expense.id, expected_revision: expense.revision })).isError).toBe(true);
      const updated = await call(alice, 'update_expense', { id: expense.id, expected_revision: expense.revision, amount: 200 });
      expect(updated.structuredContent.data.splits[0].share_amount).toBe(200);
      expect((await call(alice, 'get_dashboard')).structuredContent.data.total_spent).toBe(200);
      expect((await call(alice, 'delete_expense', { id: expense.id, expected_revision: updated.structuredContent.data.revision })).structuredContent.data.deleted).toBe(true);
      expect((await call(alice, 'list_expenses')).structuredContent.data.total).toBe(0);
    } finally {
      await Promise.all(clients.map(c => c.close()));
      await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    }
  });
});
