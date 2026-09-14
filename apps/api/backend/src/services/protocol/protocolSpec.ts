/**
 * protocolSpec.ts — VitalCV Trust Protocol Machine-Readable Specification
 *
 * The canonical, versioned description of the Trust Protocol.
 * Consumed by:
 *   - Third-party implementations building conforming systems
 *   - Conformance test runners (what must pass)
 *   - SDK code generation tools
 *   - AI agents integrating VitalCV authority verification
 *
 * Spec URL: https://vitalcv.com/protocol/spec/v1
 */

export const PROTOCOL_VERSION = '1.0.0';
export const PROTOCOL_STATUS  = 'ACTIVE' as const;

// ── Conformance test definitions ──────────────────────────────────────────────

export interface ConformanceTest {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  requiredResponseFields: string[];
  requiredStatusCodes: number[];
  level: 'REQUIRED' | 'RECOMMENDED' | 'OPTIONAL';
  group: 'IDENTITY' | 'TRUST_STATE' | 'CREDENTIAL' | 'CAPSULE' | 'PASSPORT' | 'VERIFY';
}

export const CONFORMANCE_TESTS: ConformanceTest[] = [
  // ── Identity / NPI resolution ──────────────────────────────────────────
  {
    id:   'IDENTITY-001',
    name: 'NPI Bootstrap',
    description: 'Resolve a clinician identity by NPI and return canonical profile data',
    method: 'POST', path: '/api/profile/npi/bootstrap',
    body: { npi: '1558395516' },
    requiredResponseFields: ['npi', 'name'],
    requiredStatusCodes: [200, 201],
    level: 'REQUIRED', group: 'IDENTITY',
  },
  {
    id:   'IDENTITY-002',
    name: 'NPI Credential Ingest',
    description: 'Ingest NPPES data and produce VerificationArtifacts',
    method: 'POST', path: '/api/credentials/ingest-npi',
    body: { npi: '1558395516' },
    requiredResponseFields: ['npi', 'artifactsCreated'],
    requiredStatusCodes: [200, 201],
    level: 'REQUIRED', group: 'IDENTITY',
  },

  // ── Trust state ───────────────────────────────────────────────────────
  {
    id:   'TRUST-001',
    name: 'Trust State GET',
    description: 'Retrieve computed trust state for a clinician NPI',
    method: 'GET', path: '/api/trust-state/1558395516',
    requiredResponseFields: ['readiness_level', 'readiness_score'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'TRUST_STATE',
  },
  {
    id:   'TRUST-002',
    name: 'Trust Band Enum',
    description: 'Trust band must be one of L0, L1, L2, L3',
    method: 'GET', path: '/api/trust-state/1558395516',
    requiredResponseFields: ['readiness_level'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'TRUST_STATE',
  },
  {
    id:   'TRUST-003',
    name: 'Trust Cache Stats',
    description: 'Expose cache statistics endpoint',
    method: 'GET', path: '/api/trust-state/cache/stats',
    requiredResponseFields: ['size'],
    requiredStatusCodes: [200],
    level: 'RECOMMENDED', group: 'TRUST_STATE',
  },

  // ── Credential / PSV ──────────────────────────────────────────────────
  {
    id:   'CRED-001',
    name: 'PSV Verify',
    description: 'Run parallel source verification and return source results',
    method: 'POST', path: '/api/psv/verify',
    body: { npi: '1558395516' },
    requiredResponseFields: ['npi', 'sources'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'CREDENTIAL',
  },
  {
    id:   'CRED-002',
    name: 'AI Professional Verify',
    description: 'Machine-readable authorization verdict for AI systems',
    method: 'GET', path: '/api/verify-professional/1558395516',
    requiredResponseFields: ['npi', 'verdict', 'confidence'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'VERIFY',
  },
  {
    id:   'CRED-003',
    name: 'Verify Verdict Enum',
    description: 'Verdict must be AUTHORIZED, CONDITIONAL, or BLOCKED',
    method: 'GET', path: '/api/verify-professional/1558395516',
    requiredResponseFields: ['verdict'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'VERIFY',
  },

  // ── Decision Capsules ─────────────────────────────────────────────────
  {
    id:   'CAPSULE-001',
    name: 'Capsule List',
    description: 'List decision capsules for a clinician',
    method: 'GET', path: '/api/decisions?npi=1558395516',
    requiredResponseFields: ['capsules'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'CAPSULE',
  },
  {
    id:   'CAPSULE-002',
    name: 'NPI Timeline',
    description: 'Return ordered decision timeline for a clinician',
    method: 'GET', path: '/api/decisions/npi/1558395516/timeline',
    requiredResponseFields: ['npi', 'events'],
    requiredStatusCodes: [200],
    level: 'RECOMMENDED', group: 'CAPSULE',
  },

  // ── Passport ──────────────────────────────────────────────────────────
  {
    id:   'PASSPORT-001',
    name: 'Passport GET',
    description: 'Return public-mode Clinician Passport',
    method: 'GET', path: '/api/passport/1558395516',
    requiredResponseFields: ['npi', 'trustBand'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'PASSPORT',
  },
  {
    id:   'PASSPORT-002',
    name: 'Passport Trust',
    description: 'Return trust state for a passport subject',
    method: 'GET', path: '/api/passport/1558395516/trust',
    requiredResponseFields: ['trustBand', 'trustScore'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'PASSPORT',
  },
  {
    id:   'PASSPORT-003',
    name: 'Selective Disclosure',
    description: 'Selective field disclosure endpoint',
    method: 'GET', path: '/api/passport/1558395516/disclose',
    requiredResponseFields: [],
    requiredStatusCodes: [200, 400],
    level: 'RECOMMENDED', group: 'PASSPORT',
  },

  // ── Well-known / Discovery ────────────────────────────────────────────
  {
    id:   'DISCOVERY-001',
    name: 'Well-Known Discovery',
    description: 'Serve .well-known/vitalcv-trust discovery document',
    method: 'GET', path: '/.well-known/vitalcv-trust',
    requiredResponseFields: ['protocol_version', 'trust_state_endpoint', 'verify_endpoint'],
    requiredStatusCodes: [200],
    level: 'REQUIRED', group: 'IDENTITY',
  },
  {
    id:   'DISCOVERY-002',
    name: 'Protocol Spec',
    description: 'Serve machine-readable protocol spec at /api/protocol/spec',
    method: 'GET', path: '/api/protocol/spec',
    requiredResponseFields: ['version', 'status', 'endpoints'],
    requiredStatusCodes: [200],
    level: 'RECOMMENDED', group: 'IDENTITY',
  },
];

// ── Endpoint catalogue (for spec / code-gen) ──────────────────────────────────

export interface EndpointSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  tags: string[];
  required: boolean;
  requestBody?: Record<string, unknown>;
  responseSchema: Record<string, unknown>;
}

export const ENDPOINT_CATALOGUE: EndpointSpec[] = [
  { method: 'POST', path: '/api/psv/verify',
    summary: 'Parallel Source Verification — verify credentials against all primary sources simultaneously',
    tags: ['credential', 'psv'], required: true,
    requestBody: { npi: 'string (10-digit)' },
    responseSchema: { npi: 'string', sources: 'SourceResult[]', trustBand: 'TrustBand', latencyMs: 'number' } },

  { method: 'GET', path: '/api/trust-state/:npi',
    summary: 'Retrieve computed TrustState for a clinician',
    tags: ['trust-state'], required: true,
    responseSchema: { readiness_level: 'TrustBand', readiness_score: 'number', readiness_status: 'string', facts: 'CanonicalFact[]', computedAt: 'string' } },

  { method: 'GET', path: '/api/verify-professional/:npi',
    summary: 'Machine-readable authorization verdict for AI systems',
    tags: ['verify', 'ai'], required: true,
    responseSchema: { npi: 'string', verdict: 'AUTHORIZED|CONDITIONAL|BLOCKED', confidence: 'HIGH|MEDIUM|LOW', checks: 'CheckResult[]', auditRef: 'string' } },

  { method: 'GET', path: '/api/passport/:npi',
    summary: 'Clinician Passport — public trust summary with optional selective disclosure',
    tags: ['passport'], required: true,
    responseSchema: { npi: 'string', trustBand: 'TrustBand', licenses: 'License[]', certifications: 'Cert[]', sanctions: 'SanctionStatus' } },

  { method: 'GET', path: '/api/passport/:npi/embed.svg',
    summary: 'SVG trust badge for embedding in third-party systems',
    tags: ['passport', 'badge'], required: false,
    responseSchema: { contentType: 'image/svg+xml' } },

  { method: 'GET', path: '/api/decisions/npi/:npi/timeline',
    summary: 'Ordered decision history for a clinician with replay links',
    tags: ['capsule', 'audit'], required: true,
    responseSchema: { npi: 'string', events: 'DecisionEvent[]', total: 'number' } },

  { method: 'GET', path: '/api/decisions/:id/replay',
    summary: 'Cryptographic replay verification of a DecisionCapsule',
    tags: ['capsule', 'audit'], required: true,
    responseSchema: { valid: 'boolean', capsuleId: 'string', expectedArtifactHash: 'string' } },

  { method: 'GET', path: '/api/decisions/:id/bundle',
    summary: 'Deep audit bundle — self-verifying portable artifact',
    tags: ['capsule', 'audit', 'export'], required: false,
    responseSchema: { bundleHash: 'string', replays: 'DecisionReplay[]' } },

  { method: 'GET', path: '/.well-known/vitalcv-trust',
    summary: 'Protocol discovery document (like OpenID .well-known)',
    tags: ['discovery'], required: true,
    responseSchema: { protocol_version: 'string', trust_state_endpoint: 'string', verify_endpoint: 'string' } },

  { method: 'GET', path: '/api/authority/:npi',
    summary: 'Full authority graph for a clinician in one request',
    tags: ['graph', 'authority'], required: false,
    responseSchema: { npi: 'string', nodes: 'AuthorityNode[]', edges: 'AuthorityEdge[]' } },

  { method: 'GET', path: '/api/crypto/verify/artifact/:id',
    summary: 'Verify PQC signature on a VerificationArtifact',
    tags: ['crypto', 'pqc'], required: false,
    responseSchema: { signatureValid: 'boolean', suiteId: 'CryptoSuiteId', quantumResistant: 'boolean' } },
];

// ── Trust band schema ─────────────────────────────────────────────────────────

export const TRUST_BAND_SCHEMA = {
  bands: {
    L0: { score: [0,  24],  label: 'Unverified',         meaning: 'No verified credentials. Identity not confirmed.',       deployable: false },
    L1: { score: [25, 49],  label: 'Provisionally Verified', meaning: 'Identity confirmed. One or more credentials present but not fully verified.', deployable: false },
    L2: { score: [50, 74],  label: 'Verified',           meaning: 'Core credentials verified. Licensed, no sanctions.',     deployable: true  },
    L3: { score: [75, 100], label: 'Fully Verified',     meaning: 'All credentials verified. Board certified. Fully ready.', deployable: true },
  },
  computation: 'Weighted sum of verified fact categories: identity(20%) + license(30%) + sanctions(25%) + board_cert(15%) + training(10%)',
  methodology_version: '243.1',
};

// ── Crypto suite registry (protocol-level) ────────────────────────────────────

export const PROTOCOL_CRYPTO_SUITES = [
  { id: 'sha256',       standard: 'FIPS 180-4',   pqc: false, status: 'DEPRECATED', migration: 'Upgrade to ml-dsa-65' },
  { id: 'ed25519',      standard: 'RFC 8032',      pqc: false, status: 'ACTIVE',     migration: 'Schedule upgrade to ml-dsa-65 by 2030' },
  { id: 'ml-dsa-65',    standard: 'NIST FIPS 204', pqc: true,  status: 'ACTIVE',     migration: null },
  { id: 'slh-dsa-128s', standard: 'NIST FIPS 205', pqc: true,  status: 'ACTIVE',     migration: null },
];

// ── Full spec object ─────────────────────────────────────────────────────────

export function buildProtocolSpec(baseUrl: string) {
  return {
    schema:           'https://vitalcv.com/protocol/meta/v1',
    specUri:          `${baseUrl}/api/protocol/spec`,
    version:          PROTOCOL_VERSION,
    status:           PROTOCOL_STATUS,
    publishedAt:      '2026-03-14',
    updatedAt:        new Date().toISOString(),
    title:            'VitalCV Trust Protocol',
    description:      'Open standard for machine-readable professional authority verification in healthcare.',
    license:          'CC BY 4.0 (spec) / MIT (reference implementation)',
    referenceImpl:    'https://github.com/equals9/vitalcv-monorepo',
    specDocs:         'https://vitalcv.com/docs/protocol',
    conformanceSuite: `${baseUrl}/api/protocol/conformance`,
    implementerRegistry: `${baseUrl}/api/protocol/implementations`,

    discovery: {
      wellKnown:       `${baseUrl}/.well-known/vitalcv-trust`,
      openApiSpec:     `${baseUrl}/api/docs/openapi.json`,
    },

    coreQuestion: '"Is this clinician safe to practice, right now, for this role?"',

    trustBands: TRUST_BAND_SCHEMA,
    cryptoSuites: PROTOCOL_CRYPTO_SUITES,
    endpoints: ENDPOINT_CATALOGUE,
    conformanceTests: CONFORMANCE_TESTS,

    requiredEndpoints: ENDPOINT_CATALOGUE.filter(e => e.required).map(e => `${e.method} ${e.path}`),
    requiredConformanceTests: CONFORMANCE_TESTS.filter(t => t.level === 'REQUIRED').map(t => t.id),

    credentialTypes: [
      { id: 'NPI_IDENTITY',        source: 'NPPES',       verifiable: true  },
      { id: 'STATE_LICENSE',       source: 'STATE_BOARD', verifiable: true  },
      { id: 'COMPACT_LICENSE',     source: 'NURSYS',      verifiable: true  },
      { id: 'SANCTION_EXCLUSION',  source: 'OIG_LEIE',    verifiable: true  },
      { id: 'DEA_REGISTRATION',    source: 'DEA',         verifiable: true  },
      { id: 'BOARD_CERTIFICATION', source: 'ABIM/ABFM/ABEM/ABP', verifiable: true },
      { id: 'TRAINING_RECORD',     source: 'ACGME',       verifiable: true  },
      { id: 'PRIVILEGE_GRANT',     source: 'DECISION_CAPSULE', verifiable: true },
    ],

    decisionTypes: ['HIRING', 'PRIVILEGING', 'DEPLOYMENT', 'RENEWAL'],
    verdictEnum:   ['AUTHORIZED', 'CONDITIONAL', 'BLOCKED'],
    trustBandEnum: ['L0', 'L1', 'L2', 'L3'],
    checkStatusEnum: ['PASS', 'WARN', 'FAIL', 'UNKNOWN'],
  };
}

// ── Implementation record ────────────────────────────────────────────────────

export interface ProtocolImplementation {
  implementerId: string;
  organizationName: string;
  baseUrl: string;
  contactEmail: string;
  registeredAt: string;
  lastConformanceAt: string | null;
  conformanceScore: number | null;
  conformancePassed: number | null;
  conformanceTotal: number | null;
  status: 'REGISTERED' | 'CONFORMANT' | 'NON_CONFORMANT' | 'PENDING';
  badge: string;
}

// In-memory registry (no DB migration needed; extend with DB persistence later)
const implementations = new Map<string, ProtocolImplementation>();

export function registerImplementation(impl: Omit<ProtocolImplementation, 'registeredAt' | 'lastConformanceAt' | 'conformanceScore' | 'conformancePassed' | 'conformanceTotal' | 'status' | 'badge'>): ProtocolImplementation {
  const record: ProtocolImplementation = {
    ...impl,
    registeredAt:      new Date().toISOString(),
    lastConformanceAt: null,
    conformanceScore:  null,
    conformancePassed: null,
    conformanceTotal:  null,
    status:            'REGISTERED',
    badge:             `https://vitalcv.com/badges/protocol-implementer.svg`,
  };
  implementations.set(impl.implementerId, record);
  return record;
}

export function updateConformanceResult(implementerId: string, score: number, passed: number, total: number): void {
  const impl = implementations.get(implementerId);
  if (!impl) return;
  implementations.set(implementerId, {
    ...impl,
    lastConformanceAt: new Date().toISOString(),
    conformanceScore:  score,
    conformancePassed: passed,
    conformanceTotal:  total,
    status:            score >= 80 ? 'CONFORMANT' : 'NON_CONFORMANT',
    badge:             score >= 80
      ? 'https://vitalcv.com/badges/protocol-conformant.svg'
      : 'https://vitalcv.com/badges/protocol-implementer.svg',
  });
}

export function listImplementations(): ProtocolImplementation[] {
  return Array.from(implementations.values()).sort((a, b) =>
    b.registeredAt.localeCompare(a.registeredAt)
  );
}

export function getImplementation(id: string): ProtocolImplementation | null {
  return implementations.get(id) ?? null;
}
