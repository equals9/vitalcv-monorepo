# Founder visual approval gate

**Status:** Active immediately  
**Owner:** Founder / product design  
**Applies to:** public-facing UI, homepage composition, marketing routes, shared public chrome, product demonstrations, motion systems, and design-system primitives intended for those surfaces.

This gate exists because VitalCV accumulated technically valid design work without a single owner for the final visual result. Green CI, design lint, accessibility checks, source-truth checks, and detailed implementation notes are necessary. They do **not** prove that a page is clear, memorable, attractive, or ready to represent the company.

## 1. Homepage direction discipline

### 1a. The 2026-08-15 homepage visual freeze (temporary)

The founder locked a homepage direction on 2026-08-15 — **Direction A**, constitution
amendment E, bake-off record at `design-lab/homepage-2026-08-direction-a/DECISION.md` —
after five homepage rewrites landed in one week (#1334, #1371, #1373, #1387 among them),
none implementing a founder-chosen direction.

Until this freeze lifts:

- **No homepage visual PR merges except the Direction A recomposition** implementing
  amendment E, and PRs it explicitly sequences.
- Copy, truth-contract, security, privacy, accessibility, production-outage, and
  data-loss fixes may proceed. Such fixes must avoid unrelated visual recomposition.
- The freeze **lifts** when all three exist, recorded here as a dated note:
  1. `FOUNDER VISUAL DECISION: GO` on the shipped recomposition at its merge SHA;
  2. the C3.1 five-second comprehension result filed in the evidence directory;
  3. funnel baseline collection started (PostHog key live).

**2026-09-30 — criterion 1 recorded; the freeze is still in force.** The founder gave
the visual GO in a Claude Code session and, asked whether that also waived criteria 2
and 3, answered that it is the visual GO only. Criterion by criterion:

1. **Recorded.** `FOUNDER VISUAL DECISION: GO` on the Direction A homepage as composed
   on `main` at `e04b2c3a6` (last homepage change `9d7191a7d`, #1484). **Production SHA
   not re-confirmed:** when the `9d7191a7d` rollout timed out at 600s, deploy-web run
   34994595738 (2026-09-15) found production still serving `24dd7c1a7`, and no run has
   confirmed a production SHA since. #1484 changed action hover/focus/disabled states
   only (rest and press byte-identical per its commit), so the two SHAs differ in
   interaction states, not composition. Confirm `vitalcv.com/api/version` before citing
   a production SHA.
2. **Open.** No `five-second-results.md` exists under `docs/design/evidence/`; run
   `docs/design/five-second-test-protocol.md` on the production render.
3. **Open.** #1415 made `NEXT_PUBLIC_POSTHOG_*` reach the client bundle; whether the key
   is set in the Railway web environment is not visible from the repository, and no
   baseline has been filed.

The freeze lifts when 2 and 3 are filed here as dated notes.

### 1b. Standing rule (survives the freeze)

**No new homepage visual direction without an explicit `FOUNDER VISUAL DECISION`.**
A homepage composition, register, or era change may not begin from taste, a reference
image, another lane's momentum, or "improving what's there." It begins from a founder
verdict recorded in the constitution (an EC-22 amendment) — the same bar as every
locked EC-20 row. Recomposition *within* the locked direction follows §2–§9 as usual.

The pre-UX-V1 freeze text that stood here (HorizontalCareerFilm era) is superseded;
its durable rules live on: no new page-level scroll owner without founder direction,
no duplicate-intent primitives (§7), no design-system-only public components without
a mounted consumer, and one named creative owner per surface (§2).

## 2. One creative owner per public surface

Every public-facing visual PR must name exactly one **creative owner** in its description.

The creative owner is accountable for the whole rendered result, including:

- hierarchy;
- composition;
- typography;
- spacing;
- imagery and product artifacts;
- motion;
- copy density;
- mobile recomposition;
- visual continuity with the rest of VitalCV;
- production verification.

Multiple agents may implement or review the work. They do not share creative ownership.

## 3. Required visual evidence

A public-facing visual PR may not be marked ready for review without all applicable evidence below.

### Law reference

- A **Design Handoff References** section in the PR body naming the EC clauses and
  EC-20/D/E rows the change implements (constitution preamble rule). A public visual
  PR that cannot name its rows is a new direction, and §1b applies.

### Static evidence

- Before and after at **1440 × 900**.
- Before and after at **390 × 844**.
- Final screenshot at **768 × 1024**.
- Final screenshot at **1728 × 1117** for wide-layout changes.
- A reduced-motion screenshot.
- A 200% zoom screenshot for layout changes.

### Motion evidence

For any motion, sticky, scroll-controlled, sliding, expanding, masking, or interactive-icon change:

- a short desktop recording;
- a short mobile recording;
- a reduced-motion recording or explicit static-fallback proof;
- proof that ordinary wheel, touch, keyboard, and browser navigation remain usable.

### Runtime evidence

- The affected route loaded from a production build.
- No hydration error.
- No failed CSS or JavaScript chunk.
- No horizontal page overflow.
- Keyboard focus is visible and unobscured.
- The route is checked after deployment at the exact merge SHA.

A list of tests is not a substitute for screenshots and recordings.

### A live review URL

A public-facing visual PR must publish its branch to the **review environment**
and put the URL in the PR before requesting the founder's decision:

```bash
gh workflow run deploy-review.yml -f ref=<branch> -f pr=<number>
```

Screenshots prove composition. They cannot prove that a control feels right
under the cursor, that motion reads at real speed, or that the page is pleasant
to use — and those are precisely what this gate exists to judge. The UX-V1
cutover was reviewed from stills plus a reviewer's localhost because no review
environment existed; that is no longer an acceptable answer.

The review environment has no database and no Clerk secret, so **signed-in and
write paths are expected to degrade there**. Say so in the PR rather than
presenting a degraded surface as a defect or a finished state. Setup, cost, and
the indexing refusals: `docs/deployment/review-environment.md`.

Review proves the design. It does **not** replace the post-deploy production
check at the exact merge SHA above — that stays mandatory.

## 4. Founder approval phrase

A public-facing visual PR must remain a draft until the founder reviews the rendered evidence.

The founder approval comment must contain exactly one of:

- `FOUNDER VISUAL DECISION: GO`
- `FOUNDER VISUAL DECISION: REVISE`
- `FOUNDER VISUAL DECISION: NO-GO`

Only `GO` permits the PR to become ready for merge.

An agent may not infer approval from silence, emoji, green CI, prior strategy documents, or approval of a different route.

## 5. Visual review scorecard

The PR description must answer these questions in plain language:

1. What does a first-time visitor understand in the first five seconds?
2. What is the single dominant visual object?
3. What is the single primary action?
4. What changed in the hierarchy compared with production?
5. What visual element is memorable after the page is closed?
6. What was removed because it competed with the main idea?
7. How does mobile recompose rather than merely shrink?
8. What happens with reduced motion and no JavaScript?
9. Which external interaction principles informed the work?
10. Which details were deliberately not copied?
11. Which source-truth or authorization boundaries constrain the presentation?
12. What would make this PR visually unsuccessful even if every test passed?

## 6. No library-only design milestones

A component library is not a customer outcome.

A new public-experience component must have:

- one canonical implementation path;
- a named live-route consumer;
- all required visual states;
- an owner;
- a removal or migration plan for any component it supersedes.

A PR that says “not mounted” must not be described as a public experience improvement.

Exceptions require a founder-approved issue that explains why the component must land before its consumer and when it will be mounted.

## 7. Duplicate-system rule

Before creating a component or stylesheet, search by both name and intent.

Examples of intent searches:

- eyebrow / disclosure label / expandable label;
- product action / CTA / animated button;
- evidence capsule / evidence card / proof packet;
- timeline / application events / handoff events;
- film / rail / scroll story / scene stage;
- source tabs / workflow tabs / source panels.

When two implementations exist:

1. Identify every consumer.
2. Choose one canonical implementation.
3. Migrate consumers.
4. Delete the duplicate in the same program.
5. Add a regression guard when recurrence is likely.

Do not solve duplication by adding a third wrapper.

## 8. Public-route design boundaries

This gate does not weaken VitalCV’s non-negotiable product constraints:

- no fabricated clinician or source state;
- no system error presented as a clinician finding;
- no employer decision implied by animation;
- no automatic credentialing, privileging, or hiring claim;
- no source-confirmed color used as decorative success theater;
- no inaccessible scroll trap;
- no required meaning hidden behind animation;
- no copied proprietary code, assets, fonts, or brand identity.

Truthfulness is the floor. Visual excellence is also required.

## 9. Merge checklist

A public-facing visual PR is mergeable only when:

- [ ] One creative owner is named.
- [ ] Duplicate-intent search is documented.
- [ ] A real route is changed or a founder-approved staging issue exists.
- [ ] Desktop and mobile before/after evidence is attached.
- [ ] Motion evidence is attached when applicable.
- [ ] Reduced-motion and keyboard behavior are shown.
- [ ] The visual review scorecard is complete.
- [ ] Source-truth, accessibility, claims, and performance gates pass.
- [ ] `FOUNDER VISUAL DECISION: GO` appears in the PR conversation.
- [ ] Exact-SHA production verification is planned.

## 10. Homepage recovery sequence

The current homepage recovery work must proceed in this order:

1. Freeze parallel homepage redesigns.
2. Inventory every live and duplicate homepage component.
3. Capture the current production experience at the required viewports.
4. Choose one canonical component system.
5. Produce a founder-reviewed static composition before another major implementation rewrite.
6. Implement one route in one branch with one creative owner.
7. Review desktop, mobile, motion, reduced motion, and real NPI behavior.
8. Merge only after founder GO.
9. Verify the exact SHA in production.
10. Delete superseded components, styles, branches, and stale doctrine.

This document governs Claude Code, Codex, and any other automated contributor.