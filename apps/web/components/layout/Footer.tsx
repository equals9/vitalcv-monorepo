'use client';

import { FOOTER_NAV } from '@/components/layout/navDestinations';
import { isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Footer links are `text-xs`, so their line box is only 16px tall. The earlier
 * fix here lifted them to 24×24 and reasoned, correctly but to the wrong
 * document, from WCAG 2.2 AA 2.5.8 (Target Size, Minimum). 24px is the
 * EXTERNAL legal minimum. The house floor is EC-5 — "44px minimum touch
 * targets" — and EC-20's locked button-grammar row repeats it ("≥44px targets
 * locked via EC-5"). The constitution is the experience authority of record,
 * so where the two numbers disagree, 44 controls; 2.5.8 remains the floor we
 * must never fall through, not the bar we aim at.
 *
 * That gap was real debt: these links accounted for ~152 of the 253 sub-44px
 * targets the a11y route gate baselined across 20 public routes — the single
 * largest component-level contributor, guarded at the weaker number the whole
 * time (the guards-can-enforce-retired-doctrine pattern).
 *
 * `min-h-[44px]` grows the hit box, not the type: font size, colour and the
 * label's optical centring are unchanged; the link row simply gets taller.
 * Real 44px boxes are chosen over the padding/negative-margin trick
 * deliberately — with `gap-4` (16px) between wrapped rows, phantom hit areas
 * extending 14px from each side would overlap the neighbouring row's by 12px,
 * trading a visible-but-honest height increase for silent mis-taps.
 *
 * Both dimensions are asserted in footer-tap-targets at 44, so neither can
 * regress the way the width did while only the height was guarded.
 */
const FOOTER_LINK_CLASS =
  'inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-xs text-muted-foreground transition-colors hover:text-foreground';

/**
 * W1079 moved Trust and Status off the eyebrow bar into FOOTER_NAV, and this
 * renders it. The wave asks for them "behind a compact How it works or footer
 * path" — the footer is that path, and it is the honest place for them: a
 * visitor looking for what VitalCV does and does not decide is not choosing
 * between it and a job, they are checking a claim they have already read.
 * Reachable from every public surface, competing with nothing.
 *
 * The list itself lives in navDestinations.ts so the bar, the index menu and
 * this footer stay one information architecture rather than three arrays.
 */

export default function Footer() {
  const pathname = usePathname();

  if (!isPublicSurfacePath(pathname)) {
    return null;
  }

  return (
    <footer className="mt-auto shrink-0 border-t border-border bg-card">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} VitalCV
          </p>
          {/*
            * `flex-wrap` is load-bearing after W1079 took the row from six
            * links to eight. Without it the row is a single unwrapped line at
            * 390px and the last items hang past the viewport — and an
            * `overflow-x: hidden` ancestor means `scrollWidth - clientWidth`
            * still measures 0, so the e2e asserts element right edges instead.
            */}
          <nav
            aria-label="Footer"
            className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end"
          >
            {FOOTER_NAV.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={FOOTER_LINK_CLASS}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
