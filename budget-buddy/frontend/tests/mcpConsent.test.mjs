import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { getMcpServerOrigin, validateConsentRedirect, getConsentRequest, submitConsentDecision, ConsentError } from '../src/api/mcpConsent.ts';

async function serve(t, handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  return `http://127.0.0.1:${server.address().port}`;
}

function json(response, payload, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(payload));
}

const requestId = 'example_request_123456789';

test('accepts configured HTTPS origins and loopback origins for local development', () => {
  assert.equal(getMcpServerOrigin('https://mcp.budgetbuddy.example/'), 'https://mcp.budgetbuddy.example');
  assert.equal(getMcpServerOrigin('http://localhost:3100'), 'http://localhost:3100');
  assert.equal(getMcpServerOrigin('http://127.0.0.1:3100'), 'http://127.0.0.1:3100');
});

test('never sends Firebase tokens to insecure, credentialed, or non-origin configuration', () => {
  for (const value of [undefined, '', 'http://mcp.example.com', 'javascript:alert(1)', '//mcp.example.com',
    'https://user:password@mcp.example.com', 'https://mcp.example.com/subpath',
    'https://mcp.example.com?next=elsewhere', 'https://mcp.example.com#fragment',
    'http://localhost.evil.example']) {
    assert.throws(() => getMcpServerOrigin(value));
  }
});

test('accepts HTTPS and loopback OAuth callbacks without stripping code or state', () => {
  assert.equal(validateConsentRedirect('https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz'),
    'https://chatgpt.com/connector/oauth/callback?code=abc&state=xyz');
  assert.equal(validateConsentRedirect('http://127.0.0.1:5200/callback?error=access_denied'),
    'http://127.0.0.1:5200/callback?error=access_denied');
});

test('rejects callbacks that execute scripts, expose codes over remote HTTP, or contain credentials', () => {
  for (const value of [undefined, 42, '', '/callback', '//evil.example', 'javascript:alert(1)',
    'data:text/html,unsafe', 'http://evil.example/callback', 'http://localhost.evil.example/callback',
    'https://user:password@example.com/callback']) {
    assert.throws(() => validateConsentRedirect(value));
  }
});

test('reads the requested client and scopes from the trusted consent server', async t => {
  const metadata = { client_name: 'ChatGPT', scopes: ['budgetbuddy:read'], expires_at: Date.now() + 60000 };
  const origin = await serve(t, (request, response) => {
    assert.equal(request.url, `/oauth/consent?request_id=${requestId}`);
    assert.equal(request.headers.authorization, undefined);
    json(response, metadata);
  });
  assert.deepEqual(await getConsentRequest(origin, requestId), metadata);
});

test('rejects expired and unrecognized consent permissions before they can be approved', async t => {
  const origin = await serve(t, (request, response) => {
    json(response, request.url.includes('expired')
      ? { client_name: 'ChatGPT', scopes: ['budgetbuddy:read'], expires_at: Date.now() - 1000 }
      : { client_name: 'ChatGPT', scopes: ['unrecognized:permission'], expires_at: Date.now() + 60000 });
  });
  await assert.rejects(getConsentRequest(origin, 'expired_request_123456'), error => error instanceof ConsentError && error.kind === 'expired');
  await assert.rejects(getConsentRequest(origin, requestId), error => error instanceof ConsentError && error.kind === 'invalid');
});

test('submits the explicit decision and Firebase proof in the Authorization header only', async t => {
  const origin = await serve(t, async (request, response) => {
    const parts = [];
    for await (const part of request) parts.push(part);
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/oauth/consent');
    assert.equal(request.headers.authorization, 'Bearer test-firebase-token');
    assert.deepEqual(JSON.parse(Buffer.concat(parts).toString()), { request_id: requestId, decision: 'approve' });
    json(response, { redirect_url: 'https://chatgpt.com/callback?code=abc&state=xyz' });
  });
  assert.equal(await submitConsentDecision(origin, requestId, 'approve', 'test-firebase-token'),
    'https://chatgpt.com/callback?code=abc&state=xyz');
});

test('returns a safe denial callback and refuses a script callback from the server', async t => {
  const origin = await serve(t, async (request, response) => {
    const parts = [];
    for await (const part of request) parts.push(part);
    const body = JSON.parse(Buffer.concat(parts).toString());
    json(response, { redirect_url: body.decision === 'deny'
      ? 'https://chatgpt.com/callback?error=access_denied&state=xyz'
      : 'javascript:alert(1)' });
  });
  assert.equal(await submitConsentDecision(origin, requestId, 'deny', 'test-firebase-token'),
    'https://chatgpt.com/callback?error=access_denied&state=xyz');
  await assert.rejects(submitConsentDecision(origin, requestId, 'approve', 'test-firebase-token'), ConsentError);
});

test('requires a current Firebase token before submitting approval', async () => {
  await assert.rejects(submitConsentDecision('http://localhost:3100', requestId, 'approve', ''),
    error => error instanceof ConsentError && error.kind === 'sign-in');
});

test('does not follow redirects with a Firebase bearer token', async t => {
  let receivedToken = false;
  const origin = await serve(t, (request, response) => {
    if (request.url === '/capture') {
      receivedToken = true;
      return json(response, { redirect_url: 'https://chatgpt.com/callback' });
    }
    response.writeHead(307, { Location: '/capture' });
    response.end();
  });
  await assert.rejects(submitConsentDecision(origin, requestId, 'approve', 'test-firebase-token'), ConsentError);
  assert.equal(receivedToken, false);
});

test('maps stale requests to an actionable error without exposing backend details', async t => {
  const origin = await serve(t, (_request, response) => json(response, { error: 'server-secret-detail' }, 410));
  await assert.rejects(getConsentRequest(origin, requestId), error => {
    assert.ok(error instanceof ConsentError);
    assert.equal(error.kind, 'expired');
    assert.equal(error.message.includes('server-secret-detail'), false);
    return true;
  });
});
