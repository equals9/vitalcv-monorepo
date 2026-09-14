'use client';

import * as React from 'react';

/**
 * ActivationScene — the `.oba` island primitives for the onboarding routes'
 * Direction A register pass (styles/onboarding-activation.css).
 *
 * ObaRoot arms one-shot entrances AFTER hydration and only outside reduced
 * motion (EC-4/EC-25: the server frame, no-JS frame, and reduced-motion frame
 * are the complete composition — the hidden entrance state exists only under
 * `.oba-armed`, and only for stages that mount after arming, i.e. phase/step
 * changes, never the first paint). EC-29: single-shot, nothing loops — F.1's
 * ambient-loop exception is scoped to `/` and deliberately not extended here.
 *
 * ObaBadge is the Option 1 "Chart & Badge" drawn pictogram (2026-08-16 theme
 * ruling): a clinician ID badge, 2px stroke, blank identity bars. Decorative
 * and aria-hidden; it depicts no source, count, person, or result (EC-25
 * applies to pictograms exactly as to scenes).
 */

export function ObaRoot({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    // Motion is an enhancement: no matchMedia (older engines, test DOMs)
    // means never armed — the complete frame simply stands.
    if (!el || typeof window.matchMedia !== 'function') return undefined;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      el.classList.toggle('oba-armed', !reduced.matches);
    };
    apply();
    reduced.addEventListener?.('change', apply);

    return () => {
      reduced.removeEventListener?.('change', apply);
      // Unmount leaves the finished frame, never the armed-hidden one.
      el.classList.remove('oba-armed');
    };
  }, []);

  return (
    <div ref={ref} className={`oba${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

/**
 * A one-shot entrance stage. Mounted content lands on the next frame; a
 * safety timer lands it unconditionally so a transition that never paints can
 * strand nothing. Re-key on phase/step to replay exactly once per change.
 */
export function ObaStage({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => el.classList.add('is-in'));
    });
    const settle = window.setTimeout(() => el.classList.add('is-in'), 700);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(settle);
    };
  }, []);

  return (
    <div ref={ref} className={`oba-stage${className ? ` ${className}` : ''}`} {...rest}>
      {children}
    </div>
  );
}

/** The drawn ID-badge pictogram. Blank bars only — never a fact. */
export function ObaBadge() {
  return (
    <svg
      className="oba-badge"
      viewBox="0 0 56 56"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {/* badge frame */}
      <rect className="oba-badge-frame" x="10" y="8" width="36" height="42" rx="3" />
      {/* punched lanyard slot */}
      <rect className="oba-badge-frame" x="24" y="13" width="8" height="3" rx="1.5" />
      {/* empty photo frame */}
      <rect className="oba-badge-frame" x="16" y="21" width="10" height="12" rx="1" />
      {/* blank identity bars */}
      <rect className="oba-badge-bar" x="30" y="23" width="10" height="2.5" rx="1.25" />
      <rect className="oba-badge-bar" x="30" y="29" width="7" height="2.5" rx="1.25" />
      <rect className="oba-badge-bar" x="16" y="38" width="24" height="2.5" rx="1.25" />
      {/* accent band — signal indigo, decorative */}
      <path className="oba-badge-accent" d="M10 45h36" />
    </svg>
  );
}
