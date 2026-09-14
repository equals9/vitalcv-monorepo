# Workflow: Build

Use only after the plan has established ownership, authority, scope, and falsifiable guarantees.

## 1. Start from current reality

- Work from current `origin/main` using the repo's existing worktree discipline.
- Re-run claim-check if `main` moved materially after planning.
- Do not trust local `main`, stale branch copies of canonical docs, or historical memory.

## 2. Build against guarantees, not ceremony

VitalCV uses guarantee-driven development.

Required behavior by change type:

- **Bug**: establish a valid RED reproducer before production-code correction when practical; verify the same target goes GREEN.
- **New pure semantics**: write direct tests for the new contract and its boundary states.
- **Trust/policy computation**: include golden fixtures, deterministic replay, failure-state preservation, and equivalence/property checks where applicable.
- **API/auth/security**: prove positive and negative paths, authorization, anti-enumeration, and audit consequences.
- **Database**: use the migration-backed real-Postgres path. Typecheck is not database verification.
- **UI interaction**: test the behavior and exercise it in a real browser/optimized build when the repository gate requires it.
- **Visual-only**: do not change application truth to make a composition possible; satisfy the founder visual gate.

There is no universal 80% coverage target in this workflow. Coverage is supporting evidence, not the definition of correctness.

## 3. Preserve canonical ownership

Prefer `ADAPT` or `EXTEND` over creating a second system. Do not create parallel readiness engines, graphs, policy stores, packet types, decision paths, or agent runtimes because a nearby abstraction looks inconvenient.

For Professional Trust Computing specifically, preserve the current architecture map's boundaries: computational satisfaction is not institutional acceptance; unsupported semantics reject rather than guess; AI may draft but may not silently activate professional truth or policy.

## 4. Keep scope narrow

- One coherent implementation slice per PR.
- Do not mix unrelated design, crypto, credentialing, agent-infra, and application behavior.
- Do not edit a gate merely because it catches the implementation.
- If a gate enforces genuinely superseded doctrine, stop and present evidence rather than quietly weakening it.

## 5. No destructive convenience

Follow existing repo rules for worktrees, staging, generated files, migrations, and branch handling. Do not `git clean` a shared/rescue worktree, do not force-push over another lane, and do not use local-main assumptions.

## 6. Maintain an evidence trail

Before handoff or PR readiness, be able to state:

- what changed;
- which guarantee each test/gate proves;
- which commands actually ran and their exit status;
- what was exercised manually;
- what remains unverified;
- what authority documents constrained the implementation.

Do not invent PASS results or claim a user journey was exercised when it was only inferred from code.
