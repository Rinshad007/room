import { z } from 'zod';
import type { AuthConfig } from './auth/index.js';

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = z.object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    MCP_PUBLIC_URL: z.url(), OAUTH_ISSUER_URL: z.url(), BUDGETBUDDY_APP_URL: z.url(),
    FIREBASE_PROJECT_ID: z.string().min(1), FIREBASE_DATABASE_URL: z.url(),
    DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default('INR'), DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
    OAUTH_CLIENT_ID: z.string().min(1), OAUTH_CLIENT_SECRET: z.string().min(32), OAUTH_REDIRECT_URIS: z.string().min(1),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(3).default(0),
    OAUTH_SECURE_COOKIES: z.enum(['true', 'false']).default('true'),
  }).parse(env);
  new Intl.DateTimeFormat('en', { timeZone: value.DEFAULT_TIMEZONE });
  const database = new URL(value.FIREBASE_DATABASE_URL);
  if (!env.FIREBASE_DATABASE_EMULATOR_HOST && (database.protocol !== 'https:' || !/(\.firebaseio\.com|\.firebasedatabase\.app)$/.test(database.hostname))) throw new Error('Use an HTTPS Firebase Realtime Database URL.');
  if (env.FIREBASE_DATABASE_EMULATOR_HOST && !value.FIREBASE_PROJECT_ID.startsWith('demo-')) throw new Error('Emulator mode requires a demo- project ID to prevent accidental production use.');
  const auth: AuthConfig = { issuer: value.OAUTH_ISSUER_URL, resource: value.MCP_PUBLIC_URL, frontendOrigin: value.BUDGETBUDDY_APP_URL, secureCookies: value.OAUTH_SECURE_COOKIES === 'true', client: { id: value.OAUTH_CLIENT_ID, secret: value.OAUTH_CLIENT_SECRET, name: 'ChatGPT / BudgetBuddy', redirectUris: value.OAUTH_REDIRECT_URIS.split(',').map(s => s.trim()).filter(Boolean) } };
  return { ...value, auth };
}
