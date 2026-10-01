# VitalCV

Healthcare credentialing platform. pnpm + turbo monorepo. Apps in `apps/`, shared
packages in `packages/`. Auto-memory at `~/.claude/projects/-Users-christoler-vitalcv/memory/MEMORY.md`
persists cross-session learnings; read it before assuming context.

## Operating stack

When dispatched as part of a wave, roles are explicit:
- **Claude Code Desktop** = supervisor / merge gate (issues GO/NO-GO, never builds)
- **Claude Code Terminal** = primary builder (writes code, opens PRs, runs `gh pr merge`)
- **Codex** (`codex exec` v0.125+) = optional surgical verifier. Useful for a second opinion on a risky diff; **not** required before merge.
- **`pr-shepherd`** (`.claude/agents/pr-shepherd.md`) = PR landing. Owns the loop from red-or-stalled to genuinely green and merged: triage, CI diagnosis, fix, re-verify against the head SHA, merge, post-merge deploy confirmation. Delegate a failing or stuck PR here rather than re-deriving the gate topology.
- Do NOT use OpenClaw, Browser, or Cowork for build/verify work.

**Merge gate (settled 2026-07-25):** green CI **plus real verification** — you must actually exercise the change (run the suite, hit the route, load the page, execute the script) and show the evidence. Green CI on its own is not enough: shell scripts, GPU paths, and dev-gated e2e specs run in no PR check. Codex is not a merge gate, and no verifier verdict substitutes for having exercised the change yourself.

**"Green" is a claim about a SHA, not a PR.** Read the required contexts live (`gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts[]'` — the list has moved 2 → 5 → 7 → 14 in six weeks) and enumerate conclusions from `commits/<head-sha>/check-runs`. A `CONFLICTING` PR skips every `pull_request` gate and displays ~3 push checks that look green; a push to a closed PR runs zero workflows silently. Require zero pending, zero failing, and `mergeStateStatus == CLEAN`. Never `gh pr merge --auto`.

## Public product work — the gate

Public-facing product and visual work is governed by the canonical strategy
hierarchy, in this order:

1. [`docs/strategy/vitalcv-strategy-operating-brief.md`](docs/strategy/vitalcv-strategy-operating-brief.md)
2. [`docs/strategy/vitalcv-category-strategy.md`](docs/strategy/vitalcv-category-strategy.md)
3. [`docs/strategy/product-decision-filter.md`](docs/strategy/product-decision-filter.md)
4. later wave-specific instructions

**Every product proposal must pass the decision filter** — it moves forward only
when it materially strengthens time-to-a-useful-profile, role relevance, repeated
data entry, clinician-controlled sharing, employer acceptance, successful starts,
or profile reuse. If it passes none, classify it honestly (infrastructure,
maintenance, compliance, premature scope, distraction) rather than shipping it as
product.

Craft expectations for a public surface, unchanged: name one creative owner,
attach desktop and mobile before/after evidence, attach recordings for motion or
scroll-controlled behaviour, search for duplicate intent before creating a
component, and never describe an unmounted design-system component as a
customer-facing improvement. Green CI, design lint, accessibility and
source-truth checks do not prove visual quality.

Production promotion requires an explicit founder instruction for the change in
question, plus the deployment discipline in
[Deployment](#deployment-railway--vercel-is-deprecated): exact deployed SHA, a
passing production smoke, and a homepage interaction audit. **The SHA check is
per service and reads a different endpoint on each** — see the Deployment
bullets. This used to read "matching public `/api/version`", which is a web-only
check: on the API that path answered `organization_context_required` until
2026-08-11, and its payload has no `commit` field in any case. Neither service's
endpoint stands in for the other's.

**Superseded 2026-08-05.** The Wave-1072 founder visual gate that stood here
implied Z0 was open, Z1 could not begin, production promotion was locked, and the
Living Evidence Record awaited approval. All four are closed: Z0 is complete, Z1
shipped, and `/` was promoted to the One Real Loop under explicit founder
authorization (PR #1075, `7b6bb0aa1`). Do not reopen the Z0 storyboard,
animatics, media package, or Treatment B cycle.

## VitalCV Strategy Contract

**Read [`docs/strategy/README.md`](docs/strategy/README.md) and both canonical
documents before changing any of the following:**

- Homepage messaging
- Navigation
- Customer-facing terminology
- Product naming
- Clinician onboarding
- Job discovery
- Apply flows
- Employer candidate review
- Roadmap priorities

Canonical (founder-approved 2026-08-04):

- [`docs/strategy/vitalcv-category-strategy.md`](docs/strategy/vitalcv-category-strategy.md) — the full rationale
- [`docs/strategy/vitalcv-strategy-operating-brief.md`](docs/strategy/vitalcv-strategy-operating-brief.md) — the day-to-day decision contract

> VitalCV is the portable professional identity and employment network for clinicians.

The reusable clinician profile is the product; NPI is the acquisition wedge;
`Apply with VitalCV` is the canonical transaction; employer acceptance
intelligence is the long-term advantage. North star: **clinician starts enabled
by a reused VitalCV profile** — not profiles created, checks run, or packets
generated.

Customers should need to remember four things: **VitalCV**, **your VitalCV
profile**, **VitalCV Jobs**, **Apply with VitalCV**. Wallet, passport, dossier,
Trust Passport, Evidence OS, recognition, snapshot, receipt, holder, PSV, trust
tier, SD-JWT, blockchain and knowledge graph are infrastructure vocabulary —
keep them out of the homepage, primary navigation, onboarding headings, major
CTAs and acquisition copy. **Do not mass-rename backend classes, schemas, APIs
or audit records to match the marketing vocabulary**; the strategy does not ask
for that.

Precedence when instructions conflict: founder instruction in the current task →
operating brief → category strategy → **security, privacy and truth contracts** →
existing implementation and older strategy documents. Note the fourth rank: these
documents govern what the product SAYS IT IS. They never license a claim the
truth contract forbids (see [Truth contract](#truth-contract-issuer--psv-chain)
and its banned strings) and never relax a security boundary. `docs/strategy/`
still contains older mandates that claim homepage authority; each carries a
superseded notice.

Before adding any customer-facing term or feature, run
[`docs/strategy/product-decision-filter.md`](docs/strategy/product-decision-filter.md).

### Standing constraints from the 2026-08 market and IP review

Evidence: [`docs/strategy/market-evidence-2026-08-11.md`](docs/strategy/market-evidence-2026-08-11.md).
It does not change the positioning above. These four do bind what you build.

**1. Acceptance intelligence must not put the clinician in the loop as a
credential-presenting holder.** Axuall holds US 12,079,891, whose claims describe
configuring rules on required credential attributes → defining a requisite collection
→ sending it to a **holder** as a presentation request → verifying the holder's
returned proof against a registry. `apps/api/backend` already carries an OID4VP layer
that reads onto most of it; what keeps the question small is that no product surface
invokes it, pinned by `apps/web/__tests__/presentation-exchange-baseline.test.ts`.
**Evaluate employer requirements server-side against VitalCV-held source reads
instead** — which is what the truth contract already describes, so the design-around
and the stated position are the same thing. Full note and the questions for counsel:
[`docs/strategy/fto-axuall-12079891.md`](docs/strategy/fto-axuall-12079891.md). Move
that baseline only in the same PR as an FTO decision, never alone to go green.

**2. `/directory/[npi]` is the public acquisition surface; `/verify/[npi]` is a
reviewer's tool.** The directory page answers for any NPI in the federal registry and
is where a clinician who has never heard of VitalCV meets it. `/verify/[npi]` is
`noindex, nofollow` on consent grounds (#1329), so a link from it carries no crawl
signal. Do not add an NPI-scale section to `app/sitemap.ts` — that file's
`lastModified` is recomputed from git, and a data-derived section fails its freshness
guard for reasons unrelated to freshness.

**3. Publishing provider pages to crawlers is a consent decision, not a copy fix.**
Gated on `DIRECTORY_SITEMAP`. **Founder ruled GO 2026-09-30.** The lever is unchanged:
`DIRECTORY_SITEMAP=enabled` on the Railway web service, read per request (no rebuild);
unset it to withdraw. Check production `robots.txt` before assuming it is live. Removal
requests arrive at `privacy@vitalcv.com` (printed on every directory page) and run through
`EXCLUDED_NPIS`, which drops the NPI from the sitemap **and** noindexes that record's
page — honouring half would tell someone they were removed while their page stayed
indexed.

**4. Keep the name; do not rename.** `did:web:vitalcv.com` is the `issuerDid` on
signed receipts, so the cost grows per artifact — a rename, if ever, happens before
receipt volume matters. Counsel still owes a real clearance search before the first
pilot contract:
[`docs/strategy/name-clearance-2026-08-10.md`](docs/strategy/name-clearance-2026-08-10.md).

## Experience Overhaul Program — design-only boundary (Phase 0, 2026-08-08)

**HOMEPAGE VISUAL FREEZE — 2026-08-15, ACTIVE.** A newer, homepage-scoped freeze is in
force: see `docs/ops/FOUNDER_VISUAL_GATE.md` §1 (the single source of truth — this line is
only a pointer). Only the Direction A recomposition (constitution amendment E) merges.
Lift criterion 1 (`FOUNDER VISUAL DECISION: GO`) was recorded 2026-09-30; the five-second
test and the funnel baseline are still owed.

**The UI PR freeze is LIFTED (founder ruling, 2026-08-09).** UX-03 has shipped, in two parts:
UX-V1 (#1190) delivered the public eyebrow and the homepage, and #1232 delivered the signed-in
navigation contract that shares its island. The founder ruled these jointly satisfy UX-03 and
released the freeze. Visual PRs no longer need to sit inside the Experience Overhaul Program.

**What did NOT change with the freeze.** These are separate rules and still bind every visual PR:
the DESIGN-ONLY BOUNDARY below; the founder visual gate
(`docs/ops/FOUNDER_VISUAL_GATE.md`) — public-facing visual work still needs rendered evidence, a
live review URL, and an explicit `FOUNDER VISUAL DECISION`; and the experience authority,
`docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` (successor-of-record to
`VITALCV_CREATIVE_DIRECTION.md`). The freeze bought time to establish a direction — it is gone
because the direction now exists, not because the bar dropped.

Superseded visual treatments are recorded in `docs/design/PARKED_VISUAL_ERAS.md`. Parking is the
default; the journey-rail chrome was the first era actually deleted (2026-08-09), and only after
its replacement had held in production.

Every overhaul wave carries this text verbatim at the top:

> **DESIGN-ONLY BOUNDARY**
> This wave may change UI, UX, visual design, interaction design, responsive behavior, animation,
> information hierarchy, customer-facing copy, navigation presentation, and brand expression.
> It may not change application truth, authentication, authorization, consent semantics, data
> models, APIs, readiness calculations, agent policy, source behavior, employer decisions,
> business logic, or pricing behavior.
> If the proposed experience requires one of those changes, record it as a product dependency and
> stop. Do not solve it inside the design PR.

**Operating rule:** Product contracts are inherited. Visual decisions are not. No wave inherits a
prior visual treatment merely because it exists.

## Branch cutting (worktree fleet caveat)

Local `main` is held by `/Users/christoler/vitalcv-omega4f-trigger`, and ~80 other worktrees exist (`~/.codex/worktrees/*` for the Codex fleet, plus dozens of `vitalcv-*` feature trees). **Never** `git checkout main && git pull origin main` — it fails. Instead:

```bash
git fetch origin main
git worktree add -b <feature-branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install                      # workspace symlinks + deps
pnpm turbo run build --filter @vitalcv/web   # prebuilds @vitalcv/trust-state dist/, required before pnpm --filter web build works
```

Do not remove worktrees you didn't create — they are load-bearing.

## Deployment (Railway — Vercel is deprecated)

**Railway is the canonical deployment platform; GitHub is the source of truth.** Vercel is legacy — do not add Vercel assumptions, and do not block work on Vercel previews/checks. There is no hard Vercel dependency (0 `@vercel/*` packages). See `docs/deployment/railway-migration.md` and `railway-env.md`.

- **API** deploys from root `railway.toml` (+ `nixpacks.toml`, `apps/api/Dockerfile`): `pnpm turbo build`, `prisma migrate deploy`, health `/health`.
- **Web** deploys from `apps/web/Dockerfile` (+ `apps/web/railway.toml`): `next start -p $PORT`, health `/api/health`. Both auto-deploy on push to `main`; `.github/workflows/deploy-api.yml` + `deploy-web.yml` wait + smoke-test.
- **Deployed-SHA check — different endpoint and different schema per service. Do not substitute one for the other.**
  - **API:** `https://api.vitalcv.com/health` → `git_sha`. This is what `deploy-api.yml` polls (cache-busted) until it equals `GITHUB_SHA`. `api.vitalcv.com/api/version` serves the same SHA as `commitHash` alongside `buildVersion`/`nodeVersion`/`prismaVersion`; `scripts/api-surface-probe.mjs` now reads it and fails if the two disagree.
  - **Web:** `https://vitalcv.com/api/version` → `{commit, platform, environment, branch}`, `no-store`. This is what `deploy-web.yml` → `scripts/deploy-smoke.mjs` asserts. It is a Next route on the web container and says nothing about the API deployment.
  - Assert SHA **ancestry** (`git merge-base --is-ancestor <yours> <deployed>`), never just that a deploy job succeeded.
- **Production probes, per service.** `scripts/deploy-smoke.mjs` covers WEB only (`vitalcv.com`) — do not read it as API coverage. The API's own probe is `scripts/api-surface-probe.mjs` (secretless, GET-only, run by `deploy-api.yml` after the SHA wait): it asserts the declared public surface still answers AND that the guarded surface still 401s, so a widened tenant-guard skip list goes red against production. The surface it asserts is declared once in `scripts/lib/apiSurfaceContract.cjs` and enforced on every PR by `apps/api/backend/src/routes/__tests__/apiSurfaceContract.test.ts`, which boots the real app and fails if any undeclared route answers 200 anonymously. **Add a skip-list prefix and that test tells you exactly what you opened** — the census is an upper bound, not a description. Neither probe exercises an authenticated read; nothing external can, and green means "right commit, live database, boundary unmoved", not "the API works".
- **Required web env:** set `BACKEND_URL` (e.g. `https://api.vitalcv.com`) — `getBackendBase()` uses it for server-side reads and it overrides the Docker build default `NEXT_PUBLIC_API_BASE=http://localhost:4000`. Without it, live-data surfaces (e.g. `/ops/engine`) read the wrong base.
- Deploy metadata: prefer `RAILWAY_*` env (`RAILWAY_ENVIRONMENT`, `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_GIT_BRANCH`); `VERCEL_*` reads remain only as backwards-compatible fallbacks.

## Commands

```bash
# Build workspace deps ONCE per fresh worktree before running any vitest.
# Vitest resolves @vitalcv/* through package.json main/exports, which point at
# dist/. Skip this and 25 suites fail with "Cannot find module" errors that
# blame the packages, not the missing build. A globalSetup check now says so
# outright instead of letting you debug phantom failures.
pnpm turbo build --filter='!@vitalcv/web'

# Run a focused vitest suite in apps/web
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts

# Build apps/web (requires turbo for workspace dep prebuild)
pnpm turbo run build --filter @vitalcv/web

# Validate the Knowledge Trust Graph JSON
node -e "JSON.parse(require('fs').readFileSync('docs/architecture/vitalcv-knowledge-trust-graph.json','utf8')); console.log('graph json ok')"

# Typecheck / lint
pnpm typecheck      # turbo typecheck
pnpm lint           # turbo lint
```

Tests use vitest 4.x (not Jest). React 19 + Next 15 App Router. Server components are async; tests render via `react-dom/server` `renderToStaticMarkup` (see `apps/web/__tests__/issuer-receipt-candidate.test.ts` for the pattern).

## Truth contract (issuer / PSV chain)

The issuer verification chain (`apps/web/lib/issuer-verification/`) enforces hard invariants. Do not weaken them.

- `ReceiptCandidate.decisionGrade` is the **literal** `false`. `proofTier` is the literal `'receipt_candidate'`. Do not widen to `boolean` or other strings.
- `PSVReceiptCandidate` (output of accepted policy review) is also literal `decisionGrade: false`, distinct `proofTier: 'psv_receipt_candidate'`. Promotion to a real `PSVReceipt` is a separate gated wave.
- Only `accept_candidate` (under `policyReview.ts`) may produce a `PSVReceiptCandidate`, and only when `reviewState === 'ready_for_policy_review'`. Five gates fire in order: action, wrong_office, unable_to_verify, conflict_review, ready state, legally_only-needs-limitation-note.
- Issuer-verification helper modules (`receiptCandidate.ts`, `policyReview.ts`) are **pure transforms**: no fetches, no DB writes, no audit-event writes. The review surfaces under `apps/web/app/issuer/{review,policy-review}/[requestId]/page.tsx` are demo renders only — `recordedBy: 'demo'` and copy explicitly disclaims a real audit row.
- Authoritative truth source: `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`. Boundaries are numbered (1–28 as of `657f041c`); add new ones, do not rewrite old ones.

### Banned strings (no copy may contain these except as test split-join constants)

`automatically verified`, `guaranteed verification`, `complete credentialing`, `instant credentialing`, `legally accepted`, `risk transferred`, `final verification without review`, `source confirmed before response`, `certified compliant`, `HIPAA compliant`, `SOC2 certified`. No status label may be the bare word `Verified`.

## Architecture

- **Apps**: `apps/web` (Next 15 App Router, primary), `apps/api/backend`, `apps/marketing` (separate, do not pull web changes into it), `apps/issuer-api`, `apps/verifier-api`, `apps/router`, `apps/admin-api`, `apps/mobile` (do not modify in issuer waves).
- **Packages**: `packages/domain-common` is the barrel for domain types — re-export with the `type` keyword (`isolatedModules: true`). `packages/trust-state` ships from `dist/` and must be turbo-built before `apps/web` build works.
- **`@types/react` override** in root `package.json` resolves Radix UI + React 19 conflicts. `.npmrc` has `public-hoist-pattern[]=@types/*` so `@types/node` reaches all packages.

## Gotchas

- Green CI is not evidence the code works. Anything CI does not execute — shell scripts, GPU/WebGPU paths, dev-gated e2e specs that 404 under a production build — must be run by hand before merge.
- When a build complains `Module not found: Can't resolve '@vitalcv/trust-state'` in a fresh worktree, run `pnpm turbo run build --filter @vitalcv/web` (not just `pnpm --filter @vitalcv/web build`) — turbo prebuilds the workspace dep's `dist/`.
- Local `main` is often stale relative to `origin/main` because of the worktree fleet. Always diff against `origin/main`, not `main`, when checking PR scope.
- `next.config.mjs` enforces TypeScript and ESLint checks on build (no ignore flags); typecheck failures break deploys.
- Web app `tsconfig` needs explicit `"types": ["node", "react", "react-dom"]` to avoid stale `@types/minimatch`.
