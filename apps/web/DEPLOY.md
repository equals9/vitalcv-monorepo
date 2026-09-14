# Deploying VitalCV Web

## Railway (recommended)

Vercel is no longer the deployment target. Railway + Cloudflare DNS
is the canonical production deploy path. The full step-by-step
runbook lives at `docs/ops/railway-deploy-runbook.md`. Summary:

1. Railway dashboard → New Service → Deploy from GitHub repo →
   select `equals9/vitalcv-monorepo`.
2. Set **Root Directory** to `apps/web`.
3. Builder = **Nixpacks** (auto-detected from `apps/web/nixpacks.toml`).
4. Set the two required env vars in the Railway Variables tab
   (Clerk publishable + secret).
5. Attach `vitalcv.com` as the custom domain.
6. Add a Cloudflare DNS CNAME pointing the apex (and `www`) at the
   Railway target hostname.

Railway picks up the build + start commands automatically:

| Phase | Command |
|---|---|
| Install | `cd ../.. && pnpm install --frozen-lockfile` |
| Build | `cd ../.. && pnpm turbo run build --filter @vitalcv/web` |
| Start | `pnpm start` (which runs `next start -H 0.0.0.0 -p ${PORT}`) |

## Docker

```bash
# Build with the production API base
docker build \
  --build-arg NEXT_PUBLIC_API_BASE=https://api.vitalcv.com \
  -f apps/web/Dockerfile \
  -t vitalcv-web .

# Run (the container listens on $PORT inside, default 3000)
docker run -p 3000:3000 -e PORT=3000 vitalcv-web
```

The Dockerfile defaults `NEXT_PUBLIC_API_BASE` to
`https://api.vitalcv.com`, so a build without `--build-arg` does NOT
leak a localhost URL into the production bundle.

## docker-compose (local dev)

```bash
docker-compose up        # full stack (db + api + web)
docker-compose up -d db  # just database
```

## Environment Variables

| Variable | Required | Build-time | Description |
|----------|----------|------------|-------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | **Yes** | Yes | Clerk auth public key |
| `CLERK_SECRET_KEY` | **Yes** | No | Clerk auth secret |
| `RECEIPT_KID` | **Yes** (in production) | No | ES256 keypair `kid`. Required when `NODE_ENV=production`. |
| `RECEIPT_PRIVATE_KEY_JWK` | **Yes** (in production) | No | ES256 private JWK (JSON-encoded). Required when `NODE_ENV=production`. Generate with `node scripts/generate-receipt-keypair.mjs`. |
| `NEXT_PUBLIC_API_BASE` | **Yes on Railway** | Yes | Set to `https://api.vitalcv.com`. The Dockerfile builds this in via `ARG NEXT_PUBLIC_API_BASE=https://api.vitalcv.com`, but Railway uses Nixpacks (not Docker) and does NOT inherit that Dockerfile ARG. Inline fallback chains across `apps/web/app/api/**` and 3 client components end in `http://localhost:4000`; without this env var the production server proxies to localhost and the client bundle bakes localhost as the build-time literal. |
| `NEXT_PUBLIC_APP_URL` | No | Yes | Canonical app URL (e.g. `https://vitalcv.com`); falls back to request origin |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Yes | Sentry instrumentation skipped entirely when unset |
| `PORT` | No | No | Server port (default 3000; Railway injects automatically — do NOT set manually) |
| `NODE_ENV` | Recommended | No | Set to `production` in deploys |

> **Critical:** `RECEIPT_KID` + `RECEIPT_PRIVATE_KEY_JWK` are fail-closed in production. Without them, `/.well-known/jwks.json`, `/.well-known/did.json`, `/.well-known/trust-register`, `/trust`, and `/trust/doctrine` all return 500. Generate the keypair with `node scripts/generate-receipt-keypair.mjs` and paste both lines into the Railway Variables tab before the first deploy. The private JWK is a secret; never commit it.

> **Note:** `NEXT_PUBLIC_*` variables are embedded at **build time**. Changing them requires a rebuild.

## Runtime ports (canonical)

| Service | Internal port | Where set |
|---|---|---|
| `apps/web` | 3000 (default) or `$PORT` if injected | `apps/web/package.json` `start`; `Dockerfile` `EXPOSE 3000` |
| `apps/api` | 4000 (default) or `$PORT` if injected | `apps/api/Dockerfile` `EXPOSE 4000`; `infra/env-map.md` |

On Railway, `$PORT` is injected at runtime and the app binds to it.
Inside Docker locally, the app binds to `$PORT` if set, else to the
default for the service (3000 for web, 4000 for api).

## Health Endpoints

| Endpoint | Service | Purpose | Response |
|----------|---------|---------|----------|
| `GET /api/health` | web | Liveness probe (Railway healthcheck) | `{ status: 'ok', service: 'web', timestamp, backend: {...}, config: {...} }` |
| `GET /api/audit/health` | api | Liveness probe (Railway healthcheck for the API service) | `{ status: 'ok', ... }` |
