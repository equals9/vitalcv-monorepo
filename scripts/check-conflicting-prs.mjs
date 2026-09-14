#!/usr/bin/env node
/**
 * check-conflicting-prs.mjs — find open PRs that are silently running zero gates.
 *
 * The trap, discovered on #1081 (2026-08-07): a PR that conflicts with its base
 * cannot build its `refs/pull/N/merge` ref, and GitHub creates NO `pull_request`
 * check runs for it at all. There is no skip notice, no failing check, no
 * annotation — just an empty check list, which is exactly what a PR looks like
 * one second after it is opened. #1081 sat that way for a day while its stale
 * re-run attempts reported "queued" forever (the cancel API answers
 * `409 Cannot cancel a workflow re-run that has not yet queued`). Close/reopen
 * re-created nothing; an empty commit for a fresh SHA re-created nothing.
 * Merging the base branch and resolving the conflict fixed it instantly.
 *
 * This is the same family as the bug `check-workflow-path-filters.js` exists to
 * prevent — a required check that never reports — but it arrives from the
 * opposite direction: there, one gate is missing from a populated list; here,
 * the entire list is empty and nothing says why.
 *
 * DRAFTS ARE INCLUDED ON PURPOSE. Draft PRs run `pull_request` gates normally
 * and conflict exactly like any other PR — #1081, the case this script exists
 * for, was itself a draft. Filtering drafts out would have missed it.
 *
 * Usage:
 *   node scripts/check-conflicting-prs.mjs [--repo owner/name] [--json]
 *                                          [--fail-on-findings]
 *
 * Requires GITHUB_TOKEN (or GH_TOKEN) with read access to pull requests and
 * checks. In Actions the default token is enough with:
 *   permissions: { contents: read, pull-requests: read, checks: read }
 *
 * AN `invisible` FINDING FAILS THE RUN. `--report-only` opts out.
 *
 * This reverses the default this script shipped with (#1131), because the
 * justification given there did not survive contact with its own code. That
 * justification was: "with hundreds of open PRs some are always mid-conflict,
 * so failing on findings would be red permanently and ignored within a week."
 * True of the `conflicting` class — and the exit code never keyed on that
 * class. It keys on `invisible` alone, which is neither common nor transient:
 * a conflicting PR can never acquire check runs, so the state does not clear
 * on its own, and the live repo currently has zero.
 *
 * What the old default actually produced was a sweep that stayed GREEN while a
 * PR sat silently ungated — a monitor whose green means nothing, which is the
 * exact disease this whole line of work exists to treat. A job summary that
 * nobody opens is not a signal.
 *
 * The distinction is kept where it is real: `conflicting` and `unknown` are
 * reported and never fail the run. Only `invisible` — nothing ran, and nothing
 * else anywhere says so — is worth a red.
 */

const API = (process.env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/$/, '');
const TOKEN = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '';

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(name);
const optOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

/** How many PR detail requests to have in flight at once. */
const CONCURRENCY = 8;
/** `mergeable` is computed lazily; GitHub returns null while it works. */
const MERGEABILITY_RETRIES = 3;
const MERGEABILITY_RETRY_MS = 1500;

/* ------------------------------------------------------------------ *
 * Pure classification — the part worth testing, kept free of network. *
 * ------------------------------------------------------------------ */

/**
 * `mergeable === false` and `mergeable_state === 'dirty'` both mean conflicts.
 * Both are consulted because neither is reliable alone: `mergeable_state`
 * reports lifecycle states ('draft', 'blocked', 'behind', 'unstable') that can
 * mask the merge state, and `mergeable` is null whenever GitHub has not
 * finished computing it.
 */
export function isConflicting({ mergeable, mergeableState }) {
  return mergeable === false || mergeableState === 'dirty';
}

/** True while GitHub has not computed mergeability yet — report, never guess. */
export function isUnknownMergeability({ mergeable, mergeableState }) {
  return mergeable === null || mergeable === undefined || mergeableState === 'unknown';
}

/**
 * Classify one PR.
 *
 * - `invisible`  — conflicting AND zero check runs on its head SHA. The
 *                  pathology: nothing ran and nothing says so.
 * - `conflicting`— conflicting but some check runs exist (typically from a
 *                  `push` trigger on a branch matching ci.yml's patterns, which
 *                  fires independently of the merge ref). Still cannot merge,
 *                  but at least it does not read as un-run.
 * - `unknown`    — mergeability not yet computed after retries.
 * - `ok`         — not conflicting.
 */
export function classifyPr({ mergeable, mergeableState, checkRunCount }) {
  if (isConflicting({ mergeable, mergeableState })) {
    return checkRunCount === 0 ? 'invisible' : 'conflicting';
  }
  if (isUnknownMergeability({ mergeable, mergeableState })) return 'unknown';
  return 'ok';
}

/** Whole hours since `iso`, floored. `now` is injectable so tests are stable. */
export function hoursSince(iso, now = Date.now()) {
  return Math.max(0, Math.floor((now - Date.parse(iso)) / 3_600_000));
}

/** Markdown report. Same text goes to the job summary and to stdout. */
export function renderReport(rows, { now = Date.now() } = {}) {
  const invisible = rows.filter((r) => r.level === 'invisible');
  const conflicting = rows.filter((r) => r.level === 'conflicting');
  const unknown = rows.filter((r) => r.level === 'unknown');

  const lines = ['# Conflicting-PR sweep', ''];
  lines.push(
    `Scanned **${rows.length}** open pull requests: ` +
      `**${invisible.length}** running zero gates, ` +
      `**${conflicting.length}** conflicting but partially gated, ` +
      `**${unknown.length}** mergeability not yet computed.`,
    '',
  );

  if (invisible.length === 0) {
    lines.push('No PR is currently in the invisible state.', '');
  } else {
    lines.push(
      '## Running zero gates',
      '',
      'These conflict with their base branch, so GitHub creates **no** `pull_request`',
      'check runs for them. Their empty check list is indistinguishable from',
      '"just opened". Re-running checks cannot fix this — merge the base branch',
      'into the PR and resolve the conflicts.',
      '',
      '| PR | Title | Draft | Base | Idle |',
      '|---|---|---|---|---|',
    );
    for (const r of invisible) {
      const title = r.title.length > 60 ? `${r.title.slice(0, 57)}…` : r.title;
      lines.push(
        `| [#${r.number}](${r.url}) | ${title.replace(/\|/g, '\\|')} | ` +
          `${r.draft ? 'yes' : 'no'} | \`${r.base}\` | ${hoursSince(r.updatedAt, now)}h |`,
      );
    }
    lines.push('');
  }

  if (conflicting.length > 0) {
    lines.push(
      '## Conflicting, but some checks present',
      '',
      'Cannot merge, but they do not read as un-run — usually `push`-triggered runs',
      'on a branch matching a `push:` pattern.',
      '',
      ...conflicting.map(
        (r) => `- [#${r.number}](${r.url}) — ${r.checkRunCount} check run(s), idle ${hoursSince(r.updatedAt, now)}h`,
      ),
      '',
    );
  }

  if (unknown.length > 0) {
    lines.push(
      '## Mergeability not computed',
      '',
      'GitHub had not finished computing these when the sweep ran. Not a finding —',
      'recorded so the counts above add up.',
      '',
      ...unknown.map((r) => `- [#${r.number}](${r.url})`),
      '',
    );
  }

  lines.push(
    '---',
    '',
    invisible.length > 0
      ? 'This run FAILS because a PR is running zero gates. Merging the base branch into it ' +
        'is the only fix — re-running checks cannot create the missing runs.'
      : 'Green means no PR is in the invisible state. Conflicting-but-gated PRs and ' +
        'uncomputed mergeability are reported above and do not fail the run.',
  );

  return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Network                                                            *
 * ------------------------------------------------------------------ */

async function ghFetch(path) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'vitalcv-conflicting-pr-sweep',
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function listOpenPulls(repo) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const batch = await ghFetch(`/repos/${repo}/pulls?state=open&per_page=100&page=${page}`);
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Detail fetch, retrying only while mergeability is still being computed. */
async function fetchMergeState(repo, number) {
  let detail;
  for (let attempt = 0; attempt <= MERGEABILITY_RETRIES; attempt++) {
    detail = await ghFetch(`/repos/${repo}/pulls/${number}`);
    if (!isUnknownMergeability({ mergeable: detail.mergeable, mergeableState: detail.mergeable_state })) {
      break;
    }
    if (attempt < MERGEABILITY_RETRIES) await sleep(MERGEABILITY_RETRY_MS);
  }
  return detail;
}

async function countCheckRuns(repo, sha) {
  const res = await ghFetch(`/repos/${repo}/commits/${sha}/check-runs?per_page=1`);
  return res.total_count ?? 0;
}

/** Bounded-concurrency map — polite to the API, and the sweep stays one job. */
async function mapWithLimit(items, limit, fn) {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const repo = optOf('--repo', process.env.GITHUB_REPOSITORY ?? 'equals9/vitalcv-monorepo');
  if (!TOKEN) {
    console.error('No GITHUB_TOKEN / GH_TOKEN in the environment; cannot read pull requests.');
    process.exitCode = 1;
    return;
  }

  const pulls = await listOpenPulls(repo);

  const rows = await mapWithLimit(pulls, CONCURRENCY, async (pr) => {
    const detail = await fetchMergeState(repo, pr.number);
    const conflicting = isConflicting({
      mergeable: detail.mergeable,
      mergeableState: detail.mergeable_state,
    });
    // Only conflicting PRs need the second request — the count is meaningless
    // for the rest, and this keeps the sweep well inside the token's hourly
    // budget on a repo with hundreds of open PRs.
    const checkRunCount = conflicting ? await countCheckRuns(repo, detail.head.sha) : -1;
    return {
      number: detail.number,
      title: detail.title,
      url: detail.html_url,
      draft: Boolean(detail.draft),
      base: detail.base.ref,
      head: detail.head.sha,
      updatedAt: detail.updated_at,
      mergeable: detail.mergeable,
      mergeableState: detail.mergeable_state,
      checkRunCount,
      level: classifyPr({
        mergeable: detail.mergeable,
        mergeableState: detail.mergeable_state,
        checkRunCount,
      }),
    };
  });

  const asJson = hasFlag('--json');
  if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.log(renderReport(rows));
  }

  // Annotations go to stdout so Actions parses them as workflow commands — but
  // under --json stdout must stay parseable, so they move to stderr. (The
  // workflow never passes --json; this keeps the flag usable from a shell
  // pipeline, where appending log lines after the JSON made `| jq` fail.)
  const annotate = asJson ? console.error : console.log;
  for (const r of rows.filter((x) => x.level === 'invisible')) {
    annotate(
      `::warning title=PR #${r.number} is running zero gates::` +
        `Conflicts with ${r.base}, so GitHub created no pull_request check runs. ` +
        `Merge ${r.base} into the branch and resolve — re-running checks cannot fix it. ${r.url}`,
    );
  }

  if (process.env.GITHUB_STEP_SUMMARY) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${renderReport(rows)}\n`);
  }

  // Only `invisible` fails: conflicting-with-checks is visible on the PR itself
  // and clears when its author merges the base; uncomputed mergeability clears
  // by itself. An invisible PR clears only when a human is told about it.
  const invisible = rows.filter((r) => r.level === 'invisible').length;
  if (invisible > 0 && !hasFlag('--report-only')) {
    console.error(
      `\n${invisible} pull request(s) are running zero gates. This is not a flake and ` +
        'will not clear on its own — merge the base branch into each and resolve. ' +
        'Re-run with --report-only to report without failing.',
    );
    process.exitCode = 1;
  }
}

// Only run when invoked directly, so the pure helpers above stay importable.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  });
}
