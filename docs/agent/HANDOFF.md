# Shared Claude/Codex handoff contract

Physical ledger: `docs/ops/CODEX_HANDOFF_LEDGER.md`.

The filename is retained for backwards compatibility. As of Agent Kernel v1 it is the shared append-only handoff ledger for **Claude Code, Codex, and any future approved harness**.

## Authority

A handoff is execution evidence, not policy and not permission. Before continuing work, the receiving agent must recompile live context and validate the handoff against current `origin/main`, current open/merged PRs, and the authority selected by `TRIGGERS.json`.

If the handoff conflicts with current repo reality, current repo reality wins. Never repair reality to make an old handoff true.

## Entry format

Insert newest entries at the top, preserving the ledger's append-only history.

```markdown
## <WORK-ID> · <title> — <STATE>

- **Date:** YYYY-MM-DD
- **Source harness:** Claude Code | Codex | other approved harness
- **Base SHA:** <origin/main SHA used for the work>
- **Branch / PR:** <branch and PR if they exist>
- **Claim-check:** What open/merged work and canonical owners were checked; note collisions.
- **Change:** What actually changed, with scope boundaries.
- **Authority:** Canonical docs/contracts that governed the work.
- **Evidence:** Commands/tests/probes actually run and their outcomes. Do not invent PASS.
- **Unverified / risks:** Anything not exercised, ambiguous, or dependent on another change.
- **Remaining work:** Concrete unfinished work only.
- **Next gate:** The next action the receiving agent should evaluate after recompiling live context.
```

## Rules

1. **Append-only.** Correct an earlier entry with a new entry; do not rewrite history to make it look prescient.
2. **No transcript dumps.** Store the smallest useful execution state, not the conversation.
3. **No secrets or sensitive personal data.** Link to governed sources rather than copying secret-bearing output.
4. **Evidence names a state/SHA.** "CI was green" without the relevant SHA/check state is insufficient for merge claims.
5. **No phantom completion.** Open PR, draft implementation, local branch, merged commit, deployed SHA, and manually exercised production behavior are distinct states.
6. **Handoffs may not create doctrine.** Promote a durable conclusion only by updating the canonical artifact through normal review.
7. **Stale handoffs are expected.** The receiving agent revalidates; it does not blindly resume.
8. **PR landing remains with `pr-shepherd`.** Do not turn the ledger into a parallel merge gate.

## Minimum receiving workflow

```bash
pnpm agent:context
pnpm agent:verify -- --plan
```

Then read the relevant newest ledger entry and the required authority docs. Only after those steps should the receiving harness decide whether to continue, adapt, stop as already-landed, or re-plan.
