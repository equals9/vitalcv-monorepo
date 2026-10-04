# VitalCV Micro-Interactions Specification

**Status:** DESIGN — not landed. Public-facing motion requires the founder visual gate
(`docs/ops/FOUNDER_VISUAL_GATE.md`) before any of this ships.
**Authority:** `docs/design/VITALCV_EXPERIENCE_CONSTITUTION.md` — EC-3, EC-4, EC-5, EC-20 (locked
rows), EC-29. Where this spec and the originating brief disagree, the Constitution won; §0 records
every such correction.
**Executes:** DG-5.2, DG-5.3, DG-5.5, DG-5.6, DG-6.3, DG-6.7, DG-7.2, DG-7.5
(`DESIGN_GODMODE_MASTER_TASKLIST.md`). This is not a parallel motion system — it is the
implementation of that tasklist's motion rows.
**Date:** 2026-08-16

---

## 0. Corrections to the brief

Six requested behaviours conflict with locked law or with what is actually in the repo. Each is
designed the corrected way below. None of these are style preferences — five cite a LOCKED EC-20
row or a Class A clause, and one is a factual correction about the codebase.

### 0.1 There is no red-orange clinician accent, and no clinician/employer accent split

The brief specifies primary buttons in `#D92800` on clinician surfaces and `#4F46E5` on employer
surfaces.

`#D92800` **does not appear anywhere in `apps/web`** — not in a stylesheet, not in a component, not
in a token. `#4F46E5` appears only in five unmigrated legacy files. The canonical accent is
`--vt-accent: #4338CA`, and `apps/web/styles/themes/index.css` documents at length why it is one
value product-wide:

> the accent WAS the ink, so `--primary` and `--accent` resolved to near-black and every primary
> action on every public route rendered monochrome … which is why `/employers` had a brand colour
> and `/` did not.

A per-audience accent split is the exact defect CD-W2 was written to remove. Worse, EC-20's locked
interaction row makes the split impossible in principle: **indigo "carries the focus ring and the
editorial atmosphere, and is never a status colour"** — it is not a surface-identity colour either.

**Designed instead:** one accent. Primary action is EC-20's locked warm-paper inverse instrument
(`--vt-action-primary-bg` / `--vt-action-primary-fg`), identical on clinician and employer surfaces.
Indigo appears only as the focus ring. If per-audience accent is genuinely wanted, it is a founder
amendment to a locked EC-20 row, not a micro-interaction decision.

### 0.2 The easing curve would be the fourth competing curve

The brief specifies `cubic-bezier(0.2, 0, 0, 1)`. The house curve is
`cubic-bezier(0.2, 0.8, 0.2, 1)`, defined as `--vt-ease-system` in `styles/tokens.css` and used
literally at ~15 call sites in `globals.css` alone. DG-5.2 names the same curve.

**Designed instead:** `--vt-ease-system` everywhere. The brief's exit curve
(`cubic-bezier(0.4, 0, 1, 1)`) already exists as `--ease-accelerate` and is kept.

### 0.3 The stated durations are outside the Class A bands — and so are the existing tokens

EC-29 (Class A, CI-enforceable) locks four bands: **80–150ms control feedback · 150–250ms state
transition · 250–450ms product transformation · 450–800ms rare narrative.**

- The brief's 120–180ms hover/press straddles the control and state bands. Corrected to **120ms**.
- The brief's 300–400ms entrances fit the transformation band. **Kept.**
- More seriously: `styles/tokens.css` declares *"DURATION RANGE: 280ms – 420ms (no motion outside
  this band)"* and defines `--duration-instant: 280ms`. Every hover in the product is currently
  ~2.3× the top of EC-29's control band, and the token layer makes a compliant hover unexpressible.
  That comment is stale and contradicts Class A law.

**Designed instead:** four duration tokens named for the EC-29 bands (§1), added rather than
substituted, so existing consumers of `--duration-*` are untouched. Correcting the stale
280–420ms comment in `tokens.css` is called out in §5 as a follow-up, not silently changed here.

### 0.4 Cards may not gain a shadow on hover

The brief asks for "a soft 1-layer shadow" on card hover. EC-20's card grammar row is LOCKED:
**"Solid hairline-ruled panels, radius 0–3px, no shadows."** `check-design-lint.ts` LINT-06
independently rejects any `box-shadow` that is not `none` or a token.

**Designed instead:** the hover lift is carried by a surface step + a hairline darkening + a 2px
translate. This is *more* legible than a shadow on warm paper, and it survives grayscale (EC-5).

### 0.5 "Status pills" cannot be pills

The brief asks for status pills on `/status`, `/trust`, `/trust/attribution`. EC-20's shape row
(amended A-2) is LOCKED: **"a pill is never a state marker"**, cross-referencing EC-4. The pill
silhouette is reserved for word-labels — source names, owner chips — precisely so that the
silhouette carries meaning.

**Designed instead:** `.vt-state-chip` — a near-sharp (2px) chip carrying **glyph + word**, per
EC-4's "every state renders as glyph + word." The dot is decorative reinforcement, never the
carrier. Renaming matters here: a "pill" component name will reintroduce the shape later.

### 0.6 The hero source diagram may not loop, and must not depict a check that isn't running

Two independent problems with the requested 6s ambient loop:

1. EC-29 is LOCKED: **"Nothing loops except a loading skeleton, a system-status pulse, or a source
   check that is genuinely running."** An illustrative NPPES → State board → Federal list sequence
   is none of the three.
2. EC-3: "No treatment — colour, motion, composition, chrome — may imply more certainty than the
   underlying data supports." A repeating animation of sources resolving into a filled profile
   depicts verification work that is not happening for the person watching. This is the brief's own
   stated red line — *"Nothing should ever imply a verification, check, or approval that hasn't
   actually happened"* — and the requested loop crosses it.

**Designed instead:** a **single-shot** sequence on first view, carrying EC-20's mandated
self-labelling ("Illustration — not a live result"), settling to a completed static state and never
replaying. The same sequence, driven by real per-request state, is legitimate on a surface where
checks are genuinely running; that is a different component and is out of scope here.

### 0.7 Factual note: the `/verify` reveal bug is not on `/verify`

The brief names a critical bug where `/verify` strands content at low opacity when its entrance
animation never fires. I checked all four verify routes — `app/verify/page.tsx`,
`app/verify/[npi]/page.tsx`, `app/verify/layout.tsx`, `app/design/verify/page.tsx`. **None has any
entrance animation, reveal class, or `opacity: 0` initial state.** The only opacity uses on
`/verify` are a hover affordance and two `disabled:opacity` utilities, all correct.

The **bug class is real and worth fixing** — it is just somewhere else:

- `styles/career-loop-home.css:423` — `[data-clh-reveal]{opacity:0;transform:translateY(20px)}`,
  revealed only by an IntersectionObserver in `CareerLoopHome.tsx`. Reduced-motion is handled;
  **JS failure is not.** If hydration throws or the observer never runs, that content is
  permanently invisible with no recovery path.
- `styles/easy-home.css` — 27 further `opacity: 0` reveal origins on the **live** homepage
  (`components/home/easy/`).

§2 fixes the class, not the misattributed instance. This is the single highest-value item in the
document: it is a total-content-loss failure mode on the live homepage, and it is invisible in
every test that runs with working JS.

---

## 1. The motion contract

All keyframes **must** live in `apps/web/styles/motion.css` — `check-design-lint.ts` LINT-03 fails
the build on `@keyframes` in any other file. Utilities go in `styles/utilities.css` inside
`@layer utilities`. Cascade is `@import` order in `app/globals.css`.

### 1.1 Tokens — add to `styles/tokens.css`

```css
:root {
  /* ── EC-29 motion bands (Class A). Named for the band, not for a feeling, so a
     reviewer can check compliance by reading the token. These are ADDITIVE: the
     existing --duration-* tokens keep their values and their consumers. ──────── */
  --vt-dur-control:   120ms;  /* 80–150ms  · control feedback: hover, press, focus */
  --vt-dur-state:     200ms;  /* 150–250ms · state transition: chevrons, chips, header */
  --vt-dur-transform: 350ms;  /* 250–450ms · product transformation: entrances, panels */
  --vt-dur-narrative: 600ms;  /* 450–800ms · rare narrative: the single-shot hero */

  --vt-stagger-step:  60ms;   /* sibling entrance offset; ≤3 children (DG-5.6) */

  /* Easing. --vt-ease-system already exists; aliased here for intent at call sites. */
  --vt-ease-enter: var(--vt-ease-system);          /* cubic-bezier(0.2, 0.8, 0.2, 1) */
  --vt-ease-exit:  var(--ease-accelerate);         /* cubic-bezier(0.4, 0, 1, 1) */
}
```

Do **not** write `var(--vt-dur-control, 120ms)`. A `var()` fallback is not a safety net — it hides a
missing token and silently ships two different values from the same call site.

### 1.2 The one reduced-motion rule

`globals.css:1001` already carries a global `transition-duration: 0.01ms !important` reset. Every
pattern below is additionally written so its **static end state is the default** — reduced-motion
removes movement, never content. No pattern needs its own reduced-motion block except where the
animation is the only thing setting a final value; those are marked.

---

## 2. Foundation — the reveal guard (fixes §0.7)

**The rule: CSS never hides content that only JS can bring back.**

The hidden state is scoped behind a class that JS itself installs. If the script never runs, the
selector never matches, and every element renders at its natural opacity — visible, in place,
readable. This is the guard the brief asked for, expressed so that the *failure mode is visibility*.

### CSS — `styles/utilities.css`

```css
@layer utilities {
  /* Nothing here hides content unless `.vt-js` is on <html>. The class is set by
     the reveal hook AFTER it has successfully installed an observer — so a thrown
     hook, a disabled script, or an unsupported IntersectionObserver all land on
     "fully visible", never on "blank section". */
  .vt-js [data-vt-reveal]:not([data-vt-seen]) {
    opacity: 0;
    transform: translateY(14px);
  }

  [data-vt-reveal] {
    transition:
      opacity   var(--vt-dur-transform) var(--vt-ease-enter),
      transform var(--vt-dur-transform) var(--vt-ease-enter);
    transition-delay: var(--vt-reveal-delay, 0ms);
  }

  [data-vt-seen] { opacity: 1; transform: none; }

  /* Reduced motion: the guard class is still applied, so we must explicitly
     restore — this is one of the marked cases from §1.2. */
  @media (prefers-reduced-motion: reduce) {
    .vt-js [data-vt-reveal]:not([data-vt-seen]) { opacity: 1; transform: none; }
    [data-vt-reveal] { transition: none; transition-delay: 0ms; }
  }
}
```

### Hook — `apps/web/hooks/useReveal.ts`

```ts
'use client';

import { useEffect } from 'react';

interface RevealOptions {
  /** Fraction of the element visible before it reveals. EC-29 single-shot. */
  threshold?: number;
  /** Root margin passed to the observer. */
  rootMargin?: string;
}

/**
 * Single-shot scroll reveal (DG-5.6). One primitive, repo-wide.
 *
 * Contract: this hook is the ONLY thing that may add `.vt-js` to <html>. The
 * hidden state in CSS is scoped behind that class, so every failure path —
 * script blocked, hydration error before this effect, no IntersectionObserver —
 * leaves content visible rather than stranded at opacity 0.
 */
export function useReveal({ threshold = 0.2, rootMargin = '0px' }: RevealOptions = {}): void {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('[data-vt-reveal]:not([data-vt-seen])'),
    );
    if (nodes.length === 0) return;

    // No observer support: mark everything seen and never opt into the hidden state.
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((n) => n.setAttribute('data-vt-seen', ''));
      return;
    }

    // Opt into the hidden state only now that we know we can undo it.
    document.documentElement.classList.add('vt-js');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute('data-vt-seen', '');
          observer.unobserve(entry.target); // single-shot: never re-trigger
        });
      },
      { threshold, rootMargin },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [threshold, rootMargin]);
}
```

### JSX

```tsx
'use client';
export function ThreeThings() {
  useReveal();
  return (
    <section>
      {items.map((item, i) => (
        <article
          key={item.id}
          data-vt-reveal
          style={{ '--vt-reveal-delay': `${Math.min(i, 2) * 60}ms` } as React.CSSProperties}
        >
          {/* … */}
        </article>
      ))}
    </section>
  );
}
```

**Accessibility.** Content is in the DOM and in the accessibility tree from first paint; the reveal
only animates a transform. No `aria-live` — nothing is announced, because nothing changed
semantically. Reduced-motion renders the final composition immediately.

**Performance.** `opacity` + `transform` only; both composited. Observers disconnect after firing,
so there is no scroll-time work once a section has been seen. Stagger caps at 3 (`Math.min(i, 2)`)
per DG-5.6 — an 8-card grid with a 60ms step would take 480ms to finish, past the EC-29 band.

**Migration.** `[data-clh-reveal]` and the 27 `easy-home.css` reveal origins should be converted to
`[data-vt-reveal]`, deleting their bespoke observers. That migration is its own PR — it touches the
live homepage and needs the visual gate.

---

## 3. The interactions

### 3.1 Primary button — hover / press / focus

Per §0.1, one instrument on both audiences. Per EC-20 A-2, **radius 0** on every public action.

```css
/* styles/utilities.css */
@layer utilities {
  .vt-action {
    --vt-action-lift: 0px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 40px;          /* painted box (EC-20 A-3) */
    padding: 0 20px;
    border: 1px solid transparent;
    border-radius: 0;          /* EC-20 A-2: an action is square */
    font-size: 16px;
    font-weight: 400;
    background: var(--vt-action-primary-bg);
    color: var(--vt-action-primary-fg);
    transform: translateY(var(--vt-action-lift));
    transition:
      background-color var(--vt-dur-control) var(--vt-ease-enter),
      transform        var(--vt-dur-control) var(--vt-ease-enter);
  }

  /* 2px transparent ring so the TARGET measures 44px while the painted box
     measures 40px (EC-5 + EC-20 A-3). */
  .vt-action { outline: 2px solid transparent; outline-offset: 2px; }

  @media (hover: hover) {
    .vt-action:hover { --vt-action-lift: -1px; background: var(--vt-action-primary-bg-press); }
  }

  .vt-action:active { --vt-action-lift: 0px; transform: scale(0.98); }

  .vt-action:focus-visible {
    outline: 2px solid var(--vt-focus-ring);
    outline-offset: 2px;
  }

  .vt-action:disabled,
  .vt-action[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
    --vt-action-lift: 0px;
  }
}
```

**`@media (hover: hover)` is not optional.** 78 hand-written hover rules in this repo latch on
touch — a tapped element keeps its hover state until the next tap elsewhere. Tailwind v4 auto-guards
its 458 `hover:` utilities; hand-written CSS like this must guard itself.

**Accessibility.** Focus ring is indigo — EC-20's one sanctioned use of the accent. Never
`outline: none` (EC-5). Disabled state uses `aria-disabled` on links and `disabled` on buttons; both
are styled, and `aria-disabled` keeps the control focusable so a screen-reader user can discover why
it is unavailable.

**Performance.** `transform` and `background-color` only. No `will-change` — a 1px lift on a
composited transform does not need a layer promotion, and a permanent `will-change` on every button
costs more than it saves.

### 3.2 Secondary / outlined button + arrow nudge

```css
@layer utilities {
  .vt-action--secondary {
    background: transparent;
    border-color: var(--vt-border);
    color: var(--vt-text-primary);
    transition:
      background-color var(--vt-dur-control) var(--vt-ease-enter),
      border-color     var(--vt-dur-control) var(--vt-ease-enter),
      transform        var(--vt-dur-control) var(--vt-ease-enter);
  }

  @media (hover: hover) {
    .vt-action--secondary:hover {
      background: color-mix(in srgb, var(--vt-text-primary) 4%, transparent);
      border-color: var(--vt-text-secondary);
    }
  }

  /* The glyph moves, not the label — the text stays fixed so the line never reflows. */
  .vt-glyph {
    display: inline-block;
    transition: transform var(--vt-dur-control) var(--vt-ease-enter);
  }
  @media (hover: hover) {
    :is(.vt-action, .vt-link, .vt-card):hover .vt-glyph { transform: translateX(2px); }
  }
}
```

```tsx
<a className="vt-action vt-action--secondary" href="/explore">
  Browse roles
  <span className="vt-glyph" aria-hidden="true">→</span>
</a>
```

**Accessibility.** The arrow is `aria-hidden` — it is decoration, and a screen reader announcing
"Browse roles right arrow" is noise. The link text alone must be a complete destination label.

### 3.3 NPI input — focus, digit counter, invalid input

The counter is the honest part of this interaction: it reports *what you typed*, and makes no claim
about whether the NPI is real. Reaching 10/10 enables submission; it does not mean recognised.

```css
@layer utilities {
  .vt-field {
    border: 1px solid var(--vt-border);
    background: var(--vt-surface);
    transition:
      border-color var(--vt-dur-control) var(--vt-ease-enter),
      box-shadow   var(--vt-dur-control) var(--vt-ease-enter);
  }
  .vt-field:focus-visible,
  .vt-field:focus { border-color: var(--vt-accent); outline: none; }
  .vt-field:focus-visible { outline: 2px solid var(--vt-focus-ring); outline-offset: 2px; }

  /* Counter. Mono + tabular-nums (EC-20 mono row) so 0→10 never shifts width. */
  .vt-counter {
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--vt-text-muted);
    transition: color var(--vt-dur-state) var(--vt-ease-enter);
  }
  .vt-counter[data-complete='true'] { color: var(--vt-text-primary); }

  .vt-counter__n {
    display: inline-block;
    animation: vt-tick var(--vt-dur-control) var(--vt-ease-enter) both;
  }

  .vt-field[data-invalid='true'] { animation: vt-nudge 240ms var(--vt-ease-enter) both; }

  @media (prefers-reduced-motion: reduce) {
    .vt-counter__n,
    .vt-field[data-invalid='true'] { animation: none; }
  }
}
```

```css
/* styles/motion.css — LINT-03: keyframes live here and nowhere else. */

/* One accepted digit registers. Fill-mode `both` so the end state holds even if
   the animation is interrupted mid-flight by fast typing. */
@keyframes vt-tick {
  from { opacity: 0; transform: translateY(3px); }
  to   { opacity: 1; transform: none; }
}

/* Rejected keystroke. 2px × 2, horizontal only — a correction, not an alarm.
   Deliberately NOT a red flood: nothing invalid has been submitted yet. */
@keyframes vt-nudge {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-2px); }
  75%      { transform: translateX(2px); }
}
```

```tsx
'use client';
import { useCallback, useId, useRef, useState } from 'react';

export function NpiField() {
  const [digits, setDigits] = useState('');
  const [invalid, setInvalid] = useState(false);
  const countId = useId();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const next = raw.replace(/\D/g, '').slice(0, 10);
    if (next.length === digits.length && raw !== digits) {
      // A keystroke was rejected — nudge, then clear so it can fire again.
      setInvalid(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setInvalid(false), 240);
    }
    setDigits(next);
  }, [digits]);

  const complete = digits.length === 10;

  return (
    <>
      <input
        className="vt-field"
        inputMode="numeric"
        autoComplete="off"
        pattern="[0-9]*"
        maxLength={10}
        value={digits}
        onChange={onChange}
        data-invalid={invalid || undefined}
        aria-describedby={countId}
      />
      {/* key={} restarts the tick animation on each accepted digit. */}
      <p id={countId} className="vt-counter" data-complete={complete}>
        <span key={digits.length} className="vt-counter__n">{digits.length}</span>/10 digits
      </p>
    </>
  );
}
```

**Accessibility.** The counter is wired via `aria-describedby`, so it is read on focus and on
demand — not shouted on every keystroke. **No `aria-live`**: a polite region firing ten times during
typing is unusable with a screen reader, and the information is already available in the field.
Reduced-motion drops both the tick and the nudge; the count still updates, and the invalid keystroke
is still simply not inserted.

**Truth note.** The counter must never turn green, and 10/10 must never render a check. Ten digits
is a length, not a recognition — colouring it as success would be exactly the "certainty theatre"
EC-3 bans. The brief asked for success green here; this is the one place I have quietly overridden
it on truth grounds rather than shape grounds, so it is flagged explicitly. Weight and ink carry
completion instead.

### 3.4 Submit — loading → success / error

```css
@layer utilities {
  .vt-action { min-width: var(--vt-action-minw, 205px); } /* width never changes */

  .vt-action[data-busy='true'] .vt-action__label { opacity: 0; }
  .vt-action[data-busy='true'] .vt-action__spinner { opacity: 1; }

  .vt-action__label,
  .vt-action__spinner {
    transition: opacity var(--vt-dur-state) var(--vt-ease-enter);
  }
  .vt-action__spinner {
    position: absolute;
    opacity: 0;
    width: 14px; height: 14px;
    border: 1.5px solid currentColor;
    border-top-color: transparent;
    border-radius: 9999px;                 /* a spinner is not an action; pill rule N/A */
    animation: vt-spin 600ms linear infinite;
  }

  .vt-formmsg { animation: vt-msg-in var(--vt-dur-state) var(--vt-ease-enter) both; }

  @media (prefers-reduced-motion: reduce) {
    .vt-action__spinner { animation-duration: 1800ms; }  /* slowed, not removed:
        it is the only signal that work is in flight (EC-4 permits a genuine
        in-progress loop under EC-29). */
    .vt-formmsg { animation: none; }
  }
}
```

```css
/* styles/motion.css */
@keyframes vt-spin { to { transform: rotate(360deg); } }
@keyframes vt-msg-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
```

```tsx
<button
  className="vt-action"
  data-busy={state === 'submitting' || undefined}
  aria-busy={state === 'submitting'}
  disabled={state === 'submitting'}
>
  <span className="vt-action__label">Send</span>
  <span className="vt-action__spinner" aria-hidden="true" />
</button>

<p role="status">{state === 'submitting' ? 'Sending…' : null}</p>
{error ? <p className="vt-formmsg" role="alert">{error}</p> : null}
```

**Accessibility.** `aria-busy` on the control plus a `role="status"` region for the transition;
errors go in `role="alert"` and move focus to the first invalid field. The spinner is `aria-hidden`
— the status region already says it.

**Truth note.** No check-draw-in on the NPI submit. On `/contact` a check is honest (the message was
sent); on an NPI lookup a check next to a credential reads as verification. The success state there
is a quiet confirmation panel with words.

**Performance.** Fixed `min-width` (205px, EC-20 A-3's dominant-action minimum) means the crossfade
causes zero layout shift. `opacity` and `rotate` only.

### 3.5 Card hover

Per §0.4, no shadow.

```css
@layer utilities {
  .vt-card {
    background: var(--vt-surface);
    border: 1px solid var(--vt-border-subtle);
    border-radius: 2px;                    /* EC-20 card grammar: 0–3px */
    transition:
      background-color var(--vt-dur-control) var(--vt-ease-enter),
      border-color     var(--vt-dur-control) var(--vt-ease-enter),
      transform        var(--vt-dur-control) var(--vt-ease-enter);
  }
  @media (hover: hover) {
    .vt-card:hover {
      background: var(--vt-surface-subtle);
      border-color: var(--vt-border);
      transform: translateY(-2px);
    }
  }
  /* Focus lands on the inner link; the card shows the ring. */
  .vt-card:has(a:focus-visible) { outline: 2px solid var(--vt-focus-ring); outline-offset: 2px; }
}
```

```tsx
<article className="vt-card">
  <h3>
    {/* Stretched link: whole card clickable, ONE tab stop, real link semantics. */}
    <a className="after:absolute after:inset-0" href={role.href}>{role.title}</a>
  </h3>
  <p>{role.org}</p>
  <span className="vt-glyph" aria-hidden="true">→</span>
</article>
```

**Accessibility.** The stretched-link pattern gives a full-card target without a `div onClick`,
without a duplicate tab stop, and without breaking open-in-new-tab. Text inside the card stays
selectable outside the pseudo-element's stacking context.

### 3.6 Review-journey carousel

```css
@layer utilities {
  .vt-rail {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scroll-behavior: smooth;
    scrollbar-width: none;
    /* 48px peek: the next card is visibly cut, which is the affordance. */
    padding-inline-end: 48px;
    overscroll-behavior-x: contain;   /* no back-navigation gesture hijack */
  }
  .vt-rail::-webkit-scrollbar { display: none; }
  .vt-rail > * { scroll-snap-align: start; flex: 0 0 auto; }

  @media (prefers-reduced-motion: reduce) { .vt-rail { scroll-behavior: auto; } }

  .vt-dot { background: var(--vt-border); transition: all var(--vt-dur-state) var(--vt-ease-enter); }
  .vt-dot[aria-current='true'] { background: var(--vt-text-primary); width: 20px; }
}
```

```tsx
<div role="group" aria-roledescription="carousel" aria-label="How employer review works">
  <ul className="vt-rail" tabIndex={0}>
    {steps.map((s) => <li key={s.id}>{/* … */}</li>)}
  </ul>
  <button className="vt-action" onClick={page(-1)} aria-label="Previous step">←</button>
  <button className="vt-action" onClick={page(1)} aria-label="Next step">→</button>
</div>
```

**Accessibility.** `tabIndex={0}` on the scroll container is required — a keyboard-only user must be
able to reach and arrow-scroll an overflow region, and browsers do not focus it automatically.
Arrow buttons carry real labels. **Every card must remain reachable without the arrows**, since the
rail is native scroll.

**Performance.** Native scroll-snap — no scroll listener, no rAF loop, no scroll-jacking. This is
the cheapest possible implementation and the only one that keeps momentum scrolling on iOS.

### 3.7 State chip — the pulse

Per §0.5 this is a chip, not a pill. `status-pulse` already exists in `utilities.css` and is live at
2+ call sites — reused, not redefined.

```css
@layer utilities {
  .vt-state-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 2px;                 /* NOT a pill — EC-20 A-2 */
    border: 1px solid var(--vt-border-subtle);
    font-family: var(--font-geist-mono), ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--vt-text-primary);      /* EC-4: state words always in ink */
  }
  .vt-state-chip__dot { width: 6px; height: 6px; border-radius: 9999px; background: currentColor; }

  /* Only genuinely-running states pulse (EC-29). Static states never do. */
  .vt-state-chip[data-live='true'] .vt-state-chip__dot {
    animation: status-pulse 2s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .vt-state-chip[data-live='true'] .vt-state-chip__dot { animation: none; opacity: 1; }
  }
}
```

```tsx
<span className="vt-state-chip" data-live={state === 'serving' || undefined}>
  <span className="vt-state-chip__dot" aria-hidden="true" />
  <span aria-hidden="true">{GLYPH[state]}</span>
  {LABEL[state]}
</span>
```

**Accessibility.** Glyph + word + ink, per EC-4 — remove all colour and the state is still complete.
The dot is `aria-hidden` decoration. The pulse carries no meaning: `SERVING` is legible with the
animation removed, which is the test EC-4 sets.

**Performance.** `opacity` only on a 6px element — no layout, no paint beyond the dot. Pulsing only
`[data-live='true']` means a `/status` page with 30 chips animates the two that are actually live,
not all 30. Add `content-visibility: auto` on long chip lists so off-screen chips skip rendering
entirely.

### 3.8 Hero rotating word

```css
@layer utilities {
  .vt-rotator {
    display: inline-block;
    /* CLS = 0: the slot is sized to the longest word and never reflows. Set
       --vt-rotator-w from the longest string in the array, in ch. */
    inline-size: var(--vt-rotator-w);
    text-align: start;
    vertical-align: bottom;
  }
  .vt-rotator__word { display: inline-block; animation: vt-word-in 250ms var(--vt-ease-enter) both; }
  .vt-rotator__word[data-exiting='true'] { animation: vt-word-out 250ms var(--vt-ease-exit) both; }

  @media (prefers-reduced-motion: reduce) { .vt-rotator__word { animation: none; } }
}
```

```css
/* styles/motion.css */
@keyframes vt-word-in  { from { opacity: 0; transform: translateY(8px); }  to { opacity: 1; transform: none; } }
@keyframes vt-word-out { from { opacity: 1; transform: none; } to { opacity: 0; transform: translateY(-8px); } }
```

```tsx
'use client';
import { useEffect, useState } from 'react';

const WORDS = ['application', 'shift', 'role', 'state'] as const;

export function RotatingWord() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;                       // static first word, no interval
    const id = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2800);
    return () => clearInterval(id);
  }, [paused]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  return (
    <>
      {/* The sentence a screen reader gets: one stable, complete claim. */}
      <span className="sr-only">One profile. Every application.</span>
      <span
        className="vt-rotator"
        aria-hidden="true"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        style={{ '--vt-rotator-w': '11ch' } as React.CSSProperties}
      >
        <span key={i} className="vt-rotator__word">{WORDS[i]}</span>
      </span>
    </>
  );
}
```

**Accessibility.** The visible slot is `aria-hidden` and the sr-only sentence is static — a rotating
`aria-live` word would interrupt a screen-reader user every 2.8s. No `aria-live`, as the brief
correctly specified. Reduced-motion never starts the interval at all, so the first word simply
stands.

**Performance.** `visibilitychange` stops the timer on a hidden tab. Hover pauses so a reader can
finish the word. `inline-size` in `ch` on a fixed slot gives **CLS = 0** — verify the `ch` value
against the rendered font, since Geist's `ch` is not the same as the fallback's.

### 3.9 Section entrance reveal

Fully specified in §2 — one primitive, used everywhere. Do not build a per-component reveal.

### 3.10 Sticky header scroll state

```css
@layer utilities {
  .vt-header {
    position: sticky;
    top: 0;
    transition:
      background-color var(--vt-dur-state) var(--vt-ease-enter),
      border-color     var(--vt-dur-state) var(--vt-ease-enter);
    border-block-end: 1px solid transparent;
  }
  .vt-header[data-scrolled='true'] {
    background: var(--vt-frost-bg);
    backdrop-filter: blur(10px);            /* EC-20 glass row: chrome only */
    border-block-end-color: var(--vt-border-subtle);
  }
  /* Anchors clear the header — fixes /#npi landing underneath it. */
  :target, [id] { scroll-margin-top: 86px; }
}
```

```tsx
'use client';
useEffect(() => {
  const el = document.querySelector('.vt-header');
  const sentinel = document.querySelector('#vt-header-sentinel');
  if (!el || !sentinel) return;
  // IntersectionObserver on a sentinel — NOT a scroll listener.
  const io = new IntersectionObserver(
    ([e]) => el.setAttribute('data-scrolled', String(!e.isIntersecting)),
    { threshold: 1 },
  );
  io.observe(sentinel);
  return () => io.disconnect();
}, []);
```

**Performance.** A 1px sentinel observed by IntersectionObserver replaces a scroll handler entirely
— zero main-thread work per scroll frame. `backdrop-filter` is applied only in the scrolled state,
so the expensive filter is not live at rest. EC-20 permits frost on chrome; **never** apply it to an
evidence surface.

### 3.11 Mega-menu

```css
@layer utilities {
  .vt-menu { animation: vt-fade-in var(--vt-dur-state) var(--vt-ease-enter) both; }
  .vt-menu[data-closing='true'] { animation: vt-fade-out var(--vt-dur-state) var(--vt-ease-exit) both; }
  .vt-menu__col { animation: vt-rise var(--vt-dur-transform) var(--vt-ease-enter) both;
                  animation-delay: var(--vt-reveal-delay, 0ms); }

  .vt-burger__line { transition: transform var(--vt-dur-state) var(--vt-ease-enter); }
  [aria-expanded='true'] .vt-burger__line:nth-child(1) { transform: translateY(4px) rotate(45deg); }
  [aria-expanded='true'] .vt-burger__line:nth-child(2) { transform: translateY(-4px) rotate(-45deg); }

  @media (prefers-reduced-motion: reduce) {
    .vt-menu, .vt-menu__col { animation: none; }
  }
}
```

```css
/* styles/motion.css */
@keyframes vt-fade-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes vt-fade-out { from { opacity: 1; } to { opacity: 0; } }
@keyframes vt-rise     { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
```

`vt-rise` already exists in `styles/themes/index.css` with one consumer. Per LINT-03 it belongs in
`motion.css`; move it there rather than declaring a second copy.

**Accessibility — the load-bearing part.** Focus trapped while open; Escape closes and **returns
focus to the trigger**; `aria-expanded` on the button; `inert` (or `aria-hidden` + focus containment)
on the page behind. The icon state must resync on route change — a client-side navigation that
leaves the burger as ✕ while the menu is closed is a real defect. Reset on `pathname` change.

### 3.12 Accordion

```css
@layer utilities {
  .vt-acc__panel {
    display: grid;
    grid-template-rows: 0fr;
    transition: grid-template-rows var(--vt-dur-state) var(--vt-ease-enter);
  }
  .vt-acc[open] .vt-acc__panel { grid-template-rows: 1fr; }
  .vt-acc__panel > * { overflow: hidden; min-height: 0; }  /* 1fr floors at min-content
      without this — the row would never actually collapse. */

  .vt-acc__chevron { transition: transform var(--vt-dur-state) var(--vt-ease-enter); }
  .vt-acc[open] .vt-acc__chevron { transform: rotate(180deg); }

  @media (prefers-reduced-motion: reduce) {
    .vt-acc__panel, .vt-acc__chevron { transition: none; }
  }
}
```

```tsx
<details className="vt-acc">
  <summary>{q}</summary>
  <div className="vt-acc__panel"><div>{a}</div></div>
</details>
```

**Accessibility.** Native `<details>/<summary>` gives keyboard operation, the expanded state, and —
critically — **findability with browser in-page search**, which a JS accordion loses. Content is in
the DOM either way.

**Performance.** `grid-template-rows: 0fr → 1fr` animates without measuring height in JS. Note it is
*not* a compositor-only property — it triggers layout — but on a short answer panel that is far
cheaper than a rAF height loop, and it is the only approach that handles unknown content height. The
`min-height: 0` on the child is mandatory: a `1fr` track floors at min-content, so without it the
panel never collapses.

### 3.13 Hero source diagram — single-shot

Per §0.6: no loop, self-labelled, settles complete.

```css
@layer utilities {
  .vt-src[data-vt-seen] .vt-src__chip  { animation: vt-rise var(--vt-dur-transform) var(--vt-ease-enter) both; }
  .vt-src[data-vt-seen] .vt-src__arrow { animation: vt-grow-x var(--vt-dur-transform) var(--vt-ease-enter) both; }
  .vt-src__chip  { animation-delay: calc(var(--i) * 180ms); }
  .vt-src__arrow { animation-delay: calc(var(--i) * 180ms + 90ms); transform-origin: left center; }

  /* Reduced motion / no JS: the completed diagram, immediately. Nothing is
     hidden behind the animation — `both` holds the end state, and without
     [data-vt-seen] no animation is applied at all, so it renders finished. */
  @media (prefers-reduced-motion: reduce) {
    .vt-src[data-vt-seen] :is(.vt-src__chip, .vt-src__arrow) { animation: none; }
  }
}
```

```tsx
<figure className="vt-src" data-vt-reveal>
  {/* EC-20 illustration row: it says what it is. Not sr-only — visible. */}
  <figcaption>Illustration — not a live result</figcaption>
  {SOURCES.map((s, i) => (
    <div key={s} style={{ '--i': i } as React.CSSProperties}>
      <span className="vt-src__chip">{s}</span>
      <span className="vt-src__arrow" aria-hidden="true" />
    </div>
  ))}
</figure>
```

**Truth.** The visible caption is required by EC-20's locked illustration row and is not optional
polish. The chips must name real sources only as *sources read*, never with a confirmed mark — EC-3
bans a confirmed mark on gated (Nursys, FSMB) or non-integrated (NPDB, DEA, ABMS) sources, and this
diagram is a prime place for that to slip in.

**Performance.** Single-shot via the §2 reveal, so nothing animates off-screen and nothing runs
after first view. `vt-grow-x` (existing, in `themes/index.css`) is a `scaleX` transform — compositor
only, and cheaper than `stroke-dashoffset`, which the brief offered as an alternative but which
triggers paint on every frame.

---

## 4. Delete list

Ten keyframes have **zero consumers** anywhere in `apps`, `packages`, or `docs` — verified by
grepping each name across `.css`, `.tsx`, `.ts`, and `.md`, excluding its own declaration and build
caches.

| Keyframe | Declared in | Replaced by |
|---|---|---|
| `home-capsule-reveal` | `globals.css` | §2 reveal |
| `home-glyph-swap` | `styles/motion.css` | §3.8 `vt-word-in/out` |
| `home-state-in` | `styles/motion.css` | §2 reveal |
| `vcv-banner-slide-up` | `globals.css` | §3.4 `vt-msg-in` |
| `vcv-loading-step-enter` | `globals.css` | §3.4 |
| `vcv-stagger-in` | `globals.css` | §2 reveal (named in DG-5.6 as the thing to replace) |
| `vcv-loading-check` | `globals.css` | nothing — see note |
| `film-record-settle` | `styles/motion.css` | §2 reveal |
| `vcv-input-pulse` | `globals.css` | §3.3 `vt-tick` |
| `vcv-score-count` | `globals.css` | nothing — see note |

Notes before deleting:

- **`vcv-loading-check`** is a check-mark draw-in with no consumer. Deleting it is a small truth win
  as well as a cleanup — it is exactly the asset that gets reached for when someone wants a green
  check on a credential surface.
- **`vcv-input-pulse` and `vcv-score-count`** are referenced by *open* tasklist rows (DG-7.2, DG-5.7)
  as animations those tasks would use. The code is dead; the plan is not. §3.3 supersedes DG-7.2's
  use of `vcv-input-pulse`. `vcv-score-count` belongs to DG-5.7 (readiness ring), which this spec
  does not cover — delete the dead code and let DG-5.7 write what it needs, but update those two
  tasklist rows in the same PR so the plan does not cite deleted keyframes.

Not on the delete list, deliberately: `status-pulse` (2+ consumers, reused in §3.7), `vt-rise` and
`vt-grow-x` (1 consumer each, reused in §3.11/§3.13 — **move** to `motion.css` per LINT-03, do not
duplicate), `type-caret-blink` and the `aicon-*` family (live on homepage surfaces this spec does not
touch).

A further ~35 keyframes have exactly one consumer each and are consolidation candidates. That is
DG-5.3's keyframe audit, and it should not be folded into a micro-interactions PR — it touches
matcha, z1, kinetic, and wave-1501 surfaces at once.

---

## 5. Not designed here / follow-ups

1. **`tokens.css` motion comment is wrong.** *"DURATION RANGE: 280ms – 420ms (no motion outside this
   band)"* with `--duration-instant: 280ms` contradicts EC-29's 80–150ms control band and makes a
   compliant hover unexpressible. Every hover in the product is currently ~2.3× too slow. I added
   band-named tokens rather than editing the existing ones, because changing `--duration-instant`
   would silently retime ~15 call sites. Correcting that comment and retiming those sites is its own
   reviewed change.
2. **framer-motion is imported by 135 files.** The brief's "no animation libraries" is a migration
   (DG-5.4), not a constraint this spec can satisfy alone. Everything above is CSS-first and adds no
   library.
3. **Reveal migration.** Converting `[data-clh-reveal]` and the 27 `easy-home.css` reveal origins to
   §2 is the fix for the real stranded-content bug. It touches the live homepage and needs the
   founder visual gate.
4. **Per-audience accent (§0.1)** and **pill-shaped status markers (§0.5)**, if still wanted, are
   founder amendments to locked EC-20 rows — not implementable under current law.
5. **Verification.** Nothing here has been rendered. Landing any of it requires a production build,
   desktop + 390px evidence, and reduced-motion captures per the visual gate. Green design-lint is
   not evidence that the motion reads correctly.
