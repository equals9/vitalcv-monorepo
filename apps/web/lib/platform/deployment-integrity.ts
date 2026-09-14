/**
 * Deployment Integrity Check — the self-auditing layer for the Railway deploy
 * pipeline.
 *
 * It validates that every production service agrees on the deployment facts that
 * matter — repository, branch, latest deployed commit, deployment age, health,
 * environment, build source, runtime, and public domain — and reports any
 * divergence as a deployment incident. It DETECTS drift only; it never modifies
 * infrastructure.
 *
 * This closes the failure class where one service silently deploys from a stale
 * branch while another follows `main` (exactly what stranded vitalcv-web on
 * wave-10a/docs-status for ~5 weeks while the API tracked main).
 *
 * The module is framework-agnostic so the CI/cron script and the
 * /admin/platform Founder Dashboard share one source of truth.
 */

export const RAILWAY_PROJECT_ID = '706ceff8-23ac-404c-a45b-449de5920848';
export const RAILWAY_GRAPHQL = 'https://backboard.railway.com/graphql/v2';
export const GITHUB_REPO = 'equals9/vitalcv-monorepo';

/** The canonical configuration every production service must agree on. */
export const EXPECTED = {
  repo: GITHUB_REPO,
  branch: 'main',
  environment: 'production',
  /** A deploy older than this (and behind main) is flagged stale. */
  maxDeployAgeDays: 14,
  /** Grace window for transient SHA mismatch during a normal rollout. */
  commitGraceMinutes: 30,
} as const;

export type ServiceRole = 'web' | 'api' | 'database';
export type DriftSeverity = 'incident' | 'warning';

export interface ExpectedService {
  name: string;
  role: ServiceRole;
  builder?: string; // DOCKERFILE | NIXPACKS | RAILPACK
  domain?: string;
  healthUrl?: string;
  /** Managed services (DB) skip git/branch/commit checks. */
  managed?: boolean;
}

export const EXPECTED_SERVICES: ExpectedService[] = [
  { name: 'vitalcv-web', role: 'web', builder: 'DOCKERFILE', domain: 'vitalcv.com', healthUrl: 'https://vitalcv.com/api/health' },
  { name: 'delightful-essence', role: 'api', builder: 'NIXPACKS', domain: 'api.vitalcv.com', healthUrl: 'https://api.vitalcv.com/health' },
  { name: 'Postgres', role: 'database', builder: 'RAILPACK', managed: true },
];

/** Raw per-service deployment facts gathered from Railway (CLI JSON or GraphQL). */
export interface ServiceState {
  name: string;
  repo: string | null;
  image: string | null;
  branch: string | null;
  commit: string | null;
  deployStatus: string | null; // SUCCESS | FAILED | BUILDING | ...
  createdAt: string | null; // ISO
  builder: string | null;
  environment: string | null;
}

export interface DriftIncident {
  service: string;
  field:
    | 'repository'
    | 'branch'
    | 'commit'
    | 'deployment_age'
    | 'health'
    | 'environment'
    | 'build_source'
    | 'deploy_status'
    | 'agreement'
    | 'presence';
  expected: string;
  actual: string;
  severity: DriftSeverity;
  detail: string;
}

export interface ServiceReport {
  name: string;
  role: ServiceRole;
  ok: boolean;
  repo: string | null;
  branch: string | null;
  commit: string | null;
  commitShort: string | null;
  deployStatus: string | null;
  ageHours: number | null;
  builder: string | null;
  domain: string | null;
  environment: string | null;
  healthStatus: 'ok' | 'degraded' | 'unreachable' | 'unknown';
  incidents: DriftIncident[];
}

export interface IntegrityReport {
  generatedAt: string;
  overall: 'healthy' | 'drift';
  expected: { repo: string; branch: string; environment: string };
  githubMainSha: string | null;
  githubSynced: boolean;
  railwayReachable: boolean;
  services: ServiceReport[];
  incidents: DriftIncident[];
}

function shortSha(sha: string | null): string | null {
  return sha ? sha.slice(0, 9) : null;
}

function hoursBetween(aIso: string | null, nowMs: number): number | null {
  if (!aIso) return null;
  const t = Date.parse(aIso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (nowMs - t) / 3_600_000);
}

/**
 * Parse the `railway status --json` payload (the CLI prints the GraphQL
 * response verbatim) into ServiceState[]. The same shape comes back from the
 * GraphQL API, so the script and the route share this parser.
 */
export function parseRailwayStatus(json: any, environmentName = EXPECTED.environment): ServiceState[] {
  const out: ServiceState[] = [];
  const envEdges = json?.environments?.edges ?? [];
  for (const envEdge of envEdges) {
    const env = envEdge?.node;
    if (!env || (environmentName && env.name !== environmentName)) continue;
    const svcEdges = env.serviceInstances?.edges ?? [];
    for (const svcEdge of svcEdges) {
      const n = svcEdge?.node;
      if (!n) continue;
      const dep = n.latestDeployment ?? {};
      const meta = dep.meta ?? {};
      out.push({
        name: n.serviceName ?? 'unknown',
        repo: n.source?.repo ?? null,
        image: n.source?.image ?? null,
        branch: meta.branch ?? null,
        commit: meta.commitHash ?? null,
        deployStatus: dep.status ?? null,
        createdAt: dep.createdAt ?? null,
        builder: meta.serviceManifest?.build?.builder ?? null,
        environment: env.name ?? null,
      });
    }
  }
  return out;
}

export interface EvaluateOptions {
  states: ServiceState[];
  githubMainSha: string | null;
  health?: Record<string, 'ok' | 'degraded' | 'unreachable'>;
  railwayReachable: boolean;
  nowMs: number;
}

/** Pure evaluation: compare gathered state to EXPECTED and emit drift incidents. */
export function evaluateIntegrity(opts: EvaluateOptions): IntegrityReport {
  const { states, githubMainSha, health = {}, railwayReachable, nowMs } = opts;
  const services: ServiceReport[] = [];
  const allIncidents: DriftIncident[] = [];

  // Cross-service agreement basis: the deployable (non-managed) services.
  const deployable = EXPECTED_SERVICES.filter((s) => !s.managed);
  const branchesSeen = new Set<string>();
  const commitsSeen = new Set<string>();

  for (const exp of EXPECTED_SERVICES) {
    const st = states.find((s) => s.name === exp.name) ?? null;
    const incidents: DriftIncident[] = [];
    const healthStatus = exp.healthUrl ? (health[exp.name] ?? 'unknown') : 'unknown';

    if (!st) {
      incidents.push({
        service: exp.name,
        field: 'presence',
        expected: 'service present in Railway production',
        actual: 'not found',
        severity: 'incident',
        detail: `Expected service "${exp.name}" was not found in the ${EXPECTED.environment} environment.`,
      });
      services.push({
        name: exp.name, role: exp.role, ok: false, repo: null, branch: null, commit: null,
        commitShort: null, deployStatus: null, ageHours: null, builder: null,
        domain: exp.domain ?? null, environment: null, healthStatus, incidents,
      });
      allIncidents.push(...incidents);
      continue;
    }

    const ageHours = hoursBetween(st.createdAt, nowMs);

    if (!exp.managed) {
      // Repository
      if (st.repo !== EXPECTED.repo) {
        incidents.push({ service: exp.name, field: 'repository', expected: EXPECTED.repo, actual: st.repo ?? '∅', severity: 'incident', detail: `Connected repo is not ${EXPECTED.repo}.` });
      }
      // Branch — the core failure class
      if (st.branch !== EXPECTED.branch) {
        incidents.push({ service: exp.name, field: 'branch', expected: EXPECTED.branch, actual: st.branch ?? '∅', severity: 'incident', detail: `Service is deploying from "${st.branch}" instead of ${EXPECTED.branch}. This is the stale-branch failure class.` });
      } else if (st.branch) {
        branchesSeen.add(st.branch);
      }
      // Build source / runtime parity
      if (exp.builder && st.builder && st.builder !== exp.builder) {
        incidents.push({ service: exp.name, field: 'build_source', expected: exp.builder, actual: st.builder, severity: 'warning', detail: `Builder changed from expected ${exp.builder} to ${st.builder}.` });
      }
      // Deploy status
      if (st.deployStatus && st.deployStatus !== 'SUCCESS') {
        incidents.push({ service: exp.name, field: 'deploy_status', expected: 'SUCCESS', actual: st.deployStatus, severity: st.deployStatus === 'FAILED' || st.deployStatus === 'CRASHED' ? 'incident' : 'warning', detail: `Latest deployment status is ${st.deployStatus}.` });
      }
      // Commit vs main HEAD (with rollout grace)
      if (st.commit) commitsSeen.add(st.commit);
      if (githubMainSha && st.commit && st.commit !== githubMainSha) {
        const behindGrace = ageHours != null && ageHours * 60 > EXPECTED.commitGraceMinutes;
        incidents.push({ service: exp.name, field: 'commit', expected: shortSha(githubMainSha)!, actual: shortSha(st.commit) ?? '∅', severity: behindGrace ? 'incident' : 'warning', detail: behindGrace ? `Deployed commit is behind main HEAD and older than the ${EXPECTED.commitGraceMinutes}m rollout grace.` : `Deployed commit differs from main HEAD (within rollout grace).` });
      }
      // Deployment age
      if (ageHours != null && ageHours > EXPECTED.maxDeployAgeDays * 24) {
        incidents.push({ service: exp.name, field: 'deployment_age', expected: `< ${EXPECTED.maxDeployAgeDays}d`, actual: `${Math.round(ageHours / 24)}d`, severity: 'incident', detail: `Last successful deploy is ${Math.round(ageHours / 24)} days old.` });
      }
    }

    // Environment
    if (st.environment && st.environment !== EXPECTED.environment) {
      incidents.push({ service: exp.name, field: 'environment', expected: EXPECTED.environment, actual: st.environment, severity: 'incident', detail: `Service is in ${st.environment}, expected ${EXPECTED.environment}.` });
    }
    // Health
    if (exp.healthUrl && (healthStatus === 'unreachable' || healthStatus === 'degraded')) {
      incidents.push({ service: exp.name, field: 'health', expected: 'ok', actual: healthStatus, severity: healthStatus === 'unreachable' ? 'incident' : 'warning', detail: `Health endpoint ${exp.healthUrl} reported ${healthStatus}.` });
    }

    services.push({
      name: exp.name, role: exp.role,
      ok: incidents.filter((i) => i.severity === 'incident').length === 0,
      repo: st.repo, branch: st.branch, commit: st.commit, commitShort: shortSha(st.commit),
      deployStatus: st.deployStatus, ageHours, builder: st.builder, domain: exp.domain ?? null,
      environment: st.environment, healthStatus, incidents,
    });
    allIncidents.push(...incidents);
  }

  // Cross-service agreement (deployable services must share branch + commit)
  if (deployable.length > 1) {
    if (branchesSeen.size > 1) {
      const inc: DriftIncident = { service: 'platform', field: 'agreement', expected: 'all services on one branch', actual: [...branchesSeen].join(' vs '), severity: 'incident', detail: `Production services disagree on branch: ${[...branchesSeen].join(', ')}.` };
      allIncidents.push(inc);
    }
    if (commitsSeen.size > 1) {
      const inc: DriftIncident = { service: 'platform', field: 'agreement', expected: 'all services on one commit', actual: [...commitsSeen].map((c) => shortSha(c)).join(' vs '), severity: 'warning', detail: `Production services are on different commits: ${[...commitsSeen].map((c) => shortSha(c)).join(', ')} (transient during rollout; sustained = drift).` };
      allIncidents.push(inc);
    }
  }

  const hasIncident = allIncidents.some((i) => i.severity === 'incident');
  return {
    generatedAt: new Date(nowMs).toISOString(),
    overall: hasIncident ? 'drift' : 'healthy',
    expected: { repo: EXPECTED.repo, branch: EXPECTED.branch, environment: EXPECTED.environment },
    githubMainSha,
    githubSynced: Boolean(githubMainSha),
    railwayReachable,
    services,
    incidents: allIncidents,
  };
}

/**
 * Orchestrate a full integrity report. Source of Railway state, in priority:
 *   1. `railwayStatusJson` (pre-fetched CLI JSON — used by the script)
 *   2. `railwayToken` → Railway GraphQL (used by the deployed dashboard/route)
 *   3. neither → railwayReachable=false (honest degraded report)
 * Always cross-checks GitHub main HEAD + service health.
 */
export async function buildIntegrityReport(opts: {
  railwayStatusJson?: unknown;
  railwayToken?: string;
  nowMs?: number;
}): Promise<IntegrityReport> {
  const nowMs = opts.nowMs ?? Date.now();
  let project: any = opts.railwayStatusJson ?? null;
  let railwayReachable = Boolean(project);

  if (!project && opts.railwayToken) {
    try {
      project = await fetchRailwayStatus(opts.railwayToken);
      railwayReachable = Boolean(project);
    } catch {
      railwayReachable = false;
    }
  }

  const states = project ? parseRailwayStatus(project) : [];
  const [githubMainSha, healthEntries] = await Promise.all([
    fetchGithubMainSha(),
    Promise.all(
      EXPECTED_SERVICES.filter((s) => s.healthUrl).map(async (s) => [s.name, await probeHealth(s.healthUrl!)] as const),
    ),
  ]);
  const health: Record<string, 'ok' | 'degraded' | 'unreachable'> = {};
  for (const [name, status] of healthEntries) health[name] = status;

  return evaluateIntegrity({ states, githubMainSha, health, railwayReachable, nowMs });
}

/** Fetch the current main HEAD sha from GitHub (public repo — no token needed). */
export async function fetchGithubMainSha(signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/commits/main`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'vitalcv-deploy-integrity' },
      signal,
    });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.sha === 'string' ? body.sha : null;
  } catch {
    return null;
  }
}

/** Probe a service health endpoint. ok=2xx, degraded=non-2xx, unreachable=network error. */
export async function probeHealth(url: string): Promise<'ok' | 'degraded' | 'unreachable'> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'x-org-id': 'vcv-system' } });
    return res.ok ? 'ok' : 'degraded';
  } catch {
    return 'unreachable';
  }
}

/**
 * Fetch the live Railway project status via the GraphQL API (for the deployed
 * dashboard, where the CLI is unavailable). Returns the same shape as
 * `railway status --json` so parseRailwayStatus() handles both. Requires a
 * Railway API token.
 */
export async function fetchRailwayStatus(token: string, signal?: AbortSignal): Promise<any> {
  const query = `query($id: String!) {
    project(id: $id) {
      environments { edges { node { name serviceInstances { edges { node {
        serviceName
        source { repo image }
        latestDeployment { status createdAt meta }
      } } } } } }
    }
  }`;
  const res = await fetch(RAILWAY_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables: { id: RAILWAY_PROJECT_ID } }),
    signal,
  });
  if (!res.ok) throw new Error(`Railway GraphQL ${res.status}`);
  const body = await res.json();
  if (body?.errors) throw new Error(`Railway GraphQL error: ${JSON.stringify(body.errors).slice(0, 200)}`);
  return body?.data?.project;
}
