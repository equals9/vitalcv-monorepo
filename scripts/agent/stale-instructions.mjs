#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {
  changedPaths,
  evaluateStaleEntry,
  getRepoRoot,
  gitLastCommitDate,
  parseCommonArgs,
  readJson,
} from './lib.mjs';

const args = parseCommonArgs(process.argv.slice(2));
const root = getRepoRoot();
const authority = readJson(root, 'docs/agent/AUTHORITY.json');
const changed = new Set(changedPaths(root, args.base));
const findings = [];

for (const entry of authority.stale_watch ?? []) {
  const absolute = path.join(root, entry.path);
  if (!fs.existsSync(absolute)) {
    findings.push({
      path: entry.path,
      kind: entry.kind,
      severity: 'info',
      missing: true,
      blocking: false,
      hasSignals: false,
    });
    continue;
  }

  const text = fs.readFileSync(absolute, 'utf8');
  findings.push(evaluateStaleEntry({
    entry,
    text,
    lastCommitDate: gitLastCommitDate(root, entry.path),
    changed: changed.has(entry.path),
  }));
}

const actionable = findings.filter((item) => item.hasSignals || item.missing);
const blocking = findings.filter((item) => item.blocking);

if (args.json) {
  process.stdout.write(`${JSON.stringify({ actionable, blocking }, null, 2)}\n`);
} else {
  process.stdout.write('# VitalCV stale-instruction report\n\n');
  if (actionable.length === 0) {
    process.stdout.write('No configured stale-instruction signals found.\n');
  } else {
    for (const item of actionable) {
      if (item.missing) {
        process.stdout.write(`- INFO \`${item.path}\`: configured watch target is absent.\n`);
        continue;
      }
      const details = [];
      if (item.staleByAge) details.push(`age=${item.ageDays}d`);
      if (item.markerHits?.length) details.push(`markers=${item.markerHits.join(', ')}`);
      if (item.changed) details.push('changed-on-this-branch');
      process.stdout.write(`- ${item.blocking ? 'BLOCK' : 'WARN'} \`${item.path}\` (${item.kind}) — ${details.join('; ')}\n`);
    }
  }

  process.stdout.write('\nExisting stale debt is warning-only. `--strict` blocks only when this branch edits a watched file and leaves a configured stale marker in it.\n');
}

if (args.strict && blocking.length > 0) process.exitCode = 1;
