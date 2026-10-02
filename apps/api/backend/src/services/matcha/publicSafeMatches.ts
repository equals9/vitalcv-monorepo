/**
 * Public-safe MATCHA projection — Wave 1072C / C2.
 *
 * An NPI is public. A clinician's COMPILED readiness — which credentials they
 * hold, which are missing, what blocks them, what a sanction source returned —
 * is not, and anonymous callers were able to enumerate exactly that by walking
 * NPIs against the live match feed.
 *
 * This module is the allowlist boundary. Anonymous responses are BUILT UP from
 * public facts rather than filtered down from the private object, because a
 * deny-list silently leaks every field added later.
 *
 * Public-safe may include:
 *   - public opportunity information (it is already a public listing)
 *   - a coarse potential-fit indication
 *   - reasons derived ONLY from public NPPES identity (taxonomy/specialty,
 *     practice state)
 *   - a prompt to sign in for readiness-aware matching
 *
 * Public-safe must NEVER include: credential holdings, readiness gaps,
 * exclusion/sanction-derived conclusions, held or missing credential detail,
 * application history, private preferences, or per-clinician blockers
 * assembled from non-public state.
 */

/** Dimensions of a fit reason that come from the public registry alone. */
const PUBLIC_DIMENSIONS = new Set(['specialty', 'state', 'location', 'taxonomy']);

/** Coarse buckets — never the numeric score, never the private band detail. */
export type PublicFitIndication = 'possible_fit' | 'limited_public_signal';

export interface PublicSafeMatch {
  opportunityId: string;
  title: string;
  organizationName?: string;
  organizationId?: string;
  state?: string;
  hiringType?: string;
  /** Whether this listing can currently receive an Apply with VitalCV share. */
  applyAvailable: boolean;
  fitIndication: PublicFitIndication;
  /** Reasons traceable to public NPPES identity only. */
  publicReasons: string[];
}

export interface PublicSafeMatchResponse {
  npi: string;
  visibility: 'public';
  matches: PublicSafeMatch[];
  /** Told plainly, so the surface never substitutes illustrative data. */
  signInPrompt: string;
  generatedAt: string;
}

interface RawMatchLike {
  opportunity?: Record<string, unknown>;
  explanation?: Record<string, unknown>;
  [k: string]: unknown;
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/**
 * Project the engine's full result into the public-safe shape.
 *
 * `matchBand` is deliberately collapsed to two coarse buckets: the engine's
 * own bands (CLEAR / NEAR_CLEAR / PARTIAL / INELIGIBLE) are credential-derived
 * conclusions about a person, so publishing them anonymously would leak the
 * very thing this boundary exists to protect. INELIGIBLE in particular is a
 * statement about missing credentials.
 */
export function toPublicSafeMatches(
  npi: string,
  raw: { matches?: unknown[] } | null | undefined,
): PublicSafeMatchResponse {
  const list = Array.isArray(raw?.matches) ? raw!.matches! : [];

  const matches: PublicSafeMatch[] = list.slice(0, 6).map((entry) => {
    const m = (entry ?? {}) as RawMatchLike;
    const opp = (m.opportunity ?? m) as Record<string, unknown>;
    const explanation = (m.explanation ?? m) as Record<string, unknown>;

    const rawReasons = Array.isArray(explanation.fitReasons) ? explanation.fitReasons : [];
    const publicReasons = rawReasons
      .map((r) => (r ?? {}) as Record<string, unknown>)
      .filter((r) => PUBLIC_DIMENSIONS.has(String(r.dimension ?? '')))
      .map((r) => str(r.label))
      .filter((l): l is string => Boolean(l))
      .slice(0, 3);

    const organizationId = str(opp.organizationId) ?? str(opp.organization_id);

    return {
      opportunityId: String(opp.id ?? opp.opportunityId ?? ''),
      title: String(opp.title ?? opp.role ?? 'Opportunity'),
      organizationName: str(opp.organizationName) ?? str(opp.employerName),
      organizationId,
      state: str(opp.state),
      hiringType: str(opp.hiringType) ?? str(opp.employmentType),
      // A listing can receive a share only when the server's integrated-apply
      // rule says so AND it resolves to a real organization. `applicationMode`
      // is emitted by the live mapper from the same predicate the apply
      // service enforces; when it is absent the answer is "not available",
      // never a guess from the organization id alone — a feed placeholder has
      // one of those too.
      applyAvailable: opp.applicationMode === 'vitalcv' && Boolean(organizationId),
      fitIndication: (publicReasons.length > 0 ? 'possible_fit' : 'limited_public_signal') as PublicFitIndication,
      publicReasons,
    };
  }).filter((m) => m.opportunityId);

  return {
    npi,
    visibility: 'public',
    matches,
    signInPrompt: 'Sign in to see readiness-aware matching for your own NPI.',
    generatedAt: new Date().toISOString(),
  };
}
