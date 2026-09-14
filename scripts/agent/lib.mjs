import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function run(command, args = [], options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
    env: options.env ?? process.env,
    shell: false,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const status = typeof result.status === 'number' ? result.status : 1;

  if (status !== 0 && !options.allowFailure) {
    const rendered = [command, ...args].join(' ');
    throw new Error(`Command failed (${status}): ${rendered}\n${stderr || stdout}`);
  }

  return { status, stdout, stderr };
}

export function getRepoRoot(cwd = process.cwd()) {
  const result = run('git', ['rev-parse', '--show-toplevel'], { cwd, allowFailure: true });
  return result.status === 0 ? result.stdout.trim() : path.resolve(cwd);
}

export function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

export function normalizePath(value) {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

export function globToRegExp(pattern) {
  const input = normalizePath(pattern);
  let out = '^';

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '*') {
      if (input[i + 1] === '*') {
        i += 1;
        if (input[i + 1] === '/') {
          i += 1;
          out += '(?:.*/)?';
        } else {
          out += '.*';
        }
      } else {
        out += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      continue;
    }
    out += /[\\^$+?.()|{}\[\]]/.test(char) ? `\\${char}` : char;
  }

  out += '$';
  return new RegExp(out);
}

export function matchPattern(file, pattern) {
  return globToRegExp(pattern).test(normalizePath(file));
}

export function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function changedPaths(root, base = 'origin/main') {
  const calls = [
    ['diff', '--name-only', `${base}...HEAD`],
    ['diff', '--name-only'],
    ['diff', '--cached', '--name-only'],
  ];
  const files = [];

  for (const args of calls) {
    const result = run('git', args, { cwd: root, allowFailure: true });
    if (result.status === 0) {
      files.push(...result.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    }
  }

  return unique(files.map(normalizePath)).sort();
}

export function classifyPaths(paths, manifest) {
  const riskIndex = new Map(manifest.risk_order.map((risk, index) => [risk, index]));
  let risk = manifest.risk_order[0];
  const matches = [];
  const read = [];
  const gates = [];
  const manualEvidence = [];
  const matchedPaths = new Set();

  for (const trigger of manifest.triggers) {
    const filesForTrigger = paths.filter((file) => trigger.paths.some((pattern) => matchPattern(file, pattern)));
    if (filesForTrigger.length === 0) continue;
    filesForTrigger.forEach((file) => matchedPaths.add(file));
    matches.push(trigger.id);
    read.push(...(trigger.read ?? []));
    gates.push(...(trigger.gates ?? []));
    manualEvidence.push(...(trigger.manual_evidence ?? []));
    if ((riskIndex.get(trigger.risk) ?? 0) > (riskIndex.get(risk) ?? 0)) risk = trigger.risk;
  }

  if (paths.some((file) => !matchedPaths.has(file))) {
    if ((riskIndex.get(manifest.default_risk) ?? 0) > (riskIndex.get(risk) ?? 0)) risk = manifest.default_risk;
  }

  const tier = manifest.risk_tiers[risk];
  gates.unshift(...(tier.default_gates ?? []));
  manualEvidence.unshift(...(tier.manual_evidence ?? []));

  return {
    risk,
    independentReview: tier.independent_review,
    matches: unique(matches),
    read: unique(read),
    gates: unique(gates),
    manualEvidence: unique(manualEvidence),
  };
}

export function parseRemoteSlug(remoteUrl) {
  if (!remoteUrl) return null;
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');
  const ssh = trimmed.match(/github\.com[:/]([^/]+\/[^/]+)$/i);
  return ssh ? ssh[1] : null;
}

export function gitLastCommitDate(root, file) {
  const result = run('git', ['log', '-1', '--format=%cI', '--', file], { cwd: root, allowFailure: true });
  const value = result.stdout.trim();
  return value ? new Date(value) : null;
}

export function embeddedLastUpdated(text) {
  const patterns = [
    /Last updated:\s*(\d{4}-\d{2}-\d{2})/i,
    /Last verified:\s*(\d{4}-\d{2}-\d{2})/i,
    /Updated:\s*(\d{4}-\d{2}-\d{2})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return new Date(`${match[1]}T00:00:00Z`);
  }
  return null;
}

export function ageDays(date, now = new Date()) {
  if (!date || Number.isNaN(date.getTime())) return null;
  return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

export function evaluateStaleEntry({ entry, text, lastCommitDate, changed = false, now = new Date() }) {
  const embedded = embeddedLastUpdated(text);
  const referenceDate = embedded ?? lastCommitDate;
  const age = ageDays(referenceDate, now);
  const markerHits = (entry.markers ?? []).filter((marker) => text.includes(marker));
  const staleByAge = typeof age === 'number' && age > entry.max_age_days;
  const hasSignals = staleByAge || markerHits.length > 0;

  return {
    path: entry.path,
    kind: entry.kind,
    severity: entry.severity,
    ageDays: age,
    staleByAge,
    markerHits,
    changed,
    blocking: Boolean(changed && markerHits.length > 0),
    hasSignals,
  };
}

export function parseCommonArgs(argv) {
  const result = { paths: [], base: 'origin/main', json: false, write: null, run: false, plan: false, strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--path' && argv[i + 1]) result.paths.push(argv[++i]);
    else if (arg.startsWith('--path=')) result.paths.push(arg.slice(7));
    else if (arg === '--base' && argv[i + 1]) result.base = argv[++i];
    else if (arg.startsWith('--base=')) result.base = arg.slice(7);
    else if (arg === '--json') result.json = true;
    else if (arg === '--write' && argv[i + 1]) result.write = argv[++i];
    else if (arg.startsWith('--write=')) result.write = arg.slice(8);
    else if (arg === '--run') result.run = true;
    else if (arg === '--plan') result.plan = true;
    else if (arg === '--strict') result.strict = true;
  }
  result.paths = unique(result.paths.flatMap((item) => item.split(',')).map(normalizePath).filter(Boolean));
  return result;
}
