#!/usr/bin/env bash
# local-gates.sh — run the 14 required status checks locally.
#
# Exists because GitHub Actions cannot allocate runners (see docs/ops/).
# The gate LOGIC lives in this repo; Actions was only ever the executor.
# This script is that executor, running on your machine instead.
#
# IMPORTANT — this is not equivalent to CI, in two specific ways:
#   1. CI builds your branch MERGED WITH main. This builds your branch as-is,
#      so merge-interaction failures are invisible here.
#   2. Gates whose services are unavailable are SKIPPED, not passed.
#      A skip is never green. The exit code reflects that.
#
# Exit codes:  0 = all 14 ran and passed
#              1 = at least one gate FAILED
#              2 = no failures, but some gates were SKIPPED (partial verification)

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
REPO_ROOT="$(pwd)"

LOGDIR="${TMPDIR:-/tmp}/vitalcv-local-gates.$$"
mkdir -p "$LOGDIR"

PASSED=(); FAILED=(); SKIPPED=()

c_grn=$'\033[32m'; c_red=$'\033[31m'; c_yel=$'\033[33m'; c_dim=$'\033[2m'; c_off=$'\033[0m'
[ -t 1 ] || { c_grn=""; c_red=""; c_yel=""; c_dim=""; c_off=""; }

# reclaim_3000 — free port 3000 of orphaned next-servers.
#
# scripts/launch-gate.sh (last step of Web Quality) runs `PORT=3000 pnpm start &`
# and traps EXIT to `kill -9 $SERVER_PID`. That kills the pnpm parent but NOT the
# next-server grandchild, so every passing Web Quality orphans a production
# server. Two things then break on the NEXT run: launch-gate.sh cannot bind :3000,
# and the stray server competes for CPU until vitest workers time out (observed:
# the same suite taking 795s instead of 16s, then failing).
#
# CI never sees this — each job there is a fresh isolated runner. Called once at
# startup and again before the E2E tier. Only next-server orphans are killed,
# each one announced; anything else holding the port is reported, never touched.
reclaim_3000() {
  local pid cmd
  for pid in $(lsof -nP -iTCP:3000 -sTCP:LISTEN -t 2>/dev/null); do
    cmd=$(ps -o command= -p "$pid" 2>/dev/null)
    case "$cmd" in
      *next-server*|*"next start"*)
        echo "  ${c_yel}!${c_off} reclaiming :3000 from orphaned next-server (pid $pid, left by launch-gate.sh)"
        kill "$pid" 2>/dev/null || true
        sleep 1
        kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
        ;;
      *)
        echo "  ${c_yel}!${c_off} :3000 held by a process this script will NOT kill (pid $pid):"
        echo "    ${c_dim}${cmd}${c_off}"
        echo "    Web Quality (launch-gate) and Web E2E will fail until it is freed."
        ;;
    esac
  done
}

slug() { echo "$1" | tr -c 'a-zA-Z0-9' '-' | tr -s '-'; }

# run_gate <context-name> <command...>
run_gate() {
  local name="$1"; shift
  local log="$LOGDIR/$(slug "$name").log"
  printf '  %-34s ' "$name"
  if bash -c "$*" >"$log" 2>&1; then
    printf '%sPASS%s\n' "$c_grn" "$c_off"; PASSED+=("$name")
  else
    printf '%sFAIL%s  %s%s%s\n' "$c_red" "$c_off" "$c_dim" "$log" "$c_off"; FAILED+=("$name")
  fi
}

skip_gate() {
  local name="$1"; local why="$2"
  printf '  %-34s %sSKIP%s  %s%s%s\n' "$name" "$c_yel" "$c_off" "$c_dim" "$why" "$c_off"
  SKIPPED+=("$name — $why")
}

# ---- capability detection -------------------------------------------------
PG_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/postgres}"
have_pg=0
if command -v pg_isready >/dev/null 2>&1 && pg_isready -q -h localhost -p 5432 2>/dev/null; then
  have_pg=1
fi
have_cargo_audit=0
command -v cargo-audit >/dev/null 2>&1 && have_cargo_audit=1
have_pw=0
[ -d "$HOME/Library/Caches/ms-playwright" ] && have_pw=1
have_clerk=0
[ -n "${E2E_CLERK_SECRET_KEY:-}" ] && [ -n "${E2E_CLERK_PUBLISHABLE_KEY:-}" ] && have_clerk=1

echo
echo "VitalCV local gates — 14 required contexts"
echo "logs: $LOGDIR"
echo

reclaim_3000

# ---- prerequisite: workspace dep build ------------------------------------
# Vitest resolves @vitalcv/* through dist/. Without this, suites fail with
# module-not-found errors that blame the packages rather than the missing build.
printf '  %-34s ' "(prep) workspace deps"
if pnpm turbo build --filter='!@vitalcv/web' >"$LOGDIR/prep-build.log" 2>&1; then
  printf '%sok%s\n' "$c_grn" "$c_off"
else
  printf '%sFAILED%s — everything downstream is unreliable. See %s\n' \
    "$c_red" "$c_off" "$LOGDIR/prep-build.log"
  exit 1
fi
echo

# ---- workspace hygiene ----------------------------------------------------
# CI runs on a clean checkout. Your working tree is not clean, and several
# gates walk the FILESYSTEM rather than the git index — so untracked, gitignored
# junk makes them fail for reasons CI can never reproduce.
#
# This is verified, not theoretical: 2GB of stale apps/web/.next.* dirs made
# design-md-freshness and retired-route-references fail, and gitignored
# worktrees made Rust SCA report criticals. All five passed once removed.
#
# Warn loudly; never silently work around it — the same suppression would hide
# a real failure.
JUNK=0
STALE_NEXT=$(ls -d apps/web/.next.* 2>/dev/null | wc -l | tr -d ' ')
if [ "${STALE_NEXT:-0}" -gt 0 ]; then
  echo "  ${c_yel}!${c_off} ${STALE_NEXT} stale apps/web/.next.* dir(s) — untracked, invisible to CI."
  echo "    Poisons: 'Web Quality' (design-md-freshness, retired-route-references)."
  echo "    ${c_dim}remove: rm -rf apps/web/.next.bak.* apps/web/.next.prev.* apps/web/.next.build-stale-* apps/web/.next.cache-debug-*${c_off}"
  JUNK=1
fi
for wt in .worktrees .claude/worktrees; do
  if [ -d "$wt" ] && find "$wt" -name Cargo.lock -print -quit 2>/dev/null | grep -q .; then
    echo "  ${c_yel}!${c_off} $wt/ holds Cargo.lock files and is gitignored."
    echo "    Poisons: 'Rust SCA' — it recurses the filesystem, so it reports advisories CI cannot see."
    echo "    ${c_dim}these worktrees may be load-bearing; do not delete blindly${c_off}"
    JUNK=1
  fi
done
if [ "$JUNK" -eq 1 ]; then
  echo
  echo "  ${c_yel}Failures in the gates named above are suspect until the tree is clean.${c_off}"
  echo
fi

# ---- tier 1: static gates, no services ------------------------------------
echo "${c_dim}static gates${c_off}"
NODE_TS="node --experimental-strip-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON"

run_gate "check-public-claims"           "pnpm check:copy"
run_gate "check-design-lint"             "$NODE_TS scripts/check-design-lint.ts"
run_gate "check-route-guards"            "$NODE_TS scripts/check-route-guards.ts"
run_gate "check-workflow-contract"       "node scripts/check-workflow-path-filters.js && node scripts/check-workflow-concurrency.js"
run_gate "Canonical Source Adapter Gate" "node scripts/check-canonical-source-adapter-imports.mjs"
run_gate "Identity-header trust ratchet" "node --experimental-strip-types scripts/check-header-trust-ratchet.ts"
run_gate "check-copy-source-liveness"    "node scripts/report-public-entry-copy-sources.js"
run_gate "SCA — critical-only gate"      "node scripts/security/audit-gate.mjs"
run_gate "axe WCAG 2.2 AA"               "pnpm --filter @vitalcv/web exec vitest run __tests__/a11y/shipped-components.test.tsx"

if [ "$have_cargo_audit" -eq 1 ]; then
  run_gate "Rust SCA — critical-only gate" "node scripts/security/cargo-audit-gate.mjs"
else
  skip_gate "Rust SCA — critical-only gate" "cargo-audit not installed (cargo install cargo-audit --locked)"
fi

# ---- tier 2: needs Postgres -----------------------------------------------
echo
echo "${c_dim}database gates${c_off}"
if [ "$have_pg" -eq 1 ]; then
  run_gate "Backend Tests (Postgres)" \
    "cd apps/api/backend && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vitalcv_backend_test' npx prisma generate && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vitalcv_backend_test' node scripts/check-migration-drift.mjs && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vitalcv_backend_test' npx prisma db push --skip-generate --accept-data-loss && DATABASE_URL='postgresql://postgres:postgres@localhost:5432/vitalcv_backend_test' npx jest --ci --forceExit"

  # DATABASE_URL is scoped PER STEP, exactly as ci.yml does it. The unit-test
  # step deliberately runs WITHOUT a database — exporting it for the whole job
  # makes routes report persisted:true and fails pilot-intake-route spuriously.
  WEB_DB='postgresql://postgres:postgres@localhost:5432/vitalcv_web_test'
  UNIT_EXCLUDES="--exclude __tests__/verifier-worklist-db.test.ts --exclude __tests__/start-agent-telemetry-db.test.ts --exclude __tests__/start-agent-consent-db.test.ts --exclude __tests__/start-agent-consent-loop-db.test.ts --exclude __tests__/agent-schedule-db.test.ts --exclude __tests__/agent-plan-delta-db.test.ts --exclude __tests__/clinician-contact-consent-db.test.ts"
  DB_SUITES="__tests__/verifier-worklist-db.test.ts __tests__/start-agent-telemetry-db.test.ts __tests__/start-agent-consent-db.test.ts __tests__/start-agent-consent-loop-db.test.ts __tests__/agent-schedule-db.test.ts __tests__/agent-plan-delta-db.test.ts __tests__/clinician-contact-consent-db.test.ts"

  run_gate "Web Quality" \
    "DATABASE_URL='$WEB_DB' pnpm --filter @vitalcv/web exec prisma db push --schema prisma/schema.prisma --skip-generate \
     && pnpm --filter @vitalcv/web lint \
     && pnpm --filter @vitalcv/web exec vitest run $UNIT_EXCLUDES \
     && DATABASE_URL='$WEB_DB' pnpm --filter @vitalcv/web exec vitest run $DB_SUITES \
     && pnpm --filter @vitalcv/web build \
     && bash scripts/launch-gate.sh"

else
  skip_gate "Backend Tests (Postgres)" "no Postgres on localhost:5432"
  skip_gate "Web Quality"              "no Postgres on localhost:5432"
fi

  reclaim_3000

# ---- tier 3: needs browsers / real credentials ----------------------------
echo
echo "${c_dim}end-to-end gates${c_off}"
if [ "$have_pw" -eq 1 ]; then
  # playwright.config.ts: isCI ? preview:e2e (production) : dev:e2e (dev).
  # Without CI=1 the dev server answers, and the cache-header specs fail spuriously.
  run_gate "Web E2E (Playwright)" "CI=1 pnpm --filter @vitalcv/web exec playwright test"
else
  skip_gate "Web E2E (Playwright)" "chromium not installed (pnpm --filter @vitalcv/web exec playwright install chromium)"
fi

if [ "$have_clerk" -eq 1 ] && [ "$have_pg" -eq 1 ]; then
  skip_gate "Web E2E (real auth)" "needs a running backend; run by hand — see .github/workflows/ci.yml job web-e2e-authed"
else
  skip_gate "Web E2E (real auth)" "needs E2E_CLERK_* secrets, Postgres, and a running backend"
fi

# ---- verdict --------------------------------------------------------------
echo
echo "────────────────────────────────────────────────────────"
printf 'passed %d   failed %d   skipped %d   of 14\n' \
  "${#PASSED[@]}" "${#FAILED[@]}" "${#SKIPPED[@]}"

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo
  echo "${c_red}FAILED${c_off}"
  for g in "${FAILED[@]}"; do echo "  · $g"; done
fi
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo
  echo "${c_yel}NOT VERIFIED${c_off} — these did not run. They are not passing."
  for g in "${SKIPPED[@]}"; do echo "  · $g"; done
fi
echo

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "${c_red}VERDICT: NOT MERGEABLE${c_off} — a required gate failed."
  exit 1
elif [ "${#SKIPPED[@]}" -gt 0 ]; then
  echo "${c_yel}VERDICT: PARTIAL${c_off} — ${#PASSED[@]}/14 verified. The rest are unknown, not green."
  exit 2
else
  echo "${c_grn}VERDICT: all 14 passed locally.${c_off}"
  echo "${c_dim}Still not identical to CI: this built your branch alone, not merged with main.${c_off}"
  exit 0
fi
