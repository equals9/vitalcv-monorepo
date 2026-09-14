'use client'

/**
 * MATCHA Deck detail sheet — layers 2 and 3 of the card anatomy.
 *
 * Expands the active card into the complete opportunity view without losing
 * deck position: "Why this matches" grouped by provenance (confirmed /
 * preferences / needs review / unknown / blockers), the full listing facts,
 * and explicit actions. Unknown values render as unknown. Apply is a
 * separate, explicit transaction — this sheet never submits anything.
 */

import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'

import { arrangementLabel, formatCompensation, locationText, sponsorshipLabel } from './format'
import { matchSummaryText, overallLabelText } from './deckMachine'
import { DeckTermsBlock } from './DeckTerms'
import type { DeckDecision, DeckRecommendation, MatchReason } from './types'

interface ReasonGroupProps {
  title: string
  reasons: MatchReason[]
  toneClass: string
  mark: string
}

function ReasonGroup({ title, reasons, toneClass, mark }: ReasonGroupProps) {
  if (reasons.length === 0) return null
  return (
    <section className="mdk-sheet-section" aria-label={title}>
      <h3>{title}</h3>
      <ul className="mdk-reasons">
        {reasons.map((reason) => (
          <li key={reason.id} className={`mdk-reason ${toneClass}`}>
            <span className="mdk-reason-mark" aria-hidden="true">
              {mark}
            </span>
            <span>
              {reason.label}
              {reason.origin ? <span className="mdk-reason-origin"> · {reason.origin}</span> : null}
              {reason.detail ? <span className="mdk-reason-origin"> — {reason.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      {value ? <dd>{value}</dd> : <dd className="mdk-unknown-text">Not provided</dd>}
    </div>
  )
}

export interface DeckDetailSheetProps {
  recommendation: DeckRecommendation
  onClose: () => void
  onDecide: (decision: DeckDecision) => void
}

export function DeckDetailSheet({ recommendation, onClose, onDecide }: DeckDetailSheetProps) {
  const { opportunity, explanation, freshness, actions } = recommendation
  const closeRef = useRef<HTMLButtonElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const compensation = formatCompensation(opportunity.compensation)
  const compensationProvenance =
    opportunity.compensation?.provenance === 'unknown' || !opportunity.compensation
      ? 'Compensation provenance unknown'
      : opportunity.compensation.provenance === 'employer_provided'
        ? 'Provided by the employer'
        : 'From the source listing'

  const applyBlocked = recommendation.isFixture || !actions.canApply
  const applyNote = recommendation.isFixture
    ? 'Sample listing — Apply with VitalCV is available on live roles.'
    : actions.applyBlockReason

  const handleEscape = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <>
      <motion.div
        className="mdk-sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.2 }}
        onClick={onClose}
        data-testid="mdk-sheet-backdrop"
      />
      <motion.div
        className="mdk-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Details: ${opportunity.title} at ${opportunity.employerName}`}
        onKeyDown={handleEscape}
        initial={reducedMotion ? { opacity: 0 } : { y: '12%', opacity: 0 }}
        animate={reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
        transition={{ duration: reducedMotion ? 0.05 : 0.28, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <header className="mdk-sheet-head">
          <div>
            <h2 className="mdk-sheet-title">{opportunity.title}</h2>
            <p className="mdk-sheet-sub">
              {opportunity.employerName}
              {locationText(opportunity) ? ` · ${locationText(opportunity)}` : null}
              {' · '}
              {overallLabelText(recommendation)} — {matchSummaryText(recommendation)}
            </p>
          </div>
          <button ref={closeRef} type="button" className="mdk-btn mdk-sheet-close" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="mdk-sheet-body">
          <section className="mdk-sheet-section" aria-label="Role facts">
            <h3>The role</h3>
            <dl className="mdk-facts">
              <Fact label="Compensation" value={compensation} />
              <Fact label="Compensation source" value={compensation ? compensationProvenance : null} />
              <Fact label="Employment type" value={opportunity.employmentType} />
              <Fact label="Schedule" value={opportunity.scheduleSummary} />
              <Fact label="Call expectations" value={opportunity.callExpectations} />
              <Fact label="Location" value={locationText(opportunity)} />
              <Fact label="Work arrangement" value={arrangementLabel(opportunity.workArrangement)} />
              <Fact label="Specialty" value={opportunity.specialty} />
              <Fact label="Sponsorship" value={sponsorshipLabel(opportunity)} />
              <Fact label="Listing freshness" value={freshness.label} />
            </dl>
          </section>

          <DeckTermsBlock opportunity={opportunity} variant="sheet" />

          {opportunity.description ? (
            <section className="mdk-sheet-section" aria-label="Full description">
              <h3>Description</h3>
              <p>{opportunity.description}</p>
            </section>
          ) : null}

          {opportunity.licenseRequirements?.length || opportunity.experienceRequirements?.length ? (
            <section className="mdk-sheet-section" aria-label="Requirements">
              <h3>Requirements</h3>
              <ul className="mdk-reasons">
                {[...(opportunity.licenseRequirements ?? []), ...(opportunity.experienceRequirements ?? [])].map(
                  (requirement) => (
                    <li key={requirement} className="mdk-reason">
                      <span className="mdk-reason-mark" aria-hidden="true">
                        ·
                      </span>
                      <span>{requirement}</span>
                    </li>
                  ),
                )}
              </ul>
            </section>
          ) : null}

          {opportunity.benefits?.length ? (
            <section className="mdk-sheet-section" aria-label="Benefits">
              <h3>Benefits listed</h3>
              <ul className="mdk-reasons">
                {opportunity.benefits.map((benefit) => (
                  <li key={benefit} className="mdk-reason">
                    <span className="mdk-reason-mark" aria-hidden="true">
                      ·
                    </span>
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <ReasonGroup
            title="Confirmed"
            reasons={explanation.confirmed}
            toneClass="mdk-reason--confirmed"
            mark="✓"
          />
          <ReasonGroup
            title="Preferences"
            reasons={explanation.preferences}
            toneClass="mdk-reason--preference"
            mark="✓"
          />
          <ReasonGroup
            title="Needs review"
            reasons={explanation.needsReview}
            toneClass="mdk-reason--review"
            mark="△"
          />
          <ReasonGroup
            title="Potential blockers"
            reasons={explanation.blockers}
            toneClass="mdk-reason--blocker"
            mark="△"
          />
          <ReasonGroup title="Unknown" reasons={explanation.unknown} toneClass="mdk-reason--unknown" mark="?" />
        </div>

        <footer className="mdk-sheet-actions">
          <button type="button" className="mdk-btn" onClick={() => onDecide('passed')}>
            <span className="mdk-btn-icon" aria-hidden="true">
              ←
            </span>
            Pass
          </button>
          <button
            type="button"
            className="mdk-btn mdk-btn--interested"
            onClick={() => onDecide('interested')}
            disabled={!actions.canExpressInterest}
          >
            Interested
            <span className="mdk-btn-icon" aria-hidden="true">
              →
            </span>
          </button>
          <button
            type="button"
            className="mdk-btn mdk-btn--priority"
            onClick={() => onDecide('priority')}
            disabled={!actions.canExpressInterest}
          >
            <span className="mdk-btn-icon" aria-hidden="true">
              ★
            </span>
            Priority
          </button>
          {applyBlocked ? (
            <button
              type="button"
              className="mdk-btn"
              disabled
              title={applyNote ?? undefined}
              aria-disabled="true"
            >
              Apply with VitalCV
            </button>
          ) : (
            // A link to the consent surface — never a direct submit. ApplyModal
            // (opened by ?apply=) is where evidence preview and consent happen;
            // this handoff must land there, not POST an application.
            <Link
              className="mdk-btn mdk-btn--interested"
              href={`/holder/opportunities?apply=${encodeURIComponent(opportunity.opportunityId)}`}
            >
              Apply with VitalCV
            </Link>
          )}
          {applyNote ? <p className="mdk-apply-note">{applyNote}</p> : null}
          <p className="mdk-apply-note">
            Interested saves this role for you — applying stays a separate step with evidence preview and
            consent before anything is shared.
          </p>
        </footer>
      </motion.div>
    </>
  )
}
