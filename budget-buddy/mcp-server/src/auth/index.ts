import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Router, json, urlencoded, type Request, type ErrorRequestHandler } from 'express';
import { OAuthError, OAuthErrorCode, verifyBearerToken, buildOAuthProtectedResourceMetadata, getOAuthProtectedResourceMetadataUrl, type AuthInfo, type OAuthTokenVerifier } from '@modelcontextprotocol/server';
import type { Store } from '../store.js';

export interface AuthConfig {
  issuer: string;
  resource: string;
  frontendOrigin: string;
  client: { id: string; secret: string; name: string; redirectUris: string[] };
  secureCookies?: boolean;
}
export interface AuthOptions {
  config: AuthConfig;
  store: Store;
  verifyIdentity: (token: string) => Promise<{ uid: string; email: string }>;
  now?: () => number;
}
export interface AuthPrincipal extends AuthInfo { extra: { uid: string; email: string } }

const ROOT = 'mcp_private/oauth';
const SCOPES = ['budgetbuddy:read', 'budgetbuddy:write'];
const REQUEST_MS = 10 * 60_000;
const CODE_MS = 5 * 60_000;
const ACCESS_MS = 15 * 60_000;
const GRANT_MS = 30 * 24 * 60 * 60_000;
interface Authorization {
  clientId: string; redirectUri: string; resource: string; scopes: string[];
  challenge: string; state: string; browserHash: string; expiresAt: number;
}
interface Grant {
  clientId: string; resource: string; scopes: string[]; uid: string; email: string;
  expiresAt: number; revoked: boolean;
}
interface Code {
  clientId: string; redirectUri: string; resource: string; challenge: string;
  familyId: string; expiresAt: number; used: boolean;
}
interface Token { familyId: string; expiresAt: number; scopes: string[]; used?: boolean }
interface State {
  requests: Record<string, Authorization>; codes: Record<string, Code>; grants: Record<string, Grant>;
  access: Record<string, Token>; refresh: Record<string, Token>;
}
const emptyState = (): State => ({ requests: {}, codes: {}, grants: {}, access: {}, refresh: {} });
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const opaque = (): string => randomBytes(32).toString('base64url');
const equal = (a: string, b: string): boolean => timingSafeEqual(Buffer.from(hash(a), 'hex'), Buffer.from(hash(b), 'hex'));
const fail = (code: OAuthErrorCode, message: string): never => { throw new OAuthError(code, message); };

function parameter(values: unknown, key: string, required = true): string {
  const value = values && typeof values === 'object' ? (values as Record<string, unknown>)[key] : undefined;
  if (value === undefined && !required) return '';
  if (typeof value !== 'string' || !value || value.length > 2048) return fail(OAuthErrorCode.InvalidRequest, `Invalid ${key}`);
  return value;
}
function scopes(value: string): string[] {
  const result = [...new Set(value.split(' '))];
  if (!result.length || result.some(s => !SCOPES.includes(s))) return fail(OAuthErrorCode.InvalidScope, 'Unsupported scope');
  return result;
}
function validateConfig(config: AuthConfig): void {
  const loopback = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const urls = [config.issuer, config.resource, config.frontendOrigin, ...config.client.redirectUris].map(raw => new URL(raw));
  for (const url of urls) {
    if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback(url)))) throw new Error('OAuth URLs must use HTTPS (HTTP is allowed only on loopback)');
  }
  if (config.issuer !== urls[0]!.origin || config.frontendOrigin !== urls[2]!.origin || config.resource !== `${config.issuer}/mcp`) throw new Error('OAuth issuer/frontend must be origins and resource must be issuer + /mcp');
  if (config.secureCookies === false && ![urls[0]!, urls[1]!, urls[2]!].every(loopback)) throw new Error('Insecure cookies are restricted to loopback development');
  if (!config.client.id || config.client.secret.length < 32 || !config.client.name || !config.client.redirectUris.length) throw new Error('Configure a confidential OAuth client with a secret of at least 32 characters and exact redirects');
}
function cookieName(requestId: string, config: AuthConfig): string {
  return `${config.secureCookies === false ? '' : '__Host-'}bb_mcp_${hash(requestId).slice(0, 20)}`;
}
function browserCookie(req: Request, requestId: string, config: AuthConfig): string {
  const name = `${cookieName(requestId, config)}=`;
  return (req.headers.cookie ?? '').split(';').map(p => p.trim()).find(p => p.startsWith(name))?.slice(name.length) ?? '';
}
function consentRequest(state: State, id: string, req: Request, options: AuthOptions, time: number): Authorization {
  const authorization = state.requests[hash(id)];
  if (!authorization || authorization.expiresAt <= time) return fail(OAuthErrorCode.InvalidRequest, 'Consent request expired or already used');
  const binding = browserCookie(req, id, options.config);
  if (!binding || !equal(hash(binding), authorization.browserHash)) return fail(OAuthErrorCode.AccessDenied, 'Consent must use the browser that started this connection');
  return authorization;
}
function clientAuthentication(req: Request, config: AuthConfig): void {
  let id: string, secret: string;
  const header = req.headers.authorization;
  if (header) {
    if (!header.startsWith('Basic ') || req.body?.client_secret !== undefined) return fail(OAuthErrorCode.InvalidClient, 'Invalid client authentication');
    try {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const delimiter = decoded.indexOf(':');
      if (delimiter < 0) throw new Error('Missing separator');
      id = decodeURIComponent(decoded.slice(0, delimiter).replace(/\+/g, ' '));
      secret = decodeURIComponent(decoded.slice(delimiter + 1).replace(/\+/g, ' '));
    } catch { return fail(OAuthErrorCode.InvalidClient, 'Invalid client authentication'); }
    if (req.body?.client_id !== undefined && req.body.client_id !== id) return fail(OAuthErrorCode.InvalidClient, 'Conflicting client identity');
  } else {
    id = typeof req.body?.client_id === 'string' ? req.body.client_id : '';
    secret = typeof req.body?.client_secret === 'string' ? req.body.client_secret : '';
  }
  if (!equal(id, config.client.id) || !equal(secret, config.client.secret)) return fail(OAuthErrorCode.InvalidClient, 'Invalid client credentials');
}

/** Mount at the application root. No production state is kept in this process. */
export function createAuthRouter(options: AuthOptions): Router {
  const { config, store } = options;
  validateConfig(config);
  const now = options.now ?? Date.now;
  const router = Router();
  const metadata = {
    issuer: config.issuer, authorization_endpoint: `${config.issuer}/oauth/authorize`,
    token_endpoint: `${config.issuer}/oauth/token`, revocation_endpoint: `${config.issuer}/oauth/revoke`,
    response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    revocation_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'], scopes_supported: SCOPES,
  };
  const protectedMetadata = buildOAuthProtectedResourceMetadata({ oauthMetadata: metadata, resourceServerUrl: new URL(config.resource), scopesSupported: SCOPES, resourceName: 'BudgetBuddy' });
  router.get('/.well-known/oauth-authorization-server', (_req, res) => { res.set('Access-Control-Allow-Origin', '*').json(metadata); });
  router.get(['/.well-known/oauth-protected-resource/mcp', '/.well-known/oauth-protected-resource'], (_req, res) => { res.set('Access-Control-Allow-Origin', '*').json(protectedMetadata); });
  router.use('/oauth', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache', 'Referrer-Policy': 'no-referrer' });
    next();
  }, json({ limit: '16kb' }), urlencoded({ extended: false, limit: '16kb', parameterLimit: 25 }));
  router.use('/oauth/consent', (req, res, next) => {
    res.vary('Origin');
    if (req.headers.origin === config.frontendOrigin) {
      res.set({ 'Access-Control-Allow-Origin': config.frontendOrigin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' });
    } else if (req.method !== 'GET' || req.headers.origin) return next(new OAuthError(OAuthErrorCode.AccessDenied, 'Invalid consent origin'));
    if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
    next();
  });

  // Transactions cover the complete OAuth transition, including reuse-triggered revocation.
  async function update<R>(change: (state: State) => R): Promise<R> {
    return store.transaction<State, R>(ROOT, current => {
      const state = { ...emptyState(), ...current };
      const time = now();
      for (const [key, request] of Object.entries(state.requests)) if (request.expiresAt <= time) delete state.requests[key];
      for (const [key, grant] of Object.entries(state.grants)) if (grant.expiresAt <= time) delete state.grants[key];
      for (const kind of ['access', 'refresh', 'codes'] as const) {
        for (const [key, token] of Object.entries(state[kind])) if (!state.grants[token.familyId] || (kind === 'access' && token.expiresAt <= time)) delete state[kind][key];
      }
      return { value: state, result: change(state) };
    });
  }
  router.get('/oauth/authorize', async (req, res) => {
    if (parameter(req.query, 'client_id') !== config.client.id) return fail(OAuthErrorCode.InvalidClient, 'Unknown client');
    const redirectUri = parameter(req.query, 'redirect_uri');
    if (!config.client.redirectUris.includes(redirectUri)) return fail(OAuthErrorCode.InvalidRequest, 'Unregistered redirect URI');
    if (parameter(req.query, 'response_type') !== 'code') return fail(OAuthErrorCode.UnsupportedResponseType, 'Only code responses are supported');
    if (parameter(req.query, 'resource') !== config.resource) return fail(OAuthErrorCode.InvalidTarget, 'Wrong resource');
    const challenge = parameter(req.query, 'code_challenge');
    if (parameter(req.query, 'code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(challenge)) return fail(OAuthErrorCode.InvalidRequest, 'S256 PKCE is required');
    const requestedScopes = scopes(parameter(req.query, 'scope', false) || 'budgetbuddy:read');
    const stateValue = parameter(req.query, 'state', false);
    const id = opaque(), binding = opaque();
    await update(state => { state.requests[hash(id)] = { clientId: config.client.id, redirectUri, resource: config.resource, scopes: requestedScopes, challenge, state: stateValue, browserHash: hash(binding), expiresAt: now() + REQUEST_MS }; });
    res.cookie(cookieName(id, config), binding, { httpOnly: true, secure: config.secureCookies !== false, sameSite: config.secureCookies === false ? 'lax' : 'none', path: '/', maxAge: REQUEST_MS });
    const destination = new URL('/mcp/consent', config.frontendOrigin);
    destination.searchParams.set('request_id', id);
    res.redirect(302, destination.href);
  });
  router.get('/oauth/consent', async (req, res) => {
    const id = parameter(req.query, 'request_id');
    const state = { ...emptyState(), ...await store.read<State>(ROOT) };
    const authorization = consentRequest(state, id, req, options, now());
    res.json({ client_name: config.client.name, scopes: authorization.scopes, expires_at: authorization.expiresAt });
  });
  router.post('/oauth/consent', async (req, res) => {
    const id = parameter(req.body, 'request_id');
    const decision = parameter(req.body, 'decision');
    if (!['approve', 'deny'].includes(decision)) return fail(OAuthErrorCode.InvalidRequest, 'Choose approve or deny');
    // Check browser binding before contacting Firebase, then repeat inside the atomic write.
    consentRequest({ ...emptyState(), ...await store.read<State>(ROOT) }, id, req, options, now());
    const firebaseToken = req.headers.authorization?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!firebaseToken) return fail(OAuthErrorCode.InvalidToken, 'Sign in to BudgetBuddy first');
    let identity: { uid: string; email: string };
    try {
      identity = await options.verifyIdentity(firebaseToken);
      if (!identity.uid || !identity.email) throw new Error('Missing verified identity');
    } catch { return fail(OAuthErrorCode.InvalidToken, 'BudgetBuddy sign-in expired or invalid'); }
    const code = opaque(), familyId = opaque();
    const redirect = await update(state => {
      const authorization = consentRequest(state, id, req, options, now());
      const url = new URL(authorization.redirectUri);
      if (authorization.state) url.searchParams.set('state', authorization.state);
      if (decision === 'deny') url.searchParams.set('error', 'access_denied');
      else {
        state.grants[familyId] = { clientId: authorization.clientId, resource: authorization.resource, scopes: authorization.scopes, ...identity, expiresAt: now() + GRANT_MS, revoked: false };
        state.codes[hash(code)] = { clientId: authorization.clientId, resource: authorization.resource, redirectUri: authorization.redirectUri, challenge: authorization.challenge, familyId, expiresAt: now() + CODE_MS, used: false };
        url.searchParams.set('code', code);
      }
      delete state.requests[hash(id)];
      return url.href;
    });
    res.clearCookie(cookieName(id, config), { httpOnly: true, secure: config.secureCookies !== false, sameSite: config.secureCookies === false ? 'lax' : 'none', path: '/' });
    res.json({ redirect_url: redirect });
  });

  router.post('/oauth/token', async (req, res) => {
    clientAuthentication(req, config);
    const grantType = parameter(req.body, 'grant_type');
    if (!['authorization_code', 'refresh_token'].includes(grantType)) return fail(OAuthErrorCode.UnsupportedGrantType, 'Unsupported grant');
    if (parameter(req.body, 'resource') !== config.resource) return fail(OAuthErrorCode.InvalidTarget, 'Wrong resource');
    const accessToken = opaque(), refreshToken = opaque();
    const result = await update(state => {
      let familyId: string, grantedScopes: string[];
      if (grantType === 'authorization_code') {
        const code = state.codes[hash(parameter(req.body, 'code'))];
        const verifier = parameter(req.body, 'code_verifier');
        if (!code || code.clientId !== config.client.id || code.resource !== config.resource || parameter(req.body, 'redirect_uri') !== code.redirectUri || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || !equal(createHash('sha256').update(verifier).digest('base64url'), code.challenge)) return fail(OAuthErrorCode.InvalidGrant, 'Invalid authorization code or proof');
        const grant = state.grants[code.familyId];
        if (code.used) {
          if (grant) grant.revoked = true;
          return { error: true as const };
        }
        if (code.expiresAt <= now() || !grant || grant.revoked) return fail(OAuthErrorCode.InvalidGrant, 'Authorization code expired or revoked');
        code.used = true;
        familyId = code.familyId;
        grantedScopes = grant.scopes;
      } else {
        const token = state.refresh[hash(parameter(req.body, 'refresh_token'))];
        const grant = token && state.grants[token.familyId];
        if (!token || !grant || grant.clientId !== config.client.id || grant.resource !== config.resource || token.expiresAt <= now() || grant.revoked) return fail(OAuthErrorCode.InvalidGrant, 'Refresh token expired or revoked');
        if (token.used) {
          grant.revoked = true;
          return { error: true as const };
        }
        grantedScopes = req.body.scope === undefined ? token.scopes : scopes(parameter(req.body, 'scope'));
        if (grantedScopes.some(scope => !token.scopes.includes(scope))) return fail(OAuthErrorCode.InvalidScope, 'Refresh cannot increase scope');
        token.used = true;
        familyId = token.familyId;
      }
      const grant = state.grants[familyId]!;
      const accessExpiry = Math.min(now() + ACCESS_MS, grant.expiresAt);
      state.access[hash(accessToken)] = { familyId, scopes: grantedScopes, expiresAt: accessExpiry };
      state.refresh[hash(refreshToken)] = { familyId, scopes: grantedScopes, expiresAt: grant.expiresAt, used: false };
      return { error: false as const, expiresIn: Math.floor((accessExpiry - now()) / 1000), scopes: grantedScopes };
    });
    if (result.error) return fail(OAuthErrorCode.InvalidGrant, 'Credential reuse detected; reconnect BudgetBuddy');
    res.json({ access_token: accessToken, token_type: 'Bearer', expires_in: result.expiresIn, refresh_token: refreshToken, scope: result.scopes.join(' ') });
  });
  router.post('/oauth/revoke', async (req, res) => {
    clientAuthentication(req, config);
    const tokenHash = hash(parameter(req.body, 'token'));
    await update(state => {
      const token = state.refresh[tokenHash] ?? state.access[tokenHash];
      const grant = token && state.grants[token.familyId];
      if (grant?.clientId === config.client.id) grant.revoked = true;
    });
    res.status(200).end();
  });
  const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof OAuthError) {
      const status = error.code === 'invalid_client' || error.code === 'invalid_token' ? 401 : error.code === 'access_denied' ? 403 : 400;
      if (error.code === 'invalid_client') res.set('WWW-Authenticate', 'Basic realm="BudgetBuddy OAuth"');
      res.status(status).json(error.toResponseObject());
    } else {
      const status = (error as { status?: number })?.status;
      res.status(status === 413 ? 413 : status === 400 ? 400 : 500).json({ error: status === 413 || status === 400 ? 'invalid_request' : 'server_error', error_description: status === 413 ? 'Request body too large' : 'Request could not be completed' });
    }
  };
  router.use(errors);
  return router;
}

/** Validates only BudgetBuddy OAuth access tokens; Firebase ID tokens are never accepted. */
export async function authenticate(options: AuthOptions, header: string | null | undefined, requiredScopes: string[] = []): Promise<AuthPrincipal> {
  const time = (options.now ?? Date.now)();
  const verifier: OAuthTokenVerifier = {
    async verifyAccessToken(token): Promise<AuthPrincipal> {
      if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return fail(OAuthErrorCode.InvalidToken, 'Invalid access token');
      const record = await options.store.read<Token>(`${ROOT}/access/${hash(token)}`);
      const grant = record && await options.store.read<Grant>(`${ROOT}/grants/${record.familyId}`);
      if (!record || !grant || record.expiresAt <= time || grant.expiresAt <= time || grant.revoked || grant.resource !== options.config.resource || grant.clientId !== options.config.client.id) return fail(OAuthErrorCode.InvalidToken, 'Access token expired or revoked');
      return { token, clientId: grant.clientId, scopes: record.scopes, expiresAt: Math.floor(record.expiresAt / 1000), resource: new URL(grant.resource), extra: { uid: grant.uid, email: grant.email } };
    },
  };
  return await verifyBearerToken(header, { verifier, requiredScopes, expectedResource: new URL(options.config.resource), resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(options.config.resource)) }) as AuthPrincipal;
}
