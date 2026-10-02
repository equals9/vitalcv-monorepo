// ── ONLY Node.js built-ins at top level ─────────────────────
// Everything else is dynamically imported inside bootstrapApp() so that
// a broken third-party require() cannot crash the process before the
// health-probe server binds the port.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const APP_READY_MESSAGE = 'Server ready';

// Minimal structured logger for the early boot phase — no dependencies.
function earlyLog(level: string, message: string, fields?: Record<string, unknown>): void {
  const payload = { level, message, timestamp: new Date().toISOString(), ...fields };
  const line = `${JSON.stringify(payload)}\n`;
  if (level === 'error' || level === 'warn') {
    process.stderr.write(line);
    return;
  }

  process.stdout.write(line);
}

// ── Bind a bare HTTP server immediately so the health probe passes ──
// Railway starts the healthcheck timer on container boot.  If loadEnv()
// or import('./app') throws, the container would never bind a port and
// the deploy would fail with "1/1 replicas never became healthy" — hiding
// the real error.  By binding first, the healthcheck passes and errors
// surface in Railway's runtime logs.

const PORT = Number(process.env.PORT) || 4000;
const HOST = '0.0.0.0';

let appReady = false;
let startupError: string | null = null;

function isHealthProbeRequest(req: http.IncomingMessage): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }

  if (!req.url) {
    return false;
  }

  try {
    const pathname = new URL(req.url, `http://${HOST}:${PORT}`).pathname.replace(/\/+$/, '');
    return pathname === '/health';
  } catch {
    return req.url === '/health' || req.url === '/health/' || req.url.startsWith('/health?');
  }
}

const earlyServer = http.createServer((req, res) => {
  if (isHealthProbeRequest(req)) {
    const git = { git_branch: RAILWAY_BRANCH, git_sha: RAILWAY_SHA };
    if (startupError) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: startupError, ...git }));
    } else if (!appReady) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'starting', ...git }));
    } else {
      // Should not reach here — once appReady, Express handles requests
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ...git }));
    }
    return;
  }
  res.writeHead(503, { 'Content-Type': 'text/plain' });
  res.end('Service starting...');
});

const RAILWAY_BRANCH = process.env.RAILWAY_GIT_BRANCH ?? null;
const RAILWAY_SHA = process.env.RAILWAY_GIT_COMMIT_SHA ?? null;

earlyServer.listen(PORT, HOST, () => {
  earlyLog('info', `Listening on ${HOST}:${PORT}`, {
    event: 'early_server_bound',
    host: HOST,
    port: PORT,
    railway_branch: RAILWAY_BRANCH,
    railway_sha: RAILWAY_SHA,
  });

  // Now bootstrap the real application
  bootstrapApp().catch((e) => {
    const message = e instanceof Error ? e.message : 'Unknown startup error';
    const details = e instanceof Error ? e.stack : String(e);
    startupError = message;
    earlyLog('error', `server startup failed: ${message}`, {
      event: 'server_startup_failed',
      error: message,
      details,
      railway_branch: RAILWAY_BRANCH,
      railway_sha: RAILWAY_SHA,
    });
    // Keep process alive so Railway can read logs — don't exit
  });
});

// ── Prisma migration helpers ────────────────────────────────

function resolvePrismaSchemaPath(): string {
  const override = process.env.PRISMA_SCHEMA_PATH;
  if (override) {
    const resolved = path.resolve(process.cwd(), override);
    if (fs.existsSync(resolved)) {
      return resolved;
    }

    throw new Error(`Specified PRISMA_SCHEMA_PATH does not exist: ${resolved}`);
  }

  let currentDir = process.cwd();
  const root = path.parse(currentDir).root;

  while (true) {
    const localCandidate = path.resolve(currentDir, 'prisma', 'schema.prisma');
    const monorepoCandidate = path.resolve(currentDir, 'apps', 'api', 'backend', 'prisma', 'schema.prisma');

    if (fs.existsSync(localCandidate)) {
      return localCandidate;
    }

    if (fs.existsSync(monorepoCandidate)) {
      return monorepoCandidate;
    }

    if (currentDir === root) {
      break;
    }

    currentDir = path.dirname(currentDir);
  }

  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  if (fs.existsSync(schemaPath)) {
    return schemaPath;
  }

  throw new Error(`Prisma schema file not found. Expected apps/api/backend/prisma/schema.prisma.`);
}

function runPrismaMigrateDeploy(): void {
  const schemaPath = resolvePrismaSchemaPath();
  const migrationsDir = path.resolve(schemaPath, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(
      `Missing Prisma migrations directory. Expected: ${path.relative(process.cwd(), migrationsDir)}`,
    );
  }

  const result = spawnSync(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'prisma', 'migrate', 'deploy', '--schema', schemaPath],
    {
      stdio: 'inherit',
      env: process.env,
      cwd: process.cwd(),
    },
  );

  if (result.error) {
    throw new Error(`Prisma migrate deploy failed to execute: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error('Prisma migrate deploy failed in production startup check.');
  }
}

// ── Application bootstrap ───────────────────────────────────

async function bootstrapApp() {
  // Hydrate process.env from .env.local / .env before any module reads it.
  // Real environment values (Railway, Render, shell) always win — dotenv
  // is configured with override:false in loadDotenv().
  const { loadDotenv } = await import('./config/loadDotenv');
  loadDotenv();

  const { log } = await import('./obs/logger');
  const { loadEnv } = await import('./config/env');
  const { ensureInvestigationSeedDataBootstrapped } = await import('./services/investigators/seedInvestigationData');
  const {
    ensureLaunchOpportunitiesBootstrapped,
    isDemoOpportunitySeedEnabled,
    retireSeededLaunchOpportunities,
  } = await import('./services/opportunities/launchOpportunitySeed');
  const { requestIntelligenceAutoWarm } = await import('./services/intelligence/intelligenceAutoWarmService');
  const { initializeTelemetry, shutdownTelemetry } = await import('./telemetry');
  const { runMonitoringCycle } = await import('../jobs/monitoringJob');
  const { isGeospatialPipelineEnabled, runGeospatialPipelineCycle } = await import('../jobs/geospatialJob');
  const { startQaAutomationRuntime } = await import('./qa/qaRuntime');
  const { grantConfiguredPlatformAdmins } = await import('./services/platform/platformAdminGrant');
  const Sentry = await import('@sentry/node');
  const { scrubEvent, resolveSentryRelease } = await import('@vitalcv/shared/observability');
  const cronMod = await import('node-cron');

  const config = loadEnv();

  // NPPES V1 sunset 2026-03-03 — this is the production entrypoint
  // (railway.toml startCommand runs server.js, not index.js), so the
  // version guard must fire here. A drifted endpoint constant throws,
  // which surfaces through the bootstrap failure path instead of
  // silently degrading NPI enrichment.
  const { assertNppesApiVersion } = await import('./services/identity/nppesApiVersion');
  const nppes = assertNppesApiVersion();
  log('info', 'NPPES API version pinned', {
    event: 'nppes_api_version',
    version: nppes.version,
    endpoints: nppes.endpoints,
  });

  await ensureInvestigationSeedDataBootstrapped({ logger: log });
  // Auto-seed of demo/launch opportunities is flag-gated (SEED_DEMO_OPPORTUNITIES,
  // default OFF). Production leaves it unset so it never seeds demo data — the
  // bootstrap still runs to log the honest skip line; dev/demo sets the flag to
  // seed on startup. ensureLaunchOpportunitiesBootstrapped enforces the gate again
  // internally, so this is belt-and-suspenders.
  if (config.NODE_ENV === 'production' || isDemoOpportunitySeedEnabled()) {
    await ensureLaunchOpportunitiesBootstrapped({ logger: log });
  }
  // Gating the seed stopped NEW demo rows; it did nothing about rows already
  // written before the gate existed. One of those — a posting under a real
  // health system's name — stayed live on the public board because the
  // read-time exclusion listed a slug the row did not have. Closing them at
  // boot makes the cleanup independent of every read path remembering to
  // filter. No-ops once they are closed, and when demo seeding is on.
  await retireSeededLaunchOpportunities({ logger: log });

  const productionDeployment = config.NODE_ENV === 'production';
  const skipStartupMigration =
    process.env.SKIP_STARTUP_MIGRATION === '1' ||
    process.env.SKIP_STARTUP_MIGRATION === 'true' ||
    process.env.DEPLOY_MIGRATIONS_DONE === '1' ||
    process.env.DEPLOY_MIGRATIONS_DONE === 'true';
  const runStartupMigration = productionDeployment && !config.SYSTEM_FROZEN && !skipStartupMigration;

  if (skipStartupMigration) {
    log('info', 'Startup migration skipped', {
      event: 'migration_skip',
      reason: 'SKIP_STARTUP_MIGRATION',
      node_env: config.NODE_ENV,
    });
  } else if (runStartupMigration) {
    log('warn', 'Startup migration will run in background to unblock readiness probes', {
      event: 'migration_async',
      node_env: config.NODE_ENV,
    });
  } else {
    log('warn', 'Schema migrations skipped at startup', {
      event: 'migration_skip',
      reason: config.SYSTEM_FROZEN ? 'SYSTEM_FROZEN' : 'non_production',
      node_env: config.NODE_ENV,
    });
  }

  const { default: app } = await import('./app');
  const { initializeCryptoKeys } = await import('./services/crypto/cryptoRegistry');
  await initializeCryptoKeys();
  const { initializeWave126Persistence } = await import('./services/persistence/wave126Persistence');
  initializeTelemetry('vitalcv-agent');
  await initializeWave126Persistence();

  // Initialize Sentry if DSN is configured.
  //
  // MS-1: `beforeSend`/`beforeSendTransaction` are NOT optional here. This API
  // routes NPIs in the path (`/api/passport/1234567890`), so error events carry
  // PII in `request.url` and in the Express transaction name before any body is
  // considered. The scrubber is shared with the web app (`@vitalcv/shared/
  // observability`) so there is exactly one reviewed redaction list — see
  // `docs/ops/observability.md`.
  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    const release = resolveSentryRelease();
    Sentry.init({
      dsn: sentryDsn,
      environment: config.NODE_ENV,
      release,
      sendDefaultPii: false,
      tracesSampleRate: config.NODE_ENV === 'production' ? 0.1 : 1.0,
      beforeSend: scrubEvent,
      beforeSendTransaction: scrubEvent,
    });
    log('info', 'Sentry initialized', {
      event: 'sentry_initialized',
      environment: config.NODE_ENV,
      release: release ?? 'unknown',
    });
  }

  // Hand the already-bound socket to Express — no close/rebind gap.
  earlyServer.removeAllListeners('request');
  earlyServer.on('request', app);
  {
    appReady = true;
    if (config.SYSTEM_FROZEN) {
      log('warn', 'SYSTEM_FROZEN active: startup migration freeze is enabled', {
        event: 'startup_frozen',
        environment: config.NODE_ENV,
      });
    }
    log('info', APP_READY_MESSAGE, {
      event: 'server_started',
      url: `http://localhost:${PORT}`,
      environment: config.NODE_ENV,
      frozen: config.SYSTEM_FROZEN,
      railway_branch: RAILWAY_BRANCH,
      railway_sha: RAILWAY_SHA,
    });
    startQaAutomationRuntime({
      app,
      baseUrl: `http://127.0.0.1:${PORT}`,
    });
    requestIntelligenceAutoWarm('startup');

    // W0-14: platform admin role granted by configuration. Idempotent sweep
    // over PLATFORM_ADMIN_CLERK_IDS; promotion only. Fire-and-forget like the
    // seed hooks so a datastore hiccup never blocks readiness — a listed id
    // that is missed here is promoted on its next row resolution anyway.
    void grantConfiguredPlatformAdmins().catch((error) => {
      log('error', 'platform_admin_grant_failed', {
        event: 'platform_admin_grant_failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
    });

    // Wave 2D: Schedule monitoring cycle every 24 hours (midnight UTC)
    if (!config.SYSTEM_FROZEN) {
      const monitoringTask = (cronMod.default ?? cronMod).schedule('0 0 * * *', async () => {
        log('info', 'monitoring_cron_triggered', { event: 'monitoring_cron_triggered' });
        try {
          const result = await runMonitoringCycle();
          log('info', 'monitoring_cron_completed', {
            event: 'monitoring_cron_completed',
            totalChecked: result.totalChecked,
            statusChanges: result.statusChanges,
            deltasDetected: result.deltasDetected,
            skippedSourceUnavailable: result.skippedSourceUnavailable,
            errors: result.errors,
            durationMs: result.durationMs,
          });
        } catch (error) {
          log('error', 'monitoring_cron_failed', {
            event: 'monitoring_cron_failed',
            error: error instanceof Error ? error.message : 'unknown',
          });
        }
      }, { timezone: 'UTC' });

      process.on('SIGTERM', () => monitoringTask.stop());
      process.on('SIGINT', () => monitoringTask.stop());

      log('info', 'monitoring_cron_scheduled', {
        event: 'monitoring_cron_scheduled',
        schedule: '0 0 * * * (daily at midnight UTC)',
      });

      // Wave 20: Autonomous Verification Swarm
      const { AgentOrchestrator, SanctionsAgent, StateBoardAgent } = await import('./agents');
      const orchestrator = AgentOrchestrator.getInstance();

      orchestrator.register(new SanctionsAgent(30_000));
      orchestrator.register(new StateBoardAgent(45_000));

      orchestrator.on('sanction_detected', (entry) => {
        log('warn', 'Agent sanction detection event', {
          event: 'agent_sanction_alert',
          npi: entry.npi,
          agentId: entry.agentId,
          timestamp: entry.timestamp,
        });
      });

      orchestrator.start();

      process.on('SIGTERM', () => orchestrator.shutdown());
      process.on('SIGINT', () => orchestrator.shutdown());

      log('info', 'Agent orchestrator initialized', {
        event: 'orchestrator_initialized',
        agents: ['sanctions', 'state_board'],
      });

      if (isGeospatialPipelineEnabled()) {
        const geospatialCron = process.env.GEOSPATIAL_PIPELINE_CRON ?? '17 * * * *';
        const geospatialTask = (cronMod.default ?? cronMod).schedule(geospatialCron, async () => {
          log('info', 'geospatial_cron_triggered', {
            event: 'geospatial_cron_triggered',
            schedule: geospatialCron,
          });
          try {
            const result = await runGeospatialPipelineCycle();
            log('info', 'geospatial_cron_completed', {
              event: 'geospatial_cron_completed',
              ...result,
            });
          } catch (error) {
            log('error', 'geospatial_cron_failed', {
              event: 'geospatial_cron_failed',
              error: error instanceof Error ? error.message : 'unknown',
            });
          }
        }, { timezone: 'UTC' });

        process.on('SIGTERM', () => geospatialTask.stop());
        process.on('SIGINT', () => geospatialTask.stop());

        if (process.env.GEOSPATIAL_PIPELINE_RUN_ON_START === 'true') {
          void runGeospatialPipelineCycle().catch((error) => {
            log('error', 'geospatial_startup_run_failed', {
              event: 'geospatial_startup_run_failed',
              error: error instanceof Error ? error.message : 'unknown',
            });
          });
        }

        log('info', 'geospatial_cron_scheduled', {
          event: 'geospatial_cron_scheduled',
          schedule: `${geospatialCron} (UTC)`,
        });
      }
    }
  }

  if (runStartupMigration) {
    void Promise.resolve()
      .then(() => {
        log('info', 'Applying Prisma migrations at startup', {
          event: 'migration_run',
          node_env: config.NODE_ENV,
        });
        runPrismaMigrateDeploy();
      })
      .catch((error) => {
        log('error', 'startup migration failed', {
          event: 'startup_migration_failed',
          error: error instanceof Error ? error.message : 'unknown',
        });
        process.exit(1);
      });
  }

  process.on('SIGTERM', () => {
    void shutdownTelemetry();
  });

  process.on('SIGINT', () => {
    void shutdownTelemetry();
  });
}
