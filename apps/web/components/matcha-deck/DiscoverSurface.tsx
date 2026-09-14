'use client'

/**
 * MATCHA Discover — the deck surface (PR J1, persistence PR J2).
 *
 * Hosts the MATCHA Deck under the holder workspace: header with the
 * Discover | Search mode toggle, an unmissable sample-data banner when the
 * server explicitly selects preview mode, and the deck itself. The client
 * never selects or falls back to fixture data.
 *
 * Decisions on a live deck are queued to the clinician's own append-only
 * decision log. Fixture decisions are never persisted — those opportunity ids
 * are not real, and the banner says so.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { MatchaDeck } from './MatchaDeck'
import { DeckTermsContext } from './DeckTerms'
import { DiscoveryModeBar } from './DiscoveryModeBar'
import { PassReasonBar } from './PassReasonBar'
import { PreferenceNudge } from './PreferenceNudge'
import { createDeckSource } from './sourceBoundary'
import { useDeckSignals } from './useDeckSignals'
import { applyDiscoveryMode, type DiscoveryMode } from '@/lib/matcha-deck/discoveryModes'
import { applyPreferenceNudge } from '@/lib/matcha-deck/applyPreferenceNudge'
import { emitPassReason } from '@/lib/matcha-deck/emitPassReason'
import { TermsListNote } from '@/components/matcha/TermsCheck'
import { useMatchaPreferences } from '@/components/matcha/useMatchaPreferences'
import { statedConstraintKeys } from '@/lib/matcha/constraintFit'
import {
  loadPassReasonSuppressed,
  persistPassReasonSuppressed,
  shouldPromptForReason,
} from '@/lib/matcha-deck/passReasons'
import {
  detectPreferenceNudge,
  type PreferenceNudge as PreferenceNudgeData,
  type SessionPass,
} from '@/lib/matcha-deck/preferenceNudges'
import type { DeckSignal, DeckSourcePayload } from './types'

declare global {
  interface Window {
    __mdkSignals?: DeckSignal[]
  }
}

export interface DiscoverSurfaceProps {
  payload: DeckSourcePayload
  /** The clinician's NPI, when known — attributed onto persisted signals. */
  npi?: string | null
}

export function DiscoverSurface({ payload, npi }: DiscoverSurfaceProps) {
  const [mode, setMode] = useState<DiscoveryMode>('for_you')
  const modeCtx = useMemo(() => ({ homeState: payload.homeState }), [payload.homeState])

  // The clinician's own terms, read once for the whole deck from the account-scoped
  // store; each card checks its record against them. Terms never reorder or drop a card.
  const terms = useMatchaPreferences(npi ?? undefined)
  const deckTerms = useMemo(
    () => ({ preferences: terms.preferences, loaded: terms.loaded }),
    [terms.preferences, terms.loaded],
  )
  const statedTermCount = terms.loaded ? statedConstraintKeys(terms.preferences).length : 0

  // The mode re-orders the SAME loaded recommendations — a pure lens, no fetch.
  // A new source object per mode makes the deck reload in the chosen order;
  // 'for_you' is the identity so it costs nothing.
  const source = useMemo(
    () =>
      createDeckSource({
        ...payload,
        recommendations: applyDiscoveryMode(payload.recommendations, mode, modeCtx),
      }),
    [payload, mode, modeCtx],
  )
  // Persistence follows the server's source decision: a preview deck's
  // opportunity ids are not real, so its decisions are never written.
  const { emit, unsavedCount, retryUnsaved } = useDeckSignals({
    enabled: !source.isFixture,
    npi,
  })

  // Progressive pass-reason prompting. Refs (not deps) so handleSignal stays a
  // stable callback the deck can hold, and a stale closure can't misfire.
  const passCountRef = useRef(0)
  const suppressedRef = useRef(false)
  const [pendingPass, setPendingPass] = useState<{
    opportunityId: string
    opportunityVersion: string
    title: string
  } | null>(null)

  // Progressive preference suggestion (J6c). Session-scoped pass pattern,
  // offered once, applied only on explicit confirmation, live decks only.
  const sessionPassesRef = useRef<SessionPass[]>([])
  const nudgeDismissedRef = useRef<Set<string>>(new Set())
  const [nudge, setNudge] = useState<PreferenceNudgeData | null>(null)
  const [nudgePending, setNudgePending] = useState(false)

  useEffect(() => {
    suppressedRef.current = loadPassReasonSuppressed()
  }, [])

  const handleSignal = useCallback(
    (signal: DeckSignal) => {
      emit(signal)
      // Mirrored to window.__mdkSignals so browser verification can assert
      // exactly-once emission independently of any network side effects.
      if (typeof window !== 'undefined') {
        window.__mdkSignals = window.__mdkSignals ?? []
        window.__mdkSignals.push(signal)
      }
      // After selected passes, offer an optional reason — never on every swipe.
      if (signal.action === 'passed') {
        passCountRef.current += 1
        const rec = payload.recommendations.find(
          (r) => r.opportunity.opportunityId === signal.opportunityId,
        )
        if (shouldPromptForReason(passCountRef.current, suppressedRef.current)) {
          setPendingPass({
            opportunityId: signal.opportunityId,
            opportunityVersion: signal.opportunityVersion,
            title: rec?.opportunity.title ?? 'this role',
          })
        }
        // Accumulate the session's pass pattern and, on a live deck, surface a
        // preference suggestion once — but never stacked on the reason prompt.
        if (!source.isFixture && rec) {
          sessionPassesRef.current.push({ workArrangement: rec.opportunity.workArrangement })
          const detected = detectPreferenceNudge(
            sessionPassesRef.current,
            nudgeDismissedRef.current,
          )
          if (detected) setNudge(detected)
        }
      }
    },
    [emit, payload.recommendations, source.isFixture],
  )

  const handlePickReason = useCallback(
    (reasonId: string) => {
      // A preview deck's ids are not real, so its reasons are practice only.
      if (pendingPass && !source.isFixture) {
        void emitPassReason({
          opportunityId: pendingPass.opportunityId,
          opportunityVersion: pendingPass.opportunityVersion,
          reason: reasonId,
          npi,
        })
      }
      setPendingPass(null)
    },
    [pendingPass, source.isFixture, npi],
  )

  const handleDontAskAgain = useCallback(() => {
    suppressedRef.current = true
    persistPassReasonSuppressed(true)
    setPendingPass(null)
  }, [])

  const dismissNudge = useCallback(() => {
    if (nudge) nudgeDismissedRef.current.add(nudge.id)
    setNudge(null)
  }, [nudge])

  const applyNudge = useCallback(async () => {
    if (!nudge) return
    setNudgePending(true)
    await applyPreferenceNudge(nudge.field, nudge.value)
    setNudgePending(false)
    nudgeDismissedRef.current.add(nudge.id)
    setNudge(null)
  }, [nudge])

  return (
    <div className="mdk-root" data-matcha-deck-source-mode={payload.mode}>
      <div className="mdk-shell">
        <header className="mdk-header">
          <div>
            <h1 className="mdk-title">Discover</h1>
            <p className="mdk-subtitle">
              Swipe through roles matched to your evidence and stated preferences. Interested saves a
              role for you — applying is always a separate step with evidence preview and consent.
            </p>
          </div>
          <div className="mdk-nav-group">
            <nav className="mdk-mode-toggle" aria-label="Opportunity view mode">
              <Link href="/holder/opportunities/discover" aria-current="page">
                Discover
              </Link>
              <Link href="/holder/opportunities">Search</Link>
            </nav>
            <nav className="mdk-saved-nav" aria-label="Saved roles">
              <Link href="/holder/opportunities/interested">Interested</Link>
              <Link href="/holder/opportunities/passed">Passed</Link>
            </nav>
          </div>
        </header>

        {source.isFixture ? (
          <p className="mdk-sample-banner" data-mdk-sample-banner="true">
            <span aria-hidden="true">◌</span>
            {source.sourceLabel}. Decisions here are practice only and are not saved.
          </p>
        ) : null}

        {payload.recommendations.length > 0 ? (
          <DiscoveryModeBar mode={mode} onChange={setMode} ctx={modeCtx} />
        ) : null}

        {payload.recommendations.length > 0 ? (
          <TermsListNote skin="mdk" loaded={terms.loaded} sync={terms.sync} statedCount={statedTermCount} />
        ) : null}

        {unsavedCount > 0 ? (
          <p className="mdk-unsaved-banner" role="status" data-mdk-unsaved={unsavedCount}>
            <span aria-hidden="true">◌</span>
            <span>
              {unsavedCount === 1 ? '1 decision was not saved' : `${unsavedCount} decisions were not saved`}
              . They are still on this device only.
            </span>
            <button type="button" className="mdk-btn mdk-btn--retry" onClick={retryUnsaved}>
              Try again
            </button>
          </p>
        ) : null}

        <DeckTermsContext.Provider value={deckTerms}>
          <MatchaDeck source={source} onSignal={handleSignal} />
        </DeckTermsContext.Provider>
      </div>

      {pendingPass ? (
        <PassReasonBar
          roleTitle={pendingPass.title}
          onPick={handlePickReason}
          onSkip={() => setPendingPass(null)}
          onDontAskAgain={handleDontAskAgain}
        />
      ) : nudge ? (
        // Only when no reason prompt is up — never stack two overlays.
        <PreferenceNudge nudge={nudge} pending={nudgePending} onApply={applyNudge} onDismiss={dismissNudge} />
      ) : null}
    </div>
  )
}
