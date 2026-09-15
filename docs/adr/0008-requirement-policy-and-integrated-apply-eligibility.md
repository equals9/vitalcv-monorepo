# ADR 0008: Requirement policy is not a precondition for integrated apply

- **Status:** Proposed — **founder decision required** (2026-08-26)
- **Date:** 2026-08-26
- **Context basis:** `origin/main` at `4759411e6` (= deployed production SHA). Predicate
  `apps/api/backend/src/services/opportunities/integratedApply.ts` and its enforcement in
  `applicationService.applyToOpportunity` (PR #1462). Requirement construction at
  `services/opportunities/opportunityTruth.ts:1490` (`buildRequirementList`) and the org-wide
  envelope on `OrganizationProfile.requirements` (`services/employers/pilotPolicy.ts`).
- **Deciders:** founder. Recorded by the acceptance-first lane; **not** implemented pending that ruling.

## Context

The Acceptance-First execution plan, Bundle 1, permits integrated application mode only when
**six** conditions hold. Five are unambiguous and are implemented in PR #1462:

1. the opportunity is employer-authored (`listingSource !== 'public_feed'`);
2. the organization is valid;
3. the recipient resolves server-side (the packet freezes a real organization name);
4. the integrated apply route is active;
5. the opportunity version can be sealed into the packet (`opportunityVersion = opp.updatedAt`).

The sixth — **"a supported requirement policy is present"** — is a semantic change to existing
behaviour, not a restatement of it. Implementing it silently would have changed what the product
does, so per the plan's execution rule 11 it is recorded here instead.

**What the code does today.** Requirements are built for every non-feed opportunity:

```
const requirements = isFeedListing ? [] : buildRequirementList(opportunity);
```

`buildRequirementList` reads the employer's stated requirements from the org-wide
`OrganizationProfile.requirements` envelope when one exists. When it does not, it falls back to
`buildFallbackRequirements()` — an **inference floor** (NPI, a `{state}` licence, sanctions-clear)
derived from the opportunity's state and requirement level, not from anything the employer said.
The envelope is set only at organization setup (`POST /api/employer/setup`); the opportunity
creation body has no `requirements` field at all. **Zero organizations currently have one.**

Requirements are also, today, purely explanatory: nothing in the apply path reads them, and a
clinician may apply to a role they do not yet satisfy. That is deliberate — MATCHA blockers are
soft, and requirement satisfaction is not employer acceptance.

## The decision required

**Should the absence of an employer-stated requirement policy make an opportunity ineligible for
integrated apply?**

### Option A — requirement policy NOT a precondition (recommended, and the current behaviour)

Integrated apply stays available to any employer-authored role. The inference floor continues to
carry comparison, labelled as VitalCV's inference rather than the employer's statement.

- **For:** the first real employer can post a role and receive an application on day one, without
  first completing an org-wide requirements envelope. Under Option B, the pilot's critical path
  gains a setup step that no employer has ever completed, on a route that is itself currently
  401-walled by the tenant guard for a brand-new organization — so Option B would ship integrated
  apply **inert**, which is how this repo has previously shipped built-and-dark lanes.
- **Against:** a clinician comparing themselves against an inference floor may read it as the
  employer's own requirement list. That is a **presentation** obligation, and it is already
  honoured — the floor is labelled, and feed rows publish nothing at all.

### Option B — requirement policy IS a precondition

An employer-authored role with no `OrganizationProfile.requirements` envelope would render as
external / not-applicable-through-VitalCV.

- **For:** every integrated application is then measured against something the employer actually
  stated, which is the stronger claim to make to a recipient.
- **Against:** it disables integrated apply for every organization as things stand, and couples
  the apply boundary to a setup surface that does not yet work self-serve.

## Consequences if Option B is chosen

Not a one-line change. It would require, in order:

1. a reachable way for an employer to state requirements (the tenant-guard gap on
   `/api/employer/setup` closes first, or requirements move onto the opportunity itself);
2. a definition of "supported" — which requirement types the pilot can actually evaluate;
3. `evaluateIntegratedApply` gaining a third ineligibility reason and its own refusal copy;
4. new negative tests, including one proving an employer-authored role with no envelope is
   refused and **writes nothing**.

## Decision

**Pending.** PR #1462 implements conditions 1–5 and deliberately leaves 6 unimplemented, so the
merged behaviour is Option A. If the founder rules for Option B, it lands as its own bundle with
the four steps above — never as an amendment folded into the boundary PR.

## Status of the related boundary

Independent of this ruling, and already enforced in PR #1462: **feed-copied listings are refused
on the write path.** That was the plan's own Bundle 1 acceptance gate ("leave feed listings
external") and required no new semantics — only enforcement of a contract the code already stated.
