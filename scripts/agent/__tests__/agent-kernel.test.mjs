import test from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyPaths,
  evaluateStaleEntry,
  globToRegExp,
  matchPattern,
  parseRemoteSlug,
} from '../lib.mjs';

const manifest = {
  default_risk: 'tier_1',
  risk_order: ['tier_0', 'tier_1', 'tier_2'],
  risk_tiers: {
    tier_0: { default_gates: [], independent_review: 'not_required', manual_evidence: [] },
    tier_1: { default_gates: ['typecheck'], independent_review: 'optional', manual_evidence: ['exercise'] },
    tier_2: { default_gates: ['typecheck'], independent_review: 'recommended_not_gate', manual_evidence: ['exercise boundary'] },
  },
  triggers: [
    {
      id: 'agent',
      paths: ['docs/agent/**', 'scripts/agent/**'],
      risk: 'tier_0',
      read: ['docs/agent/README.md'],
      gates: ['kernel-test'],
      manual_evidence: [],
    },
    {
      id: 'trust',
      paths: ['packages/domain-evidence/src/trust-computing/**'],
      risk: 'tier_2',
      read: ['docs/trust-computing/PTC_ARCHITECTURE_MAP.md'],
      gates: ['trust-test'],
      manual_evidence: ['determinism'],
    },
  ],
};

test('glob matcher handles ** and exact filenames', () => {
  assert.equal(matchPattern('docs/agent/workflows/plan.md', 'docs/agent/**'), true);
  assert.equal(matchPattern('apps/api/backend/Dockerfile', '**/Dockerfile'), true);
  assert.equal(matchPattern('Dockerfile', '**/Dockerfile'), true);
  assert.equal(matchPattern('apps/web/page.tsx', 'docs/agent/**'), false);
  assert.equal(globToRegExp('packages/*/src/**').test('packages/domain-evidence/src/a/b.ts'), true);
});

test('agent-only changes remain tier 0', () => {
  const result = classifyPaths(['docs/agent/README.md', 'scripts/agent/context.mjs'], manifest);
  assert.equal(result.risk, 'tier_0');
  assert.deepEqual(result.gates, ['kernel-test']);
});

test('unmatched paths receive the default risk', () => {
  const result = classifyPaths(['package.json'], manifest);
  assert.equal(result.risk, 'tier_1');
  assert.deepEqual(result.gates, ['typecheck']);
});

test('classification escalates to the highest matched risk and de-duplicates gates', () => {
  const result = classifyPaths([
    'docs/agent/README.md',
    'packages/domain-evidence/src/trust-computing/compiler.ts',
  ], manifest);

  assert.equal(result.risk, 'tier_2');
  assert.equal(result.independentReview, 'recommended_not_gate');
  assert.deepEqual(result.matches, ['agent', 'trust']);
  assert.deepEqual(result.gates, ['typecheck', 'kernel-test', 'trust-test']);
  assert.ok(result.manualEvidence.includes('determinism'));
});

test('existing stale debt warns but only changed marker debt blocks strict mode', () => {
  const entry = {
    path: 'legacy.md',
    kind: 'legacy',
    max_age_days: 30,
    severity: 'warning',
    markers: ['OpenClaw'],
  };

  const old = new Date('2026-01-01T00:00:00Z');
  const now = new Date('2026-08-20T00:00:00Z');
  const unchanged = evaluateStaleEntry({ entry, text: 'Use OpenClaw', lastCommitDate: old, changed: false, now });
  const changed = evaluateStaleEntry({ entry, text: 'Use OpenClaw', lastCommitDate: old, changed: true, now });

  assert.equal(unchanged.hasSignals, true);
  assert.equal(unchanged.blocking, false);
  assert.equal(changed.blocking, true);
});

test('GitHub remote slug parsing supports SSH and HTTPS', () => {
  assert.equal(parseRemoteSlug('git@github.com:ctol3r/vitalcv.git'), 'ctol3r/vitalcv');
  assert.equal(parseRemoteSlug('https://github.com/ctol3r/vitalcv.git'), 'ctol3r/vitalcv');
  assert.equal(parseRemoteSlug(''), null);
});
