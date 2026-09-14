import 'server-only'

import { auth } from '@clerk/nextjs/server'

import type { DeckRecommendation } from '@/components/matcha-deck/types'
import { fetchLaunchOpportunity, type OpportunitySummary } from '@/lib/launch/marketplace'
import { MARKETPLACE_BACKEND, buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy'
import { matchOpportunityId, toDeckRecommendations } from './liveRecommendation'

/** Records are read per match; the deck shows this many at most per load. */
const RECORD_FETCH_CAP = 24

/**
 * The canonical record for each matched opportunity, keyed by id. The engine's match
 * payload does not carry schedule, pay unit, pay provenance, or sponsorship; the public
 * projection does, and it is the same owner the Roles list and role detail read. A record
 * that cannot be read is simply absent — the card then says the check was unavailable.
 */
export async function loadMatchRecords(matches: unknown): Promise<Map<string, OpportunitySummary>> {
  const records = new Map<string, OpportunitySummary>()
  if (!Array.isArray(matches)) return records
  const ids = Array.from(
    new Set(matches.map(matchOpportunityId).filter((id): id is string => Boolean(id))),
  ).slice(0, RECORD_FETCH_CAP)
  const settled = await Promise.allSettled(ids.map((id) => fetchLaunchOpportunity(id)))
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) records.set(ids[index], result.value)
  })
  return records
}

const NPI_RE = /^\d{10}$/

async function backendJson<T>(path: string, headers: Headers): Promise<T | null> {
  try {
    const res = await fetch(`${MARKETPLACE_BACKEND}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** The clinician's NPI from their workspace, or null if not yet bound. */
async function resolveNpi(headers: Headers): Promise<string | null> {
  const workspaces = await backendJson<{ personProfile?: { npi?: unknown } }>(
    '/api/me/workspaces',
    headers,
  )
  const npi = workspaces?.personProfile?.npi
  return typeof npi === 'string' && NPI_RE.test(npi) ? npi : null
}

export interface LiveFeed {
  npi: string
  /** Currently-active MATCHA recommendations, mapped for the deck. */
  recommendations: DeckRecommendation[]
  /** The clinician's primary practice state, for the "Near me" mode (J6). */
  homeState?: string
}

/**
 * The signed-in clinician's live MATCHA feed, or null when it cannot be served
 * honestly (not signed in, no NPI bound, or the backend is unavailable). This
 * is the single source of live recommendations shared by the deck (J3) and the
 * Interested/Passed workspaces (J4): the workspace joins the clinician's
 * decision log against `recommendations` to hydrate saved roles and detect
 * version changes, so there is one live feed, read one way.
 *
 * Unlike the deck payload, an EMPTY active feed is returned as-is (not null):
 * the workspace still has decisions to show for roles no longer in the feed.
 */
export async function loadLiveFeed(): Promise<LiveFeed | null> {
  const session = await auth()
  if (!session.userId) return null

  const headers = await buildMarketplaceHeaders(session)
  const npi = await resolveNpi(headers)
  if (!npi) return null

  const payload = await backendJson<{ matches?: unknown; state?: unknown }>(
    `/api/matcha/opportunities/${encodeURIComponent(npi)}`,
    headers,
  )
  if (!payload) return null

  // The live matcha response carries the clinician's primary practice state
  // (profile.states[0]); a valid 2-letter code enables the "Near me" mode.
  const homeState =
    typeof payload.state === 'string' && /^[A-Za-z]{2}$/.test(payload.state)
      ? payload.state.toUpperCase()
      : undefined

  const records = await loadMatchRecords(payload.matches)
  return { npi, recommendations: toDeckRecommendations(payload.matches, records), homeState }
}
