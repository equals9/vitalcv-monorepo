# AGENTS.md — VitalCV

Operating contract for Codex (`codex exec`) and any agent that reads the
`AGENTS.md` convention. Claude Code reads [`CLAUDE.md`](CLAUDE.md); the two files
state the same rules and must not drift. Product doctrine (naming, claim
prohibitions, authorization model, packet invariants) lives in the operator's
global `~/.codex/AGENTS.md` and in [`DOCTRINE.md`](DOCTRINE.md) — this file is
about *how to work in this repository*, not what the product claims.

Healthcare credentialing platform. pnpm + turbo monorepo. Apps in `apps/`,
shared packages in `packages/`.

## Merge gate (settled 2026-07-25)

**Green CI plus real verification.** You must actually exercise the change — run
the suite, hit the route, load the page, execute the script — and show the
evidence. Green CI alone is not enough: shell scripts, GPU/WebGPU paths, and
dev-gated e2e specs run in no PR check.

**Codex is not a merge gate.** The mandatory three-pass `codex exec` audit was
retired in #1000 (merged 2026-08-02). Codex is a useful independent verifier on
a risky diff, and no verifier verdict — from Codex or from any subagent —
substitutes for having exercised the change yourself. There is no
merge-protection hook in this repository; do not write instructions that assume
one exists.

## Founder visual gate (active 2026-08-02)

Public-facing visual work is also governed by
[`docs/ops/FOUNDER_VISUAL_GATE.md`](docs/ops/FOUNDER_VISUAL_GATE.md).

For `/`, `/employers`, `/trust`, `/pilot`, `/onboarding`, `/explore`, shared
public chrome, and public experience components:

- name one creative owner;
- attach desktop and mobile before/after evidence;
- attach recordings for motion or scroll-controlled behavior;
- document duplicate-intent searches before creating a component;
- do not describe an unmounted design-system component as a customer-facing
  improvement;
- keep the PR in draft until the founder comments
  `FOUNDER VISUAL DECISION: GO`;
- do not begin a parallel homepage composition while the recovery freeze is
  active.

Green CI, design lint, accessibility checks, and source-truth checks do not
prove visual quality. Founder approval is required in addition to the normal
merge gate. Security, privacy, outage, source-truth, and data-loss fixes may
proceed without visual approval when they avoid unrelated visual recomposition.

## Lane coordination (two fleets share this repo)

Two agent fleets work `origin/main` concurrently: a **Claude lane** (branches
`fix/*`, `feat/*`, `wave/*`, `design/*`, `docs/*`; worktrees in `/tmp/vitalcv-*`)
and a **Codex lane** (branches `codex/*`; worktrees in `~/.codex/worktrees/*`).
They have repeatedly built the same directive twice. Before you build anything:

1. **Claim-check the intent, not the branch name.** Search for work already in
   flight or already landed:

   ```bash
   git fetch origin main
   gh pr list --state open --limit 100 --json number,title,headRefName
   gh pr list --state merged --limit 40 --json number,title,headRefName
   git ls-remote origin 'refs/heads/*' | grep -iE '<intent-keyword>'
   ```

   A merged PR with your intent means **stop**. An open PR with your intent
   means coordinate or pick a different slice — do not build a second
   implementation.

2. **Diff your intent against `main` before opening a PR.** If `main` already
   has the behavior, the work is a no-op: abort and report it. Do not open an
   empty or duplicate PR. This is the single most common waste in this repo.

3. **A branch is not a claim until it is a PR.** Local or pushed branches are
   invisible to the other lane's `gh pr list`. If you intend to keep work,
   open a PR (draft is fine) so the other lane can see it.

4. **Re-triage stale PRs; never blind-rebase them.** A PR that has gone
   `DIRTY` while `main` absorbed other merges may have been superseded rather
   than merely conflicted. Classify each file as LANDED / UNIQUE /
   CONFLICTED-STALE against current `main` before touching it.

### Known duplicate-intent collisions (evidence, not hypothesis)

| Intent | Claude lane | Codex lane | Outcome |
|---|---|---|---|
| Four P0 truth-containment fixes (directory, providers, passport identity, public `no-store`) | `fix/p0-*` → #989, #990, #991, #993, all merged | `codex/p0-*`, four branches pushed 2026-07-29, **no PR ever opened** | Codex work built and abandoned; total waste |
| Public opportunities board | `wave/explore-board` → #999, merged | `codex/public-opportunity-board-r1` → #970, open since 2026-07-29, DIRTY | Two independent implementations |
| Home hero eyebrow (glass chrome) | `fix/palantir-transparent-eyebrow` → #985, open, DIRTY | `codex/home-expandable-eyebrow` → #1039, merged | Same surface, both lanes; #985 now conflicts with the merged result |
| ResidencyProgram / `hospitalAffiliation` Prisma-field repair | `fix/prisma-field-names-residency` → #1022, merged | bundled inside `codex/ci-required-checks` → #971, open | Same repair, two lanes |

Rule that would have prevented all three: **claim-check the intent against
`gh pr list` (open *and* merged) before building, and open a PR as soon as the
work is real.**

## Branch cutting (worktree fleet caveat)

Local `main` is held by another worktree and ~85 worktrees exist. **Never**
`git checkout main && git pull origin main` — it fails. Instead:

```bash
git fetch origin main
git worktree add -b <feature-branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install
pnpm turbo run build --filter @vitalcv/web   # prebuilds @vitalcv/trust-state dist/
```

Do not remove worktrees you did not create — they are load-bearing. Never run
`git clean` in a rescue worktree; other lanes' untracked work lives there.

## Commands

```bash
# Focused vitest suite in apps/web
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts

# Build apps/web (turbo prebuilds the workspace dep)
pnpm turbo run build --filter @vitalcv/web

# Typecheck / lint
pnpm typecheck
pnpm lint
```

Tests use vitest 4.x (not Jest) in `apps/web`; the backend uses jest. React 19 +
Next 15 App Router. Server components are async; tests render via
`react-dom/server` `renderToStaticMarkup`.

Backend jest sweeps repo-root tests — a scoped `jest src/...` **skips** tests CI
runs. Run the project's configured invocation, not a narrowed one.

## Truth contract

The issuer verification chain (`apps/web/lib/issuer-verification/`) enforces
hard invariants; do not weaken them. `ReceiptCandidate.decisionGrade` is the
literal `false` and `proofTier` the literal `'receipt_candidate'` — do not widen
these to `boolean` or to other strings. Issuer-verification helper modules are
pure transforms: no fetches, no DB writes, no audit-event writes.

Authoritative source: `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`.
Boundaries are numbered; add new ones, do not rewrite old ones.

### Banned strings

No copy may contain these except as test split-join constants: `automatically
verified`, `guaranteed verification`, `complete credentialing`, `instant
credentialing`, `legally accepted`, `risk transferred`, `final verification
without review`, `source confirmed before response`, `certified compliant`,
`HIPAA compliant`, `SOC2 certified`. **No status label may be the bare word
`Verified`** — use a compound like `Source-verified`.

A CSS token or variable named with a banned word leaks that word into the
rendered HTML and trips the copy gate. Name tokens for the material, not the
claim.

## Operational scripts

Checked-in tooling that is easy to miss and easy to reinvent badly. Every entry
below was read from source, not assumed.

| Script | What it does |
|---|---|
| `scripts/railway/autopilot.sh` | Verify → build → deploy → smoke, in one command. Requires a **clean working tree** and a linked Railway CLI. `DEPLOY_BRANCH=develop` targets another branch; `SKIP_BUILD=1` skips the local build when CI already passed. Polls `https://$RAILWAY_DOMAIN/health` and `/readyz` (the latter confirms the database is connected). |
| `scripts/railway/bootstrap.sh` | **One-time** setup: installs the Railway CLI, authenticates, links the project, seeds required env vars. `RAILWAY_TOKEN=xxx` runs it non-interactively. |
| `scripts/railway/preflight.mjs` | Static deploy checks against source files, before a deploy is triggered. |
| `scripts/railway/print-required-env.mjs` | Prints the env vars an environment requires, e.g. `node scripts/railway/print-required-env.mjs production`. |
| `scripts/smoke/prod.sh <base-url>` | Production smoke checks against a supplied base URL (URL is `$1`; trailing slash trimmed). |
| `scripts/backend-test-db.sh` | The real-Postgres backend Jest harness behind `pnpm test:backend:db`. Takes a lock to serialise runs, prefers Docker `postgres:16-alpine`, **falls back to local Postgres.app binaries** when Docker is unavailable, applies `prisma migrate deploy`, then runs Jest from `apps/api/backend`. |
| `scripts/prisma-generate-locked.sh` | Serialises `prisma generate` to avoid concurrent-generate races. Prefer the package scripts that already call it over raw `prisma generate`. |
| `scripts/verify-build.sh` | Monorepo build verification helper. |
| `scripts/local-gates.sh` | Runs the 14 required status checks **on your machine**, for when Actions cannot allocate a runner. The gate logic already lives in this repo; Actions was only ever the executor. **Exit 0** = all 14 ran and passed, **1** = one failed, **2** = none failed but some were SKIPPED — a skip is never a pass, and the exit code says so. Two ways it is not CI: it builds your branch **as-is**, not merged with `main` (check `git merge-base --is-ancestor origin/main HEAD` first — when true, the branch tree *is* the merged tree), and it skips gates whose services are missing (Postgres on :5432 for the database tier, installed Playwright browsers for E2E, `E2E_CLERK_*` for real-auth). It also reclaims `:3000` from the `next-server` that `launch-gate.sh` orphans on every passing run, and warns when untracked junk (stale `apps/web/.next.*`, `Cargo.lock` under gitignored worktrees) is present, because several gates walk the filesystem and fail for reasons CI can never reproduce. |

Playwright defaults to `http://127.0.0.1:3000` (`PORT` overrides the port,
`PLAYWRIGHT_BASE_URL` overrides the whole URL) and picks its own server: `pnpm run
dev:e2e` locally, `pnpm run preview:e2e` when `CI` is set. Only the CI path does a
cold `next build`, so a local run serves a **dev** build — see
`apps/web/playwright.config.ts`.

For Railway deploy work prefer the preflight/autopilot path over ad-hoc
commands.

## Gotchas

- **Green CI is not evidence the code works.** Anything CI does not execute must
  be run by hand before merge.
- `Module not found: Can't resolve '@vitalcv/trust-state'` in a fresh worktree →
  run `pnpm turbo run build --filter @vitalcv/web`, not `pnpm --filter web build`.
- A stale workspace `dist/` fakes union-exhaustiveness errors. Rebuild the
  workspace dep before believing a type error.
- CI builds your branch **merged with `main`**, so green locally does not mean
  green in CI on a stacked branch. Always diff against `origin/main`, never
  local `main`.
- `next.config.mjs` enforces TypeScript and ESLint on build; typecheck failures
  break deploys.
- Railway is the canonical production platform, not Vercel. Old Vercel
  projects and aliases are not proof of canonical production.
- Never pipe a gate command — a pipeline's exit code reports the last stage and
  reads as false-clean.
- Pushing to a **closed** PR fires no CI: the push succeeds, zero checks run,
  and a watch command shows the old commit still green.
- `@ts-nocheck` hides real Prisma crashes. A `@map`'d column addressed by its
  column name instead of its Prisma field name fails 100% at runtime while
  typechecking clean.
