import * as React from 'react';

import '@/styles/onboarding-activation.css';

// Session-sensitive tree (Wave 0.2): onboarding binds an NPI to the signed-in
// account, so it must render per-request. Production 18c9311 served this tree
// as a prerendered shell with s-maxage=31536000 — a year-long SHARED cache of
// a session-dependent page.
export const dynamic = 'force-dynamic';

// Register pass-through (Direction A, 2026-08-16): the onboarding surfaces
// own their `.oba` island composition (styles/onboarding-activation.css); the
// wrapper supplies the matching warm-paper ground so route transitions never
// flash a foreign surface. (Was the Calm Wave `mz mz-paper` frame.)
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div className="oba-ground min-h-screen">{children}</div>;
}
