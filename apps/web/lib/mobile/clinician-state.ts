import {
  normalizeClinicianApplications,
  normalizeMobileTrustState,
  type MobileApplication,
  type MobileDashboardData,
  type MobileOpportunityCard,
  type MobileTrustBand,
  type MobileTrustState,
} from '@/lib/mobile/dashboard';
import type { ClinicianProofPayload, OutcomeStateChange } from '@/lib/proof/types';
import { opportunityApplicationMode } from '@/lib/explore/opportunity-display';

export interface MobileProfileCompleteness {
  score: number;
  dimensions: {
    npiVerified: boolean;
    resumeUploaded: boolean;
    linksAdded: boolean;
    workAuthProvided: boolean;
    credentialsImported: boolean;
  };
}

export interface MobileTrustHistoryEntry extends MobileTrustState {
  id: string;
  deltaScore: number | null;
  deltaBand: 'up' | 'down' | 'same' | null;
  previousLevel: MobileTrustBand | null;
  previousScore: number | null;
  newGaps: string[];
  resolvedGaps: string[];
  reason: string | null;
}

export type ClinicianNotificationType =
  | 'readiness_improved'
  | 'missing_item_detected'
  | 'application_submitted'
  | 'application_status_changed'
  | 'trust_state_changed';

/**
 * Whether a notification is about an application. The nav badge sits on the
 * Applications tab, so it may only count these — it used to count the full
 * mixed feed (readiness deltas + blockers + applications), which produced
 * "5 updates" over a page showing zero applications.
 */
export function isApplicationNotification(notification: { type: ClinicianNotificationType }): boolean {
  return (
    notification.type === 'application_submitted' ||
    notification.type === 'application_status_changed'
  );
}

/**
 * Applications still in motion. `activeApplications` is "not withdrawn", which
 * deliberately keeps settled rows visible in lists — but a tile labelled
 * "Active" may not count ACCEPTED/DECLINED, or "Active 1 / Accepted 1" is
 * guaranteed for every accepted application.
 */
export function countApplicationsInMotion(
  applications: ReadonlyArray<{ status: string }>,
): number {
  return applications.filter(
    (application) => application.status !== 'ACCEPTED' && application.status !== 'DECLINED',
  ).length;
}

export type ClinicianBlockerType =
  | 'missing_credential'
  | 'unresolved_verification'
  | 'missing_profile_info'
  | 'application_requirement_gap';

export interface ClinicianNotification {
  id: string;
  type: ClinicianNotificationType;
  occurredAt: string;
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
  relatedBlockerId: string | null;
  relatedApplicationId: string | null;
  relatedOpportunityId: string | null;
}

export interface ClinicianBlocker {
  id: string;
  type: ClinicianBlockerType;
  title: string;
  label: string;
  detail: string;
  explanation: string;
  href: string;
  nextActionLabel: string;
  nextActionHref: string;
  occurredAt: string;
  relatedApplicationId: string | null;
  relatedOpportunityId: string | null;
  priority: number;
}

export interface RecommendedMobileAction {
  kind: 'finish_onboarding' | 'resolve_gap' | 'view_application' | 'apply_now' | 'view_passport';
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}

export interface ClinicianMobileData extends MobileDashboardData {
  profileCompleteness: MobileProfileCompleteness | null;
  proof?: ClinicianProofPayload | null;
  trustHistory: MobileTrustHistoryEntry[];
  notifications: ClinicianNotification[];
  blockers: ClinicianBlocker[];
  activeApplications: MobileApplication[];
  availableOpportunities: MobileOpportunityCard[];
  recommendedAction: RecommendedMobileAction | null;
}

type BlockerSeed = {
  type: ClinicianBlockerType;
  title: string;
  label: string;
  detail: string;
  explanation: string;
  nextActionLabel: string;
  nextActionHref: string;
  occurredAt: string;
  relatedApplicationId?: string | null;
  relatedOpportunityId?: string | null;
  priority: number;
};

const ONBOARDING_DIMENSIONS: Record<keyof MobileProfileCompleteness['dimensions'], Omit<BlockerSeed, 'occurredAt'>> = {
  npiVerified: {
    type: 'unresolved_verification',
    title: 'Identity verification incomplete',
    label: 'Verify your NPI-linked identity',
    detail: 'Your NPI-linked identity still needs verification.',
    explanation: 'Your readiness cannot fully clear until your NPI-linked clinician identity is verified.',
    nextActionLabel: 'Complete onboarding',
    nextActionHref: '/onboarding',
    priority: 10,
  },
  resumeUploaded: {
    type: 'missing_profile_info',
    title: 'Profile setup incomplete',
    label: 'Upload your current resume',
    detail: 'Your clinician profile is missing a current resume.',
    explanation: 'A current resume helps complete your clinician profile and keeps downstream applications from stalling.',
    nextActionLabel: 'Upload resume',
    nextActionHref: '__SELF__',
    priority: 40,
  },
  linksAdded: {
    type: 'missing_profile_info',
    title: 'Profile setup incomplete',
    label: 'Add LinkedIn or portfolio links',
    detail: 'Your clinician profile is missing professional links.',
    explanation: 'Add the missing profile details so your readiness and employer context stay complete.',
    nextActionLabel: 'Add links',
    nextActionHref: '__SELF__',
    priority: 50,
  },
  workAuthProvided: {
    type: 'missing_profile_info',
    title: 'Profile setup incomplete',
    label: 'Confirm work authorization',
    detail: 'Your clinician profile is missing work authorization details.',
    explanation: 'Your launch path can stall if work authorization is not confirmed in profile setup.',
    nextActionLabel: 'Confirm work authorization',
    nextActionHref: '__SELF__',
    priority: 30,
  },
  credentialsImported: {
    type: 'missing_credential',
    title: 'Credential evidence missing',
    label: 'Import credential evidence',
    detail: 'Your readiness needs credential evidence attached.',
    explanation: 'Upload a supporting credential or document. The file attaches immediately, but verification may complete asynchronously.',
    nextActionLabel: 'Upload evidence',
    nextActionHref: '__SELF__',
    priority: 20,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseOccurredAt(value: string | null): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function bandRank(value: MobileTrustBand | null | undefined): number {
  switch (value) {
    case 'L3':
      return 3;
    case 'L2':
      return 2;
    case 'L1':
      return 1;
    case 'L0':
    default:
      return 0;
  }
}

function describeTrustReason(entry: {
  newGaps: string[];
  resolvedGaps: string[];
  readinessStatus: string;
  gapSummary: string[];
}): string | null {
  if (entry.newGaps[0]) {
    return entry.newGaps[0];
  }

  if (entry.resolvedGaps[0]) {
    return `Resolved ${entry.resolvedGaps[0].toLowerCase()}`;
  }

  if (entry.gapSummary[0]) {
    return entry.gapSummary[0];
  }

  return entry.readinessStatus || null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function canResolveByUpload(label: string): boolean {
  const lower = label.toLowerCase();
  return /\b(upload|credential|document|license|dea|board|certificate|evidence|cv|resume|passport)\b/.test(lower);
}

function normalizeOutcomeStateChanges(raw: unknown): OutcomeStateChange[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const id = asString(entry.id);
      const objectType = asString(entry.objectType);
      const objectId = asString(entry.objectId);
      const outcomeType = asString(entry.outcomeType);
      const summary = asString(entry.summary);
      const occurredAt = asString(entry.occurredAt);

      if (!id || !objectType || !objectId || !outcomeType || !summary || !occurredAt) {
        return null;
      }

      return {
        id,
        objectType: objectType as OutcomeStateChange['objectType'],
        objectId,
        outcomeType: outcomeType as OutcomeStateChange['outcomeType'],
        summary,
        occurredAt,
        href: asString(entry.href),
      } satisfies OutcomeStateChange;
    })
    .filter((entry): entry is OutcomeStateChange => entry !== null);
}

function normalizeClinicianProofPayload(raw: unknown): ClinicianProofPayload | null {
  if (!isRecord(raw)) {
    return null;
  }

  const metrics = isRecord(raw.metrics) ? raw.metrics : null;

  return {
    generatedAt: asString(raw.generatedAt) ?? new Date().toISOString(),
    userSummary: asString(raw.userSummary),
    metrics: {
      onboardingCompletionMinutes: asFiniteNumber(metrics?.onboardingCompletionMinutes),
      blockersResolved: asFiniteNumber(metrics?.blockersResolved) ?? 0,
      applicationsSubmitted: asFiniteNumber(metrics?.applicationsSubmitted) ?? 0,
      applicationsMoving: asFiniteNumber(metrics?.applicationsMoving) ?? 0,
      readinessDelta: asFiniteNumber(metrics?.readinessDelta),
      readinessFromScore: asFiniteNumber(metrics?.readinessFromScore),
      readinessToScore: asFiniteNumber(metrics?.readinessToScore),
      readinessFromLevel: (asString(metrics?.readinessFromLevel) as ClinicianProofPayload['metrics']['readinessFromLevel']) ?? null,
      readinessToLevel: (asString(metrics?.readinessToLevel) as ClinicianProofPayload['metrics']['readinessToLevel']) ?? null,
    },
    completedBecauseOfVCV: Array.isArray(raw.completedBecauseOfVCV)
      ? raw.completedBecauseOfVCV.filter((value): value is string => typeof value === 'string')
      : [],
    recentChanges: normalizeOutcomeStateChanges(raw.recentChanges),
    applicationSummaries: Array.isArray(raw.applicationSummaries)
      ? raw.applicationSummaries
        .map((entry) => {
          if (!isRecord(entry)) {
            return null;
          }

          const applicationId = asString(entry.applicationId);
          const status = asString(entry.status);
          const summary = asString(entry.summary);
          const occurredAt = asString(entry.occurredAt);

          if (!applicationId || !status || !summary || !occurredAt) {
            return null;
          }

          return {
            applicationId,
            status,
            summary,
            occurredAt,
          };
        })
        .filter((entry): entry is ClinicianProofPayload['applicationSummaries'][number] => entry !== null)
      : [],
  };
}

function inferBlockerType(label: string, source: 'trust' | 'profile' | 'application'): ClinicianBlockerType {
  if (source === 'application') {
    return 'application_requirement_gap';
  }

  const lower = label.toLowerCase();

  if (/\bverify|verification|verified|unresolved|pending\b/.test(lower)) {
    return 'unresolved_verification';
  }

  if (/\bcredential|document|license|dea|certificate|evidence|upload|resume\b/.test(lower)) {
    return 'missing_credential';
  }

  return source === 'profile' ? 'missing_profile_info' : 'unresolved_verification';
}

function finalizeBlocker(seed: BlockerSeed): ClinicianBlocker {
  const id = [
    seed.type,
    seed.relatedApplicationId ?? 'global',
    seed.relatedOpportunityId ?? 'global',
    slugify(seed.label),
  ].join(':');
  const href = `/holder/blockers/${encodeURIComponent(id)}`;
  const nextActionHref = seed.nextActionHref === '__SELF__' ? href : seed.nextActionHref;

  return {
    id,
    type: seed.type,
    title: seed.title,
    label: seed.label,
    detail: seed.detail,
    explanation: seed.explanation,
    href,
    nextActionLabel: seed.nextActionLabel,
    nextActionHref,
    occurredAt: seed.occurredAt,
    relatedApplicationId: seed.relatedApplicationId ?? null,
    relatedOpportunityId: seed.relatedOpportunityId ?? null,
    priority: seed.priority,
  };
}

function recommendActionForGap(label: string): Pick<BlockerSeed, 'nextActionLabel' | 'nextActionHref'> {
  if (canResolveByUpload(label)) {
    return {
      nextActionLabel: 'Upload evidence',
      nextActionHref: '__SELF__',
    };
  }

  return {
    nextActionLabel: 'Open readiness history',
    nextActionHref: '/holder/readiness',
  };
}

function buildTrustGapBlockers(input: {
  trustState: MobileTrustState | null;
  refreshedAt: string;
}): ClinicianBlocker[] {
  return (input.trustState?.gapSummary ?? []).map((gap, index) => {
    const type = inferBlockerType(gap, 'trust');
    const action = recommendActionForGap(gap);

    return finalizeBlocker({
      type,
      title: type === 'missing_credential' ? 'Credential evidence missing' : 'Verification still unresolved',
      label: gap,
      detail: gap,
      explanation: type === 'missing_credential'
        ? 'Upload supporting evidence for this item. The file attaches immediately, but source verification may complete asynchronously.'
        : 'This item is still preventing a fully clear readiness state. Add stronger evidence or refresh once the source data updates.',
      occurredAt: input.trustState?.computedAt ?? input.refreshedAt,
      nextActionLabel: action.nextActionLabel,
      nextActionHref: action.nextActionHref,
      priority: 15 + index,
    });
  });
}

function buildProfileBlockers(input: {
  profileCompleteness: MobileProfileCompleteness | null;
  refreshedAt: string;
}): ClinicianBlocker[] {
  if (!input.profileCompleteness) {
    return [];
  }

  return (Object.keys(input.profileCompleteness.dimensions) as Array<keyof MobileProfileCompleteness['dimensions']>)
    .filter((dimension) => !input.profileCompleteness?.dimensions[dimension])
    .map((dimension) => finalizeBlocker({
      ...ONBOARDING_DIMENSIONS[dimension],
      occurredAt: input.refreshedAt,
    }));
}

function applicationNeedsFollowUp(application: MobileApplication): boolean {
  if (application.readiness?.gapSummary[0]) {
    return true;
  }

  const lowerLabel = application.latestRecommendation?.label?.toLowerCase() ?? '';
  const lowerExplanation = application.latestRecommendation?.explanation?.toLowerCase() ?? '';

  return /\b(upload|verify|complete|provide|resolve|document|credential|license)\b/.test(
    `${lowerLabel} ${lowerExplanation}`.trim(),
  );
}

function buildApplicationBlockers(input: {
  applications: readonly MobileApplication[];
  refreshedAt: string;
}): ClinicianBlocker[] {
  return input.applications
    .filter((application) => application.status !== 'ACCEPTED' && application.status !== 'DECLINED')
    .filter((application) => applicationNeedsFollowUp(application))
    .map((application, index) => {
      const label = application.readiness?.gapSummary[0]
        ?? application.latestRecommendation?.label
        ?? 'Complete the requested application follow-up';
      const needsUpload = canResolveByUpload(label)
        || canResolveByUpload(application.latestRecommendation?.explanation ?? '');

      return finalizeBlocker({
        type: 'application_requirement_gap',
        title: 'Application requirement gap',
        label,
        detail: `${application.opportunity.title} is waiting on this requirement.`,
        explanation: application.latestRecommendation?.explanation
          ?? `Resolve this requirement so ${application.opportunity.title} can keep moving through the employer queue.`,
        occurredAt: application.reviewedAt ?? application.updatedAt ?? input.refreshedAt,
        nextActionLabel: needsUpload ? 'Upload evidence' : 'Open application',
        nextActionHref: needsUpload ? '__SELF__' : `/holder/applications/${encodeURIComponent(application.id)}`,
        relatedApplicationId: application.id,
        relatedOpportunityId: application.opportunityId,
        priority: 5 + index,
      });
    });
}

function dedupeBlockers(blockers: readonly ClinicianBlocker[]): ClinicianBlocker[] {
  const byId = new Map<string, ClinicianBlocker>();

  blockers.forEach((blocker) => {
    const existing = byId.get(blocker.id);
    if (!existing) {
      byId.set(blocker.id, blocker);
      return;
    }

    if (
      blocker.priority < existing.priority
      || parseOccurredAt(blocker.occurredAt) > parseOccurredAt(existing.occurredAt)
    ) {
      byId.set(blocker.id, blocker);
    }
  });

  return [...byId.values()].sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }

    return parseOccurredAt(right.occurredAt) - parseOccurredAt(left.occurredAt);
  });
}

export function normalizeProfileCompleteness(raw: unknown): MobileProfileCompleteness | null {
  if (!isRecord(raw)) {
    return null;
  }

  const score = asFiniteNumber(raw.score);
  const dimensions = isRecord(raw.dimensions) ? raw.dimensions : null;
  if (score === null || !dimensions) {
    return null;
  }

  return {
    score,
    dimensions: {
      npiVerified: dimensions.npiVerified === true,
      resumeUploaded: dimensions.resumeUploaded === true,
      linksAdded: dimensions.linksAdded === true,
      workAuthProvided: dimensions.workAuthProvided === true,
      credentialsImported: dimensions.credentialsImported === true,
    },
  };
}

function normalizeTrustHistoryPayload(raw: unknown): MobileTrustState[] {
  const history = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.history)
      ? raw.history
      : [];

  return history
    .map((entry) => normalizeMobileTrustState(entry))
    .filter((entry): entry is MobileTrustState => Boolean(entry));
}

export function buildTrustHistory(input: {
  trustState: MobileTrustState | null;
  rawHistory: unknown;
}): MobileTrustHistoryEntry[] {
  const snapshots = [...normalizeTrustHistoryPayload(input.rawHistory)];
  if (input.trustState) {
    snapshots.unshift(input.trustState);
  }

  const deduped = snapshots.filter((snapshot, index, values) => {
    const key = `${snapshot.computedAt ?? 'missing'}:${snapshot.readinessLevel}:${snapshot.readinessScore}`;
    return values.findIndex((candidate) => {
      const candidateKey = `${candidate.computedAt ?? 'missing'}:${candidate.readinessLevel}:${candidate.readinessScore}`;
      return candidateKey === key;
    }) === index;
  });

  const sorted = deduped.sort((left, right) => parseOccurredAt(right.computedAt) - parseOccurredAt(left.computedAt));

  return sorted.map((snapshot, index) => {
    const previous = sorted[index + 1] ?? null;
    const previousGaps = previous?.gapSummary ?? [];
    const newGaps = snapshot.gapSummary.filter((gap) => !previousGaps.includes(gap));
    const resolvedGaps = previousGaps.filter((gap) => !snapshot.gapSummary.includes(gap));
    const deltaScore = previous ? snapshot.readinessScore - previous.readinessScore : null;
    const currentBandRank = bandRank(snapshot.readinessLevel);
    const previousBandRank = bandRank(previous?.readinessLevel ?? null);

    return {
      ...snapshot,
      id: `${snapshot.npi}:${snapshot.computedAt ?? index}:${snapshot.readinessLevel}:${snapshot.readinessScore}`,
      deltaScore,
      deltaBand: previous
        ? currentBandRank === previousBandRank
          ? 'same'
          : currentBandRank > previousBandRank
            ? 'up'
            : 'down'
        : null,
      previousLevel: previous?.readinessLevel ?? null,
      previousScore: previous?.readinessScore ?? null,
      newGaps,
      resolvedGaps,
      reason: describeTrustReason({
        newGaps,
        resolvedGaps,
        readinessStatus: snapshot.readinessStatus,
        gapSummary: snapshot.gapSummary,
      }),
    };
  });
}

function buildApplicationNotifications(applications: readonly MobileApplication[]): ClinicianNotification[] {
  return applications.flatMap((application) => {
    const submitted: ClinicianNotification = {
      id: `application_submitted:${application.id}:${application.createdAt}`,
      type: 'application_submitted',
      occurredAt: application.createdAt,
      title: 'Application submitted',
      body: `${application.opportunity.title} was sent to ${application.employer.name ?? application.opportunity.organizationName ?? 'the employer'} with your live readiness state attached.`,
      href: `/holder/applications/${encodeURIComponent(application.id)}`,
      ctaLabel: 'Open application',
      relatedBlockerId: null,
      relatedApplicationId: application.id,
      relatedOpportunityId: application.opportunityId,
    };

    if (application.status === 'PENDING') {
      return [submitted];
    }

    const changed: ClinicianNotification = {
      id: `application_status_changed:${application.id}:${application.updatedAt}:${application.status}`,
      type: 'application_status_changed',
      occurredAt: application.updatedAt,
      title: `Application ${application.status.toLowerCase().replace(/_/g, ' ')}`,
      body: application.reviewNote
        ?? application.latestRecommendation?.explanation
        ?? `${application.opportunity.title} is now ${application.status.toLowerCase().replace(/_/g, ' ')}.`,
      href: `/holder/applications/${encodeURIComponent(application.id)}`,
      ctaLabel: 'View application',
      relatedBlockerId: null,
      relatedApplicationId: application.id,
      relatedOpportunityId: application.opportunityId,
    };

    return [submitted, changed];
  });
}

function buildTrustNotifications(history: readonly MobileTrustHistoryEntry[]): ClinicianNotification[] {
  const notifications: ClinicianNotification[] = [];

  history.forEach((entry) => {
    if (entry.deltaScore === null && entry.newGaps.length === 0) {
      return;
    }

    if ((entry.deltaScore ?? 0) > 0 || entry.deltaBand === 'up') {
      notifications.push({
        id: `readiness_improved:${entry.id}`,
        type: 'readiness_improved',
        occurredAt: entry.computedAt ?? new Date().toISOString(),
        title: `Readiness improved to ${entry.readinessLevel}`,
        body: entry.reason
          ? `${entry.readinessScore}/100. ${entry.reason}`
          : `${entry.readinessScore}/100 and trending up.`,
        href: '/holder/readiness',
        ctaLabel: 'View history',
        relatedBlockerId: null,
        relatedApplicationId: null,
        relatedOpportunityId: null,
      });
    }

    if ((entry.deltaScore ?? 0) < 0 || entry.deltaBand === 'down') {
      notifications.push({
        id: `trust_state_changed:${entry.id}`,
        type: 'trust_state_changed',
        occurredAt: entry.computedAt ?? new Date().toISOString(),
        title: `Trust state changed to ${entry.readinessLevel}`,
        body: entry.reason
          ? `${entry.readinessScore}/100. ${entry.reason}`
          : `Readiness is now ${entry.readinessStatus}.`,
        href: '/holder/readiness',
        ctaLabel: 'Review history',
        relatedBlockerId: null,
        relatedApplicationId: null,
        relatedOpportunityId: null,
      });
    }
  });

  return notifications;
}

function buildBlockerNotifications(blockers: readonly ClinicianBlocker[]): ClinicianNotification[] {
  return blockers.map((blocker) => ({
    id: `missing_item_detected:${blocker.id}:${blocker.occurredAt}`,
    type: 'missing_item_detected',
    occurredAt: blocker.occurredAt,
    title: blocker.title,
    body: blocker.detail,
    href: blocker.href,
    ctaLabel: blocker.nextActionLabel,
    relatedBlockerId: blocker.id,
    relatedApplicationId: blocker.relatedApplicationId,
    relatedOpportunityId: blocker.relatedOpportunityId,
  }));
}

export function buildClinicianNotifications(input: {
  trustHistory: readonly MobileTrustHistoryEntry[];
  applications: readonly MobileApplication[];
  blockers: readonly ClinicianBlocker[];
}): ClinicianNotification[] {
  const notifications = [
    ...buildTrustNotifications(input.trustHistory),
    ...buildBlockerNotifications(input.blockers),
    ...buildApplicationNotifications(input.applications),
  ];

  const byId = new Map<string, ClinicianNotification>();
  notifications.forEach((notification) => {
    if (!byId.has(notification.id)) {
      byId.set(notification.id, notification);
    }
  });

  return [...byId.values()]
    .sort((left, right) => parseOccurredAt(right.occurredAt) - parseOccurredAt(left.occurredAt))
    .slice(0, 24);
}

export function buildBlockers(input: {
  trustState: MobileTrustState | null;
  profileCompleteness: MobileProfileCompleteness | null;
  applications: readonly MobileApplication[];
  refreshedAt: string;
}): ClinicianBlocker[] {
  return dedupeBlockers([
    ...buildTrustGapBlockers({
      trustState: input.trustState,
      refreshedAt: input.refreshedAt,
    }),
    ...buildProfileBlockers({
      profileCompleteness: input.profileCompleteness,
      refreshedAt: input.refreshedAt,
    }),
    ...buildApplicationBlockers({
      applications: input.applications,
      refreshedAt: input.refreshedAt,
    }),
  ]);
}

export function buildRecommendedAction(input: {
  trustState: MobileTrustState | null;
  profileCompleteness: MobileProfileCompleteness | null;
  blockers: readonly ClinicianBlocker[];
  activeApplications: readonly MobileApplication[];
  availableOpportunities: readonly MobileOpportunityCard[];
}): RecommendedMobileAction | null {
  const completeness = input.profileCompleteness?.score ?? 0;
  const onboardingStarted = completeness > 0;

  if (!input.trustState || completeness < 30) {
    return {
      kind: 'finish_onboarding',
      title: onboardingStarted ? 'Continue onboarding' : 'Start onboarding',
      description: onboardingStarted
        ? 'Finish the remaining setup steps so your readiness can move forward.'
        : 'Connect your clinician profile so you can unlock readiness and apply with confidence.',
      href: '/onboarding',
      ctaLabel: onboardingStarted ? 'Continue onboarding' : 'Start onboarding',
    };
  }

  if (input.blockers[0]) {
    return {
      kind: 'resolve_gap',
      title: 'Resolve what is left',
      description: input.blockers[0].detail,
      href: input.blockers[0].href,
      ctaLabel: input.blockers[0].nextActionLabel,
    };
  }

  if (input.activeApplications[0]) {
    return {
      kind: 'view_application',
      title: 'View your application',
      description: `${input.activeApplications[0].opportunity.title} is active and every update will land in one place.`,
      href: `/holder/applications/${encodeURIComponent(input.activeApplications[0].id)}`,
      ctaLabel: 'View application',
    };
  }

  const availableOpportunity = input.availableOpportunities.find((opportunity) => !opportunity.application)
    ?? input.availableOpportunities[0]
    ?? null;

  if (availableOpportunity) {
    // A feed-carried role cannot be applied to through VitalCV — the server
    // refuses it — so the next step for one is to read it, never to apply.
    // Match band alone used to decide this, and match band says nothing about
    // whether the employer posted the role here.
    const canApplyDirectly = opportunityApplicationMode(availableOpportunity) === 'vitalcv'
      && (availableOpportunity.match?.band === 'CLEAR'
        || availableOpportunity.match?.band === 'NEAR_CLEAR');

    return {
      kind: 'apply_now',
      title: canApplyDirectly ? 'Apply to your best live match' : 'View matched opportunities',
      description: canApplyDirectly
        ? `${availableOpportunity.title} at ${availableOpportunity.organizationName} is the shortest path from readiness into action.`
        : `${availableOpportunity.title} at ${availableOpportunity.organizationName} is open now and ready for review.`,
      href: canApplyDirectly
        ? `/holder/opportunities?apply=${encodeURIComponent(availableOpportunity.id)}`
        : '/holder/opportunities',
      ctaLabel: canApplyDirectly ? 'Apply now' : 'View opportunities',
    };
  }

  return {
    kind: 'view_passport',
    title: 'Review your readiness',
    description: 'Keep your source-backed identity and credential evidence ready to share.',
    href: '/holder',
    ctaLabel: 'Open passport',
  };
}

export function buildClinicianMobileData(input: {
  base: MobileDashboardData;
  profileCompleteness: MobileProfileCompleteness | null;
  rawTrustHistory: unknown;
  proof?: ClinicianProofPayload | null;
}): ClinicianMobileData {
  const trustHistory = buildTrustHistory({
    trustState: input.base.trustState,
    rawHistory: input.rawTrustHistory,
  });
  const activeApplications = input.base.applications.filter((application) => application.status !== 'WITHDRAWN');
  const availableOpportunities = input.base.opportunities.filter((opportunity) => !opportunity.application).slice(0, 6);
  const blockers = buildBlockers({
    trustState: input.base.trustState,
    profileCompleteness: input.profileCompleteness,
    applications: activeApplications,
    refreshedAt: input.base.refreshedAt,
  });

  return {
    ...input.base,
    profileCompleteness: input.profileCompleteness,
    proof: input.proof ?? null,
    trustHistory,
    blockers,
    activeApplications,
    availableOpportunities,
    notifications: buildClinicianNotifications({
      trustHistory,
      applications: activeApplications,
      blockers,
    }),
    recommendedAction: buildRecommendedAction({
      trustState: input.base.trustState,
      profileCompleteness: input.profileCompleteness,
      blockers,
      activeApplications,
      availableOpportunities,
    }),
  };
}

export function recomputeClinicianMobileData(input: {
  base: MobileDashboardData;
  profileCompleteness: MobileProfileCompleteness | null;
  trustHistory: readonly MobileTrustHistoryEntry[];
  proof?: ClinicianProofPayload | null;
}): ClinicianMobileData {
  const activeApplications = input.base.applications.filter((application) => application.status !== 'WITHDRAWN');
  const availableOpportunities = input.base.opportunities.filter((opportunity) => !opportunity.application).slice(0, 6);
  const blockers = buildBlockers({
    trustState: input.base.trustState,
    profileCompleteness: input.profileCompleteness,
    applications: activeApplications,
    refreshedAt: input.base.refreshedAt,
  });

  return {
    ...input.base,
    profileCompleteness: input.profileCompleteness,
    proof: input.proof ?? null,
    trustHistory: [...input.trustHistory],
    blockers,
    activeApplications,
    availableOpportunities,
    notifications: buildClinicianNotifications({
      trustHistory: input.trustHistory,
      applications: activeApplications,
      blockers,
    }),
    recommendedAction: buildRecommendedAction({
      trustState: input.base.trustState,
      profileCompleteness: input.profileCompleteness,
      blockers,
      activeApplications,
      availableOpportunities,
    }),
  };
}

export function normalizeClinicianMobilePayload(raw: unknown): ClinicianMobileData | null {
  if (!isRecord(raw)) {
    return null;
  }

  const base: MobileDashboardData = {
    signedIn: raw.signedIn === true,
    workspace: isRecord(raw.workspace) ? {
      personProfile: isRecord(raw.workspace.personProfile) ? {
        npi: asString(raw.workspace.personProfile.npi),
        firstName: asString(raw.workspace.personProfile.firstName),
        lastName: asString(raw.workspace.personProfile.lastName),
        specialty: asString(raw.workspace.personProfile.specialty),
        stateOfPractice: asString(raw.workspace.personProfile.stateOfPractice),
        completeness: asFiniteNumber(raw.workspace.personProfile.completeness),
      } : null,
    } : null,
    trustState: normalizeMobileTrustState(raw.trustState),
    applications: normalizeClinicianApplications(raw.applications),
    opportunities: Array.isArray(raw.opportunities) ? raw.opportunities as MobileOpportunityCard[] : [],
    missingForHigherMatches: Array.isArray(raw.missingForHigherMatches)
      ? raw.missingForHigherMatches.filter((value): value is string => typeof value === 'string')
      : [],
    refreshedAt: asString(raw.refreshedAt) ?? new Date().toISOString(),
  };

  return buildClinicianMobileData({
    base,
    profileCompleteness: normalizeProfileCompleteness(raw.profileCompleteness),
    rawTrustHistory: raw.trustHistory,
    proof: normalizeClinicianProofPayload(raw.proof),
  });
}
