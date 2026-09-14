'use client';

/**
 * GetReadySurface — the clinician access gate + first NPI binding.
 *
 * A ChatGPT-for-Clinicians-style gated flow, adapted to VitalCV's truth
 * contract. Every no-NPI empty state in the product (wallet, readiness,
 * prequalify ribbon) routes here. The flow:
 *
 *   checking → signed_out            (no Clerk session → sign in first)
 *            → already_bound         (workspace already has an NPI)
 *            → intro                 (signed in → "Confirm you're a clinician")
 *              → form → submitting → success | form+error
 *
 * The form carries two lanes (FormMode): the default NPI binding, and a no-NPI
 * preview lane for clinicians-in-training (→ student_success). A preview profile
 * is self-attested, never source-backed, and upgrades automatically on NPI bind.
 *
 * Binding is POST /api/profile/npi/bootstrap: the backend resolves the live
 * NPPES registry record, upserts the workspace PersonProfile, and emits an
 * audit event. Copy states the registry-identity match only — an NPPES match
 * and a self-attested profession are NOT license/identity proofing, and nothing
 * here presents them as a completed license check or a bare "Verified" status.
 *
 * REGISTER (design-only, 2026-08-16). The scene frame renders in the
 * Direction A / Homepage v4 register (`.oba`, styles/onboarding-activation.css;
 * constitution amendment E scope ruling + amendment F values + D.6's LOCKED
 * /onboarding rows): warm paper, Fraunces display, mono machine facts, the
 * paper-inverse primary action, hairline rules, the drawn ID-badge pictogram,
 * and one-shot stage entrances over a complete server frame. Evidence-register
 * components inside the success phase (OnboardingReadiness, EmailVerification)
 * keep their own truthful material — the frame is what this pass recomposes.
 * Every phase, fetch, storage, analytics, and honesty contract is unchanged.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Check, CheckCircle2, Loader2 } from 'lucide-react';
import {
  describeBootstrapError,
  isNpiBootstrapResult,
  summarizeBootstrapResult,
  validateNpi,
  type BoundIdentitySummary,
} from '@/lib/get-ready/npi-binding';
import EmailVerification from '@/components/get-ready/EmailVerification';
import { activationHeaderStage } from '@/lib/activation/headerStage';
import { OnboardingReadiness } from '@/components/onboarding/OnboardingReadiness';
import { checkNpi } from '@/lib/vital/npi';
import {
  buildCareerProfile,
  isOrganization,
  type ClinicianCareerProfile,
} from '@/lib/career-loop/profile';
import { readNpiHandoff, readNpiQueryHandoff, writeNpiHandoff } from '@/lib/onboarding/npiHandoff';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { FUNNEL_EVENTS, trackFunnelEvent } from '@/lib/analytics/funnel';
import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { ActivationPath } from '@/components/onboarding/ActivationPath';
import { ObaBadge, ObaRoot, ObaStage } from '@/components/onboarding/ActivationScene';
import { VisualScene } from '@/components/visual-scene/VisualScene';
import type { Bootstrap } from '@/components/home/evidence/evidenceCapsuleModel';
import type { TrustState } from '@/components/readiness/sourceCheckNarration';

type Phase =
  | 'checking'
  | 'signed_out'
  | 'already_bound'
  | 'intro'
  | 'form'
  | 'submitting'
  | 'success'
  | 'student_success'
  | 'load_error';

/**
 * Which lane the form is showing: the NPI binding (default) or the no-NPI
 * student / in-training preview lane. The preview lane is self-attested and
 * never source-backed — it starts a preview-only profile that upgrades
 * automatically when the clinician later binds an NPI.
 */
type FormMode = 'npi' | 'student';

/**
 * The clinician professions VitalCV onboards. Selecting one is a self-attested
 * role (it guides which source lanes apply downstream) — it is NOT a
 * license verification, and the copy says so. Clinicians-in-training with no NPI
 * onboard via the separate no-NPI preview lane (see FormMode 'student').
 */
const PROFESSIONS = [
  { value: 'physician', label: 'Physician (MD/DO)' },
  { value: 'nurse_practitioner', label: 'Nurse Practitioner' },
  { value: 'physician_assistant', label: 'Physician Assistant' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'registered_nurse', label: 'Registered Nurse' },
  { value: 'dentist', label: 'Dentist' },
] as const;

type Profession = (typeof PROFESSIONS)[number]['value'];

/** Bump when the services-agreement / attestation copy materially changes. */
const ATTESTATION_VERSION = 'v1';

const FAQS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'Who can confirm?',
    a: 'Practicing U.S. clinicians with an individual (Type 1) NPI — physicians (MD/DO), nurse practitioners, physician assistants, pharmacists, registered nurses, and dentists.',
  },
  {
    q: 'How does it work?',
    a: 'You enter your NPI. VitalCV matches it against the public NPPES registry to start your workspace. License, exclusion, and enrollment checks run separately on your readiness surface, each with its own source receipt.',
  },
  {
    q: 'What do I need?',
    a: 'Your 10-digit NPI. Optionally, a work email to corroborate the match with a possession signal. No documents required to get started.',
  },
  {
    q: 'Is this identity or license verification?',
    a: 'No. An NPPES match confirms your public registry identity record only. Government ID, liveness, and license verification are separate — VitalCV never presents an attestation or registry match as a completed license check.',
  },
];

/**
 * Honest next steps shown after a no-NPI preview profile is started. Guidance
 * only — none of these are source checks, and none imply a completed
 * verification. The source-backed readiness lane opens once an NPI is bound.
 */
const PREVIEW_NEXT_STEPS: ReadonlyArray<string> = [
  'Build your self-attested profile — add your program, training, and career goals.',
  'Explore what a source-backed VitalCV profile unlocks for clinicians, so you know what to expect.',
  'Connect your NPI the moment you receive it — that unlocks your source-backed readiness, publishing, and applications.',
];

export default function GetReadySurface() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [existingNpi, setExistingNpi] = useState<string | null>(null);
  const [profession, setProfession] = useState<Profession | null>(null);
  const [attested, setAttested] = useState(false);
  const [mode, setMode] = useState<FormMode>('npi');
  const [npiInput, setNpiInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BoundIdentitySummary | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  // Anonymous preview state (signed_out phase). The record comes from the
  // PUBLIC identity bootstrap + trust-state reads only — the same pair the
  // homepage uses — never the authenticated projection (#1074 boundary).
  const [guestStep, setGuestStep] = useState<
    'entry' | 'resolving' | 'resolved' | 'organization' | 'unavailable'
  >('entry');
  const [guestNpiInput, setGuestNpiInput] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [guestProfile, setGuestProfile] = useState<ClinicianCareerProfile | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/me/workspaces', { cache: 'no-store' });
        if (cancelled) return;
        if (res.status === 401) {
          setPhase('signed_out');
          // Record-first: an NPI carried from the homepage resolved state, a
          // previous visit, or a cross-origin arrival (the marketing site's
          // NPI form links here with ?npi=) resolves immediately — the
          // visitor sees their public record before any account ask. The
          // query param wins over storage: it is the fresher intent.
          const carried = readNpiQueryHandoff() ?? readNpiHandoff();
          if (carried) {
            setGuestNpiInput(carried);
            void resolveGuest(carried);
          }
          return;
        }
        if (!res.ok) {
          setPhase('load_error');
          return;
        }
        const data = (await res.json()) as {
          personProfile?: { npi?: string | null } | null;
          accountEmail?: string | null;
        };
        if (cancelled) return;
        if (typeof data.accountEmail === 'string') setAccountEmail(data.accountEmail);
        const npi = data.personProfile?.npi ?? null;
        if (npi) {
          setExistingNpi(npi);
          setPhase('already_bound');
        } else {
          // Continuity after sign-in: prefill the binding form with the NPI
          // the visitor already resolved anonymously (or carried in ?npi=),
          // so nothing is re-typed.
          const carried = readNpiQueryHandoff() ?? readNpiHandoff();
          if (carried) setNpiInput(carried);
          setPhase('intro');
        }
      } catch {
        if (!cancelled) setPhase('load_error');
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Anonymous record resolution — public reads only. Mirrors the homepage's
   * resolve pairing (identity is load-bearing, lanes are best-effort) and its
   * honest outcome mapping: individual | organization | unavailable. Never
   * calls POST /api/profile/npi/bootstrap or /api/ownership/claim — the bind
   * stays behind sign-in, unconditionally.
   */
  async function resolveGuest(raw: string) {
    const check = checkNpi(raw);
    if (check.validity !== 'valid' || !check.npi) {
      setGuestError(check.reason ?? 'Enter your 10-digit NPI.');
      return;
    }
    setGuestError(null);
    setGuestStep('resolving');
    // Funnel continuity after /passport's retirement (2026-08-07): this lane
    // is now the anonymous acquisition funnel. NPI_SUBMITTED marks the start;
    // the terminal states below fire RESULTS_DISPLAYED / DROPOFF_DETECTED —
    // the conversion pair the retired page was the only producer of. No NPI
    // is attached: a SHA-256 of a 10-digit number is brute-forceable in
    // seconds, so hashing it would not make it anonymous.
    trackFunnelEvent(FUNNEL_EVENTS.NPI_SUBMITTED);
    try {
      const [bootRes, trust] = await Promise.all([
        fetch(`/api/identity/bootstrap/${check.npi}`, { cache: 'no-store' }),
        fetch(`/api/trust-state/${check.npi}`, { cache: 'no-store' })
          .then((r) => (r.ok ? (r.json() as Promise<TrustState>) : null))
          .catch(() => null),
      ]);
      if (!mountedRef.current) return;
      if (!bootRes.ok) {
        setGuestStep('unavailable');
        return;
      }
      const boot = (await bootRes.json()) as Bootstrap;
      const profile = buildCareerProfile(check.npi, boot, trust);
      if (profile) {
        // Carry the NPI forward so the post-sign-in binding form prefills.
        writeNpiHandoff(check.npi);
        setGuestProfile(profile);
        setGuestStep('resolved');
        trackFunnelEvent(FUNNEL_EVENTS.RESULTS_DISPLAYED, { outcome: 'guest_record' });
        // KPI continuity: passport_viewed is a named pilot-ops funnel step
        // whose only producer was the retired /passport page. It now marks
        // the honest equivalent moment — the anonymous record actually
        // displayed (a stricter trigger than the old page-view, so the
        // count can only get more truthful, not inflated).
        void trackPilotEvent({
          eventType: UX_EVENTS.PASSPORT_VIEWED,
          route: '/onboarding',
          oncePerSession: true,
          message: 'Anonymous record displayed',
        });
      } else if (isOrganization(boot)) {
        setGuestStep('organization');
        trackFunnelEvent(FUNNEL_EVENTS.DROPOFF_DETECTED, {
          last_step: FUNNEL_EVENTS.NPI_SUBMITTED,
          dropoff_reason: 'error',
          outcome: 'organization',
        });
      } else {
        // The upstream contract collapses no-result / outage / rate-limit —
        // "unavailable" is a system state, not a finding about the NPI.
        setGuestStep('unavailable');
        trackFunnelEvent(FUNNEL_EVENTS.DROPOFF_DETECTED, {
          last_step: FUNNEL_EVENTS.NPI_SUBMITTED,
          dropoff_reason: 'error',
          outcome: 'unavailable',
        });
      }
    } catch {
      if (mountedRef.current) {
        setGuestStep('unavailable');
        trackFunnelEvent(FUNNEL_EVENTS.DROPOFF_DETECTED, {
          last_step: FUNNEL_EVENTS.NPI_SUBMITTED,
          dropoff_reason: 'error',
          outcome: 'unavailable',
        });
      }
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profession) {
      setFormError('Select your profession to continue.');
      return;
    }
    const validation = validateNpi(npiInput);
    if (!validation.ok || !validation.npi) {
      setFormError(validation.reason);
      return;
    }
    if (!attested) {
      setFormError('Please attest and agree to the Services Agreement to continue.');
      return;
    }

    setFormError(null);
    setPhase('submitting');
    try {
      const res = await fetch('/api/profile/npi/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // profession + attestation are self-attested claims the backend records
        // as attested fields (+ a hashed audit row) — never verified claims.
        body: JSON.stringify({
          npi: validation.npi,
          profession,
          attested: true,
          attestationVersion: ATTESTATION_VERSION,
        }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!res.ok) {
        setFormError(describeBootstrapError(res.status, body));
        setPhase('form');
        return;
      }
      if (!isNpiBootstrapResult(body)) {
        setFormError(describeBootstrapError(502, null));
        setPhase('form');
        return;
      }
      // The bind landed. This is the conversion the acquisition funnel exists
      // to count, and it emitted nothing: the backend wrote its npi_bootstrapped
      // and clinician_attestation audit rows while the funnel saw a clinician
      // reach this form and then disappear.
      //
      // Reached only on a 2xx with a well-formed body — both failure paths above
      // return first, so this cannot count an attempt as a bind. Profession
      // only; no NPI, for the reason given on the guest resolve.
      trackFunnelEvent(FUNNEL_EVENTS.NPI_BOUND, { profession });
      setSummary(summarizeBootstrapResult(body));
      setPhase('success');
    } catch {
      if (!mountedRef.current) return;
      setFormError(describeBootstrapError(0, null));
      setPhase('form');
    }
  }

  /** No-NPI lane: start a self-attested, preview-only profile. */
  async function submitStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!attested) {
      setFormError('Please attest and agree to the Services Agreement to continue.');
      return;
    }
    setFormError(null);
    setPhase('submitting');
    try {
      const res = await fetch('/api/profile/student/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A self-attested claim the backend records (+ a hashed audit row) — it
        // is never a verified claim, and it creates a preview-only profile.
        body: JSON.stringify({ attested: true, attestationVersion: ATTESTATION_VERSION }),
      });
      if (!mountedRef.current) return;
      if (!res.ok) {
        setFormError('Could not start your preview profile. This is a system state — try again shortly.');
        setPhase('form');
        return;
      }
      setPhase('student_success');
    } catch {
      if (!mountedRef.current) return;
      setFormError('Could not start your preview profile. This is a system state — try again shortly.');
      setPhase('form');
    }
  }

  /** Flip between the NPI and student lanes, clearing lane-specific input. */
  function switchMode(next: FormMode) {
    setMode(next);
    setAttested(false);
    setFormError(null);
  }

  /* ── Checking session/workspace ── */
  if (phase === 'checking') {
    return (
      <Shell stageKey="checking">
        <div className="flex flex-col items-start gap-3 py-16" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--vt-home-f-ink-muted)]" aria-hidden />
          <p className="oba-small">Checking your workspace…</p>
        </div>
        <noscript>
          <div className="mt-5 border-y border-[var(--vt-home-f-rule)] py-5 text-left">
            <p className="text-sm font-semibold text-[var(--vt-home-f-ink-strong)]">JavaScript is needed to connect a workspace.</p>
            <p className="oba-small mt-2">You can still inspect a public NPI record without signing in or saving anything.</p>
            <Link href="/verify" className={`${secondaryBtn} mt-4`}>Look up an NPI</Link>
          </div>
        </noscript>
      </Shell>
    );
  }

  /* ── Signed out: record first, account ask second ──
     Re-sequenced per the founder experience audit (2026-08-06): the homepage
     promises the record before the account, and this surface used to answer
     with a sign-in wall ("sign-in comes first"). Now the anonymous visitor
     resolves their public NPPES record here — the same public reads the
     homepage uses — and the account ask arrives as "save what we found."
     Binding still happens only after sign-in (#1074: the claim grants on a
     session, so the session is the floor — nothing here weakens it). */
  if (phase === 'signed_out') {
    const signInHref = '/sign-in?redirect_url=%2Fonboarding';

    if (guestStep === 'resolving') {
      return (
        <Shell stageKey="guest-resolving">
          <div className="flex flex-col items-start gap-3 py-16" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--vt-home-f-ink-muted)]" aria-hidden />
            <p className="oba-small">Checking the public registry…</p>
          </div>
        </Shell>
      );
    }

    if (guestStep === 'resolved' && guestProfile) {
      return (
        <Shell stageKey="guest-resolved">
          <ObaBadge />
          <Header
            title="Here's what the registry already shows"
            lede="Your public NPPES record, matched from your NPI — an identity record match, not a license check."
          />
          <div className="oba-panel mt-6 text-left" data-guest-record="">
            <p className="oba-k">Public registry record</p>
            <p className="mt-2 text-lg font-semibold text-[var(--vt-home-f-ink-strong)]">
              {guestProfile.displayName}
              {guestProfile.credential ? `, ${guestProfile.credential}` : ''}
            </p>
            {guestProfile.specialty ? <p className="oba-small mt-1">{guestProfile.specialty}</p> : null}
            {guestProfile.location ? <p className="oba-small mt-0.5">{guestProfile.location}</p> : null}
            <p className="oba-data mt-3 border-t border-[var(--vt-home-f-rule)] pt-3">
              NPI {guestProfile.npi} · public NPPES registry record
            </p>
          </div>
          <p className="oba-small mt-4 text-left">
            Nothing is saved and nothing is sent to an employer until you decide to keep it.
          </p>
          <Link href={signInHref} className={`${primaryBtn} mt-5`}>
            Save this record — sign in to keep it
          </Link>
          <p className="oba-small mt-4">
            New here?{' '}
            <Link
              href="/sign-up"
              className="oba-ulink font-medium text-[var(--vt-home-f-ink-strong)]"
            >
              Create your free account
            </Link>
          </p>
          <p className="oba-small mt-2">
            <button
              type="button"
              onClick={() => {
                setGuestProfile(null);
                setGuestNpiInput('');
                setGuestStep('entry');
              }}
              className="oba-ulink"
            >
              Not you? Check a different NPI
            </button>
          </p>
        </Shell>
      );
    }

    if (guestStep === 'organization') {
      return (
        <Shell stageKey="guest-organization">
          <ObaBadge />
          <Header
            title="That NPI names an organization"
            lede="A Type 2 NPI identifies an organization, not a clinician. Your individual (Type 1) NPI is the one that starts a clinician record."
          />
          <button
            type="button"
            onClick={() => {
              setGuestNpiInput('');
              setGuestStep('entry');
            }}
            className={`${secondaryBtn} mt-6`}
          >
            Check a different NPI
          </button>
        </Shell>
      );
    }

    if (guestStep === 'unavailable') {
      return (
        <Shell stageKey="guest-unavailable">
          <ObaBadge />
          <Header
            title="The registry didn't answer"
            lede="This is a system state — not a finding about your NPI. Try again shortly, or sign in and connect your NPI from your workspace."
          />
          <button type="button" onClick={() => setGuestStep('entry')} className={`${secondaryBtn} mt-6`}>
            Try again
          </button>
          <p className="oba-small mt-4">
            <Link href={signInHref} className="oba-ulink">
              Sign in instead
            </Link>
          </p>
        </Shell>
      );
    }

    return (
      <Shell stageKey="guest-entry">
        <ObaBadge />
        <Header
          title="Start with your NPI. See where your record can go."
          lede="VitalCV reads your public NPPES record first, keeps every later source state distinct, and opens the path to a CV Wallet and source-labelled opportunities. Sign in only when you want to save it."
        />
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void resolveGuest(guestNpiInput);
          }}
          className="mt-7 text-left"
          noValidate
        >
          <label htmlFor="guest-npi-input" className="oba-k">
            Your 10-digit NPI
          </label>
          <div className="oba-field mt-2">
            <input
              id="guest-npi-input"
              name="npi"
              className="oba-npi-in"
              inputMode="numeric"
              autoComplete="off"
              placeholder="··· ··· ····"
              value={guestNpiInput}
              onChange={(e) => {
                setGuestNpiInput(e.target.value);
                if (guestError) setGuestError(null);
              }}
              aria-invalid={guestError ? true : undefined}
              aria-describedby={guestError ? 'guest-npi-error' : undefined}
            />
          </div>
          {guestError ? (
            <p id="guest-npi-error" role="alert" className="oba-err mt-2">
              {guestError}
            </p>
          ) : null}
          <button type="submit" className={`${primaryBtn} mt-5`}>
            Show my record
          </button>
        </form>
        <p className="oba-fine mt-3 text-left">
          This reads the public NPPES registry. Nothing is saved until you sign in to keep it.
        </p>
        <p className="oba-small mt-5">
          Already have a workspace?{' '}
          <Link
            href={signInHref}
            className="oba-ulink font-medium text-[var(--vt-home-f-ink-strong)]"
          >
            Sign in
          </Link>
        </p>
        <FaqSection />
      </Shell>
    );
  }

  /* ── Workspace load error ── */
  if (phase === 'load_error') {
    return (
      <Shell stageKey="load-error">
        <div className="space-y-4">
          <AlertCircle className="h-8 w-8 text-[var(--vt-home-f-attention)]" aria-hidden />
          <p className="font-medium text-[var(--vt-home-f-ink-strong)]">Couldn&apos;t check your workspace</p>
          <p className="oba-small">
            This is a system state — not a finding about your account. Try again shortly.
          </p>
          <button type="button" onClick={() => window.location.reload()} className={secondaryBtn}>
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Already bound ── */
  if (phase === 'already_bound' && existingNpi) {
    return (
      <Shell stageKey="already-bound">
        <ObaBadge />
        <Header
          title="Your NPI is already connected"
          lede={`This workspace is bound to NPI ${existingNpi}. Your profile and readiness surfaces read from it.`}
        />
        <div className="mt-6 space-y-3">
          <Link href="/holder" className={primaryBtn}>
            Open your profile
          </Link>
          <Link href="/holder/readiness" className={secondaryBtn}>
            Check your readiness
          </Link>
        </div>
      </Shell>
    );
  }

  /* ── Intro / access gate (signed in, no NPI yet) ── */
  if (phase === 'intro') {
    return (
      <Shell stageKey="intro">
        <ObaBadge />
        <Header
          title="Confirm you are a clinician"
          lede="Confirm you're a practicing clinician to unlock your VitalCV workspace — your free, source-backed career profile."
        />
        <p className="oba-small mt-4">
          You&apos;re signed in as{' '}
          <span className="font-medium text-[var(--vt-home-f-ink-strong)]">{accountEmail ?? 'your account'}</span>.
        </p>
        <button
          type="button"
          onClick={() => { setMode('npi'); setPhase('form'); }}
          className={`${primaryBtn} mt-5`}
        >
          Confirm you&apos;re a clinician
        </button>
        <p className="oba-small mt-4">
          Still in training and don&apos;t have an NPI yet?{' '}
          <button
            type="button"
            onClick={() => { switchMode('student'); setPhase('form'); }}
            className="oba-ulink font-medium text-[var(--vt-home-f-ink-strong)]"
          >
            Start a preview profile
          </button>
        </p>
        <p className="oba-small mt-2">
          <Link
            href="/sign-in?redirect_url=%2Fonboarding"
            className="oba-ulink"
          >
            Use a different account
          </Link>
        </p>
        <FaqSection />
      </Shell>
    );
  }

  /* ── Success ── */
  if (phase === 'success' && summary) {
    return (
      <Shell stageKey="success" headerStage={activationHeaderStage(phase)}>
        <ObaBadge />
        <Header
          title={summary.isOrganizationNpi ? 'Organization NPI detected' : 'NPPES identity record matched'}
          lede={summary.statement}
        />
        {!summary.isOrganizationNpi && (
          <dl className="oba-panel mt-6 space-y-2 text-left text-sm">
            <SummaryRow label="Registry name" value={summary.displayName ?? 'Not listed in NPPES'} />
            <SummaryRow label="Specialty" value={summary.specialty ?? 'Not listed in NPPES'} />
            <SummaryRow label="State" value={summary.stateOfPractice ?? 'Not listed in NPPES'} />
          </dl>
        )}
        {!summary.isOrganizationNpi && (
          <div className="mt-6">
            <EmailVerification />
          </div>
        )}
        {/* Finish the golden path IN PLACE: stream the source checks, render the
            readiness rail + one next-best action, end with "Your VitalCV profile
            is ready" — instead of bouncing the clinician to /holder/readiness.
            Evidence register: these components keep their own truthful material
            (the directory precedent — the frame recomposes, evidence does not). */}
        {!summary.isOrganizationNpi && validateNpi(npiInput).npi ? (
          <OnboardingReadiness npi={validateNpi(npiInput).npi!} />
        ) : (
          <div className="mt-6">
            <Link href="/holder" className={primaryBtn}>
              Open your profile
            </Link>
          </div>
        )}
      </Shell>
    );
  }

  /* ── Student / no-NPI preview success ── */
  if (phase === 'student_success') {
    return (
      <Shell stageKey="student-success">
        <ObaBadge />
        <Header
          title="Your preview profile is started"
          lede="You're in preview. When you receive your NPI, connect it here to unlock your source-backed readiness — your profile upgrades automatically."
        />
        <div className="oba-panel oba-panel--inset mt-6 text-left">
          <p className="oba-k">Preview · self-attested</p>
          <p className="oba-small mt-2 leading-relaxed">
            Everything here is self-attested and not source-verified. A preview
            profile is a place to start — it is not decision-grade, and VitalCV
            never presents it to an employer as a completed check.
          </p>
        </div>
        <div className="mt-6 text-left">
          <p className="oba-k">What you can do now</p>
          <ol className="mt-3 space-y-3">
            {PREVIEW_NEXT_STEPS.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-[var(--vt-home-f-ink-muted)]">
                <span
                  className="oba-data mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[3px] border border-[var(--vt-home-f-rule)]"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="mt-6 space-y-3">
          <Link href="/holder" className={primaryBtn}>
            Open your profile
          </Link>
          <button
            type="button"
            onClick={() => { switchMode('npi'); setPhase('form'); }}
            className={secondaryBtn}
          >
            I have an NPI — connect it instead
          </button>
        </div>
      </Shell>
    );
  }

  /* ── Form (+ submitting) ── */
  const submitting = phase === 'submitting';
  // Live structural validity — drives the affordance that fades in as the
  // clinician finishes typing a well-formed NPI. Not a registry match yet, so
  // the glyph is signal indigo (never a state hue).
  const npiValid = validateNpi(npiInput).ok;
  return (
    <Shell stageKey={`form-${mode}`}>
      <ObaBadge />
      {mode === 'npi' ? (
        <Header
          title="Confirm you are a clinician"
          lede="Enter your NPI to start your workspace. VitalCV reads your public NPPES registry record — no document uploads required to get started."
        />
      ) : (
        <Header
          title="Start a preview profile"
          lede="No NPI yet? Start a self-attested preview as a health-professions student. When you receive your NPI, connect it here and your profile upgrades to source-backed."
        />
      )}
      {mode === 'npi' ? (
      <form onSubmit={submit} className="mt-7 space-y-5 text-left" noValidate>
        <fieldset disabled={submitting} className="m-0 border-0 p-0">
          <legend className="oba-k">Your profession</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PROFESSIONS.map((p) => {
              const selected = profession === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setProfession(p.value)}
                  aria-pressed={selected}
                  className="oba-opt"
                >
                  <span>{p.label}</span>
                  <Check
                    className={`h-4 w-4 shrink-0 transition-opacity duration-200 motion-reduce:transition-none ${
                      selected ? 'opacity-100' : 'opacity-0'
                    }`}
                    aria-hidden
                  />
                </button>
              );
            })}
          </div>
          <p className="oba-fine mt-2">
            You&apos;re attesting to your role — it guides which checks apply and isn&apos;t
            license-verified here.
          </p>
        </fieldset>
        <div>
          <label htmlFor="npi-input" className="oba-k">
            Your 10-digit NPI
          </label>
          <div className="oba-field mt-2">
            <input
              id="npi-input"
              name="npi"
              className="oba-npi-in"
              inputMode="numeric"
              autoComplete="off"
              placeholder="··· ··· ····"
              value={npiInput}
              onChange={(e) => setNpiInput(e.target.value)}
              disabled={submitting}
              aria-invalid={formError ? true : undefined}
              aria-describedby={formError ? 'npi-error' : 'npi-help'}
            />
            <CheckCircle2
              className={`oba-valid pointer-events-none h-5 w-5 ${npiValid ? 'is-on' : ''}`}
              aria-hidden
            />
          </div>
          {formError ? (
            <p id="npi-error" role="alert" className="oba-err mt-2">
              {formError}
            </p>
          ) : (
            <p id="npi-help" className="oba-fine mt-2">
              Don&apos;t know it? Search the{' '}
              <a
                href="https://npiregistry.cms.hhs.gov/"
                target="_blank"
                rel="noreferrer"
                className="oba-ulink"
              >
                NPPES registry
              </a>
              .
            </p>
          )}
        </div>
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--vt-home-f-ink-muted)]">
          <input
            type="checkbox"
            checked={attested}
            onChange={(e) => setAttested(e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--vt-home-f-ink-strong)]"
          />
          <span>
            I attest that I am a licensed clinician and agree to the{' '}
            <a
              href="/terms"
              target="_blank"
              rel="noreferrer"
              className="oba-ulink"
            >
              VitalCV Services Agreement
            </a>
            . VitalCV records this attestation; it does not verify it here.
          </span>
        </label>
        <button type="submit" disabled={submitting} className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Checking the NPPES registry…
            </>
          ) : (
            'Continue'
          )}
        </button>
        <p className="oba-fine leading-relaxed">
          This matches your public registry identity record. It does not verify licenses,
          exclusions, or enrollment — those source checks run on your readiness surface,
          each with its own receipt.
        </p>
      </form>
      ) : (
        <form onSubmit={submitStudent} className="mt-7 space-y-5 text-left" noValidate>
          <p className="oba-small leading-relaxed">
            Start a preview profile as a health-professions student. When you receive your
            NPI, connect it here and your profile upgrades to source-backed — you keep
            everything you added.
          </p>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-[var(--vt-home-f-ink-muted)]">
            <input
              type="checkbox"
              checked={attested}
              onChange={(e) => setAttested(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--vt-home-f-ink-strong)]"
            />
            <span>
              I attest that I am a health-professions student and agree to the{' '}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="oba-ulink"
              >
                VitalCV Services Agreement
              </a>
              . VitalCV records this attestation; it does not verify it here.
            </span>
          </label>
          {formError ? (
            <p role="alert" className="oba-err">
              {formError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Starting your preview…
              </>
            ) : (
              'Start a preview profile'
            )}
          </button>
          <p className="oba-fine leading-relaxed">
            A preview profile is self-attested and not source-verified. Your source-backed
            readiness — license, exclusion, and enrollment checks — opens once you connect
            your NPI.
          </p>
        </form>
      )}
      <button
        type="button"
        onClick={() => switchMode(mode === 'npi' ? 'student' : 'npi')}
        disabled={submitting}
        className="oba-ulink oba-fine mt-4"
      >
        {mode === 'npi'
          ? "Still in training and don't have an NPI yet?"
          : '← I have an NPI — connect it instead'}
      </button>
      <FaqSection />
    </Shell>
  );
}

/* ── Layout: the Direction A split gate (action left, activation path right) ── */

// The paper-inverse primary instrument (A-1 via amendment F), stretched
// full-width for the gate. Radius: the locked --vt-shape-action-page seam.
const primaryBtn = 'oba-action oba-action--full';
// Hairline ghost.
const secondaryBtn = 'oba-ghost oba-ghost--full';

function Shell({
  children,
  headerStage,
  stageKey,
}: {
  children: React.ReactNode;
  headerStage?: string;
  stageKey: string;
}) {
  return (
    <ObaRoot
      // Scene contract for the shared header (FR-6). Declared only when a
      // phase has real server confirmation behind it — see
      // lib/activation/headerStage.ts. Undeclared phases fall back to the
      // route default (Your Number).
      data-header-stage={headerStage}
      data-header-theme={headerStage ? 'light' : undefined}
    >
      <div className="oba-shell">
        <div className="oba-col-act">
          {/* Re-keyed per phase: each phase change lands once (one-shot,
              state-transition band). The first paint is never hidden. */}
          <ObaStage key={stageKey} className="oba-gate">
            {children}
          </ObaStage>
        </div>
        <ActivationPanel />
      </div>
    </ObaRoot>
  );
}

function ActivationPanel() {
  return (
    <aside className="oba-col-scene" aria-label="The clinician activation path">
      <div className="oba-scene">
        <p className="oba-cap mb-2">
          Illustration — not a live record, application, or result
        </p>
        <VisualScene
          scene="activation_path"
          kind="process"
          priority="inline"
          className="oba-scene-frame [&_figcaption]:border-t [&_figcaption]:border-[var(--vt-home-f-rule)] [&_figcaption]:px-4 [&_figcaption]:py-3 [&_figcaption]:font-mono [&_figcaption]:text-[10px] [&_figcaption]:leading-relaxed [&_figcaption]:text-[var(--vt-home-f-ink-subtle)]"
        />
        <div className="mt-7">
          <ActivationPath compact heading="Your record opens the next move." />
        </div>
      </div>
    </aside>
  );
}

function FaqSection() {
  return (
    <section className="oba-qa text-left">
      <h3 className="oba-k">Verification FAQ</h3>
      <dl>
        {FAQS.map((f) => (
          <div key={f.q} className="oba-qa-row">
            <dt>{f.q}</dt>
            <dd>{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Header({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="mt-6">
      <h1 className="oba-h1">{title}</h1>
      <div className="oba-rule" aria-hidden="true" />
      <p className="oba-lede mt-4">{lede}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="oba-fact">
      <dt className="oba-k">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
