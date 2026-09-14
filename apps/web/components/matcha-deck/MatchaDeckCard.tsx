/**
 * MATCHA Deck card face — layer 1 of the card anatomy.
 *
 * Answers the five questions at a glance: what the job is, why it matches,
 * what it pays, where/how the clinician would work, and what could prevent
 * a start. Unknown values are labeled unknown, never invented.
 */

import type { ReactNode } from 'react'

import {
  arrangementLabel,
  cardFaceReasons,
  formatCompensation,
  locationText,
  reasonMark,
  reasonToneClass,
} from './format'
import { matchSummaryText, overallLabelText } from './deckMachine'
import { DeckTermsBlock } from './DeckTerms'
import type { DeckRecommendation, MatchReason } from './types'

function ReasonLine({ reason }: { reason: MatchReason }) {
  return (
    <li className={`mdk-reason ${reasonToneClass(reason)}`}>
      <span className="mdk-reason-mark" aria-hidden="true">
        {reasonMark(reason)}
      </span>
      <span>
        {reason.label}
        {reason.origin ? <span className="mdk-reason-origin"> · {reason.origin}</span> : null}
      </span>
    </li>
  )
}

export interface MatchaDeckCardProps {
  recommendation: DeckRecommendation
  /** Directional overlays and other stage-managed children (active card only). */
  children?: ReactNode
}

export function MatchaDeckCard({ recommendation, children }: MatchaDeckCardProps) {
  const { opportunity, explanation, freshness } = recommendation
  const { fits, gap } = cardFaceReasons(recommendation)
  const compensation = formatCompensation(opportunity.compensation)
  const location = locationText(opportunity)
  const arrangement = arrangementLabel(opportunity.workArrangement)

  return (
    <>
      <div className="mdk-card-body">
        <div className="mdk-card-top">
          <div>
            <p className="mdk-employer">
              {opportunity.employerName}
              {opportunity.facilityName && opportunity.facilityName !== opportunity.employerName
                ? ` · ${opportunity.facilityName}`
                : null}
            </p>
            <h3 className="mdk-role">{opportunity.title}</h3>
          </div>
          <div className="mdk-chips">
            <span className={`mdk-chip mdk-chip--${explanation.overallLabel}`}>
              {overallLabelText(recommendation)}
            </span>
            {recommendation.isFixture ? <span className="mdk-chip mdk-chip--sample">Sample</span> : null}
          </div>
        </div>

        <ul className="mdk-meta">
          <li>
            {location ?? <span className="mdk-unknown-text">Location not provided</span>}
            {/* Skip the arrangement when it IS the location text (remote role
                with no city/state) — never render "Remote · Remote". */}
            {arrangement && arrangement !== location ? ` · ${arrangement}` : null}
          </li>
          <li>
            {compensation ? (
              <span className="mdk-comp">{compensation}</span>
            ) : (
              <span className="mdk-unknown-text">Compensation not provided</span>
            )}
            {opportunity.employmentType ? ` · ${opportunity.employmentType}` : null}
          </li>
          {opportunity.scheduleSummary ? <li>{opportunity.scheduleSummary}</li> : null}
        </ul>

        {/* The role checked against the person's terms, beside the role facts it reads —
            separate from the match block below, which is the person checked against the
            role. Placed above that block because the block is the card's flexible region
            and already overflows on narrow screens; the terms must never sit under it. */}
        <DeckTermsBlock opportunity={opportunity} variant="face" />

        <hr className="mdk-divider" />

        <div className="mdk-match-block">
          <div className="mdk-match-head">
            <span className="mdk-match-label">{overallLabelText(recommendation)}</span>
            <span className="mdk-match-summary">{matchSummaryText(recommendation)}</span>
          </div>
          <ul className="mdk-reasons">
            {fits.map((reason) => (
              <ReasonLine key={reason.id} reason={reason} />
            ))}
            {gap ? <ReasonLine reason={gap} /> : null}
          </ul>
        </div>
      </div>

      <div className="mdk-card-foot">
        <span className={freshness.stale ? 'mdk-freshness--stale' : undefined}>{freshness.label}</span>
        {opportunity.specialty ? <span>{opportunity.specialty}</span> : null}
      </div>

      {children}
    </>
  )
}
