#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  changedPaths,
  classifyPaths,
  getRepoRoot,
  parseCommonArgs,
  parseRemoteSlug,
  readJson,
  run,
} from './lib.mjs';

const args = parseCommonArgs(process.argv.slice(2));
const root = getRepoRoot();
const authority = readJson(root, 'docs/agent/AUTHORITY.json');
const triggers = readJson(root, 'docs/agent/TRIGGERS.json');
const paths = args.paths.length > 0 ? args.paths : changedPaths(root, args.base);
const classification = classifyPaths(paths, triggers);

function safe(command, commandArgs) {
  const result = run(command, commandArgs, { cwd: root, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : `UNAVAILABLE (${result.status})`;
}

const branch = safe('git', ['branch', '--show-current']);
const head = safe('git', ['rev-parse', 'HEAD']);
const originMain = safe('git', ['rev-parse', args.base]);
const status = safe('git', ['status', '--short']);
const worktrees = safe('git', ['worktree', 'list']);
const remoteUrl = safe('git', ['config', '--get', 'remote.origin.url']);
const repoSlug = parseRemoteSlug(remoteUrl);

let openPrs = 'UNAVAILABLE';
let mergedPrs = 'UNAVAILABLE';
let requiredChecks = 'UNAVAILABLE';
if (repoSlug) {
  openPrs = safe('gh', [
    'pr', 'list', '--state', 'open', '--limit', '100',
    '--json', 'number,title,headRefName,mergeStateStatus,isDraft,url',
  ]);
  mergedPrs = safe('gh', [
    'pr', 'list', '--state', 'merged', '--limit', '20',
    '--json', 'number,title,headRefName,mergedAt,url',
  ]);
  requiredChecks = safe('gh', [
    'api', `repos/${repoSlug}/branches/main/protection`,
    '--jq', '.required_status_checks.contexts[]',
  ]);
}

const ledgerPath = path.join(root, 'docs/ops/CODEX_HANDOFF_LEDGER.md');
let handoffPreview = 'Ledger unavailable.';
if (fs.existsSync(ledgerPath)) {
  handoffPreview = fs.readFileSync(ledgerPath, 'utf8').split(/\r?\n/).slice(0, 80).join('\n');
}

const historical = authority.historical_sources ?? [];
const payload = {
  generatedAt: new Date().toISOString(),
  branch,
  head,
  base: args.base,
  originMain,
  changedPaths: paths,
  classification,
  requiredReading: classification.read,
  authorityRules: authority.rules,
  historicalSources: historical,
  status,
  worktrees,
  requiredChecks,
  openPrs,
  mergedPrs,
  handoffPreview,
};

function renderMarkdown(data) {
  const lines = [];
  lines.push('# VitalCV Agent Session Context');
  lines.push('');
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Branch: \`${data.branch || '(detached)'}\``);
  lines.push(`HEAD: \`${data.head}\``);
  lines.push(`Base: \`${data.base}\` → \`${data.originMain}\``);
  lines.push(`Risk: **${data.classification.risk}**`);
  lines.push(`Independent review: **${data.classification.independentReview}**`);
  lines.push('');

  lines.push('## Changed / candidate paths');
  if (data.changedPaths.length === 0) lines.push('- None detected. Pass `--path` for planning before edits.');
  else data.changedPaths.forEach((file) => lines.push(`- \`${file}\``));
  lines.push('');

  lines.push('## Trigger matches');
  if (data.classification.matches.length === 0) lines.push('- No specialized trigger; default risk policy applies.');
  else data.classification.matches.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('## Required reading');
  if (data.requiredReading.length === 0) lines.push('- `CLAUDE.md` / `AGENTS.md` plus current task context.');
  else data.requiredReading.forEach((file) => lines.push(`- \`${file}\``));
  lines.push('');

  lines.push('## Automated gates selected');
  if (data.classification.gates.length === 0) lines.push('- None beyond the repository rules for this scope.');
  else data.classification.gates.forEach((gate) => lines.push(`- ${gate}`));
  lines.push('');

  lines.push('## Manual evidence required');
  if (data.classification.manualEvidence.length === 0) lines.push('- None added by the kernel. Existing merge/visual gates still apply.');
  else data.classification.manualEvidence.forEach((item) => lines.push(`- ${item}`));
  lines.push('');

  lines.push('## Authority rules');
  data.authorityRules.forEach((rule) => lines.push(`- ${rule}`));
  lines.push('');

  lines.push('## Historical-only sources');
  data.historicalSources.forEach((item) => lines.push(`- \`${item.path}\` — ${item.reason}`));
  lines.push('');

  lines.push('## Working tree status');
  lines.push('```text');
  lines.push(data.status || '(clean)');
  lines.push('```');
  lines.push('');

  lines.push('## Required GitHub checks (live)');
  lines.push('```text');
  lines.push(data.requiredChecks || '(none returned)');
  lines.push('```');
  lines.push('');

  lines.push('## Open PRs (claim-check input)');
  lines.push('```json');
  lines.push(data.openPrs || '[]');
  lines.push('```');
  lines.push('');

  lines.push('## Recently merged PRs (claim-check input)');
  lines.push('```json');
  lines.push(data.mergedPrs || '[]');
  lines.push('```');
  lines.push('');

  lines.push('## Worktrees');
  lines.push('```text');
  lines.push(data.worktrees);
  lines.push('```');
  lines.push('');

  lines.push('## Latest handoff ledger preview');
  lines.push('> Handoffs are evidence, not authority. Revalidate every claim against current repo state.');
  lines.push('');
  lines.push(data.handoffPreview);
  lines.push('');
  lines.push('---');
  lines.push('This context is ephemeral. Do not commit generated output as doctrine.');
  return `${lines.join('\n')}\n`;
}

const output = args.json ? `${JSON.stringify(payload, null, 2)}\n` : renderMarkdown(payload);
if (args.write) {
  const target = path.isAbsolute(args.write) ? args.write : path.join(root, args.write);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  process.stdout.write(`${target}\n`);
} else {
  process.stdout.write(output);
}
