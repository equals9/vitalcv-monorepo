# Workflow: Plan

Use before non-trivial implementation, refactoring, rescue, or architecture work.

## 1. Compile live context

Run:

```bash
pnpm agent:context -- --path <candidate-path>
```

If candidate paths are not yet known, run `pnpm agent:context` and then inspect likely owners before choosing files.

## 2. Claim-check the intent

Before designing a solution, establish whether the behavior already exists, is already being built, or has been superseded.

Required checks:

- current `origin/main` implementation;
- open PRs by **intent**, not just branch name;
- recently merged PRs;
- relevant remote branches when collision risk is material;
- canonical owner for the primitive you intend to change.

Classify every substantial proposed primitive as exactly one of:

- `EXISTS` — already present; reuse it;
- `ADAPT` — existing primitive needs an adapter;
- `EXTEND` — canonical owner exists and should be extended;
- `NEW` — no canonical owner exists and a new primitive is justified;
- `DEFER` — valid idea, wrong dependency order or insufficient evidence;
- `DO_NOT_BUILD` — duplicates, violates doctrine, broadens scope, or is unnecessary to prove the current objective.

If `EXISTS`, stop building a duplicate. If an open PR owns the same intent, coordinate or choose a non-overlapping slice.

## 3. Ground the plan in repository patterns

For every affected area, identify the best current example for:

- naming and file ownership;
- error/negative-state handling;
- data access and side-effect boundaries;
- tests and fixtures;
- logging/audit behavior when relevant;
- authorization and consent boundaries when relevant.

Do not invent a pattern because an old memory says one used to exist.

## 4. Resolve authority before implementation

Read every file selected by `TRIGGERS.json`. If two instructions conflict, use `AUTHORITY.json` and record the collision in the plan. Historical memory and handoffs are evidence only.

## 5. Define falsifiable guarantees

A plan is incomplete until each behavior has a proof target.

Examples:

- bug fix → reproducer fails before fix and passes after;
- pure semantics → unit/property/golden cases;
- Trust Compiler → determinism, golden fixtures, equivalence, rich-state preservation;
- API/auth → integration plus negative authorization/anti-enumeration;
- database → migration-backed real Postgres;
- UI behavior → focused tests plus browser exercise;
- visual-only → rendered founder-gate evidence;
- deployment → exact deployed SHA plus smoke/probe;
- copy → claims/copy gates.

Do not substitute an arbitrary coverage percentage for a meaningful guarantee.

## 6. State scope and risk

The plan must include:

- objective;
- risk tier from the kernel;
- primitive classification table;
- files to change;
- files explicitly out of scope;
- guarantees/evidence;
- automated gates;
- manual evidence;
- rollback or containment note for Tier 2 work.

For Tier 2 work, an independent Claude/Codex read is recommended when useful, but it remains a second opinion rather than a merge gate.

## 7. Do not silently widen scope

If the requested outcome requires a schema, auth, consent, truth, source, pricing, employer-decision, or product-boundary change that was not authorized, record it as a dependency and stop that slice rather than solving it opportunistically.
