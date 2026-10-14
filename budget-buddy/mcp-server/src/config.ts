import { z } from 'zod';
import type { ServiceAccount } from 'firebase-admin/app';
import type { AuthConfig } from './auth/index.js';

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.email(),
  private_key: z.string().min(1),
});

export function parseServiceAccount(value: string, expectedProject: string): ServiceAccount {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new Error('Firebase service-account credential must be valid base64.');
  }
  try {
    const parsed = serviceAccountSchema.parse(JSON.parse(Buffer.from(value, 'base64').toString('utf8')));
    if (parsed.project_id !== expectedProject) throw new Error('Firebase service-account project does not match FIREBASE_PROJECT_ID.');
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch (error) {
    if (error instanceof Error && /project does not match/.test(error.message)) throw error;
    throw new Error('Firebase service-account credential is invalid.', { cause: error });
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    MCP_PUBLIC_URL: z.url(), OAUTH_ISSUER_URL: z.url(), BUDGETBUDDY_APP_URL: z.url(),
    FIREBASE_PROJECT_ID: z.string().min(1), FIREBASE_DATABASE_URL: z.url(),
    FIREBASE_SERVICE_ACCOUNT_JSON_BASE64: z.string().min(1).optional(),
    DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('INR'), DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
    OAUTH_CLIENT_ID: z.string().min(1), OAUTH_CLIENT_SECRET: z.string().min(32), OAUTH_REDIRECT_URIS: z.string().min(1),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    OAUTH_SECURE_COOKIES: z.enum(['true', 'false']).default('true'),
  }).parse(env);
  new Intl.DateTimeFormat('en', { timeZone: value.DEFAULT_TIMEZONE });
  const database = new URL(value.FIREBASE_DATABASE_URL);
  if (!env.FIREBASE_DATABASE_EMULATOR_HOST && (database.protocol !== 'https:' || !/(\.firebaseio\.com|\.firebasedatabase\.app)$/.test(database.hostname))) throw new Error('Use an HTTPS Firebase Realtime Database URL.');
  if (env.FIREBASE_DATABASE_EMULATOR_HOST && !value.FIREBASE_PROJECT_ID.startsWith('demo-')) throw new Error('Emulator mode requires a demo- project ID to prevent accidental production use.');
  if (!env.FIREBASE_DATABASE_EMULATOR_HOST && value.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64) parseServiceAccount(value.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, value.FIREBASE_PROJECT_ID);
  const auth: AuthConfig = { issuer: value.OAUTH_ISSUER_URL, resource: value.MCP_PUBLIC_URL, frontendOrigin: value.BUDGETBUDDY_APP_URL, secureCookies: value.OAUTH_SECURE_COOKIES === 'true', client: { id: value.OAUTH_CLIENT_ID, secret: value.OAUTH_CLIENT_SECRET, name: 'ChatGPT / BudgetBuddy', redirectUris: value.OAUTH_REDIRECT_URIS.split(',').map(s => s.trim()).filter(Boolean) } };
  return { ...value, auth };
}
