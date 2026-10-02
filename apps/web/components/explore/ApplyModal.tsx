'use client';

import { useRoleContext } from '@/components/auth/RoleContext';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import {
  applicationStatusLabel,
  applicationStatusTone,
  normalizeClinicianApplication,
  normalizeMobileTrustState,
  type MobileApplication,
  type MobileTrustState,
} from '@/lib/mobile/dashboard';
import { trackClinicianEvent } from '@/lib/mobile/analytics';
import { emitApplyFunnelSignal } from '@/lib/matcha-deck/applyFunnel';
import { useTrackEvent } from '@/lib/learning/useTrackEvent';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { trackPilotEvent } from '@/lib/pilot-ops/client';

interface Opportunity {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  organizationName?: string;
}

interface Props {
  opportunity: Opportunity | null;
  existingApplication?: MobileApplication | null;
  onSubmitted?: (application: MobileApplication) => void;
  onClose: () => void;
}

type Phase = 'form' | 'submitting' | 'success' | 'error';
const REQUEST_TIMEOUT_MS = 12_000;

/**
 * The section vocabulary this consent surface presents. The sealing truth
 * lives in the backend (`APPLICATION_DISCLOSURE_SECTIONS` +
 * `buildFieldEntriesFromTrustState`); apply-disclosure-contract.test.ts pins
 * this list to the backend's ids so the preview can never drift from what a
 * submission actually seals. Exported for that contract test.
 */
export const DISCLOSURE_SECTIONS = [
  {
    id: 'identity',
    label: 'Identity',
    detail: 'Your NPI-linked clinician identity is required for this application.',
    required: true,
  },
  {
    id: 'exclusions',
    label: 'Exclusions',
    detail: 'Current federal exclusion evidence, with its source state.',
    required: false,
  },
  {
    id: 'licensure',
    label: 'Licensure',
    detail: 'Available license evidence and any review or access limits.',
    required: false,
  },
  {
    id: 'enrollment',
    label: 'Enrollment',
    detail: 'Available PECOS or enrollment evidence and freshness.',
    required: false,
  },
] as const;

type DisclosureSectionId = (typeof DISCLOSURE_SECTIONS)[number]['id'];
const DEFAULT_DISCLOSURE_SECTIONS: DisclosureSectionId[] = DISCLOSURE_SECTIONS.map(
  (section) => section.id,
);

function statusClasses(status: string): string {
  switch (applicationStatusTone(status)) {
    case 'emerald':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'sky':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    case 'zinc':
      return 'border-zinc-200 bg-zinc-100 text-zinc-700';
    case 'amber':
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function formatTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function readinessConfidenceCopy(trustState: MobileTrustState | null): {
  title: string;
  detail: string;
} {
  if (!trustState) {
    return {
      title: 'Your latest readiness will attach on submission',
      detail: 'If anything else is needed later, we will show the exact next step in your application detail.',
    };
  }

  if (trustState.gapSummary.length === 0) {
    return {
      title: `Ready to submit with ${trustState.readinessLevel} readiness`,
      detail: 'Your verified profile and current readiness will go with this application automatically.',
    };
  }

  return {
    title: 'You can still submit from your current readiness state',
    detail: 'If the employer needs more evidence, we will show it in your application detail instead of leaving you guessing.',
  };
}

export default function ApplyModal({
  opportunity,
  existingApplication = null,
  onSubmitted,
  onClose,
}: Props) {
  const router = useRouter();
  const {
    clinicianNpi,
    isClinician,
    isLoaded,
    isSignedIn,
    role,
  } = useRoleContext();
  const trackEvent = useTrackEvent();
  const [coverNote, setCoverNote] = useState('');
  const [selectedSections, setSelectedSections] = useState<DisclosureSectionId[]>(
    DEFAULT_DISCLOSURE_SECTIONS,
  );
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [loadingTrustState, setLoadingTrustState] = useState(false);
  const [trustState, setTrustState] = useState<MobileTrustState | null>(null);
  const [submittedApplication, setSubmittedApplication] = useState<MobileApplication | null>(null);

  const returnUrl = useMemo(
    () => `/explore?apply=${encodeURIComponent(opportunity?.id ?? '')}`,
    [opportunity?.id],
  );
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`;
  const onboardingHref = `/onboarding?returnTo=${encodeURIComponent(returnUrl)}`;
  const activeApplication = submittedApplication ?? existingApplication;
  const existingActiveApplication = existingApplication && existingApplication.status !== 'WITHDRAWN';
  const existingApplicationRecord = existingActiveApplication ? existingApplication : null;
  const activeApplicationHref = activeApplication
    ? `/holder/applications/${encodeURIComponent(activeApplication.id)}`
    : '/holder/applications';
  const existingApplicationHref = existingApplicationRecord
    ? `/holder/applications/${encodeURIComponent(existingApplicationRecord.id)}`
    : '/holder/applications';
  const readinessConfidence = readinessConfidenceCopy(trustState);

  useEffect(() => {
    setCoverNote('');
    setSelectedSections(DEFAULT_DISCLOSURE_SECTIONS);
    setPhase('form');
    setErrorMsg('');
    setSubmittedApplication(null);
    if (opportunity && clinicianNpi) {
      trackEvent('APPLY_CLICKED', { providerId: clinicianNpi, jobId: opportunity.id });
    }
  }, [opportunity?.id, clinicianNpi, trackEvent]);

  useEffect(() => {
    if (!opportunity || existingApplicationRecord) {
      return;
    }

    void trackClinicianEvent('clinician.apply_started', {
      opportunityId: opportunity.id,
      title: opportunity.title,
      organizationName: opportunity.organizationName ?? null,
    });
    void trackPilotEvent({
      eventType: 'apply_started',
      entity: {
        kind: 'opportunity',
        id: opportunity.id,
        label: opportunity.title,
        objectType: 'opportunity',
      },
      details: {
        organizationName: opportunity.organizationName ?? null,
      },
    });
    // Close the MATCHA funnel loop in the unified decision log — the apply flow
    // opened for this opportunity. Best-effort; never blocks the apply, and NPI
    // is read as-is (attribution is best-effort, so it is not an effect dep).
    void emitApplyFunnelSignal('application_started', {
      opportunityId: opportunity.id,
      npi: clinicianNpi,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingApplicationRecord, opportunity]);

  useEffect(() => {
    if (!clinicianNpi || !isSignedIn || !isClinician) {
      setTrustState(null);
      return;
    }

    setLoadingTrustState(true);
    void fetch(`/api/trust-state/${encodeURIComponent(clinicianNpi)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to load readiness.');
        }

        const payload = await response.json() as unknown;
        setTrustState(normalizeMobileTrustState(payload));
      })
      .catch(() => {
        setTrustState(null);
      })
      .finally(() => {
        setLoadingTrustState(false);
      });
  }, [clinicianNpi, isClinician, isSignedIn]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  if (!opportunity) {
    return null;
  }

  function toggleDisclosureSection(sectionId: DisclosureSectionId) {
    if (sectionId === 'identity') {
      return;
    }
    setSelectedSections((current) => current.includes(sectionId)
      ? current.filter((section) => section !== sectionId)
      : [...current, sectionId]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!clinicianNpi || !opportunity) {
      return;
    }

    setPhase('submitting');
    setErrorMsg('');

    try {
      const response = await fetch(`/api/opportunities/${opportunity.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        // Deliberately no `npi` in the body. The server names the clinician
        // from the verified session and reads the NPI from their profile; a
        // client-supplied NPI is never the subject of an application.
        body: JSON.stringify({
          coverNote: coverNote.trim() || undefined,
          selectedSections,
          purpose: 'application',
        }),
      });

      const payload = await response.json().catch(() => null) as unknown;
      const application = normalizeClinicianApplication(payload);

      if (response.ok || response.status === 409) {
        if (!application) {
          setErrorMsg('Application status could not be loaded. Please reopen this role to continue.');
          setPhase('error');
          return;
        }

        setSubmittedApplication(application);
        onSubmitted?.(application);

        if (response.ok) {
          void trackClinicianEvent('clinician.apply_submitted', {
            applicationId: application.id,
            opportunityId: application.opportunityId,
            status: application.status,
            organizationName: application.employer.name ?? application.opportunity.organizationName ?? opportunity.organizationName ?? null,
          });
          void trackPilotEvent({
            eventType: 'apply_submitted',
            entity: {
              kind: 'application',
              id: application.id,
              label: opportunity.title,
              objectType: 'application',
            },
            details: {
              opportunityId: application.opportunityId,
              status: application.status,
            },
          });
          // The packet sealed — record the funnel completion in the unified
          // decision log. keepalive lets it survive the redirect that follows.
          void emitApplyFunnelSignal('application_submitted', {
            opportunityId: application.opportunityId,
            npi: clinicianNpi,
          });
        }

        setPhase('success');
        window.setTimeout(() => {
          onClose();
          router.push(
            `/holder/applications/${encodeURIComponent(application.id)}${response.ok ? '?submitted=1' : ''}`,
          );
        }, 450);
        return;
      }

      const errorPayload = payload && typeof payload === 'object'
        ? payload as { error?: unknown }
        : null;
      // Backend errors arrive as { error: { code, message } } or { error: string }
      // — coerce so an object never reaches JSX or string interpolation.
      const rawError = errorPayload?.error;
      const nextError = typeof rawError === 'string'
        ? rawError
        : rawError && typeof rawError === 'object'
            && typeof (rawError as { message?: unknown }).message === 'string'
          ? (rawError as { message: string }).message
          : 'Something went wrong. Please try again.';
      void trackPilotEvent({
        eventType: 'route_failure',
        severity: 'high',
        message: 'Apply submission failed',
        entity: {
          kind: 'opportunity',
          id: opportunity.id,
          label: opportunity.title,
          objectType: 'opportunity',
        },
        details: {
          error: nextError,
        },
        queueItem: {
          source: 'route_failure',
          title: 'Apply flow failed',
          message: nextError,
          severity: 'high',
          blocking: true,
        },
        dedupeKey: `apply-failure:${opportunity.id}:${nextError}`,
        oncePerSession: false,
      });
      setErrorMsg(nextError);
      setPhase('error');
    } catch {
      const nextError = 'Network error. Please check your connection and try again.';
      void trackPilotEvent({
        eventType: 'route_failure',
        severity: 'high',
        message: 'Apply network failure',
        entity: {
          kind: 'opportunity',
          id: opportunity.id,
          label: opportunity.title,
          objectType: 'opportunity',
        },
        details: {
          error: nextError,
        },
        queueItem: {
          source: 'route_failure',
          title: 'Apply flow network failure',
          message: nextError,
          severity: 'high',
          blocking: true,
        },
        dedupeKey: `apply-failure:${opportunity.id}:network`,
        oncePerSession: false,
      });
      setErrorMsg(nextError);
      setPhase('error');
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          className="relative z-10 flex max-h-[calc(100dvh-0.75rem)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl sm:max-h-[min(90dvh,44rem)]"
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.99 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="apply-modal-title"
        >
          <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 id="apply-modal-title" className="text-lg font-bold text-zinc-900">Apply now</h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {opportunity.title} - {opportunity.state}
              </p>
            </div>
            <button
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="border-b border-zinc-100 bg-zinc-50 px-4 py-3 sm:px-6">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-600">
                {opportunity.specialty}
              </span>
              <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium capitalize text-zinc-600">
                {opportunity.hiringType.replace(/_/g, ' ')}
              </span>
              {opportunity.organizationName ? (
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 font-medium text-zinc-600">
                  {opportunity.organizationName}
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-6">
            {phase === 'success' ? (
              <motion.div
                className="space-y-5 py-2 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              >
                <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-xl shadow-emerald-500/30">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <CheckCircle2 className="h-10 w-10 text-foreground" />
                  </motion.div>
                </div>
                <div>
                  <h3 className="text-2xl font-extrabold tracking-tight text-zinc-900 mb-2">
                    Application submitted
                  </h3>
                  <div className="mx-auto mt-4 max-w-sm rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-sm font-semibold text-emerald-900 flex items-center justify-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Verified profile attached.
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-emerald-800/80">
                      Your current readiness and verified identity went with this application, and we&apos;ll keep the status here as it moves.
                    </p>
                  </div>
                </div>

                {activeApplication ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-4 text-left shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">
                          {activeApplication.employer.name ?? activeApplication.opportunity.organizationName ?? opportunity.organizationName ?? 'Employer context'}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 font-medium">
                          {activeApplication.opportunity.title}
                        </p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(activeApplication.status)}`}>
                        {applicationStatusLabel(activeApplication.status)}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-zinc-500">
                      Submitted {formatTimestamp(activeApplication.createdAt) ?? 'just now'}
                    </p>
                  </motion.div>
                ) : null}

                <div className="space-y-3 pt-4 px-2">
                  <Link
                    href={activeApplicationHref}
                    className="inline-flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-zinc-900 px-6 font-bold text-foreground shadow-lg transition-all hover:bg-zinc-800 active:scale-[0.98]"
                    onClick={onClose}
                  >
                    <span>View application</span>
                    <ArrowRight className="h-4 w-4 text-zinc-400" />
                  </Link>
                  <button
                    onClick={onClose}
                    className="inline-flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-zinc-100 px-6 font-bold text-zinc-700 transition-all hover:bg-zinc-200 active:scale-[0.98]"
                  >
                    View opportunities
                  </button>
                </div>
              </motion.div>
            ) : !isLoaded ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
              </div>
            ) : !isSignedIn ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Sign in to apply now</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    We&apos;ll bring you back to this job and apply using your verified clinician profile.
                  </p>
                </div>
                <Link href={signInHref} className="glue-btn glue-btn-primary w-full justify-center">
                  Sign in to continue
                </Link>
                <Link
                  href={onboardingHref}
                  className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Check readiness first
                </Link>
              </div>
            ) : !isClinician || role === 'employer' ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Switch to your clinician workspace</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Applications only submit from a clinician profile with an active NPI.
                  </p>
                </div>
                {/* /workspace/switch never shipped; the live switcher is the
                    persona widget on the holder surfaces. */}
                <Link href="/holder" className="glue-btn glue-btn-primary w-full justify-center">
                  Open workspace switcher
                </Link>
              </div>
            ) : !clinicianNpi ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                  <p className="text-sm font-semibold text-zinc-900">Start onboarding to apply</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    We need your NPI-linked clinician profile before this employer can review you.
                  </p>
                </div>
                <Link href={onboardingHref} className="glue-btn glue-btn-primary w-full justify-center">
                  Continue onboarding
                </Link>
              </div>
            ) : existingApplicationRecord ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">Application already on file</p>
                      <p className="mt-1 text-sm text-zinc-600">
                        You&apos;re already in this employer&apos;s queue. Current status and employer context are below.
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(existingApplicationRecord.status)}`}>
                      {applicationStatusLabel(existingApplicationRecord.status)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-zinc-900">
                    {existingApplicationRecord.employer.name ?? existingApplicationRecord.opportunity.organizationName ?? opportunity.organizationName ?? 'Employer context attached'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">
                    {existingApplicationRecord.readiness?.readinessStatus ?? 'Your latest readiness stays attached to this application.'}
                  </p>
                  {formatTimestamp(existingApplicationRecord.updatedAt) ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Updated {formatTimestamp(existingApplicationRecord.updatedAt)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <Link
                    href={existingApplicationHref}
                    onClick={onClose}
                    className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-bold text-foreground shadow-md transition-all hover:bg-zinc-800 active:scale-[0.98]"
                  >
                    View application
                  </Link>
                  <button
                    onClick={onClose}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition-all hover:bg-zinc-50"
                  >
                    Back to roles
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                  <div className="flex items-start gap-4">
                    <ShieldCheck className="mt-0.5 h-6 w-6 text-emerald-500" />
                    <div className="w-full space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                        Verified NPI {clinicianNpi}
                      </p>
                      <p className="text-base font-bold text-zinc-900">
                        {readinessConfidence.title}
                      </p>
                      <p className="text-sm text-zinc-600">
                        {readinessConfidence.detail}
                      </p>
                      {loadingTrustState ? (
                        <p className="text-xs font-medium text-zinc-500">Syncing live readiness...</p>
                      ) : trustState ? (
                        <div className="mt-3 space-y-2 rounded-xl border border-emerald-100 bg-white p-3.5 shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-600">
                              Readiness {trustState.readinessLevel}
                            </p>
                          </div>
                          <p className="text-xs font-semibold text-zinc-800">
                            {trustState.readinessStatus}
                          </p>
                          {trustState.gapSummary.slice(0, 2).map((gap) => (
                            <p key={gap} className="text-[11px] text-zinc-500">
                              - {gap}
                            </p>
                          ))}
                          {trustState.computedAt ? (
                            <p className="text-[11px] text-zinc-500">
                              Updated {formatTimestamp(trustState.computedAt) ?? 'recently'}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Your latest readiness state will be computed on submission.
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <fieldset className="rounded-2xl border border-zinc-200 bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-zinc-900">
                      Choose what to present
                    </legend>
                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      The employer receives evidence from exactly these sections — omitted sections
                      are not presented. The field-by-field contents become visible in your
                      application record the moment it is sealed.
                    </p>
                    <p className="mt-1 text-xs leading-5 text-zinc-600">
                      Recipient: <span className="font-semibold text-zinc-800">{opportunity.organizationName}</span> · Purpose: this application only.
                    </p>
                    <div className="mt-3 space-y-2">
                      {DISCLOSURE_SECTIONS.map((section) => {
                        const selected = selectedSections.includes(section.id);
                        return (
                          <label
                            key={section.id}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 transition-colors hover:bg-zinc-50"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              disabled={section.required}
                              onChange={() => toggleDisclosureSection(section.id)}
                              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
                                {section.label}
                                {section.required ? (
                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600">
                                    Required
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-xs leading-5 text-zinc-600">{section.detail}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="mt-4">
                  <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                    Cover note <span className="font-normal text-zinc-400">(optional)</span>
                  </label>
                  <textarea
                    value={coverNote}
                    onChange={(event) => setCoverNote(event.target.value)}
                    rows={4}
                    placeholder="Briefly introduce yourself or highlight relevant experience..."
                    className="glue-input glue-input--emerald min-h-[112px] w-full resize-none px-4 py-3 text-sm leading-6 mb-2"
                  />
                  <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-100/50 p-2.5 rounded-lg border border-zinc-200">
                    This packet preserves what you selected at submission. Employers can review that submitted evidence and still decide what needs credentialing review.
                  </p>
                  </div>
                </div>

                {phase === 'error' ? (
                  <div className="space-y-3 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-4 text-sm">
                    <div>
                      <p className="font-semibold text-rose-900">Delivery Interrupted</p>
                      <p className="mt-1 text-sm text-rose-700">{errorMsg}</p>
                    </div>
                    <p className="text-xs leading-5 text-rose-800/80">
                      Your application draft remains safe. Review the role details and retry. If this persists, our system has securely logged the interruption.
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPhase('form');
                          setErrorMsg('');
                        }}
                        className="inline-flex items-center justify-center rounded-xl bg-rose-100 px-4 py-2.5 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-200 w-full sm:w-auto"
                      >
                        Retry Delivery
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 w-full sm:w-auto"
                      >
                        Return to Role
                      </button>
                      <Link
                        href="/holder/home"
                        onClick={onClose}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 w-full sm:w-auto"
                      >
                        Continue later
                      </Link>
                      <SupportActionButton
                        label="Contact support"
                        title="Apply flow blocked"
                        messagePrefill={errorMsg}
                        className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-50 w-full sm:w-auto"
                      />
                    </div>
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={phase === 'submitting'}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3.5 text-sm font-bold text-foreground shadow-[0_4px_14px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting application...
                    </>
                  ) : (
                    <>
                      Apply now
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {(trustState?.gapSummary.length ?? 0) > 0 ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-xs text-amber-900">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold text-amber-950">Shortest path to ready</p>
                        <p className="mt-1">
                          Resolve {trustState?.gapSummary[0]?.toLowerCase() ?? 'your top readiness gap'} in readiness if you want to tighten this application before employer review.
                        </p>
                        <p className="mt-1">
                          You can still submit now, and we&apos;ll carry the current readiness state into your application detail.
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/holder/readiness"
                      onClick={onClose}
                      className="mt-3 inline-flex items-center gap-2 font-semibold text-amber-950 hover:text-black"
                    >
                      Resolve in readiness
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                ) : (
                  <p className="text-center text-[11px] text-zinc-400">
                    Your verified profile and current readiness go with this application automatically.
                  </p>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
