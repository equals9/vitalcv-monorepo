# Security policy

VitalCV is a healthcare credentialing platform. We take reports about this
codebase and its production surfaces seriously, and we would rather hear about a
problem from you than from an incident.

## Reporting a vulnerability

**Please report privately. Do not open a public issue, pull request, or
discussion for a security problem.**

Two private channels, either is fine:

1. **GitHub Security Advisories** — [open a private report][advisory]. This is
   preferred: it keeps the discussion attached to the repository and private
   until we publish.
2. **Email** — <security@vitalcv.com>, the same address published on
   [vitalcv.com/trust](https://vitalcv.com/trust).

[advisory]: https://github.com/equals9/vitalcv-monorepo/security/advisories/new

Useful things to include, as far as you have them: what you were able to do,
which surface you did it against, and the smallest sequence that reproduces it.
A finding phrased as an outcome ("an unauthenticated caller can read X") is more
actionable than one phrased as a file. If you only have a suspicion, send the
suspicion — we would rather triage a false positive than miss a real one.

## What we ask

- **No public disclosure before a fix.** Give us a chance to close it first. If
  you have a disclosure deadline, say so in your first message and we will work
  to it rather than around it.
- **Do not access, modify, or retain data that is not yours.** If a report
  requires demonstrating access to real records, stop at the point where the
  access is demonstrated and tell us — do not enumerate, download, or keep the
  data.
- **Do not run destructive or degrading tests against production**, including
  writes, deletions, credential re-issuance, load or denial-of-service testing,
  or anything that mutates another person's record. Read-only proof is enough.
- **No social engineering, phishing, or physical access attempts** against
  VitalCV staff, clinicians, employers, or our vendors.

We will not pursue legal action against anyone who reports in good faith within
these bounds.

## Scope

In scope:

- `vitalcv.com` and `api.vitalcv.com`
- This repository's application code under `apps/` and `packages/`
- Our CI/CD and release configuration under `.github/`

Out of scope:

- Third-party services we depend on (identity, payments, hosting, analytics).
  Report those to the vendor; tell us too if the impact lands on VitalCV.
- Findings that only assert a version number without a reachable impact on a
  VitalCV surface.
- Anything reachable only with credentials or access you were given for another
  purpose.

## What happens next

We aim to acknowledge a report within **3 business days** and to give you an
initial assessment — including whether we can reproduce it and our severity read
— within **10 business days**. If a fix will take longer than that, we will tell
you what the timeline looks like rather than going quiet.

We do not currently run a paid bug bounty. We are glad to credit you in the
advisory if you want the credit, and equally glad not to if you do not.

## What this repository does and does not claim

`docs/security/` contains our own gap inventories, rollout runbooks, and
scorecards. They are **self-assessments and honest gap registers — not
certifications, not third-party audits, and not attestations of any regulatory
or accreditation standard.** They record what is enforced, what is running in
shadow mode, what is frozen by a baseline, and what is still open. Please read
them that way, and note that security findings in this repository go stale
quickly — treat any dated statement as a hypothesis to re-verify.

Reproduction-level detail for controls that are not yet enforcing is
deliberately withheld from the public documents and tracked internally.
