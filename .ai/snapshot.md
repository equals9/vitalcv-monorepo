# VitalCV — Operational Snapshot

**Last verified:** 2026-08-10 (against `origin/main` @ `b10e681c2`)
**Supersedes:** the 2026-01-07 snapshot, which described a monorepo that no longer exists.
**Companions:** `docs/architecture/vcd-00-current-reality.md` — the timestamped reconciliation
(SHAs, deploy state, open PRs, security blockers, next eligible work) — and
`docs/product/evidence-network/canonical-transaction-baseline.md` — the canonical transaction
map and gap register.

---

## 0. What this file is, and what it is not

This is an **orientation** document: the layout of the repository, the tooling that builds it,
and the invariants that hold regardless of which wave is running.

It is **not** a current-state report. Deploy SHAs, PR state, program status and audit findings in
this repository change within hours to days — they live in the companion doc above, or are read
live. Nothing here should be the reason you believe production is on a given commit.

The previous version of this file claimed to be "Tier-3 operational truth", "authoritative for
operational decisions", and instructed agents to **stop work if it were stale**. It was seven
months stale and every structural claim in it was wrong — it named five packages that do not
exist and told agents that a missing package "implies a missing domain" that must be built here.
An agent obeying it would have built `packages/credentials`, `packages/identity` and
`packages/compliance` alongside the 26 real ones. **This file no longer claims authority it
cannot hold.** Where it disagrees with `CLAUDE.md`, `CLAUDE.md` wins. Where it disagrees with
`origin/main`, `origin/main` wins.

---

## 1. Canonical repository

- **Repository:** `equals9/vitalcv-monorepo` — single authoritative monorepo.
- All active development happens here. Other VitalCV-related repos are legacy / reference-only.
- Legacy names that may still appear in comments and should not be reintroduced as dependencies:
  `ctol3r/chai-vc-platform`, `ctol3r/v0-vital-cv-frontend-mvp`.

**Local `main` is not `origin/main`.** A large worktree fleet holds `main`, so the primary
checkout is frequently behind or on a feature branch. Always diff against `origin/main`. This is
not a theoretical risk: at the time of writing, the primary checkout's `.github/workflows/` was
missing 12 workflows that exist on `origin/main`, including `deploy-web.yml`.

### Cutting a branch

Never `git checkout main && git pull origin main` — it fails against the worktree fleet.

```bash
git fetch origin main
git worktree add -b <feature-branch> /tmp/vitalcv-<slug> origin/main
cd /tmp/vitalcv-<slug>
pnpm install
pnpm turbo run build --filter @vitalcv/web   # prebuilds @vitalcv/trust-state dist/
```

Do not remove worktrees you did not create — they are load-bearing.

---

## 2. Monorepo layout (as-is on `origin/main`)

### `apps/` — 9 workspaces

| App | Role |
|---|---|
| `apps/web` | **Primary surface.** Next 15 App Router, React 19. Clinician + employer + issuer + trust UI. |
| `apps/api` | Backend. The server lives at **`apps/api/backend`**, not at `apps/api` directly; siblings are `contracts`, `credential-demo`, `fhir-bridge`, `trusted-node`. |
| `apps/marketing` | Separate marketing app. **Do not pull web changes into it.** |
| `apps/issuer-api`, `apps/verifier-api`, `apps/admin-api`, `apps/status-api`, `apps/authz` | Protocol / service surfaces. |
| `apps/mobile` | Do not modify in issuer waves. |

⚠️ **`apps/router` does not exist.** `CLAUDE.md` and issue #963 both still name it. Do not budget
work for it.

### `packages/` — 26 workspaces

`audit`, `career-graph`, `command-registry`, `crs`, `domain`, `domain-authority`,
`domain-common`, `domain-core`, `domain-events`, `domain-evidence`, `embed-sdk`, `graph-core`,
`haip-config`, `ingest`, `issuer-sdk`, `licensure`, `poe-engine`, `psv`, `psv-adapters`,
`shared`, `source-adapters`, `trust-contract`, `trust-state`, `truth-enforcement`,
`verifier-sdk`, `wallet-sdk`.

Two that bite:

- **`packages/domain-common`** is the barrel for domain types. Re-export with the `type` keyword
  (`isolatedModules: true`).
- **`packages/trust-state`** ships from `dist/` and must be turbo-built before `apps/web` builds.
  `Module not found: Can't resolve '@vitalcv/trust-state'` in a fresh worktree means you ran
  `pnpm --filter @vitalcv/web build` instead of `pnpm turbo run build --filter @vitalcv/web`.

**A package's absence means it was never built, or was removed — not that it is an external
dependency, and not that you should create it.** Adding a workspace is a deliberate architectural
decision, not a gap-fill.

---

## 3. Tooling

- **pnpm** is required. Single lockfile at repo root. No `package-lock.json` / `yarn.lock`.
- **Turborepo** is canonical. `pnpm-workspace.yaml` defines workspaces; `turbo.json` the pipelines.
- `@types/react` override in root `package.json` resolves Radix UI + React 19 conflicts.
  `.npmrc` sets `public-hoist-pattern[]=@types/*` so `@types/node` reaches all packages.
- The web `tsconfig` needs explicit `"types": ["node", "react", "react-dom"]` to avoid a stale
  `@types/minimatch`.
- **Tests are vitest 4.x, not Jest** (the backend is the exception — it runs jest, and its suite
  *is* a required PR gate). Server components are async; tests render via `react-dom/server`
  `renderToStaticMarkup`.

```bash
pnpm --filter @vitalcv/web exec vitest run __tests__/<file>.test.ts   # focused suite
pnpm turbo run build --filter @vitalcv/web                            # build web
pnpm typecheck && pnpm lint
```

`next.config.mjs` enforces TypeScript and ESLint on build — no ignore flags — so a typecheck
failure breaks the deploy.

---

## 4. Deployment

**Railway. Not Vercel.** Identities, exact-SHA mechanics and the per-service deploy path are in
`docs/architecture/vcd-00-current-reality.md` §2.

The rule that matters here: **verify a deploy by reading the SHA production reports** —
`/api/version` (web, field `commit`) or `/health` (API, field `git_sha`) — never by trusting a
green workflow, an HTTP 200, or a newest-successful Railway run.

---

## 5. Truth contract

The issuer verification chain (`apps/web/lib/issuer-verification/`) enforces hard invariants.
Full text in `CLAUDE.md`; the load-bearing ones:

- `ReceiptCandidate.decisionGrade` is the **literal** `false`; `proofTier` the literal
  `'receipt_candidate'`. Do not widen to `boolean` or another string.
- `PSVReceiptCandidate` is likewise literal `decisionGrade: false`, `proofTier:
  'psv_receipt_candidate'`. Only `accept_candidate` may produce one, and only from
  `reviewState === 'ready_for_policy_review'`.
- `receiptCandidate.ts` and `policyReview.ts` are **pure transforms** — no fetches, no DB writes,
  no audit-event writes.
- Authoritative model: `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}`. Boundaries are
  numbered; add new ones, never rewrite old ones.
- **Banned strings** (see `CLAUDE.md` for the full list) may not appear in any copy except as test
  split-join constants. No status label may be the bare word `Verified`.
- Public copy is governed by `docs/ops/vitalcv-public-claims-matrix.md` and enforced by
  `scripts/check-public-claims.ts`.

---

## 6. Verification discipline

These are the failure modes this repository has actually produced. They are why "it built" is not
a report.

1. **"Green" is a claim about a SHA, not a PR.** Read the required contexts live
   (`gh api repos/:owner/:repo/branches/main/protection --jq '.required_status_checks.contexts[]'`
   — the list has moved 2 → 5 → 7 → 14) and enumerate conclusions from
   `commits/<head-sha>/check-runs`. Require zero pending, zero failing, and
   `mergeStateStatus == CLEAN`. Never `gh pr merge --auto`.
2. A **`CONFLICTING`** PR skips every `pull_request` gate while displaying ~3 push checks that
   look green. A push to a **closed** PR runs zero workflows, silently.
3. **CI builds the branch merged with `main`**, so local-green / CI-red is expected and diagnostic.
4. **Green CI is not evidence the code works.** Shell scripts, GPU/WebGPU paths and dev-gated e2e
   specs run in no PR check — exercise them by hand.
5. **Never pipe a gate.** A piped exit code reports false-clean.
6. **Prove a guard by injecting the defect the guard actually asserts on.** A green suite can
   encode the vulnerability as correct behaviour — that has happened here.
7. **The merge gate** (settled 2026-07-25) is green CI **plus** having exercised the change
   yourself and shown the evidence. No verifier verdict substitutes for that. Codex is not a gate.
8. **Audits go stale within days.** Claim-check every finding against `origin/main` and a live
   probe before acting on it.

---

## 7. Governance — where authority actually lives

| Question | Doc of record |
|---|---|
| How we work; truth contract; merge gate; branch cutting | `CLAUDE.md` |
| Visual/experience law (Class A clauses reject PRs) | `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` |
| Retired visual eras | `docs/design/PARKED_VISUAL_ERAS.md` |
| Public-facing visual sign-off | `docs/ops/FOUNDER_VISUAL_GATE.md` |
| What public copy may claim | `docs/ops/vitalcv-public-claims-matrix.md` |
| Trust/provenance data model | `docs/architecture/vitalcv-knowledge-trust-graph.{md,json}` |
| Current SHAs, deploys, open PRs, security blockers, next branch | `docs/architecture/vcd-00-current-reality.md` |
| Open launch blockers | `docs/ops/launch-blockers.md` (⚠️ status date 2026-07-11 — re-verify) |

`VITALCV_CREATIVE_DIRECTION.md` is **superseded** by the Experience Constitution.
`docs/ops/wave-ledger.md` is **stale** (last entries 2026-05-28) and is not a current-state source.

**The design-only boundary.** A design wave may change UI, UX, visual and interaction design,
responsive behavior, animation, information hierarchy, customer-facing copy, navigation
presentation, and brand expression. It may **not** change application truth, authentication,
authorization, consent semantics, data models, APIs, readiness calculations, agent policy, source
behavior, employer decisions, business logic, or pricing behavior. If the experience requires one
of those, record it as a product dependency and stop.

---

## 8. Maintenance

Update this file when the **structure** changes — an app or package added or removed, the build
chain changed, a governance doc superseded. Do not update it for a deploy, a merge, or a wave;
those belong in the companion reconciliation doc or are read live.

If this file looks stale, **say so and re-verify** — do not stop work, and do not treat it as
authority over `origin/main`.
