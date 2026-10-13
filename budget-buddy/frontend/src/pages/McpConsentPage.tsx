import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { auth } from '../firebase';
import { authAPI } from '../api/services';
import { ConsentError, getConsentRequest, getMcpServerOrigin, submitConsentDecision } from '../api/mcpConsent';
import { useAuthStore } from '../store/auth';

function connectionConfiguration(): { origin: string; error: string | null } {
  try {
    return { origin: getMcpServerOrigin(import.meta.env.VITE_MCP_SERVER_URL), error: null };
  } catch (error) {
    return { origin: '', error: error instanceof Error ? error.message : 'Connections are not available yet.' };
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ConsentError) return error.message;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'We could not sign you in. Check your email and password.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled. Try again when you are ready.';
    case 'auth/popup-blocked':
      return 'Allow the sign-in popup in your browser, then try again.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Check your internet connection, then try again.';
    default:
      return 'We could not complete that step. Please try again.';
  }
}

export default function McpConsentPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request_id') || '';
  const [configuration] = useState(connectionConfiguration);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(() => auth.currentUser);
  const [form, setForm] = useState({ email: '', password: '' });
  const [action, setAction] = useState<'email' | 'google' | 'approve' | 'deny' | 'switch' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expiredRequest, setExpiredRequest] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState<'approve' | 'deny' | null>(null);
  const { setAuth, logout } = useAuthStore();
  const consent = useQuery({
    queryKey: ['mcp-consent', configuration.origin, requestId],
    queryFn: ({ signal }) => getConsentRequest(configuration.origin, requestId, signal),
    enabled: Boolean(configuration.origin && requestId),
    retry: false,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => onAuthStateChanged(auth, setFirebaseUser), []);

  useEffect(() => {
    if (!consent.data) return;
    const timer = window.setTimeout(() => setExpiredRequest(requestId), Math.max(0, consent.data.expires_at - Date.now()));
    return () => window.clearTimeout(timer);
  }, [consent.data, requestId]);

  const expired = expiredRequest === requestId;
  const linkError = configuration.error
    || (!requestId ? 'This connection link is incomplete. Please start again from your app.' : null)
    || (consent.error ? errorMessage(consent.error) : null)
    || (expired ? 'This connection request has expired. Please start again from your app.' : null);
  const busy = action !== null || redirecting !== null;
  const ready = Boolean(consent.data && !linkError);

  async function signIn(method: 'email' | 'google', event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy || !ready) return;
    setAction(method);
    setActionError(null);
    try {
      const response = method === 'google' ? await authAPI.googleLogin() : await authAPI.login(form);
      setAuth(response.data.user, response.data.access_token, response.data.refresh_token);
      setForm(previous => ({ ...previous, password: '' }));
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAction(null);
    }
  }

  async function switchAccount() {
    if (busy) return;
    setAction('switch');
    setActionError(null);
    try {
      await signOut(auth);
      logout();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAction(null);
    }
  }

  async function decide(decision: 'approve' | 'deny') {
    if (busy || !ready || !firebaseUser) return;
    setAction(decision);
    setActionError(null);
    try {
      // Proof always comes from Firebase, never the app's cached account or token.
      const currentUser = auth.currentUser;
      if (!currentUser || currentUser.uid !== firebaseUser.uid) {
        throw new ConsentError('sign-in', 'Your account changed. Please review the account and try again.');
      }
      if (!consent.data || consent.data.expires_at <= Date.now()) {
        setExpiredRequest(requestId);
        return;
      }
      const idToken = await currentUser.getIdToken();
      if (auth.currentUser?.uid !== currentUser.uid) {
        throw new ConsentError('sign-in', 'Your account changed. Please review the account and try again.');
      }
      const redirectUrl = await submitConsentDecision(configuration.origin, requestId, decision, idToken);
      setRedirecting(decision);
      window.location.assign(redirectUrl);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setAction(null);
    }
  }

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-container-padding py-8">
      <div className="flex flex-col items-center gap-3 mb-6">
        <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-float" aria-hidden="true">
          <span className="material-symbols-outlined text-on-primary text-3xl">account_balance_wallet</span>
        </div>
        <p className="font-headline-lg text-primary">Budget Buddy</p>
      </div>

      <section className="glass-panel rounded-2xl p-6 w-full max-w-md flex flex-col gap-5" aria-labelledby="consent-title" aria-busy={busy || consent.isFetching}>
        <header className="border-b border-outline-variant/40 pb-4">
          <h1 id="consent-title" className="font-headline-lg-mobile text-primary">Connect your account</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            {consent.data ? <><strong className="text-on-surface break-words">{consent.data.client_name}</strong> would like access to your BudgetBuddy account.</> : 'Review your account and permissions before connecting.'}
          </p>
        </header>

        {linkError ? (
          <div role="alert" className="rounded-xl bg-error/10 text-error p-4 text-sm">
            <p>{linkError}</p>
            {consent.error instanceof ConsentError && consent.error.kind === 'unavailable' ? (
              <button type="button" className="mt-3 font-semibold underline disabled:opacity-50" disabled={consent.isFetching} onClick={() => void consent.refetch()}>Try again</button>
            ) : null}
          </div>
        ) : consent.isPending ? (
          <p role="status" className="flex items-center gap-3 text-sm text-on-surface-variant"><span className="spinner spinner-dark" aria-hidden="true" />Checking connection request…</p>
        ) : null}

        {ready && consent.data ? (
          <>
            <div>
              <h2 className="text-sm font-semibold text-primary mb-3">Requested access</h2>
              <ul className="flex flex-col gap-3 text-sm text-on-surface-variant">
                {consent.data.scopes.includes('budgetbuddy:read') ? (
                  <li className="flex gap-3"><span className="material-symbols-outlined text-primary shrink-0" aria-hidden="true">visibility</span><span><strong className="block text-on-surface">View your finances</strong>Read your expenses, analytics, budgets, groups, balances, and account details.</span></li>
                ) : null}
                {consent.data.scopes.includes('budgetbuddy:write') ? (
                  <li className="flex gap-3"><span className="material-symbols-outlined text-primary shrink-0" aria-hidden="true">edit</span><span><strong className="block text-on-surface">Make changes for you</strong>Add, edit, and delete expenses; manage budgets, groups, friends, and settlement records.</span></li>
                ) : null}
              </ul>
              <p className="text-xs text-on-surface-variant mt-3">Recording a settlement does not transfer money.</p>
            </div>

            {firebaseUser ? (
              <>
                <div className="rounded-xl bg-surface-container p-4">
                  <p className="font-label-caps uppercase text-on-surface-variant">Account to connect</p>
                  <p className="font-semibold text-on-surface break-words mt-1">{firebaseUser.email || firebaseUser.displayName || 'Your BudgetBuddy account'}</p>
                  <button type="button" onClick={() => void switchAccount()} disabled={busy} className="text-sm text-primary font-semibold mt-2 underline disabled:opacity-50">Use another account</button>
                </div>
                <p className="text-xs text-on-surface-variant">To use the same email as ChatGPT, check that the account above matches it.</p>
              </>
            ) : (
              <div className="flex flex-col gap-4 border-t border-outline-variant/40 pt-4">
                <div>
                  <h2 className="text-base font-semibold text-primary">Sign in to BudgetBuddy</h2>
                  <p className="text-sm text-on-surface-variant mt-1">Use your BudgetBuddy account with the same email as ChatGPT. You will review and approve access after signing in.</p>
                </div>
                <form onSubmit={event => void signIn('email', event)} className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="consent-email" className="block text-sm font-semibold text-on-surface-variant mb-1.5">Email</label>
                    <input id="consent-email" className="input-field" type="email" autoComplete="email" required value={form.email} disabled={busy} onChange={event => setForm(previous => ({ ...previous, email: event.target.value }))} />
                  </div>
                  <div>
                    <label htmlFor="consent-password" className="block text-sm font-semibold text-on-surface-variant mb-1.5">Password</label>
                    <input id="consent-password" className="input-field" type="password" autoComplete="current-password" required value={form.password} disabled={busy} onChange={event => setForm(previous => ({ ...previous, password: event.target.value }))} />
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">{action === 'email' ? 'Signing in…' : 'Sign in'}</button>
                </form>
                <button type="button" onClick={() => void signIn('google')} disabled={busy} className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed">{action === 'google' ? 'Signing in…' : 'Continue with Google'}</button>
                <p className="text-xs text-on-surface-variant">Need help signing in? <Link to="/forgot-password" target="_blank" rel="noopener noreferrer" className="text-primary underline">Reset your password in a new tab</Link>, then return here.</p>
              </div>
            )}
          </>
        ) : null}

        {actionError ? <p role="alert" className="rounded-xl bg-error/10 text-error p-3 text-sm">{actionError}</p> : null}

        {redirecting ? (
          <p role="status" className="text-sm text-primary">{redirecting === 'approve' ? 'Account connected.' : 'Connection declined.'} Returning to your app…</p>
        ) : ready && firebaseUser ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => void decide('approve')} disabled={busy} className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed">{action === 'approve' ? 'Connecting…' : 'Allow access'}</button>
            <button type="button" onClick={() => void decide('deny')} disabled={busy} className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed">{action === 'deny' ? 'Declining…' : 'Decline'}</button>
          </div>
        ) : null}
      </section>
      <Link to="/" className="mt-6 text-sm text-primary font-semibold hover:underline">Back to BudgetBuddy</Link>
    </main>
  );
}
