# Workflow: Verify

Verification answers: **what executed this changed behavior, on which state/SHA, and what did it prove?**

It does not answer: "may this PR merge?" The existing PR shepherd, branch protection, founder visual gate, and deployment checks remain authoritative.

## 1. Recompile live context

Run:

```bash
pnpm agent:context
```

Re-check the changed paths, current `origin/main`, open PR collisions, required branch-protection contexts, and risk tier. A plan produced before `main` moved may be stale.

## 2. Inspect the path-aware gate plan

```bash
pnpm agent:verify -- --plan
```

The verifier selects gates from `TRIGGERS.json`. Review the plan before executing it. A missing gate-catalog entry is a kernel defect, not permission to skip the check.

## 3. Run selected automated gates

```bash
pnpm agent:verify -- --run
```

The verifier spawns commands directly with `shell: false`. Do not wrap a correctness gate in `| head`, `| tail`, or another pipeline whose exit code can hide failure.

If a selected gate fails:

1. diagnose the changed behavior or governing contract;
2. fix the smallest valid cause;
3. rerun the affected gate;
4. do not weaken the gate merely to obtain green.

## 4. Supply real-execution evidence

Automated green is insufficient. Exercise what the diff changed:

- route → hit the route;
- UI → load and interact with the page;
- script → execute the script;
- source adapter → exercise relevant source/degraded state;
- database → run the migration-backed Postgres harness;
- trust computation → run golden/deterministic/equivalence cases;
- deployment → verify exact deployed SHA and production smoke/probe.

If the environment cannot exercise the behavior, report that gap explicitly. Do not convert "could not verify" into "looks correct".

## 5. Review diff scope

Before claiming readiness, answer:

- Does the diff implement the brief?
- Is every changed file in scope?
- Did a generated or stale file sneak in?
- Did any copy/truth/security/consent boundary move unintentionally?
- Did the change create a duplicate primitive instead of adapting/extending the canonical owner?

## 6. Tier 2 second opinion

For Tier 2 changes, a fresh Claude/Codex review is recommended when it materially improves confidence. It remains **non-authoritative**: a SAFE/APPROVE verdict cannot replace tests, real execution, branch protection, or user/founder approval.

## 7. Handoff / PR landing

Write a handoff using `docs/agent/HANDOFF.md` when another harness or session must continue. For an actual PR landing, use the existing `pr-shepherd`; do not recreate its SHA/check-run/merge/deploy logic in the kernel.
