// @vitest-environment jsdom

/**
 * Landmark and heading contract (EC-5, the accessibility floor).
 *
 * Measured on production 2026-09-15 with read-only page loads:
 *
 *   /onboarding rendered with NO <h1> and NO <main>. The server shell is the
 *   `checking` phase of GetReadySurface — a spinner and a <noscript> block —
 *   and the hydrated h1 ("Start with your NPI…") only arrives client-side.
 *   A no-JS visitor, a crawler, and a screen reader landing pre-hydration
 *   all got a page whose first heading was the aside's h2.
 *
 *   The shared Footer's <nav> carried no aria-label, so every interior route
 *   exposed two navigation landmarks a screen reader could not tell apart
 *   ("navigation", "navigation"), while the homepage's own footer nav was
 *   labelled "Footer".
 *
 * Fixes pinned here are ARIA and heading LEVEL only — no words and no classes
 * changed (EC-9 forbids touching onboarding heading copy; the strategy brief
 * owns it). The rendered assertions use the repo's renderToStaticMarkup
 * pattern; the source-level sweep exists because several of the edited
 * components (holder chrome, issuer portal, ops engine) need signed-in
 * providers to mount, and a landmark-name regression there is a one-line
 * attribute drop that a source assertion catches with no fixture.
 */

import fs from 'node:fs';
import path from 'node:path';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import Footer from '@/components/layout/Footer';
import GetReadySurface from '@/app/get-ready/GetReadySurface';
import VerifierGuidePage from '@/app/verify/guide/page';
import { IdentityOnboardingStep } from '@/components/onboarding/OnboardingFlowSteps';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/onboarding',
  useSearchParams: () => new URLSearchParams(),
}));

const WEB_ROOT = process.cwd();

function read(rel: string): string {
  return fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8');
}

/** Every <nav …> opening tag in a rendered document, with its attributes. */
function navOpeningTags(html: string): string[] {
  return html.match(/<nav\b[^>]*>/g) ?? [];
}

function count(html: string, tag: string): number {
  return (html.match(new RegExp(`<${tag}\\b`, 'g')) ?? []).length;
}

describe('shared Footer — navigation landmark is named', () => {
  const html = renderToStaticMarkup(<Footer />);

  it('renders exactly one <nav>, labelled "Footer"', () => {
    const navs = navOpeningTags(html);
    expect(navs).toHaveLength(1);
    expect(navs[0]).toMatch(/aria-label="Footer"/);
  });

  it('uses the same label as the homepage footer, so both announce identically', () => {
    const easyHome = read('components/home/easy/EasyHome.tsx');
    expect(easyHome).toMatch(/<nav[^>]*aria-label="Footer"/);
  });
});

describe('/onboarding (GetReadySurface) — h1 and main in the server shell', () => {
  // renderToStaticMarkup produces the `checking` phase: no effects run, so
  // this is exactly the HTML production serves before hydration and the HTML
  // a no-JS visitor keeps.
  const html = renderToStaticMarkup(<GetReadySurface />);

  it('renders exactly one <main> landmark', () => {
    expect(count(html, 'main')).toBe(1);
  });

  it('renders exactly one <h1> in the no-JS fallback, with its original words and classes', () => {
    expect(count(html, 'h1')).toBe(1);
    expect(html).toContain(
      '<h1 class="text-sm font-semibold text-[var(--vt-text-primary)]">JavaScript is needed to connect a workspace.</h1>',
    );
  });

  it('keeps the activation-path aside heading at h2 (it is not the page heading)', () => {
    expect(html).toMatch(/<h2[^>]*>Your record opens the next move\.<\/h2>/);
  });

  it('labels every <nav> it renders (there are none — the chrome supplies navigation)', () => {
    for (const tag of navOpeningTags(html)) expect(tag).toMatch(/aria-label="/);
  });

  it('is wrapped by nothing that would nest a second <main> from RootChrome', () => {
    const rootChrome = read('components/layout/RootChrome.tsx');
    expect(rootChrome).toMatch(/<div id="main-content" tabIndex=\{-1\}/);
  });
});

describe('/onboarding/identity and /readiness (StepShell) — main landmark', () => {
  it('renders exactly one <main> and one <h1>', () => {
    const html = renderToStaticMarkup(<IdentityOnboardingStep guestMode={false} returnTo={null} />);
    expect(count(html, 'main')).toBe(1);
    expect(count(html, 'h1')).toBe(1);
  });
});

describe('/verify/guide — in-page nav is named', () => {
  const html = renderToStaticMarkup(<VerifierGuidePage />);

  it('labels its <nav> and renders one <main>', () => {
    const navs = navOpeningTags(html);
    expect(navs.length).toBeGreaterThan(0);
    for (const tag of navs) expect(tag).toMatch(/aria-label="/);
    expect(count(html, 'main')).toBe(1);
  });
});

describe('every <nav> in the swept components carries an aria-label (source sweep)', () => {
  // The 2026-09-15 sweep of unlabeled <nav> elements outside app/_archive.
  // HeroAppPreview and OpsEngineClient are absent on purpose: their <nav>s
  // were not navigation (a decorative product mock, a role="tablist" strip)
  // and were changed to <div>, which the last test pins.
  const FILES = [
    'components/layout/Footer.tsx',
    'app/verify/guide/page.tsx',
    'components/auth/AuthDisclosureCard.tsx',
    'components/clinician/MobileBottomNav.tsx',
    'components/holder/HolderDesktopNav.tsx',
    'components/issuer/IssuerPortal.tsx',
    'components/proof/LanePanel.tsx',
    'components/ui/portal-switcher.tsx',
  ];

  for (const rel of FILES) {
    it(`${rel}: each <nav opening tag has aria-label`, () => {
      const src = read(rel);
      // JSX opening tags may span lines; capture up to the first `>`.
      const tags = src.match(/<nav\b[\s\S]*?>/g) ?? [];
      expect(tags.length, `${rel} should still render a <nav>`).toBeGreaterThan(0);
      for (const tag of tags) {
        expect(tag, `unlabeled <nav> in ${rel}: ${tag}`).toMatch(/aria-label=/);
      }
    });
  }

  it('non-navigation strips are not <nav> landmarks', () => {
    expect(read('components/marketing/HeroAppPreview.tsx')).not.toMatch(/<nav\b/);
    const ops = read('components/ops-engine/OpsEngineClient.tsx');
    expect(ops).not.toMatch(/<nav\b/);
    expect(ops).toMatch(/role="tablist" aria-label="Engine surfaces"/);
  });
});
