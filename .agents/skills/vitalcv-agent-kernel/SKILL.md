---
name: vitalcv-agent-kernel
description: Use VitalCV's repo-native authority, context, planning, build, verification, stale-instruction, and handoff system for implementation or PR work. Do not install ECC.
---

# VitalCV Agent Kernel

Before non-trivial work:

1. Read `docs/agent/README.md`.
2. Run `pnpm agent:context` (pass `-- --path <candidate>` when planning before edits).
3. Follow `docs/agent/workflows/plan.md`, then `build.md`, then `verify.md` as applicable.
4. Use `docs/agent/AUTHORITY.json` to resolve instruction conflicts and `TRIGGERS.json` to load only path-relevant context.
5. Treat `.vitalcv/MEMORY.md`, `.vitalcv/CONTEXT.md`, `CLAUDE_CODE_ACCELERATOR.md`, and handoffs as evidence requiring revalidation, not authority.
6. Preserve the existing merge gate, founder visual gate, branch protection, and `.claude/agents/pr-shepherd.md` behavior.
7. For cross-session or Claude↔Codex continuation, use `docs/agent/HANDOFF.md` and the existing append-only `docs/ops/CODEX_HANDOFF_LEDGER.md`.

Never install ECC, add a background learning daemon, or create a parallel merge/verification authority.
