export class ConsentError extends Error {
  readonly kind: 'configuration' | 'expired' | 'invalid' | 'sign-in' | 'unavailable';

  constructor(kind: ConsentError['kind'], message: string) {
    super(message);
    this.name = 'ConsentError';
    this.kind = kind;
  }
}

function safeHttpUrl(value: unknown): URL {
  if (typeof value !== 'string' || !value) throw new Error('Missing URL');
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password) {
    throw new Error('Unsafe URL');
  }
  return url;
}

export function getMcpServerOrigin(configuredUrl: string | undefined): string {
  try {
    const url = safeHttpUrl(configuredUrl);
    if (url.pathname !== '/' || url.search || url.hash) throw new Error('Expected an origin');
    return url.origin;
  } catch {
    throw new ConsentError('configuration', 'Connections are not available yet. Please try again later.');
  }
}

export function validateConsentRedirect(value: unknown): string {
  try {
    return safeHttpUrl(value).href;
  } catch {
    throw new ConsentError('invalid', 'The connection could not return to your app. Please start again from that app.');
  }
}

export type ConsentRequest = {
  client_name: string;
  scopes: Array<'budgetbuddy:read' | 'budgetbuddy:write'>;
  expires_at: number;
};

function consentEndpoint(serverOrigin: string, requestId: string): URL {
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(requestId)) {
    throw new ConsentError('invalid', 'This connection link is incomplete. Please start again from your app.');
  }
  return new URL('/oauth/consent', getMcpServerOrigin(serverOrigin));
}

async function requestJson(url: URL, options: RequestInit): Promise<Record<string, unknown>> {
  const timeout = AbortSignal.timeout(15000);
  try {
    const response = await fetch(url, {
      ...options,
      mode: 'cors',
      credentials: 'include',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    });
    if (response.status === 410) {
      throw new ConsentError('expired', 'This connection request has expired. Please start again from your app.');
    }
    if (response.status === 401) {
      throw new ConsentError('sign-in', 'Please sign in again before connecting your account.');
    }
    if (response.status === 400 || response.status === 403 || response.status === 404) {
      throw new ConsentError('invalid', 'This connection link is no longer valid. Please start again from your app in this browser.');
    }
    if (!response.ok) throw new Error('Request failed');
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid response');
    return body as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ConsentError || options.signal?.aborted) throw error;
    throw new ConsentError('unavailable', 'We could not reach the connection service. Please try again.');
  }
}

export async function getConsentRequest(serverOrigin: string, requestId: string, signal?: AbortSignal): Promise<ConsentRequest> {
  const url = consentEndpoint(serverOrigin, requestId);
  url.searchParams.set('request_id', requestId);
  const body = await requestJson(url, { signal });
  if (typeof body.client_name !== 'string' || !body.client_name.trim() || body.client_name.length > 200
    || !Array.isArray(body.scopes) || !body.scopes.length || body.scopes.length > 2
    || body.scopes.some(scope => scope !== 'budgetbuddy:read' && scope !== 'budgetbuddy:write')
    || typeof body.expires_at !== 'number' || !Number.isSafeInteger(body.expires_at)) {
    throw new ConsentError('invalid', 'We could not verify this connection request. Please start again from your app.');
  }
  if (body.expires_at <= Date.now()) {
    throw new ConsentError('expired', 'This connection request has expired. Please start again from your app.');
  }
  return {
    client_name: body.client_name,
    scopes: [...new Set(body.scopes)] as ConsentRequest['scopes'],
    expires_at: body.expires_at,
  };
}

export async function submitConsentDecision(serverOrigin: string, requestId: string, decision: 'approve' | 'deny', idToken: string): Promise<string> {
  const url = consentEndpoint(serverOrigin, requestId);
  if (!idToken.trim()) throw new ConsentError('sign-in', 'Please sign in before connecting your account.');
  const body = await requestJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ request_id: requestId, decision }),
  });
  return validateConsentRedirect(body.redirect_url);
}
