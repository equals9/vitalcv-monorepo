'use client';

import * as React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';
import EvidenceUploadPanel from '@/components/mobile/EvidenceUploadPanel';
import ProfileCompletionPanel from '@/components/mobile/ProfileCompletionPanel';
import { rememberOpenedBlocker } from '@/components/mobile/ClinicianLaunchTracker';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { trackClinicianEvent } from '@/lib/mobile/analytics';

function formatWhen(value: string | null | undefined): string {
  if (!value) {
    return 'Pending';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Pending';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function profileCompletionMode(label: string): 'resume' | 'links' | 'work-auth' | null {
  const normalized = label.toLowerCase();

  if (/\bresume|cv\b/.test(normalized)) {
    return 'resume';
  }

  if (/\blinkedin|portfolio|link\b/.test(normalized)) {
    return 'links';
  }

  if (/\bwork authorization|authorization\b/.test(normalized)) {
    return 'work-auth';
  }

  return null;
}

export default function ClinicianBlockerDetailSurface({
  blockerId,
  evidenceUploadEnabled = false,
}: {
  blockerId: string;
  /**
   * Server-side decision from `lib/holder/evidenceUploadFlag.ts`, passed down
   * by the page because this is a client component and the flag is a runtime
   * server variable. Defaults to hidden so any mount that forgets to pass it
   * fails closed.
   */
  evidenceUploadEnabled?: boolean;
}) {
  const {
    data,
    visibleNotifications,
    markNotificationRead,
  } = useClinicianMobile();

  const blocker = data.blockers.find((entry) => entry.id === blockerId) ?? null;
  const relatedApplication = blocker?.relatedApplicationId
    ? data.activeApplications.find((application) => application.id === blocker.relatedApplicationId) ?? null
    : null;
  const relatedNotifications = blocker
    ? visibleNotifications.filter((notification) => notification.relatedBlockerId === blocker.id)
    : [];

  useEffect(() => {
    if (!blocker) {
      return;
    }

    rememberOpenedBlocker({
      id: blocker.id,
      type: blocker.type,
      label: blocker.label,
    });

    void trackClinicianEvent('clinician.blocker_opened', {
      blockerId: blocker.id,
      blockerType: blocker.type,
      blockerLabel: blocker.label,
      relatedApplicationId: blocker.relatedApplicationId,
      relatedOpportunityId: blocker.relatedOpportunityId,
    });

    relatedNotifications.forEach((notification) => {
      markNotificationRead(notification.id);
    });
  }, [blocker, markNotificationRead, relatedNotifications]);

  if (!blocker) {
    notFound();
  }

  const completionMode = profileCompletionMode(blocker.label);
  const isUploadBlocker = !completionMode
    && (
      blocker.type === 'missing_credential'
      || (
        blocker.type === 'unresolved_verification'
        && blocker.nextActionLabel.toLowerCase().includes('upload')
      )
    );
  const showUploadPanel = isUploadBlocker && evidenceUploadEnabled;
  // With upload switched off, an upload blocker must not fall through to the
  // generic "Do this now" action: its next-action link points back at this
  // page, so it would be a button that promises an upload and goes nowhere.
  const showUploadUnavailable = isUploadBlocker && !evidenceUploadEnabled;
  const relatedApplicationHref = relatedApplication
    ? `/holder/applications/${encodeURIComponent(relatedApplication.id)}`
    : null;
  const payoffTitle = relatedApplication
    ? `${relatedApplication.opportunity.title} can keep moving after this clears`
    : 'This moves your readiness forward';
  const payoffDetail = relatedApplication
    ? 'Once this item is attached, we will reflect the change here and in the related application detail.'
    : 'When this clears, we will update your readiness history and show the result back in your workspace.';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-28 pt-6 sm:px-6 sm:pb-12">
      <Link
        href="/holder/readiness"
        className="inline-flex items-center gap-2 text-sm text-white/65 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <section className="rounded-[32px] border border-amber-400/20 bg-amber-400/10 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-black/20">
            <AlertTriangle className="h-5 w-5 text-amber-100" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.18em] text-amber-100/75">{blocker.title}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">{blocker.label}</h1>
            
            <div className="mt-6 space-y-5 border-t border-amber-400/10 pt-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-100/50 mb-1">Why it's blocked</h3>
                <p className="text-sm leading-relaxed text-amber-50/90">{blocker.explanation}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-100/50 mb-1">How to fix</h3>
                <p className="text-sm leading-relaxed text-amber-50/90">{blocker.detail} {blocker.nextActionLabel}</p>
              </div>
              
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-100/50 mb-1">Estimated time</h3>
                <p className="text-sm leading-relaxed text-amber-50/90">~1–3 days after action</p>
              </div>
            </div>
            <p className="mt-5 text-[10px] text-amber-100/40">Last surfaced {formatWhen(blocker.occurredAt)}</p>
          </div>
        </div>

        {relatedApplication ? (
          <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Related application</p>
            <p className="mt-3 text-sm font-semibold text-white">{relatedApplication.opportunity.title}</p>
            <p className="mt-2 text-sm leading-6 text-white/65">
              {relatedApplication.employer.name ?? relatedApplication.opportunity.organizationName ?? 'Employer context'} · {relatedApplication.opportunity.state}
            </p>
          </div>
        ) : null}
      </section>

      <section className="rounded-[32px] border border-emerald-400/10 bg-emerald-400/5 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-400/80">Why this is worth doing now</p>
        <p className="mt-3 text-lg font-semibold text-white">{payoffTitle}</p>
        <p className="mt-2 text-sm leading-6 text-emerald-100/70">{payoffDetail}</p>
      </section>

      {completionMode ? (
        <ProfileCompletionPanel
          mode={completionMode}
          returnToHref={relatedApplicationHref ?? '/holder/readiness'}
          returnToLabel={relatedApplicationHref ? 'Return to application' : 'Return to readiness'}
        />
      ) : showUploadPanel ? (
        <EvidenceUploadPanel
          heading="Upload what clears this blocker"
          description="The file appears below right away. After verification finishes, we will update readiness and any waiting applications here."
          returnToHref={relatedApplicationHref ?? '/holder/readiness'}
          returnToLabel={relatedApplicationHref ? 'Return to application' : 'Return to readiness'}
        />
      ) : showUploadUnavailable ? (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Document upload</p>
          <p className="mt-3 text-lg font-semibold text-white">Adding documents is not available yet</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            This item stays open until the document can be added. Nothing on your profile has changed.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href={relatedApplicationHref ?? '/holder/readiness'}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              {relatedApplicationHref ? 'Return to application' : 'Return to readiness'}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Do this now</p>
          <p className="mt-3 text-lg font-semibold text-white">{blocker.nextActionLabel}</p>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Complete this action and we will show the result back in readiness and in any related application detail.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link
              href={blocker.nextActionHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-white/90"
            >
              {blocker.nextActionLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {relatedApplicationHref ? (
              <Link
                href={relatedApplicationHref}
                className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold text-white transition hover:border-white/20"
              >
                Return to application
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>
        </section>
      )}

      {relatedNotifications.length > 0 ? (
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/45">Related alerts</p>
          <div className="mt-4 space-y-3">
            {relatedNotifications.map((notification) => (
              <Link
                key={notification.id}
                href={notification.href}
                className="block rounded-2xl border border-white/10 bg-black/20 px-4 py-3 transition hover:border-white/20"
              >
                <p className="text-sm font-semibold text-white">{notification.title}</p>
                <p className="mt-2 text-sm leading-6 text-white/65">{notification.body}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
