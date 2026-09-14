#!/usr/bin/env node

import {
  changedPaths,
  classifyPaths,
  getRepoRoot,
  parseCommonArgs,
  readJson,
  run,
} from './lib.mjs';

const args = parseCommonArgs(process.argv.slice(2));
const root = getRepoRoot();
const manifest = readJson(root, 'docs/agent/TRIGGERS.json');
const paths = args.paths.length > 0 ? args.paths : changedPaths(root, args.base);
const classification = classifyPaths(paths, manifest);
const shouldRun = args.run === true;

function renderCommand(spec) {
  return spec.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(' ');
}

process.stdout.write('# VitalCV agent verification\n\n');
process.stdout.write(`Risk: **${classification.risk}**\n\n`);
process.stdout.write('Changed / candidate paths:\n');
if (paths.length === 0) process.stdout.write('- none detected\n');
else paths.forEach((file) => process.stdout.write(`- \`${file}\`\n`));

process.stdout.write('\nSelected gates:\n');
if (classification.gates.length === 0) process.stdout.write('- none added by the kernel\n');
else classification.gates.forEach((gate) => process.stdout.write(`- ${gate}\n`));

process.stdout.write('\nManual evidence still required:\n');
if (classification.manualEvidence.length === 0) process.stdout.write('- existing repository merge/visual rules only\n');
else classification.manualEvidence.forEach((item) => process.stdout.write(`- ${item}\n`));

process.stdout.write(`\nIndependent review: **${classification.independentReview}**\n`);
process.stdout.write('\nThe kernel verifier is not merge authorization. `pr-shepherd`, branch protection, founder visual approval, and production verification remain authoritative where applicable.\n\n');

if (!shouldRun) {
  process.stdout.write('## Plan only\n\n');
  for (const gate of classification.gates) {
    const spec = manifest.gate_catalog[gate];
    if (!spec) {
      process.stdout.write(`- ${gate}: MISSING FROM gate_catalog\n`);
      continue;
    }
    process.stdout.write(`- \`${renderCommand(spec)}\`\n`);
  }
  process.stdout.write('\nPass `--run` to execute these commands. Commands are spawned directly with `shell: false`; no gate is piped through `head`, `tail`, or another command.\n');
  process.exit(0);
}

process.stdout.write('## Execution\n\n');
let failed = false;
for (const gate of classification.gates) {
  const spec = manifest.gate_catalog[gate];
  if (!spec) {
    failed = true;
    process.stdout.write(`- FAIL ${gate}: missing gate_catalog entry\n`);
    continue;
  }

  const [command, ...commandArgs] = spec;
  process.stdout.write(`\n### ${gate}\n\n\`${renderCommand(spec)}\`\n\n`);
  const result = run(command, commandArgs, { cwd: root, allowFailure: true });
  if (result.stdout) process.stdout.write(result.stdout.endsWith('\n') ? result.stdout : `${result.stdout}\n`);
  if (result.stderr) process.stderr.write(result.stderr.endsWith('\n') ? result.stderr : `${result.stderr}\n`);
  if (result.status !== 0) {
    failed = true;
    process.stdout.write(`\nResult: FAIL (exit ${result.status})\n`);
  } else {
    process.stdout.write('\nResult: PASS\n');
  }
}

process.stdout.write('\n## Result\n\n');
if (failed) {
  process.stdout.write('Automated verification failed. Fix the code or the actual governing contract; do not weaken a gate merely to obtain green.\n');
  process.exitCode = 1;
} else {
  process.stdout.write('Selected automated gates passed. Real-execution evidence and all existing repository/PR gates are still required before claiming readiness or merging.\n');
}
