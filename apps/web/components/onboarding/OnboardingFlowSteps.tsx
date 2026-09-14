'use client';

import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { ResolverProgressIndicator } from '@/components/onboarding/ResolverProgressIndicator';
import {
  trackClinicianEvent,
  trackClinicianEventOncePerSession,
} from '@/lib/mobile/analytics';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { trackPilotFunnelEvent } from '@/lib/pilot-ops/funnel';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { ObaRoot, ObaStage } from '@/components/onboarding/ActivationScene';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ONBOARDING_NPI_KEY } from '@/lib/onboarding/npiHandoff';

const STORAGE_KEYS = {
  // Shared with lib/onboarding/npiHandoff.ts — the homepage resolved state
  // and /onboarding's anonymous preview write the same key.
  npi: ONBOARDING_NPI_KEY,
  bootstrap: 'onboarding_bootstrap',
  returnTo: 'onboarding_return_to',
} as const;

interface BootstrapResult {
  npi: string;
  npiType: 'TYPE_1' | 'TYPE_2';
  inferredPersona: 'CLINICIAN' | 'VERIFIER' | 'UNKNOWN';
  firstName?: string;
  lastName?: string;
  specialty?: string;
  state?: string;
  alreadyRegistered: boolean;
}

interface ActivationResult {
  readinessScore: number;
  readinessLevel: 'L0' | 'L1' | 'L2' | 'L3';
  readinessStatus: string;
}

interface ExplorePreviewOpportunity {
  id: string;
  organizationName: string;
  title: string;
  specialty: string;
  state: string;
  requirementLevel: string;
  remote: boolean;
}

function readOnboardingStorage(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
}

function writeOnboardingStorage(
  key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS],
  value: string,
) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(key, value);
  window.localStorage.setItem(key, value);
}

function removeOnboardingStorage(key: (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(key);
  window.localStorage.removeItem(key);
}

function readStoredNpi(): string {
  return readOnboardingStorage(STORAGE_KEYS.npi) ?? '';
}

function readStoredBootstrap(): BootstrapResult | null {
  const storedBootstrap = readOnboardingStorage(STORAGE_KEYS.bootstrap);
  if (!storedBootstrap) {
    return null;
  }

  try {
    return JSON.parse(storedBootstrap) as BootstrapResult;
  } catch {
    removeOnboardingStorage(STORAGE_KEYS.bootstrap);
    return null;
  }
}

function storeReturnTo(returnTo: string | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (returnTo && returnTo.startsWith('/')) {
    writeOnboardingStorage(STORAGE_KEYS.returnTo, returnTo);
    return;
  }

  removeOnboardingStorage(STORAGE_KEYS.returnTo);
}

function readStoredReturnTo(): string | null {
  const returnTo = readOnboardingStorage(STORAGE_KEYS.returnTo);
  return returnTo && returnTo.startsWith('/') ? returnTo : null;
}

function clearOnboardingStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  removeOnboardingStorage(STORAGE_KEYS.npi);
  removeOnboardingStorage(STORAGE_KEYS.bootstrap);
  removeOnboardingStorage(STORAGE_KEYS.returnTo);
}

function buildOnboardingHref(path: string, returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return path;
  }

  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

function buildSignInHref(path: string, returnTo: string | null): string {
  return `/sign-in?redirect_url=${encodeURIComponent(buildOnboardingHref(path, returnTo))}`;
}

function buildExitHref(returnTo: string | null, guestMode: boolean): string {
  if (returnTo && returnTo.startsWith('/')) {
    return returnTo;
  }

  return guestMode ? '/explore' : '/holder/home';
}

function StepShell({
  step,
  title,
  description,
  backHref,
  backLabel,
  exitHref,
  exitLabel,
  children,
}: {
  step: number;
  title: string;
  description: string;
  backHref: string;
  backLabel: string;
  exitHref: string;
  exitLabel: string;
  children: ReactNode;
}) {
  // REGISTER (design-only, 2026-08-16): the step frame renders in the
  // Direction A `.oba` island (styles/onboarding-activation.css) — warm
  // paper, Fraunces display, mono step index, hairline flow track, solid
  // panels. Was a dark gradient + frosted panel authored before the
  // all-light public register. Every href, step semantic, and support
  // affordance is unchanged.
  return (
    <ObaRoot>
      <div className="oba-step-wrap flex min-h-[100dvh] flex-col justify-center">
        <ObaStage key={`step-${step}`} className="flex flex-col gap-6">
          <div className="oba-step-head">
            <Link href={backHref} className="oba-quiet">
              ← {backLabel}
            </Link>
            <div className="ml-auto flex items-center gap-4">
              <span className="oba-step-ix">Activation {step} of 3</span>
              <Link href={exitHref} className="oba-quiet">
                {exitLabel}
              </Link>
            </div>
          </div>

          {/* Flow position, stated in words above and drawn here — the fill
              is the step index over three, never a returned number. */}
          <div className="oba-track" aria-hidden="true">
            <i style={{ width: `${(step / 3) * 100}%` }} />
          </div>

          <div>
            <p className="oba-k">Continue activation</p>
            <h1 className="oba-h1 mt-3">{title}</h1>
            <div className="oba-rule" aria-hidden="true" />
            <p className="oba-lede mt-4">{description}</p>
          </div>

          <section className="oba-panel">
            {children}
          </section>

          <ClinicianSupportCard
            topic={`onboarding-step-${step}`}
            detail="If this onboarding step does not match your clinician record or stalls after a retry, go back one step and then contact support with your NPI and the current step number."
            primaryHref={backHref}
            primaryLabel={backLabel}
          />
        </ObaStage>
      </div>
    </ObaRoot>
  );
}

export function NpiOnboardingStep({
  returnTo,
  guestMode,
}: {
  returnTo: string | null;
  guestMode: boolean;
}) {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNpi(readStoredNpi());
    storeReturnTo(returnTo);
  }, [returnTo]);

  useEffect(() => {
    void trackPilotEvent({
      eventType: 'onboarding_started',
      details: {
        guestMode,
      },
    });

    if (!guestMode) {
      void trackClinicianEventOncePerSession('onboarding-started', 'clinician.onboarding_started');
    }
  }, [guestMode]);

  function handleContinue() {
    if (!/^\d{10}$/.test(npi)) {
      setError('Enter a valid 10-digit NPI to continue.');
      return;
    }

    void trackPilotFunnelEvent({
      eventType: 'npi_submitted',
      npi,
      route: '/onboarding',
      dedupeKey: `npi-submitted:onboarding:${npi}`,
      details: {
        guestMode,
        surface: 'onboarding',
      },
    });

    writeOnboardingStorage(STORAGE_KEYS.npi, npi);
    if (returnTo) {
      writeOnboardingStorage(STORAGE_KEYS.returnTo, returnTo);
    }
    router.push(buildOnboardingHref('/onboarding/fetching', returnTo));
  }

  return (
    <StepShell
      step={1}
      title="Enter your NPI"
      description={guestMode
        ? 'Preview your public clinician match before you decide to continue.'
        : 'Enter your NPI to recognize your public record and keep momentum moving.'}
      backHref={returnTo ?? '/explore'}
      backLabel={returnTo ? 'Back to previous page' : 'Back to opportunities'}
      exitHref={buildExitHref(returnTo, guestMode)}
      exitLabel={guestMode ? 'Exit preview' : 'Exit onboarding'}
    >
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          handleContinue();
        }}
      >
        {guestMode ? (
          <div className="oba-panel oba-panel--inset text-sm">
            <p className="oba-k">Preview only</p>
            <p className="oba-small mt-2">
              We&apos;ll resolve your public NPI and preview live role fit, but activation stays protected until you sign in.
            </p>
            <Link
              href={buildSignInHref('/onboarding', returnTo)}
              className="oba-quiet mt-2"
            >
              Sign in to continue onboarding
            </Link>
          </div>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="onboarding-npi" className="oba-k">
            NPI number
          </label>
          <input
            id="onboarding-npi"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            enterKeyHint="next"
            maxLength={10}
            autoFocus
            value={npi}
            onChange={(event) => {
              const nextValue = event.target.value.replace(/\D/g, '').slice(0, 10);
              setNpi(nextValue);
              if (nextValue) {
                writeOnboardingStorage(STORAGE_KEYS.npi, nextValue);
              } else {
                removeOnboardingStorage(STORAGE_KEYS.npi);
              }
              setError(null);
            }}
            placeholder="··· ··· ····"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'onboarding-npi-error' : undefined}
            className="oba-npi-in w-full"
          />
          <p className="oba-fine">
            Type 1 clinician NPIs are supported in this flow. {npi.length > 0 && npi.length < 10
              ? `${10 - npi.length} digit${10 - npi.length === 1 ? '' : 's'} remaining.`
              : 'Your progress stays saved if this step is interrupted.'}
          </p>
        </div>

        {error ? (
          <p id="onboarding-npi-error" role="alert" className="oba-err">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={!/^\d{10}$/.test(npi)}
          className="oba-action oba-action--full"
        >
          {guestMode ? 'Preview my fit' : 'Continue'}
        </button>
      </form>
    </StepShell>
  );
}

export function IdentityOnboardingStep({
  guestMode,
  returnTo,
}: {
  guestMode: boolean;
  returnTo: string | null;
}) {
  const router = useRouter();
  const didInit = useRef(false);
  const [npi, setNpi] = useState('');
  const [bootstrap, setBootstrap] = useState<BootstrapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const resolveBootstrap = useCallback(async () => {
    const storedNpi = readStoredNpi();
    if (!/^\d{10}$/.test(storedNpi)) {
      router.replace(buildOnboardingHref('/onboarding', returnTo));
      return;
    }

    setNpi(storedNpi);

    const storedBootstrap = readStoredBootstrap();
    if (storedBootstrap?.npi === storedNpi) {
      setBootstrap(storedBootstrap);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await (guestMode
        ? fetch(`/api/identity/bootstrap/${storedNpi}`, { cache: 'no-store' })
        : fetch('/api/profile/npi/bootstrap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npi: storedNpi }),
          }));
      const payload = await response.json().catch(() => ({})) as BootstrapResult & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to resolve provider.');
      }
      if (payload.npiType !== 'TYPE_1') {
        throw new Error('This onboarding flow only supports individual clinician NPIs.');
      }
      writeOnboardingStorage(STORAGE_KEYS.bootstrap, JSON.stringify(payload));
      setBootstrap(payload);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unable to resolve provider.');
    } finally {
      setLoading(false);
    }
  }, [guestMode, returnTo, router]);

  useEffect(() => {
    if (didInit.current) {
      return;
    }
    didInit.current = true;
    void resolveBootstrap();
  }, [resolveBootstrap]);

  const clinicianName = useMemo(() => {
    if (!bootstrap) {
      return null;
    }

    return [bootstrap.firstName, bootstrap.lastName]
      .filter((value): value is string => Boolean(value))
      .join(' ')
      .trim() || null;
  }, [bootstrap]);

  return (
    <StepShell
      step={2}
      title="Confirm your profile"
      description={guestMode
        ? 'We resolved your public provider record. Review it before deciding whether to sign in and continue.'
        : 'We resolved your public provider record. Review the match and keep moving forward.'}
      backHref={buildOnboardingHref('/onboarding', returnTo)}
      backLabel="Back to NPI"
      exitHref={buildExitHref(returnTo, guestMode)}
      exitLabel={guestMode ? 'Exit preview' : 'Exit onboarding'}
    >
      {loading ? (
        <div className="flex flex-col items-start gap-4 py-10" role="status" aria-live="polite">
          <Loader2 className="h-7 w-7 animate-spin text-[var(--vt-home-f-ink-muted)]" aria-hidden />
          <p className="oba-small">Confirming your public record...</p>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <PilotFailureSignal
            title="Onboarding profile check interrupted"
            message={error}
            queueItem={{ source: 'route_failure' }}
            dedupeKey={`onboarding:identity:${npi}:${error}`}
          />
          <div className="oba-panel oba-panel--inset space-y-2 text-sm">
            <p className="font-semibold text-[var(--vt-home-f-ink-strong)]">Profile check interrupted</p>
            <p className="oba-err">{error}</p>
            <p className="oba-small">
              The public registry may be temporarily unavailable. You can try another NPI or retry this search in a few minutes.
            </p>
          </div>
          <Link
            href={buildOnboardingHref('/onboarding', returnTo)}
            className="oba-quiet"
          >
            ← Try another NPI
          </Link>
          <button
            type="button"
            onClick={() => void resolveBootstrap()}
            className="oba-quiet ml-6"
          >
            Retry profile lookup
          </button>
        </div>
      ) : bootstrap ? (
        <div className="space-y-6">
          {guestMode ? (
            <div className="oba-panel oba-panel--inset text-sm">
              <p className="oba-k">Read-only guest preview</p>
              <p className="oba-small mt-2">
                This step confirms the public provider match only. Signing in is still required before any profile, credential import, or activation write occurs.
              </p>
            </div>
          ) : null}

          <div>
            <p className="oba-k">Resolved provider</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--vt-home-f-ink-strong)]">
              {clinicianName ?? 'Clinician profile'}
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="oba-panel">
                <p className="oba-k">NPI</p>
                <p className="oba-data mt-1 text-[0.9375rem] text-[var(--vt-home-f-ink-strong)]">{npi}</p>
              </div>
              <div className="oba-panel">
                <p className="oba-k">Specialty</p>
                <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">{bootstrap.specialty ?? 'Not available yet'}</p>
              </div>
              <div className="oba-panel">
                <p className="oba-k">State</p>
                <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">{bootstrap.state ?? 'Not available yet'}</p>
              </div>
              <div className="oba-panel">
                <p className="oba-k">Status</p>
                <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">
                  {bootstrap.alreadyRegistered
                    ? 'Existing VitalCV profile found'
                    : guestMode
                      ? 'Ready for guest preview'
                      : 'Ready to activate'}
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push(buildOnboardingHref('/onboarding/readiness', returnTo))}
            className="oba-action oba-action--full"
          >
            {guestMode ? 'Continue preview' : 'Continue onboarding'}
          </button>
        </div>
      ) : null}
    </StepShell>
  );
}

export function ActivateOnboardingStep({
  guestMode,
  returnTo,
}: {
  guestMode: boolean;
  returnTo: string | null;
}) {
  const router = useRouter();
  const hasRun = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<ActivationResult | null>(null);
  const [guestBootstrap, setGuestBootstrap] = useState<BootstrapResult | null>(null);
  const [guestMatches, setGuestMatches] = useState<ExplorePreviewOpportunity[]>([]);
  const [guestMatchTotal, setGuestMatchTotal] = useState(0);
  const [guestLoading, setGuestLoading] = useState(guestMode);

  useEffect(() => {
    void trackPilotFunnelEvent({
      eventType: 'readiness_viewed',
      npi: readStoredNpi(),
      route: '/onboarding/readiness',
      dedupeKey: `readiness-viewed:onboarding:${readStoredNpi()}`,
      details: {
        guestMode,
        step: 'onboarding-readiness',
        surface: 'onboarding',
      },
    });
  }, [guestMode]);

  useEffect(() => {
    if (hasRun.current) {
      return;
    }
    hasRun.current = true;

    const npi = readStoredNpi();
    if (!/^\d{10}$/.test(npi)) {
      router.replace(buildOnboardingHref('/onboarding', returnTo));
      return;
    }

    if (guestMode) {
      const bootstrap = readStoredBootstrap();
      if (!bootstrap || bootstrap.npi !== npi) {
        router.replace(buildOnboardingHref('/onboarding/identity', returnTo));
        return;
      }

      const resolvedBootstrap = bootstrap;
      setGuestBootstrap(resolvedBootstrap);

      async function loadGuestPreview() {
        try {
          const scopedParams = new URLSearchParams({ limit: '3' });
          if (resolvedBootstrap.specialty) {
            scopedParams.set('specialty', resolvedBootstrap.specialty);
          }
          if (resolvedBootstrap.state) {
            scopedParams.set('state', resolvedBootstrap.state);
          }

          let response = await fetch(`/api/opportunities?${scopedParams.toString()}`, {
            cache: 'no-store',
          });
          let payload = await response.json().catch(() => null) as {
            opportunities?: ExplorePreviewOpportunity[];
            total?: number;
            error?: string;
          } | null;

          if (
            response.ok
            && resolvedBootstrap.specialty
            && resolvedBootstrap.state
            && (payload?.total ?? 0) === 0
          ) {
            const fallbackParams = new URLSearchParams({
              limit: '3',
              specialty: resolvedBootstrap.specialty,
            });
            response = await fetch(`/api/opportunities?${fallbackParams.toString()}`, {
              cache: 'no-store',
            });
            payload = await response.json().catch(() => null) as {
              opportunities?: ExplorePreviewOpportunity[];
              total?: number;
              error?: string;
            } | null;
          }

          if (!response.ok) {
            throw new Error(payload?.error ?? 'Unable to load the live opportunity preview.');
          }

          setGuestMatches(payload?.opportunities ?? []);
          setGuestMatchTotal(payload?.total ?? payload?.opportunities?.length ?? 0);
        } catch (guestError) {
          setError(guestError instanceof Error ? guestError.message : 'Unable to load the live opportunity preview.');
        } finally {
          setGuestLoading(false);
        }
      }

      void loadGuestPreview();
      return;
    }

    void Promise.allSettled([
      fetch('/api/credentials/ingest-npi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      }),
      fetch('/api/clinician/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi }),
      }),
    ]).then(async ([ingestResult, activateResult]) => {
      if (activateResult.status !== 'fulfilled') {
        setError('Profile creation failed before activation could complete.');
        return;
      }

      const activateResponse = activateResult.value;
      const activatePayload = await activateResponse.json().catch(() => ({})) as ActivationResult & { error?: string };
      if (!activateResponse.ok) {
        setError(activatePayload.error ?? 'Profile creation failed. Please try again.');
        return;
      }

      if (
        ingestResult.status === 'fulfilled'
        && !ingestResult.value.ok
        && ingestResult.value.status !== 409
      ) {
        setError('Your activation is ready, but background credential ingestion needs a retry.');
        setCompleted(activatePayload);
      }

      setCompleted(activatePayload);
      void trackClinicianEvent('clinician.onboarding_completed', {
        npi,
        readinessLevel: activatePayload.readinessLevel,
        readinessScore: activatePayload.readinessScore,
      });
      void trackPilotEvent({
        eventType: 'onboarding_completed',
        entity: {
          kind: 'passport',
          id: npi,
          label: npi,
          objectType: 'passport',
        },
        details: {
          readinessLevel: activatePayload.readinessLevel,
          readinessScore: activatePayload.readinessScore,
        },
      });

      const storedReturnTo = readStoredReturnTo();
      clearOnboardingStorage();
      setTimeout(() => {
        router.replace(
          storedReturnTo ?? '/holder/readiness?from=onboarding',
        );
      }, 900);
    });
  }, [guestMode, returnTo, router]);

  const guestExploreHref = useMemo(() => {
    const params = new URLSearchParams();
    if (guestBootstrap?.specialty) {
      params.set('specialty', guestBootstrap.specialty);
    }
    if (guestBootstrap?.state) {
      params.set('state', guestBootstrap.state);
    }

    const query = params.toString();
    return query ? `/explore?${query}` : '/explore';
  }, [guestBootstrap?.specialty, guestBootstrap?.state]);

  if (guestMode) {
    return (
      <StepShell
        step={3}
        title="See what activation unlocks"
        description="This preview is read-only. You can inspect your clinician match and live role fit now, then sign in when you are ready to keep going."
        backHref={buildOnboardingHref('/onboarding/identity', returnTo)}
        backLabel="Back to profile review"
        exitHref={buildExitHref(returnTo, guestMode)}
        exitLabel="Exit preview"
      >
        {guestLoading ? (
          <div className="flex flex-col items-start gap-4 py-10" role="status" aria-live="polite">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--vt-home-f-ink-muted)]" aria-hidden />
            <p className="oba-small">Bringing your guest preview into view...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <PilotFailureSignal
              title="Guest opportunity preview blocked"
              message={error}
              severity="medium"
              queueItem={{ source: 'route_failure', blocking: false }}
              dedupeKey={`onboarding:guest-preview:${guestBootstrap?.npi ?? 'unknown'}:${error}`}
            />
            <div className="oba-panel oba-panel--inset flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--vt-home-f-attention)]" aria-hidden />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-[var(--vt-home-f-ink-strong)]">Guest preview is blocked right now</p>
                <p className="oba-err">{error}</p>
                <p className="oba-small">
                  Next step: go back to the profile review and retry the live opportunity lookup, or continue into the main explore feed instead.
                </p>
              </div>
            </div>
            <Link
              href={buildOnboardingHref('/onboarding/identity', returnTo)}
              className="oba-quiet"
            >
              ← Go back and try again
            </Link>
          </div>
        ) : guestBootstrap ? (
          <div className="space-y-6">
            <div>
              <p className="oba-k">Guest preview scope</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--vt-home-f-ink-strong)]">
                {[guestBootstrap.firstName, guestBootstrap.lastName]
                  .filter((value): value is string => Boolean(value))
                  .join(' ')
                  .trim() || 'Clinician preview'}
              </h2>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="oba-panel">
                  <p className="oba-k">NPI</p>
                  <p className="oba-data mt-1 text-[0.9375rem] text-[var(--vt-home-f-ink-strong)]">{guestBootstrap.npi}</p>
                </div>
                <div className="oba-panel">
                  <p className="oba-k">Specialty</p>
                  <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">{guestBootstrap.specialty ?? 'Not available yet'}</p>
                </div>
                <div className="oba-panel">
                  <p className="oba-k">State</p>
                  <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">{guestBootstrap.state ?? 'Not available yet'}</p>
                </div>
                <div className="oba-panel">
                  <p className="oba-k">Activation</p>
                  <p className="mt-1 text-[var(--vt-home-f-ink-strong)]">
                    {guestBootstrap.alreadyRegistered
                      ? 'Sign in to continue with the existing profile'
                      : 'Sign in to create and persist your profile'}
                  </p>
                </div>
              </div>
            </div>

            <div className="oba-panel">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="oba-k">Live role preview</p>
                  <h3 className="oba-h3 mt-2">
                    {guestMatchTotal} live role{guestMatchTotal === 1 ? '' : 's'} align with this preview
                  </h3>
                  <p className="oba-small mt-2">
                    These matches come from the current opportunities feed. Guest mode does not activate, apply, or reserve anything.
                  </p>
                </div>
                <Link href={guestExploreHref} className="oba-quiet shrink-0">
                  Open matching roles
                </Link>
              </div>

              <div className="mt-4 space-y-2">
                {guestMatches.length > 0 ? guestMatches.map((opportunity) => (
                  <div key={opportunity.id} className="oba-panel oba-panel--inset">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--vt-home-f-ink-strong)]">{opportunity.title}</p>
                        <p className="oba-small mt-1">
                          {opportunity.organizationName} - {opportunity.remote ? `Remote (${opportunity.state})` : opportunity.state}
                        </p>
                      </div>
                      {/* Requirement level is a word-label: the pill silhouette
                          is ratified for word-labels (A-2), never a state. */}
                      <span className="oba-data shrink-0 rounded-full border border-[var(--vt-home-f-rule-strong)] px-2.5 py-1 text-[11px]">
                        {opportunity.requirementLevel}
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="oba-panel oba-panel--inset text-sm">
                    <p className="oba-small">
                      No exact specialty/state matches are live right now, but the marketplace feed is still available to browse.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={buildSignInHref('/onboarding/readiness', returnTo)}
                className="oba-action flex-1"
              >
                Sign in to continue onboarding
              </Link>
              <Link
                href={guestExploreHref}
                className="oba-ghost flex-1"
              >
                Continue exploring
              </Link>
            </div>

            <p className="oba-fine">
              Guest preview is read-only: no activation, credential ingestion, or submission state is persisted until you authenticate.
            </p>
          </div>
        ) : null}
      </StepShell>
    );
  }

  return (
    <StepShell
      step={3}
        title="Continue activation"
        description="We’re connecting your first readiness state so the handoff feels calm."
      backHref={buildOnboardingHref('/onboarding/identity', returnTo)}
      backLabel="Back to profile review"
      exitHref={buildExitHref(returnTo, guestMode)}
      exitLabel="Exit onboarding"
    >
      {completed ? (
        <div className="space-y-5 py-4">
          {/* The activation endpoint actually returned: completed work. The
              glyph may be work-green; the words stay ink (EC-4/A-1). */}
          <div className="oba-panel flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-[var(--vt-home-f-confirmed)]" aria-hidden />
            <div>
              <p className="font-semibold text-[var(--vt-home-f-ink-strong)]">You&apos;re ready to keep going</p>
              <p className="oba-data mt-1 text-sm">
                Readiness {completed.readinessLevel} - {completed.readinessScore}/100
              </p>
            </div>
          </div>
          {error ? (
            <p role="alert" className="oba-err">
              {error}
            </p>
          ) : null}
          <p className="oba-small">
            Opening your profile...
          </p>
        </div>
      ) : error ? (
        <div className="space-y-4">
          <PilotFailureSignal
            title="Activation paused"
            message={error}
            queueItem={{ source: 'route_failure' }}
            dedupeKey={`onboarding:activation:${error}`}
          />
          <div className="oba-panel oba-panel--inset flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--vt-home-f-attention)]" aria-hidden />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-[var(--vt-home-f-ink-strong)]">Activation paused</p>
              <p className="oba-err">{error}</p>
              <p className="oba-small">
                Your progress is saved. Please go back and retry activation. If this continues, the interruption will be visible for follow-up.
              </p>
            </div>
          </div>
          <Link
            href={buildOnboardingHref('/onboarding/identity', returnTo)}
            className="oba-quiet"
          >
            ← Go back and try again
          </Link>
        </div>
      ) : (
        <div className="space-y-6 py-4">
          <ResolverProgressIndicator durationPerStep={680} />
          <p className="oba-small">
            Your credentials and readiness are being connected to the next step.
          </p>
        </div>
      )}
    </StepShell>
  );
}
