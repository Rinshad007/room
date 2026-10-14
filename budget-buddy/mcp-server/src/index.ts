import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getAuth } from 'firebase-admin/auth';
import { loadConfig, parseServiceAccount } from './config.js';
import { FirebaseStore } from './firebase-store.js';
import { BudgetService } from './service.js';
import { createApp } from './http.js';

const config = loadConfig();
const firebase = initializeApp({
  projectId: config.FIREBASE_PROJECT_ID,
  databaseURL: config.FIREBASE_DATABASE_URL,
  ...(process.env.FIREBASE_DATABASE_EMULATOR_HOST ? {} : {
    credential: config.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64
      ? cert(parseServiceAccount(config.FIREBASE_SERVICE_ACCOUNT_JSON_BASE64, config.FIREBASE_PROJECT_ID))
      : applicationDefault(),
  }),
});
const store = new FirebaseStore(getDatabase(firebase));
const service = new BudgetService(store, { currency: config.DEFAULT_CURRENCY, timezone: config.DEFAULT_TIMEZONE, appUrl: config.BUDGETBUDDY_APP_URL });
const app = createApp({ config: config.auth, store, verifyIdentity: async token => {
  const user = await getAuth(firebase).verifyIdToken(token, true);
  if (!user.email) throw new Error('Sign in with an email-linked BudgetBuddy account.');
  return { uid: user.uid, email: user.email };
} }, service, config.TRUST_PROXY_HOPS);
const server = app.listen(config.PORT, '0.0.0.0', () => { console.info(`BudgetBuddy MCP listening on port ${config.PORT}`); });
server.requestTimeout = 30000;
server.headersTimeout = 15000;
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); });
