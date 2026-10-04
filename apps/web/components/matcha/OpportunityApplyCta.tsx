'use client';

/**
 * OpportunityApplyCta — Wave K. Gates the real Apply-with-VitalCV share flow,
 * in this order:
 *   - the listing is not integrated-apply eligible (`applicationMode` is not
 *     'vitalcv' — a feed-carried row, or a row the server did not mark) → an
 *     honest pointer to where the application really happens, never an apply
 *     control the server would refuse;
 *   - hard blockers (or an INELIGIBLE band) → an honest "review what's blocking"
 *     affordance pointing at the full breakdown, never a broken apply button;
 *   - otherwise → the real ApplyWithVitalCV modal (POST /api/apply/share,
 *     audit-first, revocable), prefilled with this opportunity's employer.
 *
 * `applicationMode` is read from the server's own integrated-apply rule, the
 * same one the apply service enforces; this component never derives it. The
 * blocker gate reflects credential eligibility from the clinician's trust
 * state — it is the engine's output, not a promise about hiring outcomes.
 */

import { ApplyWithVitalCV } from '@/components/apply/ApplyWithVitalCV';
import type {
  IntelligenceExplanation,
  IntelligenceOpportunity,
} from './OpportunityIntelligenceCard';

export interface ApplyCtaOpportunity extends IntelligenceOpportunity {
  organizationId?: string;
  employerSlug?: string;
}

/** True only when the server positively marked the listing integrated. */
export function isIntegratedApply(opportunity: Pick<ApplyCtaOpportunity, 'applicationMode'>): boolean {
  return opportunity.applicationMode === 'vitalcv';
}

export function hardGateCount(explanation?: IntelligenceExplanation): number {
  if (!explanation) return 0;
  const hard = (explanation.blockers ?? []).filter((b) => b.severity === 'hard').length;
  if (hard > 0) return hard;
  return explanation.matchBand === 'INELIGIBLE'
    ? Math.max(explanation.missingCredentials?.length ?? 0, 1)
    : 0;
}

export interface OpportunityApplyCtaProps {
  npi: string | null | undefined;
  opportunity: ApplyCtaOpportunity;
  explanation?: IntelligenceExplanation;
  /** Where the blocked state's "review" affordance points (the detail breakdown). */
  detailHref?: string;
  onShareComplete?: () => void;
}

export function OpportunityApplyCta({
  npi,
  opportunity,
  explanation,
  detailHref,
  onShareComplete,
}: OpportunityApplyCtaProps) {
  if (!npi) return null;

  if (!isIntegratedApply(opportunity)) {
    // Carried from the employer's own posting, or never marked integrated by
    // the server: the application does not happen here. Say so, and point at
    // the real posting when the feed recorded one. Checked BEFORE the blocker
    // gate — "N requirements before you can apply" would imply a VitalCV
    // apply path exists for this role, and it does not.
    const carried = opportunity.applicationMode === 'external';
    const sourceUrl = typeof opportunity.sourceUrl === 'string' && opportunity.sourceUrl.trim()
      ? opportunity.sourceUrl.trim()
      : null;
    return (
      <div
        data-testid="apply-external"
        style={{
          marginTop: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid var(--vt-border, #D6DED9)',
          background: 'var(--vt-surface, #fff)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-text-muted, #5A6472)' }}>
          {carried
            ? 'This role is carried from the employer’s own posting. Apply on the employer’s site.'
            : 'Applying through VitalCV is not available for this listing.'}
        </span>
        {sourceUrl ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--vt-accent, #0A7B7F)',
              textDecoration: 'none',
            }}
          >
            View original listing →
          </a>
        ) : null}
      </div>
    );
  }

  const gates = hardGateCount(explanation);
  if (gates > 0) {
    const label = `${gates} gating requirement${gates === 1 ? '' : 's'} to resolve before you can apply`;
    return (
      <div
        data-testid="apply-blocked"
        style={{
          marginTop: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          borderRadius: 12,
          border: '1px solid color-mix(in srgb, var(--vt-risk-medium, #A05C00) 30%, transparent)',
          background: 'color-mix(in srgb, var(--vt-risk-medium, #A05C00) 8%, transparent)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--vt-risk-medium, #A05C00)' }}>
          {label}
        </span>
        {detailHref ? (
          <a
            href={detailHref}
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--vt-accent, #0A7B7F)',
              textDecoration: 'none',
            }}
          >
            See what&rsquo;s needed →
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <ApplyWithVitalCV
        npi={npi}
        initialOrgContext={{
          name: opportunity.organization ?? '',
          organization_id: opportunity.organizationId ?? opportunity.employerSlug ?? '',
          purpose_of_use: 'Employment consideration',
        }}
        onShareComplete={onShareComplete ? () => onShareComplete() : undefined}
      />
    </div>
  );
}
