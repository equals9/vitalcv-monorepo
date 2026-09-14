/**
 * conflicting-pr-sweep.test.ts
 *
 * Covers scripts/check-conflicting-prs.mjs and its workflow.
 *
 * Truth contracts:
 *   - Drafts are NOT filtered out. #1081 — the PR this sweep exists for — was
 *     itself a draft, so a draft filter would have missed the founding case.
 *   - A conflicting PR with zero check runs is `invisible`; with check runs it
 *     is merely `conflicting`. The distinction is the whole point: the first
 *     reads as "nothing has run yet", the second does not.
 *   - Unknown mergeability is reported as unknown, never assumed clean.
 *   - The workflow is a report, not a gate: no `pull_request` trigger, and the
 *     scheduled path must not pass --fail-on-findings.
 *   - The workflow_dispatch input is passed through env, never interpolated
 *     into the shell command.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  classifyPr,
  hoursSince,
  isConflicting,
  isUnknownMergeability,
  renderReport,
} from '../../../scripts/check-conflicting-prs.mjs';

const WORKFLOW_PATH = resolve(__dirname, '../../../.github/workflows/conflicting-pr-sweep.yml');
const SCRIPT_PATH = resolve(__dirname, '../../../scripts/check-conflicting-prs.mjs');

const NOW = Date.parse('2026-08-08T00:00:00Z');

describe('conflict detection', () => {
  it('treats either conflict signal as conflicting', () => {
    // mergeable_state carries lifecycle values ('draft', 'blocked', 'behind')
    // that can mask the merge state, so `mergeable: false` must count alone.
    expect(isConflicting({ mergeable: false, mergeableState: 'draft' })).toBe(true);
    expect(isConflicting({ mergeable: null, mergeableState: 'dirty' })).toBe(true);
    expect(isConflicting({ mergeable: true, mergeableState: 'clean' })).toBe(false);
    expect(isConflicting({ mergeable: true, mergeableState: 'blocked' })).toBe(false);
  });

  it('reports uncomputed mergeability instead of guessing', () => {
    expect(isUnknownMergeability({ mergeable: null, mergeableState: 'unknown' })).toBe(true);
    expect(isUnknownMergeability({ mergeable: undefined, mergeableState: 'clean' })).toBe(true);
    expect(isUnknownMergeability({ mergeable: true, mergeableState: 'clean' })).toBe(false);
    // Unknown must never be classified as ok.
    expect(classifyPr({ mergeable: null, mergeableState: 'unknown', checkRunCount: 0 })).toBe('unknown');
  });
});

describe('classifyPr', () => {
  it('separates invisible from merely conflicting by check-run count', () => {
    expect(classifyPr({ mergeable: false, mergeableState: 'dirty', checkRunCount: 0 })).toBe('invisible');
    expect(classifyPr({ mergeable: false, mergeableState: 'dirty', checkRunCount: 3 })).toBe('conflicting');
  });

  it('classifies a conflicting DRAFT as invisible — the #1081 case', () => {
    // The real #1081 payload shape: draft, dirty, no check runs on head.
    expect(
      classifyPr({ mergeable: false, mergeableState: 'dirty', checkRunCount: 0 }),
    ).toBe('invisible');
  });

  it('leaves healthy PRs alone', () => {
    expect(classifyPr({ mergeable: true, mergeableState: 'clean', checkRunCount: -1 })).toBe('ok');
    expect(classifyPr({ mergeable: true, mergeableState: 'unstable', checkRunCount: -1 })).toBe('ok');
  });
});

describe('hoursSince', () => {
  it('floors to whole hours and never goes negative', () => {
    expect(hoursSince('2026-08-07T20:30:00Z', NOW)).toBe(3);
    expect(hoursSince('2026-08-08T01:00:00Z', NOW)).toBe(0);
  });
});

describe('renderReport', () => {
  const rows = [
    {
      number: 1081,
      title: 'feat(activation): durable clinician profile',
      url: 'https://github.com/equals9/vitalcv-monorepo/pull/1081',
      draft: true,
      base: 'main',
      updatedAt: '2026-08-07T00:00:00Z',
      checkRunCount: 0,
      level: 'invisible' as const,
    },
    {
      number: 900,
      title: 'chore: something',
      url: 'https://github.com/equals9/vitalcv-monorepo/pull/900',
      draft: false,
      base: 'main',
      updatedAt: '2026-08-07T22:00:00Z',
      checkRunCount: 2,
      level: 'conflicting' as const,
    },
  ];

  it('names the invisible PR, its draft state, and its idle time', () => {
    const out = renderReport(rows, { now: NOW });
    expect(out).toContain('#1081');
    expect(out).toContain('24h');
    // Draft state is shown rather than used to filter.
    expect(out).toMatch(/\| yes \|/);
    expect(out).toContain('#900');
  });

  it('says plainly that re-running checks cannot fix it', () => {
    const out = renderReport(rows, { now: NOW });
    expect(out).toMatch(/merge the base branch/i);
    expect(out).toMatch(/re-running checks cannot fix this/i);
  });

  it('states plainly what green means, and what red means', () => {
    const clean = renderReport(
      [{ number: 1, title: 't', url: 'u', draft: false, base: 'main', updatedAt: '2026-08-08T00:00:00Z', checkRunCount: -1, level: 'ok' as const }],
      { now: NOW },
    );
    expect(clean).toContain('No PR is currently in the invisible state.');
    expect(clean).toMatch(/Green means no PR is in the invisible state/);
    // And with a finding present, the report says the run failed and why.
    expect(renderReport(rows, { now: NOW })).toMatch(/This run FAILS because a PR is running zero gates/);
  });
});

describe('an invisible PR fails the run; nothing else does', () => {
  const workflow = readFileSync(WORKFLOW_PATH, 'utf-8');
  const script = readFileSync(SCRIPT_PATH, 'utf-8');

  it('has no pull_request trigger, so it can never gate a PR', () => {
    expect(workflow).not.toMatch(/^\s+pull_request(_target)?:/m);
    expect(workflow).toMatch(/^\s+schedule:/m);
    expect(workflow).toMatch(/workflow_dispatch:/);
  });

  it('fails on the scheduled path — report-only is the opt-out, not the default', () => {
    // Regression guard for the reversal: the scheduled path must NOT suppress
    // the exit code. A green sweep while a PR is silently ungated is the
    // lying-monitor failure this tool exists to treat.
    const [manualBranch, elseBranch] = (
      workflow.split('if [ "${REPORT_ONLY:-false}" = "true" ]; then')[1] ?? ''
    ).split('else');
    expect(manualBranch).toContain('--report-only');
    expect(elseBranch).not.toContain('--report-only');
  });

  it('only the invisible class drives the exit code', () => {
    // conflicting-but-gated is visible on the PR; unknown clears itself.
    expect(script).toMatch(/const invisible = rows\.filter\(\(r\) => r\.level === 'invisible'\)\.length/);
    expect(script).toMatch(/if \(invisible > 0 && !hasFlag\('--report-only'\)\)/);
    expect(script).not.toMatch(/level === 'conflicting'[^\n]*exitCode/);
  });

  it('reads the dispatch input through env, never interpolated into the shell', () => {
    expect(workflow).toMatch(/REPORT_ONLY:\s*\$\{\{\s*inputs\.report_only\s*\}\}/);
    // No `${{ ... }}` inside the run: block's node invocation.
    expect(workflow).not.toMatch(/node scripts\/check-conflicting-prs\.mjs.*\$\{\{/);
  });

  it('requests only read permissions', () => {
    expect(workflow).toMatch(/pull-requests:\s*read/);
    expect(workflow).toMatch(/checks:\s*read/);
    expect(workflow).not.toMatch(/:\s*write/);
  });

  it('keeps stdout parseable under --json by routing annotations to stderr', () => {
    // Regression: annotations were appended to stdout after the JSON array, so
    // `node check-conflicting-prs.mjs --json | jq` failed with "Extra data".
    expect(script).toMatch(/const annotate = asJson \? console\.error : console\.log/);
  });

  it('does not filter drafts out of the sweep', () => {
    // A `draft` filter on the listing would silently reintroduce the #1081 gap.
    expect(script).not.toMatch(/filter\([^)]*!\s*\w*\.?draft/);
    expect(script).toMatch(/DRAFTS ARE INCLUDED ON PURPOSE/);
  });
});
