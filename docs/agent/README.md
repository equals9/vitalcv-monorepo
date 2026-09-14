# VitalCV Agent Kernel v1

Status: repository-native development infrastructure. It does not alter VitalCV product or runtime behavior.

## Purpose

VitalCV already has strong repo-specific operating law in `CLAUDE.md`, `AGENTS.md`, CI, the PR shepherd, truth gates, and domain architecture. Agent Kernel v1 does **not** add another agent framework. It makes the existing system easier for Claude Code and Codex to use consistently by separating durable authority from volatile state.

Core law:

> Persist durable truth. Recompute volatile truth. Treat memory and handoffs as evidence, never authority.

The kernel consists of:

- `AUTHORITY.json` — precedence and freshness policy.
- `TRIGGERS.json` — changed-path → required reading, risk tier, automated gates, and manual evidence.
- `scripts/agent/context.mjs` — compiles live Git/GitHub state and relevant context for a session.
- `scripts/agent/stale-instructions.mjs` — identifies stale operational instruction surfaces without turning old debt into a permanent blocker.
- `scripts/agent/verify.mjs` — plans or runs path-aware verification without shell pipelines.
- `workflows/{plan,build,verify}.md` — small shared Claude/Codex workflows.
- `HANDOFF.md` — cross-harness handoff contract using the existing append-only ledger.

## Collision audit — baseline `origin/main@57dfe9f8b404b392bf4e2c5b69d147ad8c14838e`

### 1. Multiple instruction authorities can drift

`CLAUDE.md` and `AGENTS.md` both describe themselves as operating contracts, but they are not byte-equivalent and evolve at different rates. Several `.claude/agents/*.md` files repeat portions of those contracts. Kernel v1 does not rewrite them; it establishes a machine-readable precedence layer and requires current repo reality to win over copied instructions.

### 2. Historical memory is materially stale

`.vitalcv/MEMORY.md` and `.vitalcv/CONTEXT.md` are dated 2026-03-12 and contain superseded wave, product-language, infrastructure, and timing assumptions. They remain useful archaeology but are classified as historical evidence, never instructions.

### 3. Legacy accelerator instructions conflict with current operation

`CLAUDE_CODE_ACCELERATOR.md` contains OpenClaw-era parallel execution and older build/deployment assumptions. Current `CLAUDE.md` explicitly pauses OpenClaw for build/verify work and makes Railway canonical. The accelerator is therefore historical-only unless a current task explicitly revives a contained technique after verification.

### 4. Committed Claude permissions contain stale operational affordances

`.claude/settings.local.json` contains a large accumulated allow-list including old Vercel commands, broad shell patterns, historic one-off commit commands, and token-inspection-era commands. Kernel v1 does not mutate this user-local compatibility surface. The stale detector reports it and ratchets only files changed by the current branch.

### 5. Specialist agents duplicate policy

The repo already contains `pr-shepherd`, `vitalcv-architect`, `vitalcv-engineer`, `security-engineer`, UI specialists, graph/trust agents, and others. Adding ECC-style agent catalogs would increase instruction collision. Kernel v1 adds no new specialist agent; thin skill adapters point both harnesses at shared kernel files.

### 6. Verification must remain VitalCV-specific

Generic agent frameworks commonly use piped build/test examples and blanket coverage targets. VitalCV has documented false-green failures caused by piped gates and requires real execution in addition to CI. Kernel v1 preserves that rule and never treats its verifier as merge authorization.

### 7. PR landing already has an owner

`.claude/agents/pr-shepherd.md` remains the authoritative PR landing workflow. Kernel verification prepares evidence; it does not replace the shepherd, founder visual gate, branch protection, or production SHA verification.

## Session use

Before a non-trivial change:

```bash
pnpm agent:context
```

With explicit candidate paths:

```bash
pnpm agent:context -- --path packages/domain-evidence/src/trust-computing/compiler.ts
```

Plan verification without executing commands:

```bash
pnpm agent:verify -- --plan
```

Run the selected automated gates:

```bash
pnpm agent:verify -- --run
```

Check stale instruction debt:

```bash
pnpm agent:stale
```

`--strict` fails only when the current branch modifies a watched operational file while leaving a configured stale marker in that same file. Existing historical debt is reported but does not make unrelated work impossible.

## Non-goals

- No ECC installation.
- No daemon, observer, MCP server, vector memory, control plane, or background learning.
- No automatic edits to `CLAUDE.md`, `AGENTS.md`, or existing specialist agents.
- No new merge gate.
- No automatic product decisions.
- No product/runtime dependency on agent tooling.

## Precedence

When anything here conflicts with a live repository fact, test, security/truth boundary, current founder instruction, or current `origin/main`, the higher-ranked source in `AUTHORITY.json` wins. The kernel is a routing layer, not a new source of product truth.
