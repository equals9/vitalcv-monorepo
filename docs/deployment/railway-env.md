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
