import { describe, expect, it } from 'vitest';
import { loadConfig, parseServiceAccount } from '../src/config.js';
const env = () => ({ MCP_PUBLIC_URL: 'https://mcp.example.com/mcp', OAUTH_ISSUER_URL: 'https://mcp.example.com', BUDGETBUDDY_APP_URL: 'https://app.example.com', FIREBASE_PROJECT_ID: 'budgetbuddy', FIREBASE_DATABASE_URL: 'https://budgetbuddy-default-rtdb.firebaseio.com', OAUTH_CLIENT_ID: 'chatgpt', OAUTH_CLIENT_SECRET: 'x'.repeat(32), OAUTH_REDIRECT_URIS: 'https://chatgpt.com/connector/oauth/example' });
describe('deployment configuration boundaries', () => {
  it('fails closed without credentials, with invalid timezone or an unrelated database host', () => {
    expect(() => loadConfig({ ...env(), OAUTH_CLIENT_SECRET: '' })).toThrow();
    expect(() => loadConfig({ ...env(), DEFAULT_TIMEZONE: 'Mars/Olympus' })).toThrow();
    expect(() => loadConfig({ ...env(), FIREBASE_DATABASE_URL: 'https://evil.example.com' })).toThrow();
    expect(() => loadConfig({ ...env(), FIREBASE_DATABASE_URL: 'http://budgetbuddy.firebaseio.com' })).toThrow();
  });
  it('forbids a production project in emulator mode and parses explicit proxy settings', () => {
    expect(() => loadConfig({ ...env(), FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000' })).toThrow(/demo-/);
    const config = loadConfig({ ...env(), FIREBASE_PROJECT_ID: 'demo-budgetbuddy', FIREBASE_DATABASE_EMULATOR_HOST: '127.0.0.1:9000', TRUST_PROXY_HOPS: '1', OAUTH_REDIRECT_URIS: 'https://client.example/callback, https://client.example/callback2' });
    expect(config.TRUST_PROXY_HOPS).toBe(1);
    expect(config.auth.client.redirectUris).toEqual(['https://client.example/callback', 'https://client.example/callback2']);
    expect(config.auth.secureCookies).toBe(true);
  });
  it('accepts only a matching base64-encoded Firebase service account', () => {
    const encoded = Buffer.from(JSON.stringify({ project_id: 'budgetbuddy', client_email: 'firebase@example.iam.gserviceaccount.com', private_key: 'private-key' })).toString('base64');
    expect(parseServiceAccount(encoded, 'budgetbuddy')).toEqual({ projectId: 'budgetbuddy', clientEmail: 'firebase@example.iam.gserviceaccount.com', privateKey: 'private-key' });
    expect(() => parseServiceAccount(encoded, 'another-project')).toThrow(/project/i);
    expect(() => parseServiceAccount('not-base64', 'budgetbuddy')).toThrow(/credential/i);
  });
});
