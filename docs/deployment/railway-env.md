# Railway Environment Variables

Canonical deployment is **Railway** (Vercel is deprecated — see
[railway-migration.md](./railway-migration.md)). Use this checklist for both
Railway services: **`@vitalcv/api`** (root `railway.toml`) and **`@vitalcv/web`**
(`apps/web/Dockerfile` + `apps/web/railway.toml`).

## Required in Production

### Web service — build-time (baked into the client bundle)

`NEXT_PUBLIC_*` are read at **build** time and frozen into the client JS. Railway
exposes service variables as Docker build args, so set these on the web service:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  **Required** — without it the client Clerk SDK initializes with an empty key
  and auth breaks in the browser. (`apps/web/Dockerfile` declares the matching `ARG`.)
- `NEXT_PUBLIC_API_BASE`
  Client-side API base. The Dockerfile defaults this to `https://api.vitalcv.com`,
  so a build without an override does not leak a localhost URL into the bundle.

### Web service — runtime (server)
- `BACKEND_URL`
  Real backend base URL for **server-side** reads (e.g. `https://api.vitalcv.com`).
  Takes precedence in `getBackendBase()` / `lib/backend-url.ts`. **Required** for
  `/ops/engine` and other surfaces that read the live roster/ledger.
- `CLERK_SECRET_KEY`
  Required by Clerk middleware in the server runtime.
- `DATABASE_URL`
  **Required on the web service too** — `lib/verifier/worklistRepo.ts` and
  `lib/issuer-verification/issuerPersistenceWriter.ts` query the web Prisma client
  (`IssuerRequest` / `ReceiptCandidate`) at runtime. Those routes fail without it.
- `EVIDENCE_UPLOAD_ENABLED`
  Shows the "Add evidence" upload panel (and its header link) on `/holder` only
  when set to the literal `enabled`. Unset or any other value hides it. Read per
  request (`lib/holder/evidenceUploadFlag.ts`). Leave unset until the document
  lane (`/api/documents/parse` → `/api/credentials/ingest` → confirm) is confirmed
  working end to end on production.

### Shared Backend Storage / Policy
- `DATABASE_URL`
  PostgreSQL connection string used by `@vitalcv/api`, `@vitalcv/authz`, and `@vitalcv/verifier-api`.

- `SIGNING_KEY_JWK`
  JSON JWK used for authz token signing. Required by `@vitalcv/authz`.

- `CORS_ORIGIN`
  Comma-separated allowed CORS origins. **Must not be `*` in production.**

- `API_KEYS`
  Comma-separated API keys. Required in production for write endpoints on `@vitalcv/api`.

### Frontend Configuration
- `NEXT_PUBLIC_API_BASE` or `NEXT_PUBLIC_BACKEND_URL`
  Backend base URL consumed by `@vitalcv/web`.

- `NEXT_PUBLIC_SENTRY_DSN`
  Public Sentry DSN (optional, but supported) for frontend monitoring.

- `NEXT_PUBLIC_ADMIN_API_URL` or `NEXT_PUBLIC_APP_URL`
  Optional route-prefix variables used by specific web screens.

## Loop-critical variables on the API service (names only)

These decide whether the signed-in loop works at all — whether a verified
session is accepted, whether an admin can reach `/admin/*`, whether a
notification or an upload goes anywhere. This section records the **names**
and what each one controls. It deliberately records **no value and no mode**:
the repository is public, and the live setting is read in the Railway
dashboard, not here. The API `/health` endpoint publishes exactly one of these
facts, as the boolean `identityEnforced` (true only when verified identity is
in its blocking mode), so a deploy can be confirmed without a probe.

| Variable | Read by | Controls |
|---|---|---|
| `CLERK_JWT_VERIFICATION` | `config/env.ts` → `middleware/verifiedIdentity.ts` | Whether a Clerk session JWT is verified and whether an unverified identity header is rejected. Surfaces on `/health` as `identityEnforced`. |
| `CLERK_ISSUER` | `config/env.ts` → `middleware/verifiedIdentity.ts` | The Clerk frontend-API origin whose JWKS verifies session tokens. Required for any verifying mode. |
| `CLERK_AUTHORIZED_PARTIES` | `config/env.ts` → `middleware/verifiedIdentity.ts` | Comma-separated `azp` allowlist for verified tokens. Empty means `azp` is not checked. |
| `TENANT_ORG_BINDING` | `config/env.ts` → `middleware/tenantGuard.ts` | Whether organization context comes only from verified membership rather than a caller-supplied org header. Depends on `CLERK_JWT_VERIFICATION`. |
| `VERIFIER_RBAC_MODE` | `middleware/orgRoleGuard.ts` | Rollout mode of the employer-review org-role guard (read per request). |
| `VERIFIER_RBAC_ENFORCED` | `config/env.ts` | Whether employer-review mutations are blocked, or only logged, on an RBAC denial. |
| `RESEND_API_KEY` | `services/providers/notificationProvider.ts` | Presence selects the live email provider; absence leaves notifications on the no-op provider. |
| `NOTIFY_FROM_EMAIL` | `services/providers/notificationProvider.ts` | Sender address for outbound notifications. |
| `OCR_PROVIDER` | `services/ai/documentPipeline.ts` | Which document-parse provider the credential-document lane calls. Unset (or any provider fault) makes document reading answer 503 "unavailable"; the fixture reader runs only under `NODE_ENV=test`. |
| `SENTRY_DSN` | `server.ts` | Presence turns on server-side error reporting. |
| `DISABLE_BACKGROUND_JOBS` | `app.ts` | Turns off in-process background jobs. |
| `POLLING_ENABLED` | `app.ts` | Turns on the in-process source polling loop. |
| `FEATURE_CREDENTIAL_INGESTION` | `config/envValidation.ts` | Feature flag for the credential-ingestion lane. |
| `PLATFORM_ADMIN_CLERK_IDS` | `config/env.ts` → `services/platform/platformAdminGrant.ts` | Comma-separated Clerk user ids (identifiers, not secrets) granted the platform ADMIN role by configuration. Read once at boot and on user-row creation; promotion only — removing an id never demotes; never read from a request. |
| `EVIDENCE_UPLOAD_ENABLED` | web service — `lib/holder/evidenceUploadFlag.ts` | Shows the document upload panel on `/holder` and `/holder/blockers/[blockerId]` only when set to the literal `enabled`; unset hides it. Set on the **web** service, not the API. |
| `BACKEND_URL` | web service — see [Web service — runtime](#web-service--runtime-server) | Server-side backend base for the web app, including the role resolver that decides `/admin/*` access from the database role. |

## Optional

- `SAM_API_KEY`
  Optional downstream service key used by `@vitalcv/api` integrations.

- `OCR_PROVIDER`, `OPENAI_API_KEY`
  Document reading on `@vitalcv/api` (`POST /api/documents/parse`). With
  `OCR_PROVIDER=openai` and a key, uploads are read by that provider. With
  neither set, or when the provider fails, the route answers 503 and stores
  nothing — there is no fixture fallback outside `NODE_ENV=test`
  (`services/ai/documentPipeline.ts`).

- `SENTRY_DSN`
  Server-side Sentry DSN for `@vitalcv/api` crash/error reporting.

- `VERIFIER_AUDIENCE`, `TOKEN_AUDIENCE`, `TOKEN_ISSUER`, `VERIFIER_ISSUER`
  Override only when wiring non-default OIDC endpoints.

- `NEXT_PUBLIC_*` variables not listed above
  Add only documented frontend values needed by your deployment.

## Deploy metadata (injected automatically by Railway)

Railway injects these; the app reads them for the deploy banner / observability
(`apps/web/lib/deployInfo.ts`, `lib/trust/passport-observability.ts`). The
legacy `VERCEL_*` equivalents are still read as backwards-compatible fallbacks.

| Railway | Legacy (Vercel) fallback | Purpose |
|---|---|---|
| `RAILWAY_ENVIRONMENT` | `VERCEL_ENV` | environment label |
| `RAILWAY_GIT_COMMIT_SHA` | `VERCEL_GIT_COMMIT_SHA` | commit SHA |
| `RAILWAY_GIT_BRANCH` | `VERCEL_GIT_COMMIT_REF` | branch |
| `RAILWAY_GIT_COMMIT_MESSAGE` | `VERCEL_GIT_COMMIT_MESSAGE` | commit message |
| `RAILWAY_PUBLIC_DOMAIN` | `VERCEL_URL` | deployment URL |
| `RAILWAY_REGION` | `VERCEL_REGION` | region |
