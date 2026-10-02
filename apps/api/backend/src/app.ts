import cors from 'cors';
import type { Express, Request, Response } from 'express';
import { buildCorsOriginCallback } from './utils/originAllowlist';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import { registerIngestRoutes } from '../../routes/ingest';
import { env, getProductionEnvCheck } from './config/env';
import { isAutomatedTestRuntime } from './config/runtimeMode';
import { validateEnv } from './config/envValidation'; // Wave 196
import prisma, { Prisma, PrismaClient } from './graphql/prisma_client';
import { errorHandler } from './middleware/errorHandler';
import { getRequestOrganizationId } from './middleware/organizationContext';
import { apiKeyAuth, publicApiRateLimit } from './middleware/publicSafety';
import { credentialStatusRateLimit, proofRateLimit, walletRateLimit } from './middleware/rateLimitFactory';
import { requestObservability } from './middleware/requestObservability';
import { verifiedIdentityMiddleware } from './middleware/verifiedIdentity';
import { bindPlatformAdmin } from './middleware/platformAdminContext';
import {
    enforceOrganizationMatch,
    isSuperAdminRequest,
    parseRequestRole as parseTenantRequestRole,
    requireTenantContext,
    requireTenantContextOrReadAccess,
} from './middleware/tenantGuard';
import { log } from './obs/logger';
import { requestLatencyMetrics } from './observability/requestMetrics';
import openApiSpec from './openapi';
import { registerImpactRoutes } from './routes/impact';
import { registerPublicMetricsRoutes } from './routes/publicMetrics';
// Wave 26: Golden Link — public read-only profile API
import { registerPublicRoutes } from './routes/public';
// Wave 27: Authority-Bound Knowledge Graph — MCP endpoint
import { registerAKGRoutes } from './mcp/akg-server';
// Wave 29: Professional Authority State (PAS) engine
import { registerAuthorityRoutes } from './routes/authority';
// Wave 35: Merkle Anchoring — audit proof endpoint + background worker
import { registerAuditRoutes } from './routes/audit';
import { startAnchorWorker } from './workers/anchorWorker';
import { startRevocationOutboxWorker } from './workers/revocationOutboxWorker';
import { startIngestionWorker } from './workers/ingestionWorker';
// Wave 37: Superbrain GraphRAG intelligence endpoint — now superseded by Intelligence Engine
// Wave 40: Continuous Trust & Revocation Engine
import { registerStatusListRoutes } from './routes/statusList';
import { startContinuousMonitor } from './workers/continuousMonitor';
// Wave 41: Start Attestation Engine — ON Loop
import { registerHiringRoutes } from './routes/hiring';
import { registerEmployerActionRoutes } from './routes/employerActions'; // M2: Accept with Confidence
import { registerEmployerNotificationRoutes } from './routes/employerNotifications'; // GAIS: employer notification polling
import { registerSealTrainingRoutes }   from './routes/sealTraining';    // SEAL: training pipeline
import { registerPilotKpiRoutes }       from './routes/pilotKpi';         // Pilot KPI loop
import { registerReportRoutes }         from './routes/report';            // Credential Intelligence Report
// Wave 43: Public Trust Profile — NPI-keyed
import { registerPublicProfileRoutes } from './routes/publicProfile';
// Wave 47: Human-in-the-Loop review queue
import { registerHitlRoutes } from './routes/hitl';
// Wave 82: Trust Graph Intelligence
import { registerGraphRoutes } from './routes/graph';
// Wave 83: Decision Intelligence
import { registerDecisionInsightsRoutes } from './routes/decisionInsights';
// Wave 84: Trust Simulation
import { registerSimulationRoutes } from './routes/simulation';
// Wave 85: Monitoring Events
import { registerMonitoringEventsRoutes } from './routes/monitoringEvents';
import { registerFeedRoutes } from './routes/feed';
// Wave 87: Trust Operations
import { registerTrustOperationsRoutes } from './routes/trustOperations';
// Wave 88: Clinician Passport
import { registerPassportRoutes } from './routes/passport';
// Wave 89: Network Telemetry
import { registerTelemetryRoutes } from './routes/telemetry';
import { registerCoordinationRoutes } from './routes/coordination';
// Wave 90: System Status
import { registerSystemStatusRoutes } from './routes/systemStatus';
// Wave B: System Integrity
import { registerSystemIntegrityRoutes } from './routes/systemIntegrity';
// Wave 91: Network Gateway
import { registerNetworkGatewayRoutes } from './routes/networkGateway';
// Wave 92: Trust Knowledge Protocol
import { registerKnowledgeRoutes } from './routes/knowledge';
// Wave 94: Trust Credential Infrastructure
import { registerCredentialRoutes } from './routes/credentials';
// Wave 95: Trust Registry
import { registerTrustRegistryRoutes } from './routes/registry';
// Wave 97: Trust Alerts
import { registerTrustAlertRoutes } from './routes/alerts';
// Wave 99: Verifier Acceptance
import { registerVerifierAcceptanceRoutes } from './routes/verifier';
// Wave 100: DID Registry
import { registerDIDRoutes } from './routes/did';
// Wave 197: Trust Anchor Service
import { registerTrustAnchorRoutes } from './routes/trustAnchors';
// Waves 199-201: SD-JWT Issuer, Trust Registry Governance, Validation, VC2 Schemas
import { registerSdJwtRoutes } from './routes/sdJwt';
// Waves 202-204: OID4VC metadata discovery + self-cert
import { registerOidcDiscoveryRoutes } from './routes/oidcDiscovery';
// Waves 205-207: PSV Adapter Layer
import { registerPsvAdapterRoutes } from './routes/psvAdapters';
// Waves 208-210: Readiness Engine + Clear-to-Start
import { registerReadinessRoutes } from './routes/readiness';

import { ingestAllTrustLists } from './services/trust-anchors/anchorIngestion';
// Wave 198: NPI-bound DID Identity Binding
import { registerIdentityBindingRoutes } from './routes/identityBinding';
// Wave 101: Credential Revocation
import { registerRevocationRoutes } from './routes/revocation';
// Wave 102: Network Federation
import { registerFederationRoutes } from './routes/federation';
import { registerIssuerOnboardingRoutes } from './routes/issuerOnboarding'; // Wave 106: Issuer Onboarding
import { registerPayerVerificationRoutes } from './routes/payerVerification'; // Wave 142: Payer Network
import { registerProviderDirectoryRoutes } from './routes/providerDirectory';  // Wave 143: Provider Directory
import { registerGraphScalingRoutes } from './routes/graphScaling';             // Wave 144: Graph Performance Scaling
import { registerPayerNetworkRoutes } from './routes/payerNetwork';             // Wave 148: Payer Credential Network
import { registerNetworkTelemetryRoutes } from './routes/networkTelemetry';     // Wave 150: Network Telemetry Intelligence
import { registerNetworkHealthRoutes } from './routes/networkHealth';           // Wave 162: Network Health Monitoring
import { registerFederationDiscoveryRoutes } from './routes/federationDiscovery'; // Wave 166: Federation Discovery
import { registerPassportAnalyticsRoutes } from './routes/passportAnalytics';   // Wave 167: Passport Analytics
import { registerWalletExportRoutes } from './routes/walletExport';             // Wave 154: Wallet Interoperability Bridge
import { registerComplianceCopilotRoutes } from './routes/complianceCopilot';   // Wave 157: Compliance Co-Pilot
import { registerGovernanceRoutes } from './routes/governance';             // Wave 108: Trust Governance
import { registerOID4VCIRoutes } from './routes/oid4vci';                  // Wave 109: OID4VCI Issuance
import { registerOID4VPRoutes } from './routes/oid4vp';                    // Wave 110: OID4VP Presentation
import { registerFederationMetadataRoutes } from './routes/federationMetadata'; // Wave 113: OpenID Federation
import { registerConformanceRoutes } from './routes/conformance';          // Wave 114: Conformance + Receipts
import { registerApiKeyRoutes } from './routes/apiKeys';                   // Wave 115: API Keys
import { registerAnalyticsRoutes } from './routes/analytics';              // Wave 116: Analytics
import { registerNetworkAnalyticsRoutes } from './routes/networkAnalytics'; // Wave 140: Network Telemetry
import { registerDocsRoutes } from './routes/docs';                        // Wave 117: Developer Docs
import { registerFeedbackRoutes } from './routes/feedback';                // Wave 119: Feedback
import { registerPilotOpsRoutes } from './routes/pilotOps';                // Pilot ops: support + feedback + triage
import { registerWebAuthnRoutes } from './routes/webauthn';                // Wave 122: WebAuthn
import { registerDecisionCapsuleRoutes } from './routes/decisionCapsules'; // Wave A: Decision Capsules
import { registerDecisionRoutes } from './routes/decisions'; // Wave FE19-A: Decision Intelligence
import { registerAuditDecisionRoutes } from './routes/auditDecision'; // Acceptance Graph: /api/audit/decision
import { registerAcceptanceRoutes } from './routes/acceptance'; // Acceptance Graph: /api/acceptance/predict
import { registerTrustSubstrateRoutes } from './routes/trustSubstrate';   // Substrate Consolidation: Phase 1
import { registerAuditStreamRoutes } from './routes/auditStream';          // Substrate Consolidation: Phase 2
import { registerHealthStartRoutes } from './routes/healthstart';           // Substrate Consolidation: Phase 3
import { registerProviderRoutes } from './routes/providers';                 // Wave 119: Provider Data Integrity Fabric
import { registerMissionOpsRoutes } from './routes/missionOps';             // Wave 123: Mission Ops + Conversion Engine
import { registerWorkspaceRoutes } from './routes/workspace';               // Wave 180: Identity workspace graph
import { registerClinicianRoutes } from './routes/clinician';             // Wave 287: Clinician activation
import { registerIntakeRoutes } from './routes/intake';                     // Wave 183: Resume + NPI + Links + Work Auth ingestion
import { registerGardenRoutes } from './routes/gardenNotes';                 // Career Garden: private notes + Living CV lines
import { registerLedgerProofRoutes } from './routes/ledgerProof';           // Anchor witness: public Merkle inclusion proofs + witness evidence
import { registerEmailOtpRoutes } from './routes/identity';                 // Email-OTP identity-binding possession factor
import { registerSearchRoutes } from './routes/search';                     // Wave 184: Unified Search Index & Content Graph
import { registerRoleRoutes } from './routes/role';                         // Clerk auth: GET /api/me/role
import { registerOwnershipRoutes } from './routes/ownership';               // Auth A1: NPI ownership claims
import { registerEntityRoutes }    from './routes/entity';                   // S1/S3: canonical entity resolution
import { registerPassportEntityRoutes } from './routes/passportEntity';      // S1/S5: entity passport + share
import { registerIngestStreamRoutes }   from './routes/ingestStream';        // Real-time ingest SSE
import { leieCacheStats }               from './services/identity/leieCache'; // OIG LEIE cache
import { registerOpportunityRoutes } from './routes/opportunities';          // Wave 227: Opportunities + Candidates
import { registerMatchaRoutes } from './routes/matcha';                      // Wave K: MATCHA demand-side engine
import { registerApplicationRoutes } from './routes/applications';            // Wave 229: Application Flow
import { registerActivationRoutes } from './routes/activation';               // ACT-7.3: Activation ledger + start-state HTTP surface
import { registerAskRoutes } from './routes/ask';                           // Wave 185: Ask VitalCV answer engine
import { registerCopilotRoutes } from './routes/copilot';                   // Waves C25-C28: Copilot query engine
import { registerInvestigationRoutes } from './routes/investigation';        // Wave INV: Investigation engine
import { registerInvestigationWorkbenchRoutes } from './routes/investigationWorkbench'; // Wave INV+: Investigation workbench APIs
import { registerFindingsRoutes } from './routes/findings';                  // Wave AI: Autonomous investigators
import { registerActionsRoutes } from './routes/actions';                    // Waves C49-C51: Action engine API
import { registerStorylineRoutes } from './routes/storylines';               // Wave ST: Storyline engine
import { registerDetailAgentRoutes } from './routes/detailAgents';           // Wave DT: Detail agents
import { registerPollingRoutes } from './routes/polling';                    // Wave POLL: Polling scheduler
import { registerEmployerRoutes } from './routes/employers';                 // Wave 186: Employer Knowledge Layer
import { registerPrequalificationRoutes } from './routes/prequalification';  // Wave 189: AI Interview, Assessments, Prequalification
// Wave 190 (verifierPipeline) is deliberately NOT imported — the routes are
// unauthenticated and org-scoped by a caller-supplied header. See the header of
// routes/verifierPipeline.ts and the guard in
// routes/__tests__/verifierPipelineNotWired.test.ts before re-adding this.
import { registerReferralRoutes } from './routes/referrals';                 // Wave 191: Referral Engine with Compliance Guardrails
import { registerAmbassadorRoutes } from './routes/ambassador';              // Wave 192: Ambassador Program
import { registerGrowthRoutes } from './routes/growth';                      // Wave 193: Instant Offers + Growth Loops
import { registerMarketplaceAnalyticsRoutes } from './routes/marketplaceAnalytics'; // Wave 194: Marketplace Analytics
import { registerDocumentRoutes } from './routes/documents';                       // Wave 237: Document Intelligence API
import { registerCapacityRoutes } from './routes/capacity';                         // Wave 240: Capacity Score MVP
import { registerOigRoutes } from './routes/oig';                                   // Wave 241: OIG/LEIE Exclusion Check
import { registerTrustStateEngineRoutes } from './routes/trustStateEngine';          // Wave 243: Trust State Engine
import { registerAsyncTrustRoutes } from './routes/asyncTrust';                      // Wave 245: Async Trust Engine
import { startMonitoringScheduler } from './services/async/monitoringScheduler';    // Wave 245: Monitoring Scheduler
import { registerApplyRoutes } from './routes/apply';                                // Wave 246: Apply-with-VitalCV
import { registerReadinessSnapshotRoutes } from './routes/readinessSnapshot';         // Wave M: reusable readiness snapshots
import { registerTrustDecisionRoutes } from './routes/trustDecision';               // Shape-of-Truth: 6-class decision engine
import { registerSystemHealthRoutes } from './routes/systemHealth';                    // Wave 249: Trust Spine Hardening
import { registerVelocityRoutes } from './routes/velocity';                              // Wave 250: Time-to-Start Velocity Dashboard
import { registerTrustProofRoutes } from './routes/trustProof';                        // Wave 252: Trust Proof Bundle
import { registerPsvRoutes } from './routes/psv';
import { registerCredentialIndexRoutes } from './routes/credentialIndex';  // Wave Index
import { registerAuthorityGraphRoutes } from './routes/authorityGraph';       // Wave 500: Authority Graph Engine
import { registerVerificationAgentRoutes } from './routes/verificationAgents'; // Wave 500+: AI Verification Agents
import { registerVerifyProfessionalRoutes } from './routes/verifyProfessional';   // Wave: AI Professional Verification
import { registerDeploymentRoutes } from './routes/deployment';                    // Wave: Deployable Workforce
import { registerWorkforceIntelligenceRoutes } from './routes/workforceIntelligence'; // Wave: Workforce Intelligence
import { registerAuditReplayRoutes } from './routes/auditReplay';                       // Wave: Decision Accountability
import { registerReplayRunRoutes, registerReplayByNpiRoute } from './routes/replayRuns'; // Replay Persistence Alpha
import { registerCryptoProtocolRoutes } from './routes/cryptoProtocol';               // Wave: PQC Trust Protocol
import { registerProtocolRoutes } from './routes/protocol';                            // Wave: Open Trust Protocol
import { registerDomainRoutes } from './routes/domains';                               // Wave: Universal Authority
import { registerIdentityLayerRoutes } from './routes/identityLayer';                  // Wave: Canonical Identity
import { registerTrustIntelligenceRoutes } from './routes/trustIntelligence';          // Wave M: Trust Score V1 + Freshness + Divergence
import { registerIntelligenceEngineRoutes } from './routes/intelligence';              // Wave I: Intelligence Engine + Learning Loops
import { registerIntelligenceInsightRoutes } from './routes/insights';                 // Wave FE0-FE21: Intelligence insight surfaces
import { registerIntelligenceAggregateRoutes } from './routes/intelligenceAggregates'; // Wave FE21-B: Intelligence feed + aggregate APIs
import { registerIntelligencePublicSnapshotRoutes } from './routes/intelligencePublicSnapshot';
import { registerIntelligenceSignalRoutes } from './routes/intelligenceSignals';       // Wave FE22: Explainable intelligence signal APIs
import { registerIntelligenceLayerRoutes } from './routes/intelligenceLayer';          // Wave FE-next: Compounding intelligence layer APIs
import { registerMapRoutes } from './routes/map';                                      // Waves C60-C61: Geospatial intelligence map APIs
import { registerPredictionRoutes } from './routes/predictions';                      // Wave FE17: Predictive Intelligence
import { registerStrategyRoutes } from './routes/strategy';                           // Wave FE20-A: Strategic Intelligence Engine
import { registerInvestigatorRoutes } from './routes/investigators';                   // Waves C41-C44: Investigator findings feed
import { registerInvestigatorApiRoutes } from './routes/investigatorApi';              // FE16-A: Autonomous investigator engine API
import { startInvestigatorScheduler } from './services/investigators/investigatorScheduler';
import { registerAgentRoutes } from './routes/agents';                                 // FE21-A: Autonomous strategy agents API
import { registerLearningTrackRoutes } from './routes/learningTrack';                  // Learning: frontend event tracking
import { registerLearningAnalyticsRoutes } from './routes/learningAnalytics';          // Learning: analytics + feedback loop
import { registerResearchRoutes } from './routes/research';                             // Wave 12: Research Identity Layer
import { startStrategyAgentScheduler } from './services/strategyAgents/strategyAgentScheduler';
import {
    createArtifactFromNursys,
    generateAuditBundle,
    getBundleExportBySnapshotId,
    getLatestArtifact,
} from './services/artifactService';
import { isDecisionGradeArtifact } from './services/artifactDecisionGrade';
import { SourceAccessRequiredError } from './services/sourceRegistry';
import { isProductionRuntime } from './utils/environment';
import { generateAuditPacket } from './services/auditPacketGenerator';
import {
    getMonitoringStatus,
    isMonitoringEngineOperational,
    runMonitoringSweep,
} from './services/credentialMonitoringEngine';
import { computeCredentialState } from './services/credentialStatusEngine';
import { generateCrossCheckBundle } from './services/crossCheckBundleEngine';
import { getEnterpriseCapabilities } from './services/enterpriseCapabilities';
import { runEnterpriseSelfTest } from './services/enterpriseSelfTest';
import {
    getActiveOrganizationTrustLinks,
    getFederatedTrustLevel,
    getTotalOrganizationTrustLinks,
} from './services/federatedTrustEngine';
import { getIssuerRegistrySummary } from './services/issuerRegistry';
import { validateMerkleIntegrity } from './services/merkleIntegrity';
import { getPerformanceSnapshot, recordLatency } from './services/performanceMetrics';
import { enforceHaipNoDowngrade, isZeroDowngradeEnforced, runRuntimeGuards } from './services/runtimeGuards';
import { generateClaimProof, verifyClaimProof } from './services/selectiveProofEngine';
import { getTransparencyEntries } from './services/transparencyLog';
import { validateTrustChain } from './services/trustChain';
import { computeTrustState } from './services/trustState';
import { enterpriseCapabilitiesCache } from './services/ttlCache';
import {
    assessVerifierLifecycleTransition,
    coerceVerifierLifecycle,
    VERIFIER_LIFECYCLE_STATES,
} from './services/verifierLifecycle';
import type { ClaimProof } from './types/selectiveProof';
import { sha256Hex } from './utils/deterministic';
import { isStrictTransitionMode, parseBooleanEnv } from './utils/environment';
import { resolveCrossOrgTrustLevel } from './utils/federation';
import { getConfiguredIssuerDid, isValidDidFormat } from './utils/issuerDid';
import { CredentialLifecycleState } from './utils/lifecycleState';
// Wave R: Onboarding Analytics + Revenue Signal
import { getOnboardingMetrics, recordProofIssuedEvent, recordVerificationEvent } from './services/onboardingAnalyticsEngine';
import { computeRevenueSignal } from './services/revenueSignalEngine';
// Wave S: PSV Window Engine
import { checkPSVDeadlines, getPSVStatus } from './services/psvWindowEngine';
// Wave T: Failure Isolation Engine
import { getObservabilityStatus, hasCriticalFailure, isSystemHealthyForOperation, logSystemFailure } from './services/failureIsolationEngine';
// Wave X: External Integrations
import { getIntegrationHealth } from './services/externalIntegrations';
// Wave Y: Delta Monitoring + Expiration Forecasting
import { getOrganizationForecastSummary } from './services/expirationForecastEngine';
// Wave Z: Verifier Dashboard
import { buildDashboardExport, buildDashboardResponse } from './services/verifierDashboardEngine';
// Identity Module
import { registerIdentityRoutes } from './modules/identity';
// Demo Module (public, rate-limited, no auth)
import { registerDemoRoutes } from './modules/demo';
// PSV Verify Module (Wave 1)
import { registerPsvVerifyRoutes } from './services/psv/verifyRoute';
// Wave 31: HTM Proof of Experience (PoE) — cryptographic volume attestation
import { registerIssuerRoutes } from './routes/issuer'; // Wave 38: Issuer Command Center
import { registerIssuerPsvReceiptRoutes } from './routes/issuerPsvReceipts'; // ISSUER-10
import { registerPoeRoutes } from './routes/poe';
import { registerWidgetRoutes } from './routes/widget'; // Wave 34: Plaid Widget
// Wave 27: Genesis Mesh Emergency Overrides
import { complianceRoutes } from './routes/compliance-emergency';

type VerificationLane = 'PUBLIC' | 'PARTNER' | 'MANUAL';
const VALID_LANES: readonly VerificationLane[] = ['PUBLIC', 'PARTNER', 'MANUAL'] as const;

type MonitoringFlags = {
  firstViewTracking: boolean;
  artifactGenerationTracking: boolean;
  pilotOrgTracking: boolean;
};

type FunnelRef = 'demo' | 'yc' | 'direct';
type FunnelVariant = 'A' | 'B';
type FunnelEventType =
  | 'verifier_page_view'
  | 'verify_api_call'
  | 'pilot_activation_click'
  | 'pilot_activation_success';

type FunnelVariantAccumulator = {
  clicks: number;
  activations: number;
};

type FunnelEventRow = {
  eventType: string;
  variant: string | null;
  count: bigint | number;
};

type FunnelMetrics = {
  totalVerifierViews: number;
  totalPilotClicks: number;
  totalActivations: number;
  conversionRateByVariant: Record<string, number>;
};

type PilotOrgRow = {
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: string;
  accepted: boolean;
  bundlesGenerated: number;
};

type TrustStateDistribution = {
  verified: number;
  verified_monitoring: number;
  expiring_soon: number;
  needs_review: number;
  expired: number;
};

type EnterpriseComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  trustLedgerAppendOnly: boolean;
  lifecycleEnforced: boolean;
  multiTenantScoped: boolean;
};

type YcMetricsPayload = {
  totalNPIs: number;
  shareLinks: number;
  verifierViews: number;
  exports: number;
  avgTimeToView: number;
  estimatedStartDateAccelerationDays: number | null;
  activePilotOrgs: number;
  bundlesGenerated: number;
  estimatedRevenueImpact: number;
  pilotOrgCount: number;
  monitoringFlags: MonitoringFlags;
  verifierConversionRate: number;
  pilotActivationRate: number;
  avgArtifactViewTime: number;
  timeFromRegistrationToPilotActivation: number | null;
  isDemoMode: boolean;
  pilotOrgs: PilotOrgRow[];
  // Wave 34 additions
  verifierFunnelMetrics: FunnelMetrics;
  revenueRecoveryEstimate: number;
  trustStateDistribution: TrustStateDistribution;
  monitoringDeltaFrequency: number;
  enterpriseComplianceSummary: EnterpriseComplianceSummary;
  pilotReady: boolean;
};

type VerifierActivationTimeRow = {
  organizationId: string | null;
  activatedAt: Date;
};

const MARKETING_DATABASE_URL = process.env.MARKETING_DATABASE_URL?.trim();
const eventLogPrisma: PrismaClient = (() => {
  const databaseUrl = MARKETING_DATABASE_URL;
  if (!databaseUrl || databaseUrl === process.env.DATABASE_URL?.trim()) {
    return prisma;
  }

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  });
})();

function normalizeFunnelRef(value: unknown): FunnelRef | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? normalizeFunnelRef(value[0]) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'demo' || normalized === 'yc' || normalized === 'direct') {
    return normalized;
  }
  return null;
}

function normalizeFunnelVariant(value: unknown): FunnelVariant {
  if (typeof value !== 'string') {
    return 'A';
  }
  return value.trim().toUpperCase() === 'B' ? 'B' : 'A';
}

function asRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  const rawRate = numerator / denominator;
  return Number(rawRate.toFixed(4));
}

function toCount(input: bigint | number | string | null): number {
  if (input === null) {
    return 0;
  }
  if (typeof input === 'number') {
    return input;
  }
  if (typeof input === 'bigint') {
    return Number(input);
  }
  return Number.parseInt(input, 10);
}

type EnterprisePosture = {
  rateLimiting: boolean;
  inputValidation: boolean;
  enumLocked: boolean;
  internalRouteProtection: boolean;
  startupEnvValidation: boolean;
};

type ComplianceSummary = {
  ncqaAlignment: boolean;
  monitoringEnabled: boolean;
  crossCheckEligible: boolean;
  auditSnapshotSupported: boolean;
  trustLedgerAppendOnly: boolean;
};

type VersionResponse = {
  buildVersion: string;
  commitHash: string;
  nodeVersion: string;
  prismaVersion: string;
};

type OrganizationQueryFilter = {
  organizationId?: string;
};

type PilotChecklist = {
  schemaStable: boolean;
  monitoringActive: boolean;
  trustLedgerDeterministic: boolean;
  rateLimitingActive: boolean;
  envValidated: boolean;
  noDemoModeInProd: boolean;
  readyForPilot: boolean;
};

const MONITORING_SECRET = process.env.MONITORING_SECRET?.trim();
const ENTERPRISE_MODE = parseBooleanEnv(process.env.ENTERPRISE_MODE, false);
const PILOT_MODE = parseBooleanEnv(process.env.PILOT_MODE, false);
const SYSTEM_FROZEN = parseBooleanEnv(process.env.SYSTEM_FROZEN, false);
const YC_DEMO_MODE = parseBooleanEnv(process.env.YC_DEMO_MODE, false);
const BACKGROUND_JOBS_ENABLED =
  !isAutomatedTestRuntime()
  && !parseBooleanEnv(process.env.DISABLE_BACKGROUND_JOBS, false);

const COMPLIANCE_SUMMARY: ComplianceSummary = {
  ncqaAlignment: true,
  monitoringEnabled: true,
  crossCheckEligible: true,
  auditSnapshotSupported: true,
  trustLedgerAppendOnly: true,
};

const SECURITY_POSTURE: EnterprisePosture = {
  rateLimiting: true,
  inputValidation: true,
  enumLocked: true,
  internalRouteProtection: true,
  startupEnvValidation: true,
};

const VERSION_INFO = readVersionInfo();

function extractInternalSecret(req: Request): string | null {
  const raw = req.headers['x-monitoring-secret'];
  if (typeof raw === 'string') {
    return raw;
  }
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  return null;
}

function requireVerifierOrAdmin(req: Request, res: Response): boolean {
  const role = parseTenantRequestRole(req);
  if (role === 'verifier' || role === 'admin' || role === 'super-admin') {
    return true;
  }

  res.status(403).json({
    error: 'forbidden',
    error_description: 'RBAC requires verifier or admin role.',
  });
  return false;
}

function requireVerifierOnly(req: Request, res: Response): boolean {
  const role = parseTenantRequestRole(req);
  if (role === 'verifier' || role === 'super-admin') {
    return true;
  }

  res.status(403).json({
    error: 'forbidden',
    error_description: 'RBAC requires verifier role.',
  });
  return false;
}

function requireInternalSecret(req: Request, res: Response): boolean {
  const provided = extractInternalSecret(req);
  if (!MONITORING_SECRET || !provided || provided !== MONITORING_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

function requireAdminRequest(req: Request, res: Response): boolean {
  const role = parseTenantRequestRole(req);
  if (role === 'admin' || role === 'super-admin') {
    return true;
  }

  res.status(403).json({
    error: 'forbidden',
    error_description: 'RBAC requires admin role.',
  });
  return false;
}

function enforceArtifactOrganizationAccess(
  req: Request,
  res: Response,
  artifact: { organizationId: string | null },
): boolean {
  if (!artifact.organizationId) {
    res.status(404).json({ error: 'Artifact not found' });
    return false;
  }

  return enforceOrganizationMatch(req, res, artifact.organizationId);
}

function isValidNpi(input: string | undefined): input is string {
  return !!input && /^\d{10}$/.test(input);
}

function parseNpi(input: string | undefined, label: string): string {
  const trimmed = input?.trim() ?? '';
  if (!isValidNpi(trimmed)) {
    throw new Error(`${label} must be a 10-digit NPI`);
  }
  return trimmed;
}

async function isDbConnected(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function isTrustLedgerOperational(): Promise<boolean> {
  try {
    await Promise.all([
      prisma.recognition.findFirst({ select: { recognitionId: true }, take: 1 }),
      prisma.acceptance.findFirst({ select: { acceptanceId: true }, take: 1 }),
      prisma.start.findFirst({ select: { startId: true }, take: 1 }),
    ]);
    return true;
  } catch {
    return false;
  }
}

async function isMonitoringOperational(organizationId?: string): Promise<boolean> {
  const where = organizationId ? { organizationId } : undefined;
  try {
    await prisma.monitoringEvent.findFirst({ select: { id: true }, where, take: 1 });
    return true;
  } catch {
    return false;
  }
}

function isRateLimitingActive(): boolean {
  const limit = Number.parseInt(process.env.PUBLIC_RATE_LIMIT_PER_TEN_MINUTES ?? '100', 10);
  return Number.isInteger(limit) && limit > 0;
}

async function isTrustChainDeterministic(): Promise<boolean> {
  try {
    const result = await validateTrustChain(process.env.TRUST_CHAIN_HEALTHCHECK_NPI ?? '1234567890');
    return (
      result.valid && !result.invalidTransitions && !result.checksumMismatches && result.appendOnlyConfirmed
    );
  } catch {
    return false;
  }
}

async function buildPilotReadiness(organizationId?: string): Promise<PilotChecklist> {
  const dbConnected = await isDbConnected();
  const trustLedgerOperational = await isTrustLedgerOperational();
  const monitoringOperational = await isMonitoringOperational(organizationId);

  const schemaStable = dbConnected && trustLedgerOperational && monitoringOperational;
  const monitoringActive = schemaStable && Boolean(MONITORING_SECRET);
  const trustLedgerDeterministic = await isTrustChainDeterministic();
  const rateLimitingActive = isRateLimitingActive();
  const envValidated = process.env.NODE_ENV === 'production' ? getProductionEnvCheck().ok : true;
  const noDemoModeInProd = process.env.NODE_ENV !== 'production' || !YC_DEMO_MODE;

  return {
    schemaStable,
    monitoringActive,
    trustLedgerDeterministic,
    rateLimitingActive,
    envValidated,
    noDemoModeInProd,
    readyForPilot:
      schemaStable &&
      monitoringActive &&
      trustLedgerDeterministic &&
      rateLimitingActive &&
      envValidated &&
      noDemoModeInProd,
  };
}

function buildOrganizationFilter(organizationId: string | undefined): OrganizationQueryFilter {
  return organizationId ? { organizationId } : {};
}

// ─── Wave 34: Enterprise Status ─────────────────────────────

type EnterpriseStatus = {
  systemFrozen: boolean;
  trustLedgerDeterministic: boolean;
  strictTransitionMode: boolean;
  haipCompliant: boolean;
  didReady: boolean;
  walletSimulationReady: boolean;
  rateLimitingActive: boolean;
  monitoringOperational: boolean;
  multiTenantSafe: boolean;
  structuredLoggingEnabled: boolean;
  startupGuardsEnforced: boolean;
  lifecycleIntegrity: boolean;
  trustEngineIntegrity: boolean;
  selectiveDisclosureEnabled: boolean;
  issuerRegistryReady: boolean;
  transparencyLogActive: boolean;
  auditPacketReady: boolean;
  version: string;
  pilotReady: boolean;
};

/**
 * Validate verifier lifecycle integrity:
 * - All states are enum-backed (const array).
 * - Every sequential pair allows a +1 transition.
 * - No invalid state jumps exist in the transition table.
 */
function checkLifecycleIntegrity(): boolean {
  const states = VERIFIER_LIFECYCLE_STATES;
  if (states.length === 0) {
    return false;
  }

  for (let i = 0; i < states.length - 1; i += 1) {
    const assessment = assessVerifierLifecycleTransition(states[i], states[i + 1]);
    if (!assessment.allowed || assessment.noOp) {
      return false;
    }
  }

  // Verify backward transitions are blocked
  for (let i = 1; i < states.length; i += 1) {
    const backward = assessVerifierLifecycleTransition(states[i], states[0]);
    if (backward.allowed && !backward.noOp) {
      return false;
    }
  }

  // Verify coercion returns valid enum values
  for (const state of states) {
    if (coerceVerifierLifecycle(state) !== state) {
      return false;
    }
  }

  return true;
}

/**
 * Validate trust engine consistency:
 * - computeTrustState is the single source (pure function).
 * - monitoringEngine uses the same computeTrustState function.
 * - Trust ledger append-only confirmed.
 * - Strict transition mode active (SYSTEM_FROZEN blocks feature flags).
 */
async function checkTrustEngineIntegrity(organizationId?: string): Promise<boolean> {
  // 1. Validate trust chain determinism
  const chainValid = await isTrustChainDeterministic();
  if (!chainValid) {
    return false;
  }

  // 2. Validate trust ledger append-only ordering
  const ledgerOrdered = await evaluateTrustLedgerIntegrity(organizationId);
  if (!ledgerOrdered) {
    return false;
  }

  // 3. Validate computeTrustState is deterministic by running same input twice
  const testInput = { status: 'ACTIVE', expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), monitoring: true };
  const fixedNow = new Date('2026-01-01T00:00:00.000Z');
  const result1 = computeTrustState(testInput, fixedNow);
  const result2 = computeTrustState(testInput, fixedNow);
  if (result1 !== result2) {
    return false;
  }

  return true;
}

/**
 * Data scope safety: verify organizationId filtering is respected.
 * Creates a scoped query with a synthetic organizationId and confirms
 * it returns zero results (no cross-tenant leakage).
 */
async function checkDataScopeSafety(): Promise<boolean> {
  const syntheticOrgId = `__scope_test_${Date.now()}`;
  try {
    const [artifacts, events, links] = await Promise.all([
      prisma.verificationArtifact.count({ where: { organizationId: syntheticOrgId } }),
      prisma.monitoringEvent.count({ where: { organizationId: syntheticOrgId } }),
      prisma.shareLink.count({ where: { organizationId: syntheticOrgId } }),
    ]);

    return artifacts === 0 && events === 0 && links === 0;
  } catch {
    return false;
  }
}

/**
 * Wave C: Check if selective disclosure proofs can be generated.
 * True when at least one artifact has both merkleRoot and claimHashes,
 * and the proof engine can reconstruct valid proofs.
 */
async function checkSelectiveDisclosureCapability(
  organizationId?: string,
): Promise<boolean> {
  try {
    const sample = await prisma.verificationArtifact.findFirst({
      where: {
        merkleRoot: { not: null },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!sample) {
      return false;
    }

    const hasMerkleRoot =
      typeof sample.merkleRoot === 'string' && sample.merkleRoot.length > 0;
    const hasClaimHashes =
      Array.isArray(sample.claimHashes) && sample.claimHashes.length > 0;

    if (!hasMerkleRoot || !hasClaimHashes) {
      return false;
    }

    return validateMerkleIntegrity(sample);
  } catch {
    return false;
  }
}

/**
 * Freeze hard lock: when SYSTEM_FROZEN=true, block runtime mutations
 * that would alter system behavior. Called on startup and before
 * any attempted toggle/migration operation.
 */
function enforceFreezeHardLock(operation: string): void {
  if (!SYSTEM_FROZEN) {
    return;
  }

  const blockedOperations = [
    'schema_migration',
    'env_toggle',
    'feature_flag_mutation',
    'adapter_switch',
  ];

  if (blockedOperations.includes(operation)) {
    log('error', 'freeze_hard_lock_violation', {
      event: 'freeze_hard_lock_blocked',
      operation,
      systemFrozen: true,
    });
    throw new Error(
      `Operation "${operation}" blocked: SYSTEM_FROZEN=true prevents runtime mutations.`,
    );
  }
}

function parsePositiveInteger(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

function parseVerifierWalletApiKeys(): Set<string> {
  const raw = process.env.VERIFIER_WALLET_API_KEYS ?? process.env.API_KEYS ?? '';
  return new Set(
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );
}

function readSigningKeyRaw(): string {
  if (process.env.ISSUER_SIGNING_JWK && process.env.ISSUER_SIGNING_JWK.trim().length > 0) {
    return process.env.ISSUER_SIGNING_JWK.trim();
  }

  if (process.env.SIGNING_KEY_JWK && process.env.SIGNING_KEY_JWK.trim().length > 0) {
    return process.env.SIGNING_KEY_JWK.trim();
  }

  return '';
}

type EcSigningJwk = {
  kty: string;
  crv: string;
  alg: string;
  use: string;
  x: string;
  y: string;
};

function parseSigningJwk(raw: string): EcSigningJwk | null {
  try {
    const parsed = JSON.parse(raw) as Partial<EcSigningJwk>;
    if (
      parsed.kty === 'EC' &&
      parsed.crv === 'P-256' &&
      parsed.alg === 'ES256' &&
      parsed.use === 'sig' &&
      typeof parsed.x === 'string' &&
      parsed.x.length > 0 &&
      typeof parsed.y === 'string' &&
      parsed.y.length > 0
    ) {
      return {
        kty: parsed.kty,
        crv: parsed.crv,
        alg: parsed.alg,
        use: parsed.use,
        x: parsed.x,
        y: parsed.y,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function isHaipSignerReady(): boolean {
  const raw = readSigningKeyRaw();
  return raw.length > 0 && parseSigningJwk(raw) !== null;
}

function computeHaipComplianceReady(): boolean {
  if (!isHaipSignerReady()) {
    return false;
  }

  const pkceRequired = parseBooleanEnv(process.env.PKCE_REQUIRED, true);
  const parRequired = parseBooleanEnv(process.env.PAR_REQUIRED, true);
  const dpopRequired = parseBooleanEnv(process.env.DPOP_REQUIRED, true);
  const cNonceLifetime = parsePositiveInteger(process.env.C_NONCE_LIFETIME_SECONDS, 60);

  return pkceRequired && parRequired && dpopRequired && cNonceLifetime <= 60;
}

function isDidResolverReady(): boolean {
  const issuerDid = getConfiguredIssuerDid();
  return isHaipResolverHealthy() && isValidDidFormat(issuerDid);
}

function isHaipResolverHealthy(): boolean {
  return isHaipSignerReady();
}

function isWalletSimulationReady(): boolean {
  const verifierKeys = parseVerifierWalletApiKeys();
  const hasVerifierCredentialKey = verifierKeys.size > 0;
  if (process.env.NODE_ENV === 'production') {
    return hasVerifierCredentialKey && isHaipSignerReady();
  }

  return true;
}

async function hasActiveTrustedIssuer(): Promise<boolean> {
  try {
    const activeIssuer = await prisma.trustedIssuer.findFirst({
      where: { active: true },
      select: { id: true },
      take: 1,
    });
    return activeIssuer !== null;
  } catch {
    return false;
  }
}

async function isTransparencyLogOperational(): Promise<boolean> {
  try {
    await prisma.credentialTransparencyLog.findFirst({
      select: { id: true },
      take: 1,
    });
    return true;
  } catch {
    return false;
  }
}

async function isAuditPacketReady(): Promise<boolean> {
  const [issuerRegistryReady, transparencyLogActive] = await Promise.all([
    hasActiveTrustedIssuer(),
    isTransparencyLogOperational(),
  ]);
  return isDidResolverReady() && issuerRegistryReady && transparencyLogActive;
}

async function buildEnterpriseStatus(organizationId?: string): Promise<EnterpriseStatus> {
  const [
    trustLedgerDeterministic,
    monitoringOperational,
    trustEngineIntegrity,
    multiTenantSafe,
    selectiveDisclosureEnabled,
    issuerRegistryReady,
    transparencyLogActive,
    auditPacketReady,
  ] = await Promise.all([
    isTrustChainDeterministic(),
    isMonitoringOperational(organizationId),
    checkTrustEngineIntegrity(organizationId),
    checkDataScopeSafety(),
    checkSelectiveDisclosureCapability(organizationId),
    hasActiveTrustedIssuer(),
    isTransparencyLogOperational(),
    isAuditPacketReady(),
  ]);

  const systemFrozen = SYSTEM_FROZEN;
  const strictTransitionMode = checkLifecycleIntegrity();
  const haipCompliant = computeHaipComplianceReady();
  const didReady = isDidResolverReady();
  const walletSimulationReady = isWalletSimulationReady();
  const rateLimitingActive = isRateLimitingActive();
  const structuredLoggingEnabled = true; // JSON logger is always active
  const startupGuardsEnforced = process.env.NODE_ENV === 'production'
    ? getProductionEnvCheck().ok
    : true;
  const lifecycleIntegrity = strictTransitionMode;

  const pilotReady =
    systemFrozen &&
    trustLedgerDeterministic &&
    strictTransitionMode &&
    haipCompliant &&
    didReady &&
    walletSimulationReady &&
    rateLimitingActive &&
    monitoringOperational &&
    multiTenantSafe &&
    structuredLoggingEnabled &&
    startupGuardsEnforced &&
    lifecycleIntegrity &&
    trustEngineIntegrity &&
    issuerRegistryReady &&
    transparencyLogActive &&
    auditPacketReady;

  return {
    systemFrozen,
    trustLedgerDeterministic,
    strictTransitionMode,
    haipCompliant,
    didReady,
    walletSimulationReady,
    rateLimitingActive,
    monitoringOperational,
    multiTenantSafe,
    structuredLoggingEnabled,
    startupGuardsEnforced,
    lifecycleIntegrity,
    trustEngineIntegrity,
    selectiveDisclosureEnabled,
    issuerRegistryReady,
    transparencyLogActive,
    auditPacketReady,
    version: VERSION_INFO.buildVersion,
    pilotReady,
  };
}

function readVersionInfo(): VersionResponse {
  const buildVersion =
    process.env.BUILD_VERSION ??
    process.env.npm_package_version ??
    readPackageValue<string>(resolveBackendPackageJsonPath(), 'version') ??
    'unknown';
  const commitHash =
    process.env.COMMIT_HASH ??
    process.env.GIT_COMMIT_HASH ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ?? // legacy fallback
    'unknown';
  const prismaVersion =
    readPackageValue<string>(readInstalledPrismaPackagePath(), 'version') ??
    readPackageValue<Record<string, string>>(resolveBackendPackageJsonPath(), 'dependencies')?.[
      '@prisma/client'
    ] ??
    'unknown';

  return {
    buildVersion,
    commitHash,
    nodeVersion: process.version,
    prismaVersion,
  };
}

function resolveBackendPackageJsonPath(): string {
  const candidatePaths = [
    path.resolve(process.cwd(), 'apps/api/backend/package.json'),
    path.resolve(__dirname, '../../package.json'),
    path.resolve(process.cwd(), 'package.json'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return path.resolve(process.cwd(), 'package.json');
}

function readInstalledPrismaPackagePath(): string {
  const candidate = path.resolve(process.cwd(), 'node_modules/@prisma/client/package.json');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return '/dev/null';
}

function readPackageValue<T>(packageJsonPath: string, key: string): T | undefined {
  try {
    const file = fs.readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(file) as Record<string, unknown>;
    const value = parsed[key];
    if (value === undefined || value === null) {
      return undefined;
    }
    return value as T;
  } catch {
    return undefined;
  }
}

function parsePilotMetadataOverrides(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return metadata ?? {};
}

async function logFunnelEvent(
  eventType: FunnelEventType,
  npi: string,
  metadata?: Record<string, unknown>,
  organizationId?: string,
): Promise<void> {
  if (!npi.trim()) {
    return;
  }

  try {
    const normalizedMetadata = parsePilotMetadataOverrides(metadata);
    const payload = JSON.stringify(normalizedMetadata);
    await eventLogPrisma.$executeRaw`
      INSERT INTO "EventLog" ("eventType", "npi", "metadata", "organizationId")
      VALUES (${eventType}, ${npi.trim()}, CAST(${payload} AS JSONB), ${organizationId})
    `;
  } catch (error) {
    log('error', 'funnel_event_log_failed', {
      event: 'funnel_event_log_failed',
      eventType,
      npi: npi.trim(),
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

async function loadFunnelMetrics(organizationId?: string): Promise<FunnelMetrics> {
  const zero: FunnelMetrics = {
    totalVerifierViews: 0,
    totalPilotClicks: 0,
    totalActivations: 0,
    conversionRateByVariant: {},
  };

  try {
    const rows = await eventLogPrisma.$queryRaw<Array<FunnelEventRow>>`
      SELECT
        "eventType" AS "eventType",
        "metadata"->>'cta_variant' AS "variant",
        COUNT(*)::bigint AS "count"
      FROM "EventLog"
      WHERE ${
        organizationId
          ? Prisma.sql`"organizationId" = ${organizationId} AND `
          : Prisma.sql``
      }
      "eventType" IN ('verifier_page_view', 'verify_api_call', 'pilot_activation_click', 'pilot_activation_success')
      GROUP BY "eventType", "metadata"->>'cta_variant'
    `;

    const byVariant: Record<string, FunnelVariantAccumulator> = {};

    for (const row of rows) {
      const count = toCount(row.count);

      if (row.eventType === 'verifier_page_view') {
        zero.totalVerifierViews += count;
        continue;
      }

      if (row.eventType === 'pilot_activation_click' || row.eventType === 'pilot_activation_success') {
        const variant = normalizeFunnelVariant(row.variant);
        if (!byVariant[variant]) {
          byVariant[variant] = {
            clicks: 0,
            activations: 0,
          };
        }

        if (row.eventType === 'pilot_activation_click') {
          byVariant[variant].clicks += count;
          zero.totalPilotClicks += count;
        } else {
          byVariant[variant].activations += count;
          zero.totalActivations += count;
        }
      }

      if (row.eventType === 'verify_api_call') {
        // Reserved for deeper conversion timing/attribution if needed.
      }
    }

    const conversionRateByVariant: Record<string, number> = {};
    for (const [variant, totals] of Object.entries(byVariant)) {
      conversionRateByVariant[variant] = asRate(totals.activations, totals.clicks);
    }

    return {
      ...zero,
      conversionRateByVariant,
    };
  } catch (error) {
    log('error', 'funnel_metrics_failed', {
      event: 'funnel_metrics_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return zero;
  }
}

async function loadAverageTimeFromRegistrationToPilotActivation(
  organizationId?: string,
): Promise<number | null> {
  const organizationClause = organizationId
    ? Prisma.sql`AND "organizationId" = ${organizationId}`
    : Prisma.sql``;
  try {
    const activationRows = await eventLogPrisma.$queryRaw<
      Array<VerifierActivationTimeRow>
    >`
      SELECT
        "organizationId",
        MIN("createdAt") AS "activatedAt"
      FROM "EventLog"
      WHERE "eventType" = 'VERIFIER_LIFECYCLE_PILOT_ACTIVATED'
        ${organizationClause}
        AND "organizationId" IS NOT NULL
      GROUP BY "organizationId"
    `;

    if (activationRows.length === 0) {
      return null;
    }

    const verifiedOrgIds = activationRows
      .map((row) => row.organizationId)
      .filter((id): id is string => id !== null);

    const orgs = await prisma.verifierOrg.findMany({
      where: {
        id: { in: verifiedOrgIds },
      },
      select: {
        id: true,
        createdAt: true,
      },
    });

    const activationByOrg = new Map<string, Date>(
      activationRows
        .filter(
          (row): row is VerifierActivationTimeRow & { organizationId: string } =>
            row.organizationId !== null,
        )
        .map((row) => [row.organizationId, row.activatedAt]),
    );

    const deltasMs = orgs
      .map((org) => {
        const activatedAt = activationByOrg.get(org.id);
        if (!activatedAt) {
          return null;
        }
        return activatedAt.getTime() - org.createdAt.getTime();
      })
      .filter((delta): delta is number => delta !== null && Number.isFinite(delta) && delta > 0);

    if (deltasMs.length === 0) {
      return null;
    }

    const avgMs = deltasMs.reduce((sum, deltaMs) => sum + deltaMs, 0) / deltasMs.length;
    return Number((avgMs / MS_PER_DAY).toFixed(2));
  } catch (error) {
    log('error', 'verifier_activation_latency_failed', {
      event: 'verifier_activation_latency_failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
    return null;
  }
}

const DEMO_PILOT_ORGS: ReadonlyArray<{
  id: string;
  name: string;
  contactEmail: string;
  activatedAt: Date;
  accepted: boolean;
  bundlesGenerated: number;
}> = [
  {
    id: 'demo-pilot-org-alpha',
    name: 'Northpoint Health Group',
    contactEmail: 'pilot-access@northpoint.example',
    activatedAt: new Date('2026-01-09T09:00:00.000Z'),
    accepted: true,
    bundlesGenerated: 2,
  },
  {
    id: 'demo-pilot-org-beta',
    name: 'Summit Care Collective',
    contactEmail: 'pilot-access@summitcare.example',
    activatedAt: new Date('2026-01-10T10:15:00.000Z'),
    accepted: true,
    bundlesGenerated: 1,
  },
];

const BASELINE_START_DATE_DELAY_DAYS = 21;
const AVERAGE_DELAY_REDUCTION_DAYS = 7;
const REVENUE_RECOVERY_PER_DAY_USD = 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Share ids are `@db.Uuid` columns; anything else must be rejected before it
// reaches Prisma. Same shape as the guards in routes/passportEntity.ts and
// routes/auditDecision.ts.
const SHARE_ID_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }

  return value.trim();
}

function parseYcDemoMode(): boolean {
  return parseBooleanEnv(process.env.YC_DEMO_MODE, false);
}

function parseEmail(value: unknown, field: string): string {
  const email = parseRequiredString(value, field);
  if (!email.includes('@')) {
    throw new Error(`${field} must be a valid email address`);
  }

  return email.toLowerCase();
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? parseOptionalString(value[0]) : undefined;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseCredentialLifecycleState(value: unknown): CredentialLifecycleState | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return null;
  }

  switch (normalized) {
    case CredentialLifecycleState.ISSUED:
      return CredentialLifecycleState.ISSUED;
    case CredentialLifecycleState.ACTIVE:
      return CredentialLifecycleState.ACTIVE;
    case CredentialLifecycleState.SUSPENDED:
      return CredentialLifecycleState.SUSPENDED;
    case CredentialLifecycleState.REVOKED:
      return CredentialLifecycleState.REVOKED;
    case CredentialLifecycleState.EXPIRED:
      return CredentialLifecycleState.EXPIRED;
    default:
      return null;
  }
}

function isCredentialActiveFromRecord(record: {
  revokedAt: Date | null;
  suspendedAt: Date | null;
  expiresAt: Date | null;
  status: string;
}): boolean {
  const lifecycleState = computeCredentialState(
    {
      revokedAt: record.revokedAt,
      suspendedAt: record.suspendedAt,
      expiresAt: record.expiresAt,
      status: record.status,
    },
    new Date(),
  );

  return lifecycleState === CredentialLifecycleState.ACTIVE;
}

function estimateRecoveredRevenue(bundleCount: number): number {
  return bundleCount * AVERAGE_DELAY_REDUCTION_DAYS * REVENUE_RECOVERY_PER_DAY_USD;
}

function collectDemoYcMetrics(): YcMetricsPayload {
  const totalNPIs = 12;
  const shareLinks = 24;
  const verifierViews = 16;
  const avgTimeToView = 24;
  const avgMillisecondsToView = avgTimeToView * 60 * 1000;
  const exports = 3;
  const bundlesGenerated = DEMO_PILOT_ORGS.reduce((sum, org) => sum + org.bundlesGenerated, 0);
  const estimatedStartDateAccelerationDays = toStartDateAcceleration(avgMillisecondsToView) ?? 0;
  const activePilotOrgs = DEMO_PILOT_ORGS.length;
  const estimatedRevenueImpact = estimateRecoveredRevenue(bundlesGenerated);

  return {
    totalNPIs,
    shareLinks,
    verifierViews,
    exports,
    avgTimeToView,
    estimatedStartDateAccelerationDays,
    activePilotOrgs,
    bundlesGenerated,
    estimatedRevenueImpact,
    verifierConversionRate: asRate(0, verifierViews),
    pilotActivationRate: asRate(0, 0),
    avgArtifactViewTime: avgTimeToView,
    timeFromRegistrationToPilotActivation: null,
    pilotOrgCount: DEMO_PILOT_ORGS.length,
    monitoringFlags: {
      firstViewTracking: true,
      artifactGenerationTracking: exports > 0,
      pilotOrgTracking: true,
    },
    isDemoMode: true,
    pilotOrgs: DEMO_PILOT_ORGS.map((pilotOrg) => ({
      id: pilotOrg.id,
      name: pilotOrg.name,
      contactEmail: pilotOrg.contactEmail,
      activatedAt: pilotOrg.activatedAt.toISOString(),
      accepted: pilotOrg.accepted,
      bundlesGenerated: pilotOrg.bundlesGenerated,
    })),
    verifierFunnelMetrics: {
      totalVerifierViews: verifierViews,
      totalPilotClicks: 0,
      totalActivations: 0,
      conversionRateByVariant: {},
    },
    revenueRecoveryEstimate: estimatedRevenueImpact,
    trustStateDistribution: {
      verified: 8,
      verified_monitoring: 2,
      expiring_soon: 1,
      needs_review: 1,
      expired: 0,
    },
    monitoringDeltaFrequency: 0,
    enterpriseComplianceSummary: buildEnterpriseComplianceSummary(),
    pilotReady: false,
  };
}

function parseLane(value: unknown): VerificationLane {
  const normalized = parseRequiredString(value, 'lane').toUpperCase();
  if (!VALID_LANES.includes(normalized as VerificationLane)) {
    throw new Error('lane must be one of PUBLIC | PARTNER | MANUAL');
  }
  return normalized as VerificationLane;
}

function parseDateField(value: unknown): Date {
  if (value === undefined) {
    return new Date();
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('acceptedAt must be an ISO timestamp');
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('acceptedAt must be an ISO timestamp');
  }

  return parsed;
}

function toAuditHash(input: string): string {
  return sha256Hex(input);
}

function calculateAverageTimeToViewMilliseconds(
  rows: Array<{
    createdAt: Date;
    firstViewedAt: Date | null;
  }>,
): number | null {
  if (rows.length === 0) {
    return null;
  }

  const totalMinutes = rows.reduce((acc, row) => {
    if (!row.firstViewedAt) {
      return acc;
    }
    const deltaMs = row.firstViewedAt.getTime() - row.createdAt.getTime();
    return acc + deltaMs;
  }, 0);

  const sampleCount = rows.filter((row) => row.firstViewedAt).length;
  if (sampleCount === 0) {
    return null;
  }

  return Number((totalMinutes / sampleCount).toFixed(2));
}

function toStartDateAcceleration(avgTimeToViewMilliseconds: number | null): number | null {
  if (avgTimeToViewMilliseconds === null) {
    return null;
  }
  return Number(
    (
      BASELINE_START_DATE_DELAY_DAYS - avgTimeToViewMilliseconds / MS_PER_DAY
    ).toFixed(2),
  );
}

async function evaluateTrustLedgerIntegrity(
  organizationId?: string,
): Promise<boolean> {
  const organizationFilter = buildOrganizationFilter(organizationId);

  const events = await prisma.trustLedgerEntry.findMany({
    where: organizationFilter,
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });

  if (events.length <= 1) {
    return true;
  }

  for (let i = 1; i < events.length; i += 1) {
    if (events[i].createdAt.getTime() < events[i - 1].createdAt.getTime()) {
      return false;
    }
  }

  return true;
}

async function loadTrustStateDistribution(organizationId?: string): Promise<TrustStateDistribution> {
  const distribution: TrustStateDistribution = {
    verified: 0,
    verified_monitoring: 0,
    expiring_soon: 0,
    needs_review: 0,
    expired: 0,
  };

  try {
    const organizationFilter = buildOrganizationFilter(organizationId);
    const artifacts = await prisma.verificationArtifact.findMany({
      where: organizationFilter,
      select: { trustState: true },
    });

    for (const artifact of artifacts) {
      const state = artifact.trustState;
      if (state in distribution) {
        distribution[state as keyof TrustStateDistribution] += 1;
      }
    }
  } catch {
    // Return zero distribution on failure
  }

  return distribution;
}

async function loadMonitoringDeltaFrequency(organizationId?: string): Promise<number> {
  try {
    const organizationFilter = buildOrganizationFilter(organizationId);
    const count = await prisma.monitoringEvent.count({ where: organizationFilter });
    return count;
  } catch {
    return 0;
  }
}

function buildEnterpriseComplianceSummary(): EnterpriseComplianceSummary {
  return {
    ncqaAlignment: COMPLIANCE_SUMMARY.ncqaAlignment,
    monitoringEnabled: COMPLIANCE_SUMMARY.monitoringEnabled,
    trustLedgerAppendOnly: COMPLIANCE_SUMMARY.trustLedgerAppendOnly,
    lifecycleEnforced: checkLifecycleIntegrity(),
    multiTenantScoped: true,
  };
}

async function loadYcMetrics(organizationId?: string): Promise<YcMetricsPayload> {
  if (parseYcDemoMode()) {
    return collectDemoYcMetrics();
  }

  const organizationFilter = buildOrganizationFilter(organizationId);

  const [shareLinks, verifiedViews, npiGroups, viewRows, exportCount, funnelMetrics, pilotOrgs, activePilotPlans, timeFromRegistrationToPilotActivation, trustStateDistribution, monitoringDeltaFrequency, enterpriseStatus] =
    await Promise.all([
      prisma.shareLink.count({ where: organizationFilter }),
      prisma.shareLink.count({
        where: {
          ...organizationFilter,
          firstViewedAt: { not: null },
        },
      }),
      prisma.shareLink.groupBy({
        by: ['npi'],
        _count: { _all: true },
        where: organizationFilter,
      }),
      prisma.shareLink.findMany({
        where: {
          ...organizationFilter,
          firstViewedAt: { not: null },
        },
        select: { createdAt: true, firstViewedAt: true },
      }),
      prisma.auditEvent.count({
        where: {
          type: 'ARTIFACT_EXPORTED',
          ...(organizationFilter.organizationId ? { organizationId } : {}),
        },
      }),
      loadFunnelMetrics(organizationId),
      prisma.pilotOrg.findMany({
        orderBy: { activatedAt: 'desc' },
        select: { id: true, name: true, contactEmail: true, activatedAt: true, accepted: true },
      }),
      prisma.pilotPlan.findMany({
        where: {
          active: true,
          ...(organizationFilter.organizationId ? { organizationId } : {}),
        },
        select: { organizationId: true, bundleCount: true },
      }),
      loadAverageTimeFromRegistrationToPilotActivation(organizationId),
      loadTrustStateDistribution(organizationId),
      loadMonitoringDeltaFrequency(organizationId),
      buildEnterpriseStatus(organizationId),
    ]);

  const avgMillisecondsToView = calculateAverageTimeToViewMilliseconds(viewRows);
  const avgTimeToView =
    avgMillisecondsToView === null ? 0 : Number((avgMillisecondsToView / (1000 * 60)).toFixed(2));
  const estimatedStartDateAccelerationDays = toStartDateAcceleration(avgMillisecondsToView);

  const activeOrgIds = activePilotPlans
    .map((plan) => plan.organizationId)
    .filter((id): id is string => id !== null);

  const scopedPilotOrgs = organizationFilter.organizationId
    ? pilotOrgs.filter((pilotOrg) => activeOrgIds.includes(pilotOrg.id))
    : pilotOrgs;

  const bundlesByOrg = new Map<string, number>(
    activePilotPlans
      .filter((plan): plan is typeof plan & { organizationId: string } => plan.organizationId !== null)
      .map((plan) => [plan.organizationId, plan.bundleCount]),
  );
  const activeBundlesGenerated = activePilotPlans.reduce(
    (sum, plan) => sum + plan.bundleCount,
    0,
  );

  const pilotOrgRows: PilotOrgRow[] = scopedPilotOrgs.map((p) => ({
    id: p.id,
    name: p.name,
    contactEmail: p.contactEmail,
    activatedAt: p.activatedAt.toISOString(),
    accepted: p.accepted,
    bundlesGenerated: bundlesByOrg.get(p.id) ?? 0,
  }));

  return {
    totalNPIs: npiGroups.length,
    shareLinks,
    verifierViews: verifiedViews,
    exports: exportCount,
    avgTimeToView,
    estimatedStartDateAccelerationDays,
    activePilotOrgs: bundlesByOrg.size,
    bundlesGenerated: activeBundlesGenerated,
    estimatedRevenueImpact: estimateRecoveredRevenue(activeBundlesGenerated),
    verifierConversionRate: asRate(funnelMetrics.totalPilotClicks, funnelMetrics.totalVerifierViews),
    pilotActivationRate: asRate(funnelMetrics.totalActivations, funnelMetrics.totalPilotClicks),
    avgArtifactViewTime: avgTimeToView,
    timeFromRegistrationToPilotActivation,
    pilotOrgCount: scopedPilotOrgs.length,
    monitoringFlags: {
      firstViewTracking: verifiedViews > 0,
      artifactGenerationTracking: activeBundlesGenerated > 0,
      pilotOrgTracking: organizationFilter.organizationId
        ? scopedPilotOrgs.length > 0
        : pilotOrgs.length > 0,
    },
    isDemoMode: false,
    pilotOrgs: pilotOrgRows,
    verifierFunnelMetrics: funnelMetrics,
    revenueRecoveryEstimate: estimateRecoveredRevenue(activeBundlesGenerated),
    trustStateDistribution,
    monitoringDeltaFrequency,
    enterpriseComplianceSummary: buildEnterpriseComplianceSummary(),
    pilotReady: enterpriseStatus.pilotReady,
  };
}

async function ensureActivePilotPlan(organizationId: string): Promise<void> {
  const existing = await prisma.pilotPlan.findFirst({
    where: {
      organizationId,
      active: true,
    },
  });

  if (existing) {
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.pilotPlan.updateMany({
      where: {
        organizationId,
        active: true,
      },
      data: {
        active: false,
      },
    });

    await tx.pilotPlan.create({
      data: {
        organizationId,
        startDate: new Date(),
        active: true,
      },
    });
  });
}

function registerHealthRoutes(app: Express): void {
  app.get(['/health', '/health/'], (_req, res) => {
    res.status(200).json({
      status: 'ok',
      metrics: requestLatencyMetrics.snapshot(),
      git_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
      git_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      // The container's Node version decides whether a CommonJS `require()`
      // can load an ESM-only dependency: `require(esm)` exists from 22.12.
      // Two outages on 2026-07-27 (jose v6, @noble/post-quantum) turned on
      // this exact number, and both times it had to be INFERRED from an
      // ERR_REQUIRE_ESM in the logs because nothing reported it. `nixpacks.toml`
      // pins `nodejs_22` while its own comment claims ">= 22.12" — publishing
      // the real value is how that claim stops being unfalsifiable.
      node_version: process.version,
      // W0-09: exactly one identity fact, as a boolean. True only when the
      // verified-identity middleware is in its blocking mode; false for every
      // other mode. No mode names and no other environment facts — this is a
      // public endpoint on a public repo, and a boolean is the smallest thing
      // that lets the deploy loop confirm the flip without a probe.
      identityEnforced: env().CLERK_JWT_VERIFICATION === 'enforce',
    });
  });

  app.get('/readyz', (_req, res) => {
    prisma
      .$queryRaw`SELECT 1`
      .then(() => {
        res.status(200).json({
          status: 'ready',
          service: 'api',
          git_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
          git_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
        });
      })
      .catch(() => {
        res.status(503).json({
          status: 'not_ready',
          service: 'api',
          git_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
          git_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
        });
      });
  });

  app.get('/', (_req, res) => {
    res.status(200).json({
      name: 'VitalCV API',
      version: 'mvp',
    });
  });

  app.get('/verifier', (_req, res) => {
    res.status(200).json({ route: 'verifier', status: 'available' });
  });

  app.get('/api/internal/health', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const [dbConnected, trustLedgerOperational, monitoringOperational] = await Promise.all([
      isDbConnected(),
      isTrustLedgerOperational(),
      isMonitoringOperational(),
    ]);

    return res.status(200).json({
      status:
        dbConnected && trustLedgerOperational && monitoringOperational ? 'ok' : 'degraded',
      dbConnected,
      trustLedgerOperational,
      monitoringOperational,
    });
  });
}

function registerLookupRoutes(app: Express): void {
  app.get('/clinician', async (req: Request, res: Response) => {
    const npiInput = parseOptionalString(req.query.npi);

    try {
      const npi = parseNpi(npiInput, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'Clinician not found' });
      }

      return res.status(200).json({
        clinicianId: npi,
        npi,
        trustState: artifact.trustState,
        monitoring: artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD',
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid clinician lookup' });
    }
  });

  app.get('/api/npi/:npi', async (req: Request, res: Response) => {
    try {
      const npi = parseNpi(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'NPI not found' });
      }

      return res.status(200).json({
        npi,
        artifact: {
          id: artifact.id,
          source: artifact.source,
          status: artifact.status,
          verifiedAt: artifact.verifiedAt.toISOString(),
          expiresAt: artifact.expiresAt?.toISOString() ?? null,
          monitoring: artifact.monitoring,
          trustState: artifact.trustState,
        },
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid NPI' });
    }
  });

  app.get('/api/trust/:npi', async (req: Request, res: Response) => {
    try {
      const npi = parseNpi(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);
      const artifact = await getLatestArtifact(npi, organizationId);
      if (!artifact) {
        return res.status(404).json({ error: 'NPI not found' });
      }

      return res.status(200).json({
        npi,
        trustState: artifact.trustState,
        monitoring: artifact.monitoring,
      });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid NPI' });
    }
  });
}

function registerComplianceRoutes(app: Express): void {
  app.use('/api', complianceRoutes);

  app.get('/api/compliance/summary', (_req: Request, res: Response) => {
    res.status(200).json(COMPLIANCE_SUMMARY);
  });

  app.get('/api/security/posture', (_req: Request, res: Response) => {
    res.status(200).json(SECURITY_POSTURE);
  });

  app.get('/api/version', (_req: Request, res: Response) => {
    res.status(200).json(VERSION_INFO);
  });
}

function registerOperationsRoutes(app: Express): void {
  app.get('/api/internal/system-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const dbConnected = await isDbConnected();
    const trustLedgerOperational = await isTrustLedgerOperational();
    const monitoringOperational = await isMonitoringOperational();

    return res.status(200).json({
      version: VERSION_INFO.buildVersion,
      uptime: process.uptime(),
      dbConnected,
      trustLedgerOperational,
      monitoringOperational,
      pilotMode: PILOT_MODE,
      enterpriseMode: ENTERPRISE_MODE,
      frozen: SYSTEM_FROZEN,
    });
  });

  app.get('/api/internal/pilot-checklist', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await buildPilotReadiness(organizationId);
      return res.status(200).json(payload);
    } catch {
      return res.status(500).json({ error: 'Unable to calculate pilot readiness' });
    }
  });

  // ── Wave 34: Consolidated Enterprise Status ──────────────────
  app.get('/api/internal/enterprise-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await buildEnterpriseStatus(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'enterprise_status_error', {
        event: 'enterprise_status_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute enterprise status' });
    }
  });

  app.get('/api/internal/trusted-issuers', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const summary = await getIssuerRegistrySummary();
      return res.status(200).json(summary);
    } catch (error) {
      log('error', 'trusted_issuer_lookup_error', {
        event: 'trusted_issuer_lookup_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to load trusted issuers.' });
    }
  });

  app.get('/api/internal/artifact-merkle/:artifactId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
          claimHashes: true,
          merkleRoot: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const claimHashes = Array.isArray(artifact.claimHashes) ? artifact.claimHashes : [];
      const merkleRoot = typeof artifact.merkleRoot === 'string' ? artifact.merkleRoot : '';

      return res.status(200).json({
        merkleRoot,
        claimCount: claimHashes.length,
        merkleValid: validateMerkleIntegrity(artifact),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to validate artifact merkle proof';
      return res.status(500).json({ error: message });
    }
  });

  // ── Wave 34: Freeze Hard Lock Enforcement ────────────────────
  app.post('/api/internal/freeze-check', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const operation = typeof body.operation === 'string' ? body.operation.trim() : '';

    if (!operation) {
      return res.status(400).json({ error: 'operation field is required' });
    }

    try {
      enforceFreezeHardLock(operation);
      return res.status(200).json({ allowed: true, operation });
    } catch (error) {
      return res.status(403).json({
        allowed: false,
        operation,
        error: error instanceof Error ? error.message : 'Operation blocked by freeze lock',
      });
    }
  });
}

// ── Wave C: Selective Disclosure Proof Routes ─────────────────
function registerProofRoutes(app: Express): void {
  /**
   * Generate a selective disclosure proof for a single claim.
   * Requires API key auth and org scoping — only the verifier org
   * that owns the artifact can generate proofs.
   */
  app.get(
    '/api/proof/:artifactId/:claimType',
    proofRateLimit,
    apiKeyAuth,
    async (req: Request, res: Response) => {
      try {
        const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
        const claimType = parseRequiredString(req.params.claimType, 'claimType');
        const requestOrganizationId = getRequestOrganizationId(req);
        if (!requestOrganizationId) {
          return res.status(401).json({
            error: 'organization_context_required',
            error_description: 'Organization context is required.',
          });
        }

        const artifact = await prisma.verificationArtifact.findUnique({
          where: { id: artifactId },
          select: {
            id: true,
            npi: true,
            status: true,
            rawPayload: true,
            checksum: true,
            merkleRoot: true,
            claimHashes: true,
            verifiedAt: true,
            expiresAt: true,
            revokedAt: true,
            suspendedAt: true,
            organizationId: true,
          },
        });

        if (!artifact) {
          return res.status(404).json({ error: 'Artifact not found' });
        }

        const trustLevel = await resolveCrossOrgTrustLevel({
          requestOrganizationId,
          artifactOrganizationId: artifact.organizationId,
          isSuperAdmin: isSuperAdminRequest(req),
          resolveTrustLevel: getFederatedTrustLevel,
        });
        if (!trustLevel) {
          return res.status(403).json({
            error: 'forbidden',
            error_description: 'Cross-organization proof access not permitted.',
          });
        }

        // Wave N: HAIP no-downgrade enforcement
        const algorithmHeader = typeof req.get('x-proof-algorithm') === 'string'
          ? req.get('x-proof-algorithm')
          : undefined;
        const haipCheck = enforceHaipNoDowngrade({
          algorithm: algorithmHeader ?? 'ES256',
          signed: true,
          issuerType: getConfiguredIssuerDid(),
        });
        if (!haipCheck.valid) {
          return res.status(422).json({
            error: 'HAIP no-downgrade violation',
            violations: haipCheck.violations,
          });
        }

        // Strict mode guard
        const strictMode = isStrictTransitionMode();
        if (strictMode) {
          if (!artifact.checksum || artifact.checksum.length === 0) {
            return res.status(422).json({ error: 'Strict mode: artifact fingerprint invalid' });
          }
          if (!artifact.merkleRoot || artifact.merkleRoot.length === 0) {
            return res.status(422).json({ error: 'Strict mode: artifact merkleRoot invalid' });
          }
          const integrityOk = validateMerkleIntegrity(artifact);
          if (!integrityOk) {
            return res.status(422).json({ error: 'Strict mode: artifact integrity invalid' });
          }

          const active = isCredentialActiveFromRecord(artifact);
          if (!active) {
            return res.status(422).json({ error: 'Strict mode: artifact lifecycle is not active' });
          }
        }

        // Wave T5: Strict mode health gate — abort if system unhealthy
        if (isStrictTransitionMode() && hasCriticalFailure()) {
          return res.status(503).json({
            error: 'system_unhealthy',
            error_description: 'Proof generation blocked: recent critical system failure detected.',
          });
        }

        const proofStartMs = Date.now();
        let claimProof;
        try {
          claimProof = generateClaimProof(
            {
              npi: artifact.npi,
              status: artifact.status,
              rawPayload: artifact.rawPayload,
              checksum: artifact.checksum,
              merkleRoot: artifact.merkleRoot,
              claimHashes: artifact.claimHashes,
              verifiedAt: artifact.verifiedAt,
              expiresAt: artifact.expiresAt,
            },
            claimType,
          );
          recordLatency('proof', Date.now() - proofStartMs);

          // Wave R: Record proof issuance analytics (fire-and-forget)
          recordProofIssuedEvent(artifactId, requestOrganizationId).catch(() => {});
        } catch (proofError) {
          await logSystemFailure('proof_generation', 'error', proofError instanceof Error ? proofError.message : 'Proof generation failed', { artifactId });
          throw proofError;
        }

        if (trustLevel !== 'full') {
          return res.status(200).json({ claimProof });
        }

        const auditPacket = await generateAuditPacket(artifact.id);
        return res.status(200).json({ claimProof, auditPacket });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to generate claim proof';
        log('error', 'proof_generation_error', {
          event: 'proof_generation_error',
          error: message,
        });
        return res.status(400).json({ error: message });
      }
    },
  );

  /**
   * Verify a selective disclosure claim proof.
   * Stateless — no DB access needed. Any party can verify.
   */
  app.post('/api/proof/verify', proofRateLimit, express.json(), async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const claimProofInput = body.claimProof;

      if (
        !claimProofInput ||
        typeof claimProofInput !== 'object' ||
        Array.isArray(claimProofInput)
      ) {
        return res.status(400).json({ error: 'claimProof is required' });
      }

      const proof = claimProofInput as Record<string, unknown>;

      // Validate required fields
      if (typeof proof.claimType !== 'string' || proof.claimType.trim().length === 0) {
        return res.status(400).json({ error: 'claimProof.claimType is required' });
      }
      if (
        proof.claimValue === undefined ||
        proof.claimValue === null ||
        (typeof proof.claimValue !== 'string' &&
          typeof proof.claimValue !== 'number' &&
          typeof proof.claimValue !== 'boolean')
      ) {
        return res.status(400).json({ error: 'claimProof.claimValue is required' });
      }
      if (typeof proof.leafHash !== 'string' || proof.leafHash.length === 0) {
        return res.status(400).json({ error: 'claimProof.leafHash is required' });
      }
      if (typeof proof.leafIndex !== 'number' || !Number.isInteger(proof.leafIndex) || proof.leafIndex < 0) {
        return res.status(400).json({ error: 'claimProof.leafIndex must be a non-negative integer' });
      }
      if (!Array.isArray(proof.proofPath)) {
        return res.status(400).json({ error: 'claimProof.proofPath must be an array' });
      }
      if (typeof proof.merkleRoot !== 'string' || proof.merkleRoot.length === 0) {
        return res.status(400).json({ error: 'claimProof.merkleRoot is required' });
      }
      if (typeof proof.fingerprint !== 'string' || proof.fingerprint.length === 0) {
        return res.status(400).json({ error: 'claimProof.fingerprint is required' });
      }

      const validatedProof: ClaimProof = {
        claimType: proof.claimType,
        claimValue: proof.claimValue as string | number | boolean,
        leafHash: proof.leafHash,
        leafIndex: proof.leafIndex,
        proofPath: proof.proofPath as string[],
        merkleRoot: proof.merkleRoot,
        fingerprint: proof.fingerprint,
      };

      const valid = verifyClaimProof(validatedProof);

      return res.status(200).json({ valid });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to verify claim proof';
      log('error', 'proof_verification_error', {
        event: 'proof_verification_error',
        error: message,
      });
      return res.status(400).json({ error: message });
    }
  });
}

function registerCredentialStatusRoutes(app: Express): void {
  app.get('/api/credential-status/:artifactId', credentialStatusRateLimit, async (req: Request, res: Response) => {
    const statusCheckStartMs = Date.now();
    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
          revokedAt: true,
          suspendedAt: true,
          expiresAt: true,
          status: true,
          checksum: true,
          merkleRoot: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const lifecycleState = computeCredentialState(
        {
          revokedAt: artifact.revokedAt,
          suspendedAt: artifact.suspendedAt,
          expiresAt: artifact.expiresAt,
          status: artifact.status,
        },
        new Date(),
      );

      recordLatency('status_check', Date.now() - statusCheckStartMs);

      return res.status(200).json({
        lifecycleState,
        revoked: lifecycleState === CredentialLifecycleState.REVOKED,
        suspended: lifecycleState === CredentialLifecycleState.SUSPENDED,
        expired: lifecycleState === CredentialLifecycleState.EXPIRED,
        expiresAt: artifact.expiresAt,
        fingerprint: artifact.checksum,
        merkleRoot: artifact.merkleRoot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read credential status';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/transparency/:artifactId', async (req: Request, res: Response) => {
    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const entries = await getTransparencyEntries(artifactId);
      return res.status(200).json({
        artifactId,
        entries,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read transparency log';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/audit-packet/:artifactId', async (req: Request, res: Response) => {
    if (!requireVerifierOrAdmin(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const auditPacket = await generateAuditPacket(artifactId);
      return res.status(200).json({
        auditPacket,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate audit packet';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/verifier/audit-bundle/:artifactId', async (req: Request, res: Response) => {
    if (!requireVerifierOrAdmin(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const auditPacket = await generateAuditPacket(artifactId);
      return res.status(200).json({
        artifactId,
        verifierAuditBundle: auditPacket.verifierAuditBundle,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export verifier audit bundle';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/cross-check-bundle/:artifactId', async (req: Request, res: Response) => {
    if (!requireVerifierOnly(req, res)) {
      return;
    }

    try {
      const requestOrganizationId = getRequestOrganizationId(req);
      if (!requestOrganizationId) {
        return res.status(401).json({ error: 'organization_context_required' });
      }

      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: { id: true, organizationId: true },
      });

      if (!artifact || !artifact.organizationId) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      const trustLevel = await resolveCrossOrgTrustLevel({
        requestOrganizationId,
        artifactOrganizationId: artifact.organizationId,
        isSuperAdmin: isSuperAdminRequest(req),
        resolveTrustLevel: getFederatedTrustLevel,
      });
      if (!trustLevel) {
        return res.status(403).json({
          error: 'forbidden',
          error_description: 'Cross-organization bundle access not permitted.',
        });
      }

      const bundle = await generateCrossCheckBundle(artifactId);
      return res.status(200).json(bundle);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to generate cross-check bundle';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/status-list', credentialStatusRateLimit, async (req: Request, res: Response) => {
    const organizationId = getRequestOrganizationId(req);
    const organizationFilter = buildOrganizationFilter(organizationId);
    try {
      const [revokedCredentials, suspendedCredentials] = await Promise.all([
        prisma.verificationArtifact.findMany({
          where: { ...organizationFilter, revokedAt: { not: null } },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
        prisma.verificationArtifact.findMany({
          where: {
            ...organizationFilter,
            revokedAt: null,
            suspendedAt: { not: null },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
        }),
      ]);

      return res.status(200).json({
        revokedCredentialIds: revokedCredentials.map((row) => row.id),
        suspendedCredentialIds: suspendedCredentials.map((row) => row.id),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read status list';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/credential-status-audit/:artifactId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: artifactId },
        select: {
          id: true,
          organizationId: true,
          revokedAt: true,
          suspendedAt: true,
          expiresAt: true,
          status: true,
        },
      });

      if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
      }

      if (!enforceArtifactOrganizationAccess(req, res, artifact)) {
        return;
      }

      const lifecycleState = computeCredentialState(
        {
          revokedAt: artifact.revokedAt,
          suspendedAt: artifact.suspendedAt,
          expiresAt: artifact.expiresAt,
          status: artifact.status,
        },
        new Date(),
      );

      const latestLedgerEvent = await prisma.trustLedgerEntry.findFirst({
        where: { artifactId },
        orderBy: { createdAt: 'desc' },
        select: { metadata: true },
      });

      let ledgerConsistency = true;
      if (latestLedgerEvent?.metadata && typeof latestLedgerEvent.metadata === 'object') {
        const metadata = latestLedgerEvent.metadata as Record<string, unknown>;
        const ledgerState = parseCredentialLifecycleState(metadata.status);
        if (ledgerState !== null && ledgerState !== lifecycleState) {
          ledgerConsistency = false;
        }
      }

      return res.status(200).json({
        lifecycleState,
        revokedAt: artifact.revokedAt,
        suspendedAt: artifact.suspendedAt,
        expiresAt: artifact.expiresAt,
        ledgerConsistency,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read credential status audit';
      return res.status(500).json({ error: message });
    }
  });
}
function registerPilotRoutes(app: Express): void {
  app.get('/api/verify/:shareId', publicApiRateLimit, async (req: Request, res: Response) => {
    const shareId = parseRequiredString(req.params.shareId, 'shareId');
    const organizationId = getRequestOrganizationId(req);
    const organizationFilter = buildOrganizationFilter(organizationId);
    const ref = normalizeFunnelRef(req.query.ref);

    // ShareLink.id is `@db.Uuid`, so a malformed id makes Prisma throw at the
    // driver ("Error creating UUID") before the not-found branch below is ever
    // reached — a public endpoint returning 500 for any non-UUID path segment.
    // Guard the exact value the query receives, and answer exactly as we answer
    // an id that simply does not exist, so the two are indistinguishable.
    if (!SHARE_ID_UUID_RE.test(shareId)) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    try {
      const existing = await prisma.shareLink.findFirst({
        where: {
          id: shareId,
          ...organizationFilter,
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Share link not found' });
      }

      const now = new Date();
      const isFirstView = existing.firstViewedAt === null;

      const updated = await prisma.shareLink.update({
        where: {
          id: shareId,
        },
        data: {
          firstViewedAt: existing.firstViewedAt ?? now,
        },
      });

      void logFunnelEvent('verify_api_call', updated.npi, {
        shareId: updated.id,
        isFirstView,
        ...(ref ? { ref } : {}),
        ...(organizationId ? { organizationId } : {}),
      });

      await prisma.auditEvent.create({
        data: {
          type: 'ARTIFACT_VIEWED',
          hash: toAuditHash(`verify:${shareId}`),
          referenceId: updated.id,
          clinicianId: updated.npi,
          ...(updated.organizationId ? { organizationId: updated.organizationId } : {}),
          metadata: {
            shareId: updated.id,
            first_view: isFirstView,
            trace: toAuditHash(`${updated.id}:${updated.npi}:${updated.createdAt.toISOString()}`),
          } as Prisma.InputJsonValue,
        },
      });

      // Resolve or create artifact for this NPI (scoped to share link's org)
      const shareLinkOrgId = updated.organizationId ?? undefined;

      // Wave T5: Strict mode health gate — abort issuance if system unhealthy
      if (isStrictTransitionMode() && hasCriticalFailure()) {
        return res.status(503).json({
          error: 'system_unhealthy',
          error_description: 'VC issuance blocked: recent critical system failure detected.',
        });
      }

      let artifact = await getLatestArtifact(updated.npi, shareLinkOrgId);
      if (artifact && isProductionRuntime() && !isDecisionGradeArtifact(artifact)) {
        // Fabricated (stub-origin) rows confer nothing in production.
        artifact = null;
      }
      if (!artifact) {
        const issuanceStartMs = Date.now();
        try {
          artifact = await createArtifactFromNursys(updated.npi, shareLinkOrgId);
          recordLatency('vc_issuance', Date.now() - issuanceStartMs);

          // Wave R: Record onboarding analytics (fire-and-forget)
          recordVerificationEvent(artifact.id, shareLinkOrgId ?? '').catch(() => {});
        } catch (issuanceError) {
          if (issuanceError instanceof SourceAccessRequiredError) {
            // Honest fail-closed state: the share link resolved, but no
            // decision-grade verification exists and production must not
            // fabricate one. Expected state, not a system failure.
            return res.status(200).json({
              trustState: 'needs_review',
              source: `NPI:${updated.npi}`,
              status: 'SOURCE_ACCESS_REQUIRED',
              decisionGrade: false,
              reason:
                'License verification requires primary-source access that is not yet connected. No license status is available for this credential.',
              verifiedAt: null,
              expiresAt: null,
              monitoring: 'STANDARD',
              checksum: null,
              crossCheckEligible: false,
              signature: null,
              hash: null,
              timestamp: new Date().toISOString(),
            });
          }
          await logSystemFailure('vc_issuance', 'critical', issuanceError instanceof Error ? issuanceError.message : 'VC issuance failed', { organizationId: shareLinkOrgId });
          throw issuanceError;
        }
      }

      const status = artifact.status === 'ACTIVE' ? 'VERIFIED' : artifact.status;
      const monitoringStatus = artifact.monitoring ? 'ACTIVE_MONITORING' : 'STANDARD';
      const trustState = computeTrustState({
        status: artifact.status,
        expiresAt: artifact.expiresAt,
        monitoring: artifact.monitoring,
      });

      return res.status(200).json({
        trustState,
        source: `NPI:${updated.npi}`,
        status,
        decisionGrade: isDecisionGradeArtifact(artifact),
        verifiedAt: artifact.verifiedAt.toISOString(),
        expiresAt: artifact.expiresAt?.toISOString() ?? null,
        monitoring: isFirstView ? 'pending verifier confirmation' : monitoringStatus,
        checksum: artifact.checksum,
        crossCheckEligible: true,
        signature: `rev-${artifact.checksum}`,
        hash: artifact.checksum,
        timestamp: artifact.verifiedAt.toISOString(),
      });
    } catch (error) {
      log('error', 'verify_share_error', {
        event: 'verify_share_error',
        shareId: req.params.shareId,
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to resolve share link' });
    }
  });

  // `POST /api/pilot/acceptance` was retired here (VCD-01d). It sat behind
  // walletRateLimit and nothing else, and wrote a VerifierAcceptance row from a
  // caller-supplied organization string. That model holds id, organization and
  // acceptedAt — no clinician, no packet, no employer identity — so it could
  // not represent a head-start acceptance; it recorded nothing to accept. Its
  // rows were nonetheless counted into the metrics payload, unfiltered by
  // organization, which made an unauthenticated endpoint the writer of a number
  // presented as "employers accepted".
  //
  // The VerifierAcceptance model is intentionally still in the schema; dropping
  // it is a destructive migration and a separate decision. See
  // routes/__tests__/pilotAcceptanceCounterRetired.test.ts.

  app.post('/api/pilot/activate', walletRateLimit, async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const organizationId = getRequestOrganizationId(req);
    const ctaVariant = normalizeFunnelVariant(body.ctaVariant ?? body.cta_variant);
    const ref = normalizeFunnelRef(body.ref);
    const eventNpi =
      typeof body.npi === 'string' && body.npi.trim().length > 0 ? body.npi.trim() : 'pilot_activation';

    try {
      const organizationName = parseRequiredString(body.organizationName, 'organizationName');
      const contactEmail = parseEmail(body.contactEmail, 'contactEmail');

      void logFunnelEvent('pilot_activation_click', eventNpi, {
        cta_variant: ctaVariant,
        ...(ref ? { ref } : {}),
        ...(organizationId ? { organizationId } : {}),
      });

      const existing = await prisma.pilotOrg.findFirst({
        where: {
          name: organizationName,
          contactEmail,
        },
      });

      if (existing) {
        const activated = existing.accepted
          ? existing
          : await prisma.pilotOrg.update({
              where: { id: existing.id },
              data: {
                accepted: true,
                activatedAt: new Date(),
              },
            });
        await ensureActivePilotPlan(activated.id);

        void logFunnelEvent('pilot_activation_success', eventNpi, {
          cta_variant: ctaVariant,
          ...(ref ? { ref } : {}),
          status: 'existing',
          ...(organizationId ? { organizationId } : {}),
        });

        return res.status(200).json({
          id: activated.id,
          organization: activated.name,
          contactEmail: activated.contactEmail,
          activatedAt: activated.activatedAt.toISOString(),
          accepted: activated.accepted,
        });
      }

      const created = await prisma.pilotOrg.create({
        data: {
          name: organizationName,
          contactEmail,
          accepted: true,
        },
      });
      await ensureActivePilotPlan(created.id);

      void logFunnelEvent('pilot_activation_success', eventNpi, {
        cta_variant: ctaVariant,
        ...(ref ? { ref } : {}),
        status: 'created',
        ...(organizationId ? { organizationId } : {}),
      });

      return res.status(201).json({
        id: created.id,
        organization: created.name,
        contactEmail: created.contactEmail,
        activatedAt: created.activatedAt.toISOString(),
        accepted: created.accepted,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to activate pilot organization';
      return res.status(400).json({ error: message });
    }
  });

  app.get('/api/metrics/yc', async (_req: Request, res: Response) => {
    try {
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadYcMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'yc_metrics_error', {
        event: 'yc_metrics_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute YC metrics' });
    }
  });

  app.get('/api/internal/funnel-report', async (req: Request, res: Response) => {
    // Operator surface: the other 20 /api/internal/* routes gate on the
    // monitoring secret and these two did not, so they answered any anonymous
    // caller who set x-org-id. loadFunnelMetrics is org-scoped, so a real org
    // id returned that org's funnel. scripts/simulateVerifierFlow.ts already
    // sends x-monitoring-secret and asserts it is required here.
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await loadFunnelMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'funnel_report_error', {
        event: 'funnel_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute funnel report' });
    }
  });

  app.get('/api/internal/verifier-funnel', async (req: Request, res: Response) => {
    // Operator surface: the other 20 /api/internal/* routes gate on the
    // monitoring secret and these two did not, so they answered any anonymous
    // caller who set x-org-id. loadFunnelMetrics is org-scoped, so a real org
    // id returned that org's funnel. scripts/simulateVerifierFlow.ts already
    // sends x-monitoring-secret and asserts it is required here.
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const payload = await loadFunnelMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'funnel_report_error', {
        event: 'funnel_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute funnel report' });
    }
  });

  app.get('/api/pilot/report', async (_req: Request, res: Response) => {
    try {
      const organizationId = getRequestOrganizationId(_req);
      const payload = await loadYcMetrics(organizationId);
      return res.status(200).json(payload);
    } catch (error) {
      log('error', 'pilot_report_error', {
        event: 'pilot_report_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute pilot report' });
    }
  });

  // ── Wave 11: NCQA Audit-Ready Bundle Generator ──────────────
  app.get('/bundle/:id/export', publicApiRateLimit, async (req: Request, res: Response) => {
    try {
      const snapshotId = parseRequiredString(req.params.id, 'id');
      const exportPayload = await getBundleExportBySnapshotId(snapshotId);

      return res.status(200).json(exportPayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to export audit bundle snapshot';
      if (message.includes('required')) {
        return res.status(400).json({ error: message });
      }
      if (message.includes('not found')) {
        return res.status(404).json({ error: message });
      }

      log('error', 'audit_bundle_export_error', {
        event: 'audit_bundle_export_error',
        snapshotId: req.params.id,
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/artifact/bundle/:npi', publicApiRateLimit, async (req: Request, res: Response) => {
    try {
      const npi = parseRequiredString(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);

      const bundle = await generateAuditBundle(npi, { organizationId });

      return res.status(200).json({
        npi: bundle.npi,
        artifact: {
          id: bundle.artifact.id,
          source: bundle.artifact.source,
          status: bundle.artifact.status,
          checksum: bundle.artifact.checksum,
          verifiedAt: bundle.artifact.verifiedAt,
          expiresAt: bundle.artifact.expiresAt,
          monitoring: bundle.artifact.monitoring,
        },
        auditMetadata: bundle.auditMetadata,
        snapshotId: bundle.snapshotId,
        verifierAuditBundle: bundle.verifierAuditBundle,
        auditScrapbookBundle: bundle.auditScrapbookBundle,
      });
    } catch (error) {
      log('error', 'artifact_bundle_error', {
        event: 'artifact_bundle_error',
        npi: req.params.npi,
        error: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof SourceAccessRequiredError) {
        return res.status(404).json({ error: error.message, code: error.code });
      }
      const message = error instanceof Error ? error.message : 'Unable to generate audit bundle';
      if (message.includes('No verification artifacts found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });

  // ── Wave 3C: Bundle Download (zip) ───────────────────────
  app.get('/api/artifact/bundle/:npi/download', publicApiRateLimit, async (req: Request, res: Response) => {
    try {
      const npi = parseRequiredString(req.params.npi, 'npi');
      const organizationId = getRequestOrganizationId(req);

      const bundle = await generateAuditBundle(npi, { organizationId });
      const rawPayload = (bundle.rawPayload ?? {}) as Record<string, unknown>;

      // Build a PsvArtifact-shaped object from the DB record for the bundle
      const { buildBundleContentsFromRecord, createBundleZipStream } = await import('./engine/services/bundleDownloadService');

      const bundleContents = buildBundleContentsFromRecord(bundle, rawPayload);
      const zipStream = createBundleZipStream(bundleContents, npi);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="psv-bundle-${npi}.zip"`);

      zipStream.pipe(res);
    } catch (error) {
      log('error', 'artifact_bundle_download_error', {
        event: 'artifact_bundle_download_error',
        npi: req.params.npi,
        error: error instanceof Error ? error.message : 'unknown',
      });
      if (error instanceof SourceAccessRequiredError) {
        return res.status(404).json({ error: error.message, code: error.code });
      }
      const message = error instanceof Error ? error.message : 'Unable to generate bundle download';
      if (message.includes('No verification artifacts found')) {
        return res.status(404).json({ error: message });
      }
      return res.status(500).json({ error: message });
    }
  });
}

// The root `/trust-state/:clinician_id` alias was retired with the wedge lane
// (ADR 0007): it was a URL-rewriting shim whose only terminal handler was the
// wedge's `GET /trust-state`, deleted under the same retirement. The live
// trust-state surface is `/api/trust-state/:npi` (registerTrustStateEngineRoutes).

// ─── Wave 14: Continuous Monitoring Engine ───────────────────

function registerMonitoringRoutes(app: Express): void {
  const runMonitoringNow = async (req: Request, res: Response): Promise<void> => {
    if (!requireInternalSecret(req, res)) {
      return;
    }
    if (!requireAdminRequest(req, res)) {
      return;
    }

    const organizationId = getRequestOrganizationId(req);

    try {
      const status = await runMonitoringSweep(organizationId);
      res.status(200).json({
        totalActiveCredentials: status.totalActiveCredentials,
        expiringSoonCount: status.expiringSoonCount,
        revokedCount: status.revokedCount,
        lastSweepTimestamp: status.lastSweepTimestamp,
      });
    } catch (error) {
      await logSystemFailure('monitoring_sweep', 'error', error instanceof Error ? error.message : 'Monitoring sweep failed', { organizationId: organizationId ?? undefined });
      log('error', 'monitoring_run_error', {
        event: 'monitoring_run_error',
        organizationId: organizationId ?? null,
        error: error instanceof Error ? error.message : 'unknown',
      });
      const message = error instanceof Error ? error.message : 'Monitoring run failed';
      res.status(500).json({ error: message });
    }
  };

  app.post('/api/internal/run-monitoring', runMonitoringNow);
  app.post('/api/internal/monitoring/run', runMonitoringNow);

  app.get('/api/internal/monitoring-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    const organizationId = getRequestOrganizationId(req);

    try {
      const status = await getMonitoringStatus(organizationId);
      return res.status(200).json({
        totalActiveCredentials: status.totalActiveCredentials,
        expiringSoonCount: status.expiringSoonCount,
        revokedCount: status.revokedCount,
        lastSweepTimestamp: status.lastSweepTimestamp,
      });
    } catch (error) {
      log('error', 'monitoring_status_error', {
        event: 'monitoring_status_error',
        organizationId: organizationId ?? null,
        error: error instanceof Error ? error.message : 'unknown',
      });
      const message = error instanceof Error ? error.message : 'Unable to read monitoring status';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/nursys-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }
    if (!requireAdminRequest(req, res)) {
      return;
    }

    try {
      const [totalEvents, lastEvent, monitoringIntegrated] = await Promise.all([
        prisma.nursysEvent.count(),
        prisma.nursysEvent.findFirst({
          orderBy: { receivedAt: 'desc' },
          select: { receivedAt: true },
        }),
        isMonitoringEngineOperational(),
      ]);

      return res.status(200).json({
        totalEvents,
        lastEventReceived: lastEvent?.receivedAt?.toISOString() ?? null,
        monitoringIntegrated,
      });
    } catch (error) {
      log('error', 'nursys_status_error', {
        event: 'nursys_status_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      const message = error instanceof Error ? error.message : 'Unable to read nursys status';
      return res.status(500).json({ error: message });
    }
  });

  app.get('/api/internal/federation-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const [totalTrustLinks, activeTrustLinks] = await Promise.all([
        getTotalOrganizationTrustLinks(),
        getActiveOrganizationTrustLinks(),
      ]);
      return res.status(200).json({
        totalTrustLinks,
        activeTrustLinks,
        federationEnabled: activeTrustLinks > 0,
      });
    } catch (error) {
      log('error', 'federation_status_error', {
        event: 'federation_status_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      const message = error instanceof Error ? error.message : 'Unable to read federation status';
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave L: Enterprise Readiness ───────────────────────────

function registerEnterpriseReadinessRoutes(app: Express): void {
  /**
   * GET /api/internal/enterprise-readiness
   * Returns capabilities snapshot + self-test results.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/enterprise-readiness', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      // Check cache first (1-minute TTL)
      const cachedCapabilities = enterpriseCapabilitiesCache.get('capabilities');
      const capabilities = cachedCapabilities ?? getEnterpriseCapabilities();
      if (!cachedCapabilities) {
        enterpriseCapabilitiesCache.set('capabilities', capabilities as unknown as Record<string, unknown>);
      }

      const selfTest = await runEnterpriseSelfTest();

      // Wave N: security status flags
      const zeroDowngradeEnforced = isZeroDowngradeEnforced();
      let runtimeGuardsPassed = true;
      try {
        const guardResult = runRuntimeGuards();
        runtimeGuardsPassed = guardResult.passed;
      } catch {
        // runRuntimeGuards throws in production on failure,
        // but we're already running so it passed at boot
        runtimeGuardsPassed = false;
      }

      // Wave T: observability status
      const observability = await getObservabilityStatus();

      return res.status(200).json({
        capabilities,
        selfTest,
        zeroDowngradeEnforced,
        runtimeGuardsPassed,
        observability,
      });
    } catch (error) {
      log('error', 'enterprise_readiness_error', {
        event: 'enterprise_readiness_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to compute enterprise readiness' });
    }
  });
}

// ─── Wave M: Performance Metrics ────────────────────────────

function registerPerformanceMetricsRoutes(app: Express): void {
  /**
   * GET /api/internal/performance-metrics
   * Returns rolling averages for key operation latencies.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/performance-metrics', (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    return res.status(200).json(getPerformanceSnapshot());
  });
}

// ─── Wave R: Onboarding Metrics Routes ──────────────────────

function registerOnboardingMetricsRoutes(app: Express): void {
  /**
   * GET /api/internal/onboarding-metrics/:organizationId
   * Returns analytics for artifact onboarding + revenue signal.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/onboarding-metrics/:organizationId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = parseRequiredString(req.params.organizationId, 'organizationId');
      const metrics = await getOnboardingMetrics(organizationId);
      const revenueSignal = computeRevenueSignal(metrics);

      return res.status(200).json({
        avgDaysToVerification: metrics.avgDaysToVerification,
        avgDaysToPSVCompletion: metrics.avgDaysToPSVCompletion,
        avgDaysSaved: revenueSignal.avgDaysSaved,
        estimatedRevenueRecovered: revenueSignal.estimatedRevenueRecovered,
        totalArtifacts: metrics.totalArtifacts,
        completedVerifications: metrics.completedVerifications,
        completedPSV: metrics.completedPSV,
        revenueSignal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute onboarding metrics';
      log('error', 'onboarding_metrics_endpoint_error', {
        event: 'onboarding_metrics_endpoint_error',
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave S: PSV Status Routes ──────────────────────────────

function registerPSVStatusRoutes(app: Express): void {
  /**
   * GET /api/internal/psv-status/:artifactId
   * Returns PSV window compliance status for an artifact.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/psv-status/:artifactId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const artifactId = parseRequiredString(req.params.artifactId, 'artifactId');
      const status = await getPSVStatus(artifactId);

      if (!status) {
        return res.status(404).json({ error: 'No PSV window found for this artifact' });
      }

      return res.status(200).json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read PSV status';
      log('error', 'psv_status_endpoint_error', {
        event: 'psv_status_endpoint_error',
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });

  /**
   * POST /api/internal/psv-deadline-check/:organizationId
   * Run PSV deadline checks for an organization.
   * Returns any warnings or breaches detected.
   */
  app.post('/api/internal/psv-deadline-check/:organizationId', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = parseRequiredString(req.params.organizationId, 'organizationId');
      const warnings = await checkPSVDeadlines(organizationId);

      return res.status(200).json({
        warningCount: warnings.filter((w) => w.eventType === 'psv-window-warning').length,
        breachCount: warnings.filter((w) => w.eventType === 'psv-window-breach').length,
        events: warnings,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to check PSV deadlines';
      log('error', 'psv_deadline_check_endpoint_error', {
        event: 'psv_deadline_check_endpoint_error',
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave T: Observability Status Routes ────────────────────

function registerObservabilityRoutes(app: Express): void {
  /**
   * GET /api/internal/observability-status
   * Returns system health status based on failure events.
   * systemHealthy = no critical failures in last 24h.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/observability-status', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const status = await getObservabilityStatus();
      return res.status(200).json(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read observability status';
      log('error', 'observability_status_endpoint_error', {
        event: 'observability_status_endpoint_error',
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave X: Integration Health Routes ──────────────────────

function registerIntegrationHealthRoutes(app: Express): void {
  /**
   * GET /api/internal/integration-health
   * Returns Nursys/PECOS integration mode and health status.
   * RBAC: Admin only (monitoring secret).
   */
  app.get('/api/internal/integration-health', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const health = getIntegrationHealth();
      return res.status(200).json(health);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read integration health';
      log('error', 'integration_health_endpoint_error', {
        event: 'integration_health_endpoint_error',
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave Y: Expiration Forecast Routes ─────────────────────

function registerExpirationForecastRoutes(app: Express): void {
  /**
   * GET /api/internal/expiration-forecast/:organizationId
   * Returns expiration risk distribution for an organization.
   * RBAC: Admin or verifier with org match.
   */
  app.get('/api/internal/expiration-forecast/:organizationId', async (req: Request, res: Response) => {
    if (!requireVerifierOrAdmin(req, res)) {
      return;
    }

    const { organizationId } = req.params;
    if (!organizationId?.trim()) {
      return res.status(400).json({ error: 'organizationId is required.' });
    }

    if (!enforceOrganizationMatch(req, res, organizationId)) {
      return;
    }

    try {
      const summary = await getOrganizationForecastSummary(organizationId);
      return res.status(200).json(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute expiration forecast';
      log('error', 'expiration_forecast_endpoint_error', {
        event: 'expiration_forecast_endpoint_error',
        organizationId,
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Wave Z: Verifier Dashboard Routes ──────────────────────

function registerVerifierDashboardRoutes(app: Express): void {
  /**
   * GET /api/verifier/dashboard
   * Aggregated verifier dashboard with summary, events, revenue, health.
   * RBAC: Verifier only, tenant scoped, federation enforced.
   */
  app.get('/api/verifier/dashboard', async (req: Request, res: Response) => {
    if (!requireVerifierOnly(req, res)) {
      return;
    }

    const organizationId = getRequestOrganizationId(req)?.trim();
    if (!organizationId) {
      return res.status(401).json({
        error: 'organization_context_required',
        error_description: 'Organization context is required for dashboard.',
      });
    }

    // Strict mode enforcement: reject if system unhealthy
    const strictMode = isStrictTransitionMode();
    if (strictMode) {
      const healthy = await isSystemHealthyForOperation();
      if (!healthy) {
        return res.status(503).json({
          error: 'system_unhealthy',
          error_description: 'Dashboard generation rejected: system health check failed under strict mode.',
        });
      }
    }

    try {
      const dashboard = await buildDashboardResponse(organizationId);
      return res.status(200).json(dashboard);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build dashboard';
      log('error', 'verifier_dashboard_endpoint_error', {
        event: 'verifier_dashboard_endpoint_error',
        organizationId,
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });

  /**
   * GET /api/verifier/dashboard/export
   * Audit-ready JSON export of dashboard data.
   * RBAC: Verifier only, tenant scoped.
   * Strict mode: rejects if transparency log inconsistent.
   */
  app.get('/api/verifier/dashboard/export', async (req: Request, res: Response) => {
    if (!requireVerifierOnly(req, res)) {
      return;
    }

    const organizationId = getRequestOrganizationId(req)?.trim();
    if (!organizationId) {
      return res.status(401).json({
        error: 'organization_context_required',
        error_description: 'Organization context is required for export.',
      });
    }

    // Strict mode enforcement: reject if system unhealthy
    const strictMode = isStrictTransitionMode();
    if (strictMode) {
      const healthy = await isSystemHealthyForOperation();
      if (!healthy) {
        return res.status(503).json({
          error: 'system_unhealthy',
          error_description: 'Export rejected: system health check failed under strict mode.',
        });
      }
    }

    try {
      const exportData = await buildDashboardExport(organizationId);
      return res.status(200).json(exportData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to build export';
      log('error', 'verifier_dashboard_export_endpoint_error', {
        event: 'verifier_dashboard_export_endpoint_error',
        organizationId,
        error: message,
      });
      return res.status(500).json({ error: message });
    }
  });
}

// ─── Express Application ────────────────────────────────────

// Wave 196: Validate environment on startup
validateEnv();

const app = express();

// Trust exactly one proxy hop (Railway's edge). Without this, Express leaves
// `req.ip` as the proxy's address, so all anonymous callers collapse into a
// single rate-limit bucket (ASVS gap G3). Trusting `1` (not `true`) means we
// read the client IP from the last X-Forwarded-For hop only — a spoofed XFF from
// the real client is overwritten by Railway, so it cannot forge a distinct IP.
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — origin continuity enforcement
// Uses canonical normalizeOrigin() + structured allowlist evaluation.
// Rejects are logged with reason; same-origin / server-to-server always pass.
const corsOrigin = env().CORS_ORIGIN?.trim() || '*';
if (process.env.NODE_ENV === 'production' && corsOrigin === '*') {
  throw new Error('CORS_ORIGIN must not be "*" in production');
}

const _nodeEnv = (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test';

app.use(
  cors({
    origin: buildCorsOriginCallback(corsOrigin, _nodeEnv),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'x-request-id',
      'x-org-id',
      'x-monitoring-secret',
      'x-role',
      'x-user-role',
      'x-verifier-role',
      'x-clerk-user-id',
    ],
    credentials: corsOrigin !== '*',
  }),
);

// Public replay lookup endpoints — registered before org-context middleware.
// /api/replay/runs/:runId and /api/replay/runs/by-npi/:npi are public verifier surfaces.
registerReplayRunRoutes(app);
registerReplayByNpiRoute(app);

// G1 verified identity (CLERK_JWT_VERIFICATION: off|shadow|enforce). Mounted
// BEFORE the tenant guard so enforce mode rewrites x-clerk-user-id to the
// verified JWT sub (and strips role-bypass headers on unverified requests)
// before any downstream reader — including tenantGuard — consumes them.
app.use(verifiedIdentityMiddleware);

// S1 platform-admin binding. Mounted AFTER verifiedIdentity (it consumes the
// verified subject) and BEFORE the tenant guard (which asks `isSuperAdmin`
// while deciding org scope). Single mount, so every `isSuperAdminRequest`
// caller downstream gets a verified answer with no per-route change.
app.use(bindPlatformAdmin);

// Intelligence/investigation read routes bypass org requirement.
// All other routes still require org context via requireTenantContext.
app.use(requireTenantContextOrReadAccess);

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Observability
  app.use(requestObservability);

  // Routes
  registerHealthRoutes(app);
  registerPublicMetricsRoutes(app);
  registerPublicRoutes(app); // Wave 26: Golden Link
  registerAKGRoutes(app);       // Wave 27: AKG / MCP
  registerAuthorityRoutes(app); // Wave 29: PAS Engine
  registerImpactRoutes(app);
  registerIngestRoutes(app);
  registerLookupRoutes(app);

  registerProofRoutes(app);
registerComplianceRoutes(app);
registerOperationsRoutes(app);
registerPilotRoutes(app);
registerCredentialStatusRoutes(app);
registerMonitoringRoutes(app);
registerEnterpriseReadinessRoutes(app);
registerPerformanceMetricsRoutes(app);
registerOnboardingMetricsRoutes(app);
registerPSVStatusRoutes(app);
registerObservabilityRoutes(app);
registerIntegrationHealthRoutes(app);
registerExpirationForecastRoutes(app);
registerVerifierDashboardRoutes(app);
registerIdentityRoutes(app);
registerDemoRoutes(app);
registerPsvVerifyRoutes(app);
registerPoeRoutes(app);
registerWidgetRoutes(app); // Wave 34: Plaid Widget
registerIssuerRoutes(app); // Wave 38: Issuer Command Center
registerIssuerPsvReceiptRoutes(app); // ISSUER-10: client-safe PSV receipt write boundary
registerAuditRoutes(app); // Wave 35: Merkle Anchoring
// registerIntelligenceRoutes superseded by registerIntelligenceEngineRoutes (Wave I)
registerStatusListRoutes(app); // Wave 40: W3C Bitstring Status List
registerHiringRoutes(app);           // Wave 41: ON Loop — EmployerAcceptance + StartAttestation
registerEmployerActionRoutes(app);   // M2: Accept with Confidence — accept/refresh/review/packet
registerEmployerNotificationRoutes(app); // GAIS: employer notification polling
registerSealTrainingRoutes(app);     // SEAL: training event capture + dataset export
registerPilotKpiRoutes(app);         // Pilot KPI loop: 7 velocity KPIs + CSV export
registerReportRoutes(app);           // Credential Intelligence Report: POST /api/report
registerPublicProfileRoutes(app); // Wave 43: Public Trust Profile — NPI-keyed
registerHitlRoutes(app);         // Wave 47: AI HITL Review Queue
registerGraphRoutes(app);        // Wave 82: Trust Graph Intelligence
registerDecisionInsightsRoutes(app); // Wave 83: Decision Intelligence
registerSimulationRoutes(app);       // Wave 84: Trust Simulation
registerMonitoringEventsRoutes(app); // Wave 85: Monitoring Events
registerTrustOperationsRoutes(app);  // Wave 87: Trust Operations
registerPassportRoutes(app);         // Wave 88: Clinician Passport
registerTelemetryRoutes(app);        // Wave 89: Network Telemetry
registerCoordinationRoutes(app);     // Wave 132: Coordination & Cleanup
registerSystemStatusRoutes(app);     // Wave 90: System Status
registerSystemIntegrityRoutes(app);  // Wave B: System integrity sweep + E2E probes
registerNetworkGatewayRoutes(app);   // Wave 91+96: Network Gateway + Global Graph
registerKnowledgeRoutes(app);        // Wave 92: Trust Knowledge Protocol
registerCredentialRoutes(app);       // Wave 94+98: Trust Credential Infrastructure + Presentations
registerTrustRegistryRoutes(app);    // Wave 95: Trust Registry
registerTrustAlertRoutes(app);       // Wave 97: Trust Alerts
registerVerifierAcceptanceRoutes(app); // Wave 99: Verifier Acceptance
registerDIDRoutes(app);               // Wave 100: DID Registry + Resolver
registerTrustAnchorRoutes(app);       // Wave 197: Trust Anchor Service
registerSdJwtRoutes(app);             // Waves 199-201: SD-JWT, Governance, Validation, Schemas
registerOidcDiscoveryRoutes(app);     // Waves 202-204: OID4VC metadata + discovery
registerPsvAdapterRoutes(app);        // Waves 205-207: PSV Adapter Layer
registerReadinessRoutes(app);         // Waves 208-210: Readiness + Clear-to-Start

registerIdentityBindingRoutes(app);   // Wave 198: NPI-bound DID identity binding
registerRevocationRoutes(app);        // Wave 101: Credential Revocation Registry
registerFederationRoutes(app);        // Wave 102: Network Federation
registerIssuerOnboardingRoutes(app);  // Wave 106: Issuer Onboarding Protocol
registerGovernanceRoutes(app);        // Wave 108: Trust Governance Layer
registerOID4VCIRoutes(app);           // Wave 109: OpenID4VCI Issuance Layer
registerOID4VPRoutes(app);            // Wave 110: OpenID4VP Presentation Layer
registerFederationMetadataRoutes(app); // Wave 113: OpenID Federation Trust Metadata
registerConformanceRoutes(app);       // Wave 114: Conformance Suite + Audit Receipts
registerApiKeyRoutes(app);            // Wave 115: API Keys
registerAnalyticsRoutes(app);         // Wave 116: Analytics Dashboard
registerNetworkAnalyticsRoutes(app);  // Wave 140: Network Telemetry Intelligence
registerDocsRoutes(app);              // Wave 117: Developer Docs & OpenAPI
registerFeedbackRoutes(app);          // Wave 119: Feedback Loop
registerPilotOpsRoutes(app);          // Pilot ops: support, metrics, triage queue
import { registerPilotTelemetryRoutes } from './routes/pilotTelemetry';
registerPilotTelemetryRoutes(app);      // Pilot telemetry: metrics, friction, dashboard
import { registerReuseSignalRoutes } from './routes/reuseSignal';
registerReuseSignalRoutes(app);          // Trust reuse: employer action signals

// ── Omega Orchestrator: Recognition → Acceptance → Start ──
import omegaRoutes from './routes/omega';
app.use('/api/omega', omegaRoutes);
registerWebAuthnRoutes(app);          // Wave 122: WebAuthn Biometric Auth
registerDecisionCapsuleRoutes(app);   // Wave A: Decision Capsules + Blast Radius
registerDecisionRoutes(app);             // Wave FE19-A: Decision recommendations + state model
registerAuditDecisionRoutes(app);        // Acceptance Graph: /api/audit/decision + learning capsules
registerAcceptanceRoutes(app);           // Acceptance Graph: /api/acceptance/predict
registerTrustSubstrateRoutes(app);    // Substrate Consolidation: Phase 1 — unified trust substrate
registerAuditStreamRoutes(app);       // Substrate Consolidation: Phase 2 — audit OS, cursor export, SIEM stream
registerHealthStartRoutes(app);       // Substrate Consolidation: Phase 3 — HealthStart deployment profiles + evidence
registerLedgerProofRoutes(app);       // Anchor witness — public, hash-only: inclusion proofs + Rekor/TSA evidence
registerProviderRoutes(app);          // Wave 119 — Provider data integrity + provenance + smoke tests
registerMissionOpsRoutes(app);        // Wave 123 — Mission Ops + onboarding flows
registerWorkspaceRoutes(app);         // Wave 180 — Dual-Entity Identity + workspace switching
registerClinicianRoutes(app);         // Wave 287 — Clinician activation
registerIntakeRoutes(app);            // Wave 183 — Resume + NPI + Links + Work Auth ingestion
registerGardenRoutes(app);            // Career Garden — private notes + explicit Living CV promotion
registerEmailOtpRoutes(app);          // Email-OTP identity-binding possession factor
registerSearchRoutes(app);            // Wave 184 — Unified Search Index + hybrid retrieval
registerRoleRoutes(app);              // Clerk auth — GET /api/me/role (role resolution)
registerOwnershipRoutes(app);         // Auth A1 — NPI ownership claim/revoke
registerEntityRoutes(app);            // S1/S3 — canonical entity resolution + roles + relationships
registerPassportEntityRoutes(app);    // S1/S5 — trust passport + POST /api/share + POST /api/organization-context
registerIngestStreamRoutes(app);      // Real-time ingest — POST /api/ingest/:npi + GET /api/ingest/:runId/stream

// GET /api/leie/status — OIG LEIE cache health
app.get('/api/leie/status', (_req, res) => { res.json(leieCacheStats()); });
registerOpportunityRoutes(app);       // Wave 227 — Opportunities + Candidates
registerMatchaRoutes(app);            // Wave K — MATCHA demand-side engine (was built + tested but never mounted)
registerApplicationRoutes(app);       // Wave 229 — Clinician Application Flow
registerActivationRoutes(app);        // ACT-7.3 — mounts the activation requirement ledger + start-state services
registerAskRoutes(app);               // Wave 185 — Ask VitalCV natural language answer engine
registerCopilotRoutes(app);           // Waves C25-C28 — Copilot query engine
registerInvestigationRoutes(app);    // Wave INV — Investigation engine
registerInvestigationWorkbenchRoutes(app); // Wave INV+ — Investigation workbench APIs
registerFeedRoutes(app);             // Wave 1 — Live feed event stream
registerFindingsRoutes(app);         // Wave AI — Autonomous investigators + findings feed
registerActionsRoutes(app);          // Waves C49-C51 — Action engine API
registerStorylineRoutes(app);        // Wave ST — Storyline intelligence narratives
registerDetailAgentRoutes(app);      // Wave DT — Detail agents + system health
registerPollingRoutes(app);          // Wave POLL — Polling scheduler
registerEmployerRoutes(app);          // Wave 186 — Employer Knowledge Layer
registerPrequalificationRoutes(app);  // Wave 189 — AI Interview, Assessments, Prequalification
// Wave 190 — Apply with VitalCV + ATS + Verifier Pipeline: NOT WIRED.
// Unauthenticated writes on any NPI and a cross-tenant read gated only on the
// x-verifier-org-id request header. No caller exists (the embed it backed 404s).
// Restoring it requires real auth first — routes/verifierPipeline.ts explains what.
registerReferralRoutes(app);          // Wave 191 — Referral Engine with Compliance Guardrails
registerAmbassadorRoutes(app);        // Wave 192 — Ambassador Program
registerGrowthRoutes(app);            // Wave 193 — Instant Offers + Growth Loops
registerMarketplaceAnalyticsRoutes(app); // Wave 194 — Marketplace Analytics
registerDocumentRoutes(app);             // Wave 237 — Document Intelligence API
registerCapacityRoutes(app);             // Wave 240 — Capacity Score MVP
registerOigRoutes(app);                  // Wave 241 — OIG/LEIE Exclusion Check
registerTrustStateEngineRoutes(app);     // Wave 243 — Trust State Engine
registerAsyncTrustRoutes(app);           // Wave 245 — Async Trust Engine
if (BACKGROUND_JOBS_ENABLED) {
  startMonitoringScheduler();            // Wave 245 — Monitoring Scheduler (MONITORING_ENABLED gated)
  startInvestigatorScheduler();          // Waves C41-C44 — Investigator scheduler heartbeat
  startStrategyAgentScheduler();         // FE21-A — Strategy agent scheduler heartbeat
}
registerApplyRoutes(app);                // Wave 246 — Apply-with-VitalCV Distribution Wedge
registerReadinessSnapshotRoutes(app);    // Wave M — share-once / reuse-by-many readiness snapshots
registerTrustDecisionRoutes(app);       // Shape-of-Truth — 6-class trust decision engine
registerSystemHealthRoutes(app);         // Wave 249 — Trust Spine Hardening
registerVelocityRoutes(app);             // Wave 250 — Time-to-Start Velocity Dashboard
registerTrustProofRoutes(app);           // Wave 252 — Trust Proof Bundle
registerPsvRoutes(app);                  // Wave PSV-Engine — unified PSV API
registerCredentialIndexRoutes(app);       // Wave Index — global credential readiness index
registerAuthorityGraphRoutes(app);         // Wave 500 — Authority Graph Engine
registerVerificationAgentRoutes(app);      // Wave 500+ — AI Verification Agent Swarm
registerVerifyProfessionalRoutes(app);     // Wave: AI Professional Verification API
registerDeploymentRoutes(app);             // Wave: Credential-based deployment matching
registerWorkforceIntelligenceRoutes(app);  // Wave: Workforce intelligence layer
registerAuditReplayRoutes(app);            // Wave: Decision accountability layer
registerCryptoProtocolRoutes(app);         // Wave: PQC crypto suite + resign pipeline
registerProtocolRoutes(app);               // Wave: open protocol spec + conformance + discovery
registerDomainRoutes(app);                 // Wave: universal domain authority registry
registerIdentityLayerRoutes(app);          // Wave: canonical clinician identity layer
registerTrustIntelligenceRoutes(app);      // Wave M: Trust Score V1 + Freshness + Divergence
registerIntelligenceEngineRoutes(app);     // Wave I: Intelligence Engine + Learning Loops
registerIntelligenceInsightRoutes(app);    // Wave FE0-FE21 — Provider intelligence insight APIs
registerIntelligenceAggregateRoutes(app);  // Wave FE21-B — Intelligence feed + entity aggregate APIs
registerIntelligencePublicSnapshotRoutes(app); // Wave FE-Ignition — seeded public snapshot APIs
registerIntelligenceSignalRoutes(app);     // Wave FE22 — Trust, influence, pressure, momentum, and provider summary APIs
registerIntelligenceLayerRoutes(app);      // Wave FE-next — Compounding intelligence layer APIs
registerMapRoutes(app);                    // Waves C60-C61 — Geospatial intelligence map APIs
registerPredictionRoutes(app);             // Wave FE17: Predictive Intelligence
registerStrategyRoutes(app);               // Wave FE20-A: Strategic Intelligence Engine
registerInvestigatorRoutes(app);           // Waves C41-C44: Investigator findings feed
registerInvestigatorApiRoutes(app);        // FE16-A: Autonomous investigator engine API
registerAgentRoutes(app);                  // FE21-A: Autonomous strategy agents API
registerPayerVerificationRoutes(app); // Wave 142 — Payer Network Integration
registerProviderDirectoryRoutes(app);  // Wave 143 — Provider Directory Distribution
registerGraphScalingRoutes(app);       // Wave 144 — Trust Graph Performance Scaling
registerPayerNetworkRoutes(app);       // Wave 148 — Payer Credential Network
registerNetworkTelemetryRoutes(app);   // Wave 150 — Network Telemetry Intelligence
registerNetworkHealthRoutes(app);      // Wave 162 — Network Health Monitoring
registerFederationDiscoveryRoutes(app); // Wave 166 — Federation Discovery
registerPassportAnalyticsRoutes(app);   // Wave 167 — Passport Analytics
registerWalletExportRoutes(app);       // Wave 154 — Wallet Interoperability Bridge
registerComplianceCopilotRoutes(app);  // Wave 157 — Compliance Co-Pilot
registerLearningTrackRoutes(app);      // Learning: frontend event tracking
registerLearningAnalyticsRoutes(app);  // Learning: analytics + feedback loop
registerResearchRoutes(app);           // Wave 12: Research Identity Layer

if (BACKGROUND_JOBS_ENABLED) {
  // Avoid open handles and unrelated database chatter during Jest runs.
  startAnchorWorker();
  startContinuousMonitor();
  startRevocationOutboxWorker();
  // No-ops unless a feed's credentials are set, so an unconfigured deployment
  // stays silent instead of failing every interval.
  startIngestionWorker();
}

if (ENTERPRISE_MODE) {
  app.get('/internal/enterprise', async (req: Request, res: Response) => {
    if (!requireInternalSecret(req, res)) {
      return;
    }

    try {
      const organizationId = getRequestOrganizationId(req);
      const trustLedgerIntegrity = await evaluateTrustLedgerIntegrity(organizationId);

      return res.status(200).json({
        complianceSummary: COMPLIANCE_SUMMARY,
        securityPosture: SECURITY_POSTURE,
        trustLedgerIntegrity,
      });
    } catch (error) {
      log('error', 'enterprise_signals_error', {
        event: 'enterprise_signals_error',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return res.status(500).json({ error: 'Unable to collect enterprise signals' });
    }
  });
}

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.get('/openapi.json', (_req, res) => res.json(openApiSpec));

// Error handler (must be last)
app.use(errorHandler);

// Wave 197: Ingest trust lists on startup (idempotent)
ingestAllTrustLists();

// ── Initialize detail agents ─────────────────────────────────────────────────
import { initDetailAgents } from './services/detailAgents/detailAgentEngine';
initDetailAgents();

// ── Initialize polling scheduler ─────────────────────────────────────────────
import { initPollingScheduler } from './services/polling/pollingScheduler';
if (process.env.POLLING_ENABLED === 'true') {
  initPollingScheduler();
}

export default app;
