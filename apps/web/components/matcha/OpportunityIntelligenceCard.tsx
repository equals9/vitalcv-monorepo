/**
 * OpportunityIntelligenceCard — Wave 4. Replaces the flat "job card" with an intelligence
 * card built entirely from real signals:
 *   - Fit band + score come from the engine's MatchExplanation.
 *   - "Why it fits" / "Potential concerns" come from engine fitReasons AND preference alignment.
 *   - Time-to-credential is a clearly-labeled estimate derived from unmet requirements.
 *
 * Honesty rule: dimensions the platform cannot yet score (interview probability, culture fit
 * as a number) are NOT shown as invented figures. Absent signals are simply omitted, and a
 * provenance line states what each score is based on.
 */

import {
  MatchaExplanation,
  reasonsFromFitReasons,
  type ExplanationReason,
} from './MatchaExplanation';
import { estimateTimeToCredential, matchBandDisplay } from '@/lib/matcha/opportunityFit';

export interface IntelligenceOpportunity {
  id: string;
  title: string;
  organization?: string;
  location?: string;
  state?: string;
  specialty?: string;
  payRange?: string;
  hiringType?: string;
  remote?: boolean;
  /**
   * Whether "Apply with VitalCV" exists for this listing, decided by the
   * backend's one integrated-apply rule and emitted on the live match. Never
   * derived at the web tier; absent reads as not available.
   */
  applicationMode?: 'external' | 'vitalcv';
  /** The employer's own posting for a feed-carried row, when the feed had one. */
  sourceUrl?: string | null;
}

export interface IntelligenceExplanation {
  matchBand: string;
  matchScore: number;
  confidence: number;
  fitReasons?: Array<{ label: string; positive: boolean; dimension?: string }>;
  missingCredentials?: string[];
  blockers?: Array<{ label: string; severity: 'hard' | 'soft'; actionLabel?: string }>;
  instantOfferEligible?: boolean;
}

export interface OpportunityIntelligenceCardProps {
  opportunity: IntelligenceOpportunity;
  /** Real engine output. Optional — the card degrades honestly without it. */
  explanation?: IntelligenceExplanation;
  /** Preference-grounded reasons from opportunityFit.preferenceMatchReasons. */
  preferenceReasons?: ExplanationReason[];
  href?: string;
  /**
   * Links the title to the opportunity detail route. Use this (not `href`)
   * when the card body contains interactive children — a whole-card anchor
   * would nest buttons inside an <a>.
   */
  titleHref?: string;
  /** Interactive content injected before the honesty footer (action bar, livability). */
  children?: React.ReactNode;
}

const TONE_COLORS: Record<string, string> = {
  go: 'var(--vt-status-resolved, #2E7D45)',
  near: 'var(--vt-accent, #0A7B7F)',
  partial: 'var(--vt-risk-medium, #A05C00)',
  blocked: 'var(--vt-risk-high, #8C2A2A)',
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--vt-text-muted)' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--vt-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub ? <div style={{ fontSize: 11, color: 'var(--vt-text-muted)' }}>{sub}</div> : null}
    </div>
  );
}

export function OpportunityIntelligenceCard({
  opportunity,
  explanation,
  preferenceReasons = [],
  href,
  titleHref,
  children,
}: OpportunityIntelligenceCardProps) {
  const band = explanation ? matchBandDisplay(explanation.matchBand) : null;
  const bandColor = band ? TONE_COLORS[band.tone] : 'var(--vt-text-muted)';

  // Merge engine reasons with preference reasons; de-duplicate on label.
  const engineReasons = reasonsFromFitReasons(explanation?.fitReasons);
  const seen = new Set<string>();
  const allReasons: ExplanationReason[] = [...engineReasons, ...preferenceReasons].filter((r) => {
    const key = r.label.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const positives = allReasons.filter((r) => r.positive);
  const concerns = allReasons.filter((r) => !r.positive);

  const hardBlockers = (explanation?.blockers ?? []).filter((b) => b.severity === 'hard').length;
  const missingCount = explanation?.missingCredentials?.length ?? hardBlockers;

  const Wrapper: React.ElementType = href ? 'a' : 'div';

  return (
    <Wrapper
      {...(href ? { href } : {})}
      className="matcha-lift"
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: 'var(--vt-surface, #fff)',
        border: '1px solid var(--vt-border, #E2E8E6)',
        borderRadius: 16,
        padding: 20,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--vt-text-primary)' }}>
            {titleHref ? (
              <a href={titleHref} style={{ color: 'inherit', textDecoration: 'none' }}>
                {opportunity.title}
              </a>
            ) : (
              opportunity.title
            )}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--vt-text-secondary)' }}>
            {[opportunity.organization, opportunity.location].filter(Boolean).join(' · ')}
          </p>
        </div>
        {band ? (
          <span
            style={{
              flex: '0 0 auto',
              fontSize: 12,
              fontWeight: 600,
              padding: '5px 10px',
              borderRadius: 999,
              color: bandColor,
              background: `color-mix(in srgb, ${bandColor} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${bandColor} 30%, transparent)`,
              whiteSpace: 'nowrap',
            }}
          >
            {band.label}
          </span>
        ) : null}
      </div>

      {/* Stat row — only real signals */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: 16,
          marginTop: 18,
          paddingTop: 16,
          borderTop: '1px solid var(--vt-border, #E2E8E6)',
        }}
      >
        {explanation ? (
          <Stat label="Fit" value={`${explanation.matchScore}`} sub={`${Math.round(explanation.confidence * 100)}% confidence`} />
        ) : null}
        {opportunity.payRange ? <Stat label="Comp" value={opportunity.payRange} /> : null}
        {opportunity.specialty ? <Stat label="Specialty" value={opportunity.specialty} /> : null}
        {explanation ? (
          <Stat
            label="To credential"
            value={missingCount === 0 ? 'Ready' : `${missingCount} item${missingCount === 1 ? '' : 's'}`}
            sub={estimateTimeToCredential(missingCount)}
          />
        ) : null}
      </div>

      {/* Why it fits */}
      {positives.length ? (
        <div style={{ marginTop: 16 }}>
          <MatchaExplanation reasons={positives} title="Why it fits" />
        </div>
      ) : null}

      {/* Potential concerns */}
      {concerns.length ? (
        <div style={{ marginTop: 14 }}>
          <MatchaExplanation reasons={concerns} title="Potential concerns" />
        </div>
      ) : null}

      {/* Instant offer signal (real, from engine) */}
      {explanation?.instantOfferEligible ? (
        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--vt-status-resolved, #2E7D45)',
          }}
        >
          Eligible for an instant offer based on your current trust state.
        </div>
      ) : null}

      {/* Interactive slot: action bar + livability */}
      {children}

      {/* Honesty footer: what these scores are based on */}
      <p style={{ margin: '16px 0 0', fontSize: 11, color: 'var(--vt-text-muted)', lineHeight: 1.5 }}>
        {explanation
          ? 'Fit reflects both your credential eligibility (from your trust state) and your stated preferences — location, role type, pay, and timing. This does not estimate interview outcomes.'
          : 'Live fit scoring is unavailable right now — reasons shown come from your stated preferences only.'}
      </p>
    </Wrapper>
  );
}
