# BudgetBuddy MCP setup and ChatGPT connection

The server in `budget-buddy/mcp-server` provides **43 authenticated tools** over Streamable HTTP. It uses the existing Firebase data and the new `/mcp/consent` frontend page. **Implementation and local verification are complete; live deployment and ChatGPT account linking remain to be performed.**

No OpenAI API key is needed to expose these tools. ChatGPT interprets your messages; the server validates and executes structured operations.

## Account linking and the same email

ChatGPT opens BudgetBuddy's sign-in/consent page. Sign in using the same email you use for ChatGPT and approve the permissions. Access is bound to the verified Firebase UID. The server does not receive a verified ChatGPT-user email to compare automatically and never treats an email typed into chat as proof of ownership.

If your expenses belong to another BudgetBuddy account, sign into that account or change its email through BudgetBuddy's existing reauthentication flow. Creating a new account does not migrate expenses. Phone-only accounts need an email-linked identity for this integration.

## 1. Prerequisites

- Node.js **24**, npm, and the repository checkout.
- Access to the Firebase project already used by BudgetBuddy.
- A server-only Firebase service-account JSON or supported Application Default Credentials.
- A Node/Docker host with HTTPS. A separate Render Blueprint is included.
- ChatGPT account/workspace permission to add a custom MCP server.
- Java **21+**, only if running Firebase emulator tests; production does not need Java.

Prefer sibling domains such as `app.example.com` and `mcp.example.com`. Consent uses a secure HttpOnly cookie on the MCP origin. Unrelated Vercel/Render hostnames may encounter third-party-cookie blocking. Locally, use `localhost` consistently for both services rather than mixing it with `127.0.0.1`.

## 2. Firebase credentials and rules

1. Select the frontend's existing Firebase project in Firebase Console.
2. Copy its project ID and exact Realtime Database URL, including its region if present.
3. Confirm email/password or Google sign-in is enabled and the frontend domain is authorized for the chosen provider.
4. Obtain a dedicated service-account JSON from Project Settings → Service accounts, or configure Application Default Credentials. Keep the JSON outside tracked source.
5. Set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute path. On Render, use a mounted secret file.

`VITE_FIREBASE_*` values identify the project; they are not Admin credentials. Never expose service-account keys or OAuth secrets through a `VITE_` variable.

OAuth grants and request deduplication records live under `mcp_private`. Merge this child into your **deployed** Realtime Database rules while preserving other app rules:

```json
"mcp_private": { ".read": false, ".write": false }
```

Remove any permissive root rule that overrides this restriction. Do not deploy the entire `database.emulator.rules.json` to production: it intentionally denies all client access for testing. The checked-in mobile rules are not proof of deployed rules. Firebase Admin bypasses client rules, so the server independently enforces user, participant, owner, and scope permissions.

## 3. Install and configure

From the repository root in PowerShell:

```powershell
Set-Location budget-buddy/mcp-server
npm ci
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Place the generated value in `OAUTH_CLIENT_SECRET` privately. Configure:

| Variable | Value |
| --- | --- |
| `PORT` | Local `3001`; accept the host-provided port in production. |
| `MCP_PUBLIC_URL` | `http://localhost:3001/mcp` locally; `https://mcp.example.com/mcp` in production. |
| `OAUTH_ISSUER_URL` | MCP origin **without trailing slash**, e.g. `http://localhost:3001`. |
| `BUDGETBUDDY_APP_URL` | Frontend origin without trailing slash, e.g. `http://localhost:5173`. |
| `FIREBASE_PROJECT_ID` | Existing Firebase project ID. |
| `FIREBASE_DATABASE_URL` | Exact database URL from Firebase Console. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute server credential file path; omit only with working Application Default Credentials. |
| `DEFAULT_CURRENCY` | Initially `INR`; labels amounts, does not convert currencies. |
| `DEFAULT_TIMEZONE` | Initially `Asia/Kolkata`. |
| `OAUTH_CLIENT_ID` | For example `budgetbuddy-chatgpt`. |
| `OAUTH_CLIENT_SECRET` | Random secret, at least 32 characters. |
| `OAUTH_REDIRECT_URIS` | Comma-separated **exact callbacks shown by your client**, no wildcards. |
| `OAUTH_SECURE_COOKIES` | `false` only when issuer/frontend/resource are all loopback; **`true` in production**. |
| `TRUST_PROXY_HOPS` | `0` locally, `1` for the supplied Render setup; match the actual proxy topology. |

The resource URL must equal issuer plus `/mcp`. Production URLs must be HTTPS. Do not set emulator environment variables in production.

## 4. Frontend configuration

Add to `budget-buddy/frontend/.env.local` or the frontend host's environment:

```dotenv
VITE_MCP_SERVER_URL=http://localhost:3001
```

In production use `https://mcp.example.com` **without `/mcp`**. Keep existing Firebase settings. Vite environment changes require rebuilding/redeploying.

Run in a separate terminal from the repository root:

```powershell
Set-Location budget-buddy/frontend
npm ci
npm run dev
```

Start linking from your MCP client. Opening `/mcp/consent` without a valid authorization request correctly shows an invalid-link message. The page supports email/password or Google sign-in, switching accounts, permission review, approval, and denial. Credentials are never sent to the MCP server; only a Firebase ID token proves identity during consent.

## 5. Build, test, and run the server

From `budget-buddy/mcp-server`:

```powershell
npm run typecheck
npm run test:coverage
npm run build
npm start
# Auto-reload alternative:
# npm run dev
```

Health: `http://localhost:3001/health`. MCP: `http://localhost:3001/mcp`. An ordinary browser GET is not a tool call. A 401 without OAuth is expected. Health does not prove account linking works.

Normal tests use isolated memory persistence and the real MCP client/HTTP transport. Database tests are skipped until explicitly run with Java 21+ on PATH:

```powershell
npx firebase emulators:exec --project demo-budgetbuddy --only database "npm run test:emulator"
```

Tests seed and clear **only the loopback demo emulator** on port 9000. They never use the live database. The emulator rules deny browser access while Admin test operations work.

Frontend checks, from its directory:

```powershell
node --test tests/mcpConsent.test.mjs
npm run build
```

## 6. MCP Inspector

```powershell
npx @modelcontextprotocol/inspector@latest
```

1. Choose Streamable HTTP and enter `http://localhost:3001/mcp`.
2. Configure OAuth with your client ID/secret and scopes `budgetbuddy:read budgetbuddy:write`.
3. Copy Inspector's displayed callback to `OAUTH_REDIRECT_URIS` and restart the server. The template callback is an example; use the client's actual value.
4. Start OAuth in the same browser, sign into BudgetBuddy, review permissions, and approve.
5. Initialize, list tools, and call `get_account_context`.

Supported OAuth: authorization code with S256 PKCE, confidential client Basic/form authentication, resource binding, refresh rotation, and revocation. Dynamic registration/CIMD are not advertised. Firebase ID tokens are not accepted as MCP bearer tokens.

Example `create_expense` input (choose the intended calendar date):

```json
{
  "title": "MCP test lunch",
  "amount": 250,
  "category": "Food",
  "payment_method": "Cash",
  "expense_date": "2026-10-13",
  "request_id": "test-lunch-20261013-1"
}
```

Success returns `structuredContent.data`. Keep its `id` and `revision`. Updates/deletes and split acknowledgements require the latest `expected_revision`. Reuse `request_id` only to retry the same creation; use a new ID for a different operation. Tool failures return `isError: true` and safe error information.

## 7. Deploy to Render

Use **`budget-buddy/mcp-server/render.yaml`**, not the root Blueprint for the legacy FastAPI/PostgreSQL backend.

1. Commit/push the reviewed changes to your deployment branch.
2. Create a Render Blueprint from the repository and select the new Blueprint path. Alternatively create a Docker web service with root `budget-buddy/mcp-server`, Dockerfile `./Dockerfile`, context `.`, health `/health`.
3. The template selects a free service with automatic deploys disabled. Choose a plan for your availability needs; cold starts can delay connections.
4. Set the environment variables above using the final HTTPS origin and frontend origin.
5. Add a secret file named **`firebase-service-account.json`** containing the server credential. The template expects `/etc/secrets/firebase-service-account.json`; verify the mount path.
6. Render generates `OAUTH_CLIENT_SECRET`. Copy it privately into the client's OAuth configuration. Keep client credentials stable across deploys.
7. Configure the client's exact callback(s), `OAUTH_SECURE_COOKIES=true`, and proxy hops.
8. Deploy the frontend with its MCP origin and configure sibling domains for reliable consent cookies.
9. Deploy the server and inspect `/health` plus these discovery endpoints:

```text
https://mcp.example.com/.well-known/oauth-authorization-server
https://mcp.example.com/.well-known/oauth-protected-resource/mcp
```

10. Complete an HTTPS Inspector connection with a test account.

The production Docker stage omits test tools, `.env`, credentials, coverage, and the portable Java test runtime. No Java/Firebase CLI is required in the service. Database grants persist across deployment restarts.

## 8. Connect ChatGPT

OpenAI currently documents [ChatGPT Plugins](https://chatgpt.com/plugins) → plus button → **Add custom MCP server**. Account/workspace policies apply. [Official connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt)

1. Name the connection **BudgetBuddy** and enter the deployed HTTPS URL **including `/mcp`**.
2. Select OAuth, enter the configured client ID/secret, and request `budgetbuddy:read budgetbuddy:write`. For read-only access, request only `budgetbuddy:read`.
3. Copy the **exact callback displayed for this connection** into `OAUTH_REDIRECT_URIS`; keep Inspector's callback if needed. Redeploy/restart configuration before authorization. Do not guess a callback from an old tutorial.
4. Create/install the connection. Sign into BudgetBuddy using the same email as ChatGPT and review the displayed account before approving.
5. Start a new conversation, select `@BudgetBuddy`, and ask for your account context.

The authentication flow implements discovery, PKCE, resource binding, and per-request validation. [Official authentication guide](https://developers.openai.com/plugins/build/auth)

OpenAI also documents Secure MCP Tunnel for private testing. This delivery's verified transport is HTTP and does not include a stdio wrapper. Public HTTPS is the setup documented here.

### End-to-end smoke test

With a test account:

1. “Show my BudgetBuddy account and today's date.”
2. “Add a personal cash expense of ₹250 for MCP test lunch today, category Food.”
3. “Find the MCP test lunch expense.”
4. “Change that expense to ₹200.”
5. “Show my Food spending this month.”
6. “Delete the MCP test lunch expense.”
7. “Confirm the test expense is gone.”

Refresh BudgetBuddy and compare the same record/totals. Also test a shared expense and acknowledgement from the other account, and verify a read-only connection refuses writes. Health/discovery alone is not a complete integration test.

## 9. Tool catalog

| Area | Tools |
| --- | --- |
| Account | `get_account_context`, `get_profile`, `update_profile`, `search_users`, `get_user` |
| Categories | `list_categories`, `create_category`, `delete_category` |
| Expenses | `list_expenses`, `get_expense`, `create_expense`, `update_expense`, `delete_expense`, `update_split_status` |
| Groups | `list_groups`, `get_group`, `create_group`, `update_group`, `delete_group`, `add_group_member`, `remove_group_member` |
| Friends | `list_friends`, `list_friend_requests`, `send_friend_request`, `accept_friend_request`, `reject_friend_request`, `remove_friend` |
| Payments/debts | `list_settlements`, `get_balances`, `record_settlement`, `approve_settlement` |
| Budgets | `list_budgets`, `get_budget`, `create_budget`, `update_budget`, `get_budget_summary` |
| Analytics | `get_dashboard`, `get_monthly_spending`, `get_category_spending`, `get_spending_trends` |
| Notifications | `list_notifications`, `mark_notifications_read` |
| Integration status | `get_telegram_status` |

Lists return `items`, `total`, `next_offset` and accept bounded `offset`/`limit`. Expense search supports title/description, category, group, and date range. Dates are ISO calendar dates; payment methods match the app's `Cash`/`GPay`.

Equal splits distribute every minor unit. Percentage/custom allocations must match their totals. New other-user shares and changed obligations are pending until acknowledged; personal shares are accepted immediately. Non-equal amount changes require replacement allocation to avoid stale shares.

Spending uses **your accepted shares**, not full shared bills. Confirmed balances exclude pending payments and report them separately. This intentionally differs from the existing app's balance cards, which deduct pending settlements. Budget remaining can be negative for overspending. Existing browser expense updates retain their legacy behavior; consistent amount/share updates are guaranteed through MCP.

Only payers edit/delete expenses; creators administer groups; recipients approve friend requests and payments. Group/member deletion is blocked when expense history would be stranded. Settlement tools record payments and **never transfer money**.

Email/password changes use the secure account UI. Currency conversion, recurring bills, and receipts are not added. Telegram link/unlink is **unavailable** until the separate bot's authenticated API is integrated; the status tool says so explicitly.

## 10. Troubleshooting

| Symptom | Check |
| --- | --- |
| Startup validation fails | Required secret/URLs, timezone, HTTPS configuration, credential path. |
| `invalid_host` | Request hostname must match the configured issuer; use consistent local hostnames. |
| `/mcp` returns 401 | Connect with OAuth; follow the `WWW-Authenticate` metadata URL. |
| `invalid_client` | Client ID/secret and Basic/form method; keep registration stable. |
| Redirect rejected | Exact allowlisted callback, including path/trailing slash. |
| Consent link/browser invalid | Restart linking in the same browser, allow cookies, prefer sibling domains. Requests expire after 10 minutes. |
| Firebase sign-in fails | Correct project/provider/authorized domain and an email-linked account. |
| Record absent from app | Same database/project/account UID; refresh and compare returned record ID. |
| Totals differ | Your share, acceptance status, dates, and pending versus completed payments. |
| `CONFLICT` | Read the latest record and use its new revision. |
| `IDEMPOTENCY_CONFLICT` | Request ID reused with different input; use a new ID for a new operation. |
| Tools stale | Refresh connection metadata and start a new chat after deployment. |
| 429 | Honor `Retry-After`; limits are per process/IP. |
| `DATASET_LIMIT` | More than 50,000 application records; migrate to indexed account-partitioned storage. No partial totals are returned. |
| Emulator startup fails | Java 21+ on PATH, port 9000 available, CLI cache/download access. |

## 11. Revocation and operational limits

Access tokens last 15 minutes; grants/refresh credentials up to 30 days. Codes are single-use for 5 minutes. Refresh rotation and replay detection revoke the grant family. `/oauth/revoke` accepts a token with configured client authentication. Deleting a chat alone does not revoke access.

An administrator can revoke a grant by setting `revoked=true` under `mcp_private/oauth/grants` after checking its UID. Raw bearer tokens are not stored. Rotating the client secret requires updating clients and does not by itself revoke all existing access tokens.

Domain writes use Firebase **root transactions** and reads scan collections. This preserves atomic expenses, splits, notifications, idempotency and concurrent legacy writes, but limits throughput. This is a small-app implementation; migrate before high volume. Idempotency records persist until administratively archived; do not remove records while retries remain possible. Protect private grants in backups.

Unit coverage excludes process bootstrap and the Firebase adapter; the adapter has separate real emulator tests. Runtime dependency audit was clean at verification. Firebase CLI's development-only dependency tree retains upstream advisories; it is not in the production image. Compatible fixes were attempted without forcing a breaking downgrade.

CI: `.github/workflows/mcp.yml` builds, runs coverage/emulator tests, audits runtime dependencies, and checks frontend consent helpers. The existing frontend workflow builds the app. Review dependency upgrades and refresh client metadata when tools change.
