import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { authenticate, createAuthRouter, type AuthOptions } from '../src/auth/index.js';
import type { Store } from '../src/store.js';

// A real atomic in-process persistence implementation; the only fake is external Firebase identity.
class MemoryStore implements Store {
  data: Record<string, any> = {};
  async read<T>(path: string): Promise<T | null> {
    let value: any = this.data;
    for (const key of path.split('/')) value = value?.[key];
    return value == null ? null : structuredClone(value);
  }
  async transaction<T, R>(path: string, change: (current: T | null) => { value: T; result: R }): Promise<R> {
    const keys = path.split('/');
    let current: any = this.data;
    for (const key of keys.slice(0, -1)) current = current[key] ??= {};
    const key = keys.at(-1)!;
    const next = change(current[key] == null ? null : structuredClone(current[key]));
    current[key] = structuredClone(next.value);
    return next.result;
  }
}

const verifier = 'a'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');
const origin = 'https://app.budget.test';
const callback = 'https://chatgpt.com/connector/oauth/callback';

function setup() {
  let time = Date.now();
  const store = new MemoryStore();
  const options: AuthOptions = {
    config: {
      issuer: 'https://mcp.budget.test', resource: 'https://mcp.budget.test/mcp', frontendOrigin: origin,
      client: { id: 'chatgpt', secret: 'client-secret-at-least-32-characters', name: 'ChatGPT', redirectUris: [callback] },
    }, store, now: () => time,
    verifyIdentity: async (token) => {
      if (token !== 'firebase-alice') throw new Error('Firebase rejected identity');
      return { uid: 'alice', email: 'alice@example.com' };
    },
  };
  const app = express().use(createAuthRouter(options));
  const authorization = {
    client_id: 'chatgpt', redirect_uri: callback, response_type: 'code', state: 'client-state',
    code_challenge: challenge, code_challenge_method: 'S256', resource: options.config.resource,
    scope: 'budgetbuddy:read budgetbuddy:write',
  };
  const client = () => ({ client_id: 'chatgpt', client_secret: options.config.client.secret });
  const begin = async (overrides = {}) => {
    const response = await request(app).get('/oauth/authorize').query({ ...authorization, ...overrides });
    expect(response.status).toBe(302);
    const url = new URL(response.headers.location);
    expect(url.origin + url.pathname).toBe(origin + '/mcp/consent');
    return { request_id: url.searchParams.get('request_id')!, cookie: response.headers['set-cookie'] as unknown as string[] };
  };
  const consent = (flow: Awaited<ReturnType<typeof begin>>, decision = 'approve') => request(app)
    .post('/oauth/consent').set('Origin', origin).set('Cookie', flow.cookie)
    .set('Authorization', 'Bearer firebase-alice').send({ request_id: flow.request_id, decision });
  const authorize = async (overrides = {}) => {
    const flow = await begin(overrides);
    const response = await consent(flow);
    expect(response.status).toBe(200);
    const url = new URL(response.body.redirect_url);
    expect(url.searchParams.get('state')).toBe('client-state');
    return url.searchParams.get('code')!;
  };
  const exchange = (code: string, overrides = {}) => request(app).post('/oauth/token').type('form').send({
    ...client(), grant_type: 'authorization_code', code, redirect_uri: callback,
    resource: options.config.resource, code_verifier: verifier, ...overrides,
  });
  const refresh = (token: string, overrides = {}) => request(app).post('/oauth/token').type('form').send({
    ...client(), grant_type: 'refresh_token', refresh_token: token, resource: options.config.resource, ...overrides,
  });
  return { app, options, store, authorization, begin, consent, authorize, exchange, refresh, client, advance: (ms: number) => { time += ms; } };
}

describe('BudgetBuddy OAuth account linking', () => {
  it('publishes usable discovery without advertising unsupported dynamic registration', async () => {
    const f = setup();
    const server = await request(f.app).get('/.well-known/oauth-authorization-server');
    expect(server.body).toMatchObject({ issuer: 'https://mcp.budget.test', authorization_endpoint: 'https://mcp.budget.test/oauth/authorize', code_challenge_methods_supported: ['S256'] });
    expect(server.body.registration_endpoint).toBeUndefined();
    const resource = await request(f.app).get('/.well-known/oauth-protected-resource/mcp');
    expect(resource.body).toMatchObject({ resource: 'https://mcp.budget.test/mcp', authorization_servers: ['https://mcp.budget.test'] });
  });

  it('binds consent to browser, Firebase identity, resource and persisted hashed tokens', async () => {
    const f = setup();
    const flow = await f.begin();
    expect(flow.cookie[0]).toContain('HttpOnly');
    expect(flow.cookie[0]).toContain('Secure');
    expect(flow.cookie[0]).toContain('SameSite=None');
    const info = await request(f.app).get('/oauth/consent').query({ request_id: flow.request_id }).set('Cookie', flow.cookie).set('Origin', origin);
    expect(info.body).toMatchObject({ client_name: 'ChatGPT', scopes: ['budgetbuddy:read', 'budgetbuddy:write'] });
    expect(info.headers['access-control-allow-origin']).toBe(origin);
    expect(info.headers['access-control-allow-credentials']).toBe('true');
    const approved = await f.consent(flow);
    const redirect = new URL(approved.body.redirect_url);
    expect(redirect.searchParams.get('state')).toBe('client-state');
    const code = redirect.searchParams.get('code')!;
    const response = await f.exchange(code);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ token_type: 'Bearer', expires_in: 900, scope: 'budgetbuddy:read budgetbuddy:write' });
    const principal = await authenticate(f.options, `Bearer ${response.body.access_token}`, ['budgetbuddy:write']);
    expect(principal.extra).toEqual({ uid: 'alice', email: 'alice@example.com' });
    expect(principal.resource?.href).toBe('https://mcp.budget.test/mcp');
    const persisted = JSON.stringify(f.store.data);
    for (const secret of [code, response.body.access_token, response.body.refresh_token, 'firebase-alice', f.options.config.client.secret]) expect(persisted).not.toContain(secret);
    await expect(authenticate(f.options, 'Bearer firebase-alice')).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it.each([
    { redirect_uri: 'https://evil.test/callback' }, { resource: 'https://evil.test/mcp' },
    { code_challenge_method: 'plain' }, { code_challenge: 'short' }, { scope: 'admin' }, { response_type: 'token' },
    { client_id: 'other' },
  ])('rejects invalid authorization %j without redirecting', async (override) => {
    const f = setup();
    const response = await request(f.app).get('/oauth/authorize').query({ ...f.authorization, ...override });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(404);
    expect(response.body.error).toBeTypeOf('string');
    expect(response.headers.location).toBeUndefined();
  });

  it('rejects consent from another browser or origin and unauthenticated identity', async () => {
    const f = setup();
    const flow = await f.begin();
    const body = { request_id: flow.request_id, decision: 'approve' };
    const missingCookie = await request(f.app).post('/oauth/consent').set('Origin', origin).set('Authorization', 'Bearer firebase-alice').send(body);
    expect(missingCookie.status).toBe(403);
    const wrongOrigin = await request(f.app).post('/oauth/consent').set('Origin', 'https://evil.test').set('Cookie', flow.cookie).set('Authorization', 'Bearer firebase-alice').send(body);
    expect(wrongOrigin.status).toBe(403);
    const noIdentity = await request(f.app).post('/oauth/consent').set('Origin', origin).set('Cookie', flow.cookie).send(body);
    expect(noIdentity.status).toBe(401);
    const invalidIdentity = await request(f.app).post('/oauth/consent').set('Origin', origin).set('Cookie', flow.cookie).set('Authorization', 'Bearer forged').send(body);
    expect(invalidIdentity.status).toBe(401);
    expect((await f.consent(flow)).status).toBe(200);
    expect((await f.consent(flow)).status).toBe(400);
  });

  it('denial returns state and access_denied without issuing credentials', async () => {
    const f = setup();
    const response = await f.consent(await f.begin(), 'deny');
    expect(response.status).toBe(200);
    const url = new URL(response.body.redirect_url);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe('client-state');
    expect(url.searchParams.has('code')).toBe(false);
  });

  it('enforces client authentication, redirect, resource and PKCE before consuming a code', async () => {
    const f = setup();
    const code = await f.authorize();
    for (const override of [{ client_secret: 'wrong' }, { redirect_uri: 'https://evil.test' }, { resource: 'https://evil.test/mcp' }, { code_verifier: 'b'.repeat(43) }]) {
      expect((await f.exchange(code, override)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await f.exchange(code)).status).toBe(200);
    expect((await f.exchange(code)).body.error).toBe('invalid_grant');
  });

  it('expires authorization requests, authorization codes and access tokens', async () => {
    const f = setup();
    const flow = await f.begin();
    f.advance(11 * 60_000);
    expect((await f.consent(flow)).status).toBe(400);
    const code = await f.authorize();
    f.advance(6 * 60_000);
    expect((await f.exchange(code)).body.error).toBe('invalid_grant');
    const tokens = await f.exchange(await f.authorize());
    f.advance(16 * 60_000);
    await expect(authenticate(f.options, `Bearer ${tokens.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rotates refresh tokens and revokes the whole family after reuse', async () => {
    const f = setup();
    const first = await f.exchange(await f.authorize());
    const second = await f.refresh(first.body.refresh_token);
    expect(second.status).toBe(200);
    expect(second.body.refresh_token).not.toBe(first.body.refresh_token);
    expect((await f.refresh(first.body.refresh_token)).body.error).toBe('invalid_grant');
    await expect(authenticate(f.options, `Bearer ${second.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
    expect((await f.refresh(second.body.refresh_token)).body.error).toBe('invalid_grant');
  });

  it('prevents read-only scope escalation through refresh and tool authentication', async () => {
    const f = setup();
    const tokens = await f.exchange(await f.authorize({ scope: 'budgetbuddy:read' }));
    await expect(authenticate(f.options, `Bearer ${tokens.body.access_token}`, ['budgetbuddy:write'])).rejects.toMatchObject({ code: 'insufficient_scope' });
    expect((await f.refresh(tokens.body.refresh_token, { scope: 'budgetbuddy:read budgetbuddy:write' })).body.error).toBe('invalid_scope');
    expect((await f.refresh(tokens.body.refresh_token)).status).toBe(200);
  });

  it('revoking an access or refresh token invalidates the entire persistent grant family', async () => {
    const f = setup();
    const tokens = await f.exchange(await f.authorize());
    const rebooted = { ...f.options };
    expect((await authenticate(rebooted, `Bearer ${tokens.body.access_token}`)).extra.uid).toBe('alice');
    const revoked = await request(f.app).post('/oauth/revoke').type('form').send({ ...f.client(), token: tokens.body.access_token });
    expect(revoked.status).toBe(200);
    await expect(authenticate(rebooted, `Bearer ${tokens.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
    expect((await f.refresh(tokens.body.refresh_token)).body.error).toBe('invalid_grant');
  });

  it('never allows an insecure cookie for public hosts', () => {
    const f = setup();
    expect(() => createAuthRouter({ ...f.options, config: { ...f.options.config, secureCookies: false } })).toThrow(/loopback/i);
  });

  it('supports confidential Basic authentication and rejects mixed authentication methods', async () => {
    const f = setup();
    const code = await f.authorize();
    const fields = { grant_type: 'authorization_code', code, code_verifier: verifier, resource: f.options.config.resource, redirect_uri: callback };
    const mixed = await request(f.app).post('/oauth/token').auth('chatgpt', f.client().client_secret).type('form').send({ ...fields, ...f.client() });
    expect(mixed.status).toBe(401);
    const malformed = await request(f.app).post('/oauth/token').set('Authorization', `Basic ${Buffer.from('missing-colon').toString('base64')}`).type('form').send(fields);
    expect(malformed.status).toBe(401);
    const wrongId = await request(f.app).post('/oauth/token').auth('chatgpt', f.client().client_secret).type('form').send({ ...fields, client_id: 'other-client' });
    expect(wrongId.status).toBe(401);
    const valid = await request(f.app).post('/oauth/token').auth('chatgpt', f.client().client_secret).type('form').send(fields);
    expect(valid.status).toBe(200);
    expect((await authenticate(f.options, `Bearer ${valid.body.access_token}`)).extra.uid).toBe('alice');
  });

  it('narrows refresh scope permanently and preserves a token after wrong client or resource requests', async () => {
    const f = setup();
    const first = await f.exchange(await f.authorize());
    expect((await f.refresh(first.body.refresh_token, { resource: 'https://another-resource.test/mcp' })).body.error).toBe('invalid_target');
    expect((await f.refresh(first.body.refresh_token, { client_secret: 'not-the-client' })).body.error).toBe('invalid_client');
    const narrowed = await f.refresh(first.body.refresh_token, { scope: 'budgetbuddy:read' });
    expect(narrowed.body.scope).toBe('budgetbuddy:read');
    await expect(authenticate(f.options, `Bearer ${narrowed.body.access_token}`, ['budgetbuddy:write'])).rejects.toMatchObject({ code: 'insufficient_scope' });
    expect((await f.refresh(narrowed.body.refresh_token, { scope: 'budgetbuddy:write' })).body.error).toBe('invalid_scope');
    expect((await f.refresh(narrowed.body.refresh_token)).body.scope).toBe('budgetbuddy:read');
  });

  it('expires the absolute grant and refresh lifetime after thirty days', async () => {
    const f = setup();
    const tokens = await f.exchange(await f.authorize());
    f.advance(31 * 24 * 60 * 60_000);
    expect((await f.refresh(tokens.body.refresh_token)).body.error).toBe('invalid_grant');
    await expect(authenticate(f.options, `Bearer ${tokens.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
  });

  it('rejects one browser binding used with another consent request', async () => {
    const f = setup();
    const aliceFlow = await f.begin();
    const anotherFlow = await f.begin();
    const response = await f.consent({ request_id: aliceFlow.request_id, cookie: anotherFlow.cookie });
    expect(response.status).toBe(403);
    const leakedInfo = await request(f.app).get('/oauth/consent').query({ request_id: aliceFlow.request_id }).set('Cookie', anotherFlow.cookie);
    expect(leakedInfo.status).toBe(403);
    expect((await f.consent(aliceFlow, 'invalid-decision')).status).toBe(400);
    expect((await f.consent(aliceFlow)).status).toBe(200);
  });

  it('limits credentialed CORS to the configured consent origin', async () => {
    const f = setup();
    const valid = await request(f.app).options('/oauth/consent').set('Origin', origin).set('Access-Control-Request-Method', 'POST');
    expect(valid.status).toBe(204);
    expect(valid.headers['access-control-allow-origin']).toBe(origin);
    const invalid = await request(f.app).options('/oauth/consent').set('Origin', 'https://evil.test');
    expect(invalid.status).toBe(403);
    expect(invalid.headers['access-control-allow-origin']).toBeUndefined();
    expect((await request(f.app).get('/oauth/consent').set('Origin', 'null').query({ request_id: 'x' })).status).toBe(403);
  });

  it('rejects duplicated OAuth parameters and missing resource identifiers', async () => {
    const f = setup();
    const duplicate = await request(f.app).get('/oauth/authorize').query({ ...f.authorization, client_id: ['chatgpt', 'chatgpt'] });
    expect(duplicate.body.error).toBe('invalid_request');
    const missing = await request(f.app).get('/oauth/authorize').query({ ...f.authorization, resource: undefined });
    expect(missing.body.error).toBe('invalid_request');
    const empty = await request(f.app).get('/oauth/authorize').query({ ...f.authorization, code_challenge: '' });
    expect(empty.body.error).toBe('invalid_request');
  });

  it('defaults to read-only and permits optional state without inventing one', async () => {
    const f = setup();
    const flow = await f.begin({ scope: undefined, state: undefined });
    const approval = await f.consent(flow);
    const redirect = new URL(approval.body.redirect_url);
    expect(redirect.searchParams.has('state')).toBe(false);
    const token = await f.exchange(redirect.searchParams.get('code')!);
    expect(token.body.scope).toBe('budgetbuddy:read');
  });

  it('keeps separate user grant families isolated when one connection is revoked', async () => {
    const f = setup();
    const alice = await f.exchange(await f.authorize());
    f.options.verifyIdentity = async (token) => {
      if (token !== 'firebase-bob') throw new Error('Invalid');
      return { uid: 'bob', email: 'bob@example.com' };
    };
    const bobFlow = await f.begin();
    const bobApproval = await request(f.app).post('/oauth/consent').set('Origin', origin).set('Cookie', bobFlow.cookie).set('Authorization', 'Bearer firebase-bob')
      .send({ request_id: bobFlow.request_id, decision: 'approve', uid: 'alice', email: 'alice@example.com' });
    const bob = await f.exchange(new URL(bobApproval.body.redirect_url).searchParams.get('code')!);
    expect((await authenticate(f.options, `Bearer ${bob.body.access_token}`)).extra).toEqual({ uid: 'bob', email: 'bob@example.com' });
    await request(f.app).post('/oauth/revoke').type('form').send({ ...f.client(), token: alice.body.refresh_token });
    await expect(authenticate(f.options, `Bearer ${alice.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
    expect((await authenticate(f.options, `Bearer ${bob.body.access_token}`)).extra.uid).toBe('bob');
  });

  it('revokes tokens issued from a replayed authorization code', async () => {
    const f = setup();
    const code = await f.authorize();
    const issued = await f.exchange(code);
    expect((await f.exchange(code)).body.error).toBe('invalid_grant');
    await expect(authenticate(f.options, `Bearer ${issued.body.access_token}`)).rejects.toMatchObject({ code: 'invalid_token' });
    expect((await f.refresh(issued.body.refresh_token)).body.error).toBe('invalid_grant');
  });

  it('returns safe errors for malformed JSON and oversized requests', async () => {
    const f = setup();
    const malformed = await request(f.app).post('/oauth/consent').set('Content-Type', 'application/json').send('{secret-do-not-echo');
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toContain('secret-do-not-echo');
    const oversized = await request(f.app).post('/oauth/token').send({ secret: 'a'.repeat(20_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body.error).toBe('invalid_request');
    const unknownGrant = await request(f.app).post('/oauth/token').type('form').send({ ...f.client(), grant_type: 'password' });
    expect(unknownGrant.body.error).toBe('unsupported_grant_type');
  });

  it('returns the same revocation result for unknown credentials and already revoked credentials', async () => {
    const f = setup();
    expect((await request(f.app).post('/oauth/revoke').type('form').send({ ...f.client(), token: 'unknown' })).status).toBe(200);
    expect((await request(f.app).post('/oauth/revoke').type('form').send({ ...f.client(), token: 'unknown' })).status).toBe(200);
  });

  it('supports explicitly insecure loopback development and rejects public HTTP configuration', () => {
    const f = setup();
    const local = { ...f.options.config, issuer: 'http://localhost:3001', resource: 'http://localhost:3001/mcp', frontendOrigin: 'http://localhost:5173', secureCookies: false };
    expect(() => createAuthRouter({ ...f.options, config: local })).not.toThrow();
    expect(() => createAuthRouter({ ...f.options, config: { ...local, issuer: 'http://budget.test' } })).toThrow(/HTTPS/);
    expect(() => createAuthRouter({ ...f.options, config: { ...f.options.config, resource: 'https://other.test/mcp' } })).toThrow(/resource/);
    expect(() => createAuthRouter({ ...f.options, config: { ...f.options.config, client: { ...f.options.config.client, secret: 'short' } } })).toThrow(/secret/);
  });
});
