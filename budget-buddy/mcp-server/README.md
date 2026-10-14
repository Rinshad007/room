# BudgetBuddy MCP server

Authenticated Streamable HTTP MCP server for the existing BudgetBuddy Firebase data. Requires Node 24. Uses the official MCP SDK v2 and per-user OAuth account linking.

**[Complete setup and ChatGPT connection guide](../../docs/MCP_SETUP.md)**

```powershell
npm ci
Copy-Item .env.example .env
# Configure .env privately.
npm run build
npm start
```

Endpoints: `/mcp`, `/health`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`, `/oauth/authorize`, `/oauth/token`, `/oauth/revoke`, `/oauth/consent`.

```powershell
npm run typecheck
npm run test:coverage
# Requires Java 21+:
npx firebase emulators:exec --project demo-budgetbuddy --only database "npm run test:emulator"
```

Default tests use isolated memory persistence and the real MCP HTTP/client implementation; database tests run only against the explicitly selected local Firebase emulator. No test uses production Firebase data. `src/firebase-store.ts` is tested separately with the emulator; the process bootstrap is excluded from unit coverage.

The tool catalog is maintained in `src/catalog.ts`. Each tool returns `{ data: ... }` as structured content on success. Lists use `items`, `total`, and `next_offset`; expense records include a content-hash `revision`. Writes require `budgetbuddy:write`, reads require `budgetbuddy:read`.

The package is independent of the legacy FastAPI/PostgreSQL backend. Telegram account linking is reported as unavailable until the external bot's authenticated API is integrated. This server records settlements but never moves money.

For Firebase Admin authentication, set either `GOOGLE_APPLICATION_CREDENTIALS` to a server-only JSON file or set `FIREBASE_SERVICE_ACCOUNT_JSON_BASE64` to the base64-encoded contents of that file. The base64 variable takes precedence and is validated against `FIREBASE_PROJECT_ID` during startup.

Operational boundary: domain mutations use root Firebase transactions to atomically preserve splits, notifications, idempotency, and concurrent browser writes. This is suitable for a small app, not a high-throughput database. At 50,000 application records the server refuses scans instead of returning incomplete analytics. Migrate to indexed, account-partitioned storage before that limit. Private OAuth state is persisted under `mcp_private`; never grant clients access to that namespace.
