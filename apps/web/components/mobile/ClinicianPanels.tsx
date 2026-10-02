'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Clock4,
  Compass,
  MapPin,
  Stethoscope,
  type LucideIcon,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import ApplyModal from '@/components/explore/ApplyModal';
import { useClinicianMobile } from '@/components/mobile/ClinicianMobileProvider';
import { formatEventTimestamp } from '@/lib/mobile/formatEventTimestamp';
import { ClinicianStatusBanner } from '@/components/mobile/ClinicianStatusBanner';
import { trackClinicianEventOncePerSession } from '@/lib/mobile/analytics';
import { opportunityApplicationMode } from '@/lib/explore/opportunity-display';
import type { ClinicianNotification } from '@/lib/mobile/clinician-state';
import {
  applicationStatusLabel,
  applicationStatusTone,
  type MobileApplication,
  type MobileOpportunityCard,
} from '@/lib/mobile/dashboard';

export interface MobileQuickAction {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
  tone: 'emerald' | 'sky' | 'amber' | 'zinc';
}



/** Map an application-status tone onto a calm truth-state chip variant. */
function toneClasses(tone: ReturnType<typeof applicationStatusTone>): string {
  switch (tone) {
    case 'emerald':
      return 'mz-chip-ok';
    case 'sky':
      return 'mz-chip-unknown';
    case 'rose':
      return 'mz-chip-p0';
    case 'zinc':
      return 'mz-chip-unknown';
    case 'amber':
    default:
      return 'mz-chip-watch';
  }
}

function matchTone(opportunity: MobileOpportunityCard): string {
  if (opportunity.application) {
    return toneClasses(applicationStatusTone(opportunity.application.status));
  }

  switch (opportunity.match?.band) {
    case 'CLEAR':
      return 'mz-chip-ok';
    case 'NEAR_CLEAR':
      return 'mz-chip-watch';
    case 'PARTIAL':
      return 'mz-chip-watch';
    default:
      return 'mz-chip-unknown';
  }
}

function matchLabel(opportunity: MobileOpportunityCard): string {
  if (opportunity.application) {
    return applicationStatusLabel(opportunity.application.status);
  }

  switch (opportunity.match?.band) {
    case 'CLEAR':
      return 'Clear to start';
    case 'NEAR_CLEAR':
      return 'Almost ready';
    case 'PARTIAL':
      return 'Partial fit';
    case 'INELIGIBLE':
      return 'Needs work';
    default:
      // No match data is a statement about what we know, not about the role.
      // 'Live role' asserted freshness precisely when we knew least.
      return 'Open role';
  }
}

export function OpportunityGrid({
  opportunities,
  heading,
  description,
  maxItems,
}: {
  opportunities: readonly MobileOpportunityCard[];
  heading?: string;
  description?: string;
  maxItems?: number;
}) {
  const { data, applySubmitted, selectOpportunity, selectedOpportunityId } = useClinicianMobile();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeOpportunityId, setActiveOpportunityId] = useState<string | null>(null);
  const supportsApplyQuery = pathname === '/holder/opportunities';

  const visibleOpportunities = maxItems ? opportunities.slice(0, maxItems) : opportunities;
  const activeOpportunity = visibleOpportunities.find((opportunity) => opportunity.id === activeOpportunityId)
    ?? opportunities.find((opportunity) => opportunity.id === activeOpportunityId)
    ?? null;
  const existingApplication = activeOpportunity
    ? data.activeApplications.find((application) => application.opportunityId === activeOpportunity.id) ?? null
    : null;

  const updateApplyQuery = React.useCallback((opportunityId: string | null) => {
    if (!supportsApplyQuery) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (opportunityId) {
      params.set('apply', opportunityId);
    } else {
      params.delete('apply');
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams, supportsApplyQuery]);

  React.useEffect(() => {
    if (!supportsApplyQuery) {
      return;
    }

    const applyId = searchParams.get('apply');
    if (!applyId) {
      setActiveOpportunityId(null);
      return;
    }

    const target = opportunities.find((opportunity) => opportunity.id === applyId) ?? null;
    // A deep link is an entry point like any other. Gating only the card's
    // button would leave ?apply=<feed row> opening the integrated modal for a
    // role the server refuses — other surfaces still build that link.
    if (target && opportunityApplicationMode(target) === 'vitalcv') {
      setActiveOpportunityId((current) => (current === applyId ? current : applyId));
      selectOpportunity(applyId);
      return;
    }

    updateApplyQuery(null);
  }, [opportunities, searchParams, selectOpportunity, supportsApplyQuery, updateApplyQuery]);

  return (
    <section className="mz mz-card p-5">
      {heading ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="mz-eyebrow">{heading}</p>
          </div>
          <Compass className="mt-0.5 h-5 w-5 text-[var(--ink-400)]" aria-hidden="true" />
        </div>
      ) : null}

      {visibleOpportunities.length > 0 ? (
        <div className="space-y-4">
          {visibleOpportunities.map((opportunity) => {
            const isSelected = selectedOpportunityId === opportunity.id;
            return (
              <article
                key={opportunity.id}
                className={`mz-interactive p-4 ${isSelected ? 'mz-card' : 'mz-inset'}`}
                style={isSelected ? { borderColor: 'var(--accent)' } : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <Link
                    href={`/holder/opportunities/${encodeURIComponent(opportunity.id)}`}
                    onClick={() => selectOpportunity(opportunity.id)}
                    className="min-w-0 flex-1"
                  >
                    <p className="mz-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[var(--ink-500)]">
                      <Building2 className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                      {opportunity.organizationName}
                    </p>
                    <h3 className="mz-h2 mt-2 transition hover:text-[var(--accent)]">
                      {opportunity.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-2 mz-body">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />{opportunity.state}</span>
                      <span className="opacity-40">·</span>
                      <span className="inline-flex items-center gap-1"><Stethoscope className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />{opportunity.specialty}</span>
                      {opportunity.payRange ? (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="mz-mono inline-flex items-center gap-1 font-medium text-[var(--ink-800)]"><Banknote className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />{opportunity.payRange}</span>
                        </>
                      ) : null}
                    </div>
                  </Link>
                  <span className={`mz-chip ${matchTone(opportunity)}`}>
                    <span className="mz-gl" />
                    {matchLabel(opportunity)}
                  </span>
                </div>

                {opportunity.match?.fitReasons.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {opportunity.match.fitReasons.slice(0, 3).map((reason) => (
                      <span
                        key={reason}
                        className="rounded-[2px] border border-[var(--rule)] bg-[var(--paper-2)] px-2.5 py-1 text-xs text-[var(--ink-600)]"
                      >
                        {reason}
                      </span>
                    ))}
                  </div>
                ) : null}

                {opportunity.match?.blockers.length ? (
                  <div className="mt-3 mz-inset px-4 py-3">
                    <p className="mz-mono text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-500)]">Requirements remaining</p>
                    <ul className="mt-2 space-y-1.5">
                      {opportunity.match.blockers.slice(0, 2).map((blocker) => (
                        <li key={blocker.label} className="flex items-start gap-2 text-xs text-[var(--ink-700)]">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--watch)]" />
                          <span>{blocker.label}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 mz-small">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock4 className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                    Posted {formatEventTimestamp(opportunity.createdAt)}
                  </span>
                  {opportunity.hiringType === 'PERMANENT' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                      Direct Hire
                    </span>
                  ) : opportunity.hiringType === 'LOCUM_TENENS' ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                      Locums
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  {opportunity.application ? (
                    <Link
                      href={`/holder/applications/${encodeURIComponent(opportunity.application.id)}`}
                      onClick={() => selectOpportunity(opportunity.id)}
                      className="mz-btn min-h-11 justify-center"
                    >
                      View application
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : opportunityApplicationMode(opportunity) === 'external' ? (
                    /*
                     * Carried from the employer's own posting: the application
                     * happens on their site. The public explore surfaces
                     * already drew this distinction; this signed-in card did
                     * not. The server now refuses these outright, so offering
                     * "Apply now" here would promise something that cannot
                     * happen. Other surfaces still advertise apply for feed
                     * rows (the MATCHA deck and WorkspaceCard) — those are
                     * separate follow-ups, not closed here.
                     */
                    opportunity.source?.url ? (
                      <a
                        href={opportunity.source.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        onClick={() => {
                          void trackClinicianEventOncePerSession(`opportunity-view:${opportunity.id}`, 'clinician.opportunity_viewed', {
                            npi: data.workspace?.personProfile?.npi ?? null,
                            opportunityId: opportunity.id,
                            organizationId: opportunity.organizationId,
                            requirementLevel: opportunity.requirementLevel,
                          });
                          selectOpportunity(opportunity.id);
                        }}
                        className="mz-btn min-h-11 justify-center"
                      >
                        View original listing
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    ) : (
                      /* No source page recorded — never render a dead control. */
                      <Link
                        href={`/holder/opportunities/${encodeURIComponent(opportunity.id)}`}
                        onClick={() => selectOpportunity(opportunity.id)}
                        className="mz-btn min-h-11 justify-center"
                      >
                        View role
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void trackClinicianEventOncePerSession(`opportunity-view:${opportunity.id}`, 'clinician.opportunity_viewed', {
                          npi: data.workspace?.personProfile?.npi ?? null,
                          opportunityId: opportunity.id,
                          organizationId: opportunity.organizationId,
                          requirementLevel: opportunity.requirementLevel,
                        });
                        setActiveOpportunityId(opportunity.id);
                        selectOpportunity(opportunity.id);
                        updateApplyQuery(opportunity.id);
                      }}
                      className="mz-btn min-h-11 justify-center"
                    >
                      Apply now
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <Link
                    href={`/holder/opportunities/${opportunity.id}`}
                    onClick={() => {
                      void trackClinicianEventOncePerSession(`opportunity-view:${opportunity.id}`, 'clinician.opportunity_viewed', {
                        npi: data.workspace?.personProfile?.npi ?? null,
                        opportunityId: opportunity.id,
                        organizationId: opportunity.organizationId,
                        requirementLevel: opportunity.requirementLevel,
                      });
                      selectOpportunity(opportunity.id);
                    }}
                    className="mz-btn mz-btn-ghost min-h-11 justify-center"
                  >
                    Role details
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="No matching roles available right now"
          detail="No live matches found for your current readiness profile."
          actionHref="/holder/readiness"
          actionLabel="View readiness"
        />
      )}

      {activeOpportunity ? (
        <ApplyModal
          opportunity={{
            id: activeOpportunity.id,
            title: activeOpportunity.title,
            specialty: activeOpportunity.specialty,
            hiringType: activeOpportunity.hiringType,
            state: activeOpportunity.state,
            organizationName: activeOpportunity.organizationName,
          }}
          existingApplication={existingApplication}
          onSubmitted={(application) => {
            applySubmitted(application);
          }}
          onClose={() => {
            setActiveOpportunityId(null);
            updateApplyQuery(null);
          }}
        />
      ) : null}
    </section>
  );
}

export function NotificationList({
  notifications,
  heading = 'Recent changes',
  description,
  maxItems,
  dismissible = false,
}: {
  notifications: readonly ClinicianNotification[];
  heading?: string;
  description?: string;
  maxItems?: number;
  dismissible?: boolean;
}) {
  const {
    dismissNotification,
    markNotificationRead,
    readNotificationIds,
  } = useClinicianMobile();
  const visibleNotifications = maxItems ? notifications.slice(0, maxItems) : notifications;

  return (
    <section className="mz mz-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mz-eyebrow">{heading}</p>
          {description ? (
            <p className="mt-2 mz-small">{description}</p>
          ) : null}
        </div>
        <BellRing className="mt-0.5 h-5 w-5 text-[var(--ink-400)]" aria-hidden="true" />
      </div>

      {visibleNotifications.length > 0 ? (
        <div className="space-y-3">
          {visibleNotifications.map((notification) => {
            const isRead = readNotificationIds.includes(notification.id);
            return (
              <div
                key={notification.id}
                className={`relative p-4 ${isRead ? 'mz-inset' : 'mz-card'}`}
                style={isRead ? undefined : { borderColor: 'var(--accent)' }}
              >
                {!isRead ? (
                  <div className="absolute left-0 top-0 h-full w-1 rounded-l-[3px] bg-[var(--accent)]" />
                ) : null}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mz-h2">{notification.title}</p>
                    <p className="mt-2 mz-body">{notification.body}</p>
                  </div>
                  {dismissible ? (
                    <button
                      type="button"
                      onClick={() => dismissNotification(notification.id)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--card)] text-[var(--ink-500)] transition hover:border-[var(--ink-400)] hover:text-[var(--ink-800)]"
                      aria-label={`Dismiss ${notification.title}`}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="mz-small mz-mono">{formatEventTimestamp(notification.occurredAt, 'Recently')}</span>
                  <Link
                    href={notification.href}
                    onClick={() => markNotificationRead(notification.id)}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--ink-900)]"
                  >
                    {notification.ctaLabel}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="You're all caught up"
          detail="Your notifications will appear here."
          actionHref="/holder/home"
          actionLabel="Return home"
        />
      )}
    </section>
  );
}

export function ApplicationList({
  applications,
  heading = 'Applications in motion',
  description,
  maxItems,
}: {
  applications: readonly MobileApplication[];
  heading?: string;
  description?: string;
  maxItems?: number;
}) {
  const visibleApplications = maxItems ? applications.slice(0, maxItems) : applications;

  return (
    <section className="mz mz-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mz-eyebrow">{heading}</p>
          {description ? (
            <p className="mt-2 mz-small">{description}</p>
          ) : null}
        </div>
        <BriefcaseBusiness className="mt-0.5 h-5 w-5 text-[var(--ink-400)]" aria-hidden="true" />
      </div>

      {visibleApplications.length > 0 ? (
        <div className="space-y-4">
          {visibleApplications.map((application) => (
            <article key={application.id} className="mz-inset p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="mz-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-400)]">
                    {application.employer.name ?? application.opportunity.organizationName ?? 'Employer context'}
                  </p>
                  <h3 className="mz-h2 mt-2">{application.opportunity.title}</h3>
                  <p className="mt-2 mz-body">
                    {application.opportunity.state} · {application.opportunity.specialty}
                  </p>
                </div>
                <span className={`mz-chip ${toneClasses(applicationStatusTone(application.status))}`}>
                  <span className="mz-gl" />
                  {applicationStatusLabel(application.status)}
                </span>
              </div>

              <div className="mt-4 mz-card px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="mz-h2">Record attached</p>
                  <span className="mz-chip mz-chip-ok">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {application.readiness?.readinessLevel ?? 'L0'}
                  </span>
                </div>
                <p className="mt-3 mz-body">
                  {application.readiness?.readinessStatus ?? 'Your readiness will auto-refresh when reviewed.'}
                </p>
                {application.latestRecommendation?.label ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-[2px] border border-[var(--rule)] bg-[var(--paper-2)] px-3 py-1 text-xs text-[var(--ink-700)]">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {application.latestRecommendation.label}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 mz-small">
                <span className="inline-flex items-center gap-1">
                  <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Updated {formatEventTimestamp(application.updatedAt)}
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/holder/applications/${encodeURIComponent(application.id)}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] transition hover:text-[var(--ink-900)]"
                  >
                    View application
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href={`/holder/opportunities/${application.opportunity.id}`}
                    className="inline-flex items-center gap-1 text-sm text-[var(--ink-500)] transition hover:text-[var(--ink-900)]"
                  >
                    <Building2 className="h-4 w-4" aria-hidden="true" />
                    Role details
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <ClinicianStatusBanner
          tone="info"
          title="No active applications"
          detail="You haven't applied to any roles yet."
          actionHref="/holder/opportunities"
          actionLabel="View opportunities"
        />
      )}
    </section>
  );
}

export function QuickActionGrid({ actions }: { actions: readonly MobileQuickAction[] }) {
  return (
    <section className="mz mz-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="mz-eyebrow">Other actions</p>
        </div>
        <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--ink-400)]" aria-hidden="true" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.id}
              href={action.href}
              className="mz-inset mz-interactive p-4"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-[8px] border border-[var(--rule)] bg-[var(--card)]">
                <Icon className="h-5 w-5 text-[var(--ink-700)]" />
              </div>
              <p className="mz-h2 mt-4">{action.label}</p>
              <p className="mt-2 mz-body">{action.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function SelectedOpportunityBanner() {
  const { data, selectedOpportunityId } = useClinicianMobile();
  const selectedOpportunity = selectedOpportunityId
    ? data.opportunities.find((opportunity) => opportunity.id === selectedOpportunityId) ?? null
    : null;

  if (!selectedOpportunity) {
    return null;
  }

  // One control (A4): the role card and the role detail own the apply/view
  // choreography. This banner is recall context from a localStorage card
  // click — repeating the card's CTA pair here made the same role show two
  // identical "Apply"/"View application" pairs on one screen.
  return (
    <section className="mz mz-glass p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mz-eyebrow">{selectedOpportunity.application ? 'Continuing where you left off' : 'Recently viewed role'}</p>
          <h2 className="mz-h2 mt-3">{selectedOpportunity.title}</h2>
          <p className="mt-2 mz-body">
            {selectedOpportunity.organizationName} · {selectedOpportunity.state}
          </p>
        </div>
        <Building2 className="mt-0.5 h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
      </div>
      <div className="mt-4">
        <Link
          href={`/holder/opportunities/${selectedOpportunity.id}`}
          className="mz-btn mz-btn-ghost min-h-11 justify-center"
        >
          Open role details
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
