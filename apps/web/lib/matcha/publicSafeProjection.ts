/**
 * Public-safe MATCHA projection at the WEB tier — Wave 1072C / C2.
 *
 * The backend already enforces this split. This is the second wall, and it
 * exists because of something the deployed preview proved: a web deployment
 * can point at a backend that does NOT yet carry the guard (the preview's
 * BACKEND_URL targets the production API), and the browser then receives the
 * full credential-derived object regardless of what the branch's backend code
 * says. A boundary that only holds when both tiers ship together is not a
 * boundary.
 *
 * FAIL CLOSED: the full object is forwarded only when the backend explicitly
 * marks the response `visibility: 'authenticated'` — a positive assertion that
 * it verified the session AND the NPI binding. Anything else (an older
 * backend with no marker, an unexpected shape, an error) is projected down.
 *
 * Mirrors apps/api/backend/src/services/matcha/publicSafeMatches.ts. The
 * duplication is deliberate: these are two independently deployable tiers, and
 * a shared import would not survive the version skew this exists to survive.
 */

const PUBLIC_DIMENSIONS = new Set(['specialty', 'state', 'location', 'taxonomy']);

export interface PublicSafeMatch {
  opportunityId: string;
  title: string;
  organizationName?: string;
  organizationId?: string;
  state?: string;
  hiringType?: string;
  applyAvailable: boolean;
  fitIndication: 'possible_fit' | 'limited_public_signal';
  publicReasons: string[];
}

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** True only when the backend positively asserts an authorized caller. */
export function isAuthenticatedVisibility(payload: unknown): boolean {
  return (payload as { visibility?: unknown })?.visibility === 'authenticated';
}

export function toPublicSafeMatches(npi: string, raw: unknown) {
  const list = Array.isArray((raw as { matches?: unknown[] })?.matches)
    ? (raw as { matches: unknown[] }).matches
    : [];

  const matches: PublicSafeMatch[] = list.slice(0, 6).map((entry) => {
    const m = (entry ?? {}) as Record<string, unknown>;
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
      opportunityId: String(opp.id ?? opp.opportunityId ?? m.opportunityId ?? ''),
      title: String(opp.title ?? opp.role ?? 'Opportunity'),
      organizationName: str(opp.organizationName) ?? str(opp.employerName),
      organizationId,
      state: str(opp.state),
      hiringType: str(opp.hiringType) ?? str(opp.employmentType),
      // When the backend already projected this match it answered the apply
      // question from its own integrated-apply rule; honour that answer. When
      // the raw engine match is being projected here, read the mode that rule
      // emitted — and when it is absent, the answer is "not available". An
      // organization id alone never means a listing can receive a share: a
      // feed placeholder has one too.
      applyAvailable: typeof m.applyAvailable === 'boolean'
        ? m.applyAvailable
        : opp.applicationMode === 'vitalcv' && Boolean(organizationId),
      fitIndication: (publicReasons.length > 0 ? 'possible_fit' : 'limited_public_signal') as PublicSafeMatch['fitIndication'],
      publicReasons,
    };
  }).filter((m) => m.opportunityId);

  return {
    npi,
    visibility: 'public' as const,
    matches,
    signInPrompt: 'Sign in to see readiness-aware matching for your own NPI.',
    generatedAt: new Date().toISOString(),
  };
}
