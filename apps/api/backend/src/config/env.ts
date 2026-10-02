import { z } from 'zod';
import { log } from '../obs/logger';

type ApiKeyParseInput = string;

function normalizeCorsCandidate(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      return new URL(trimmed).origin;
    } catch {
      return trimmed;
    }
  }
  return `https://${trimmed}`;
}

function resolvePlatformCorsOrigin(): string {
  const candidates = [
    process.env.RAILWAY_PUBLIC_DOMAIN,
    process.env.RENDER_EXTERNAL_URL,
    process.env.VERCEL_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCorsCandidate(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

export const PRODUCTION_REQUIRED_VARS = [
  'API_KEYS',
  'DATABASE_URL',
] as const;

export type ProductionEnvCheckReport = {
  ok: boolean;
  missing: string[];
};

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'no', 'off']);

function parseApiKeys(raw: ApiKeyParseInput, isProduction: boolean): string[] {
  const values = raw
    .split(',')
    .map((key) => key.trim())
    .filter((key) => key.length > 0);

  if (isProduction && values.length === 0) {
    throw new Error('API_KEYS must be defined in production');
  }

  return values;
}

function parseBooleanEnvVar(
  raw: unknown,
  fieldName: string,
  requiredInProduction: boolean,
): boolean {
  const normalized =
    raw === undefined || raw === null ? '' : String(raw).trim().toLowerCase();

  if (!normalized) {
    if (requiredInProduction && PRODUCTION) {
      throw new Error(`${fieldName} must be defined in production`);
    }
    return false;
  }

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  throw new Error(`${fieldName} must be 'true', 'false', '1', or '0'`);
}

const PRODUCTION = process.env.NODE_ENV === 'production';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  YC_DEMO_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'YC_DEMO_MODE', false);
  }, z.boolean()),
  CORS_ORIGIN: z.preprocess(
    (raw: unknown): string => {
      const rawValue = raw === undefined || raw === null ? '' : String(raw).trim();
      if (rawValue.length > 0) {
        return rawValue;
      }

      return resolvePlatformCorsOrigin() || '*';
    },
    z
      .string()
      .transform((value: string) => value.trim())
      .superRefine((value: string, ctx) => {
      if (process.env.NODE_ENV === 'production' && value === '*') {
        ctx.addIssue({
          code: 'custom',
          message: 'CORS_ORIGIN must not be "*" in production',
        });
      }
      }),
  ),
  API_KEYS: z.preprocess(
    (raw) => {
      if (raw === undefined) {
        return '';
      }
      return String(raw);
    },
    z
      .string()
      .transform((raw) => parseApiKeys(raw, PRODUCTION)),
  ),
  TRUST_STATE_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(60),
  MONITORING_SECRET: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string(),
  ),
  // G4: server-held key for salting publicly-exposed claim-leaf digests
  // (routes/public.ts). Empty (default) = fail-closed, expose no digests.
  CLAIM_DIGEST_HMAC_SECRET: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw).trim()),
    z.string(),
  ),
  INTERNAL_DASH_PASSWORD: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string(),
  ),
  PILOT_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'PILOT_MODE', false);
  }, z.boolean()),
  ENTERPRISE_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'ENTERPRISE_MODE', false);
  }, z.boolean()),
  LOW_FRICTION_MODE: z.preprocess((raw) => {
    return parseBooleanEnvVar(raw, 'LOW_FRICTION_MODE', false);
  }, z.boolean()),
  SYSTEM_FROZEN: z.preprocess((raw) => parseBooleanEnvVar(raw, 'SYSTEM_FROZEN', false), z.boolean()),
  REAL_NURSYS_ENABLED: z.preprocess((raw) => parseBooleanEnvVar(raw, 'REAL_NURSYS_ENABLED', false), z.boolean()),
  // Live SAM.gov exclusion checks (services/samGovAdapter.ts). Default false:
  // the lane stays an honest gated stub until SAM_GOV_API_KEY is configured
  // and a live fetcher is wired.
  SAM_GOV_ENABLED: z.preprocess((raw) => parseBooleanEnvVar(raw, 'SAM_GOV_ENABLED', false), z.boolean()),
  // RBAC rollout for employer-review mutations. false = shadow mode (log
  // would-deny, never block); true = enforce (403 + denied-mutation audit).
  // Deliberately NOT in the SYSTEM_FROZEN blocklist: freezing features must
  // not switch a security control off.
  VERIFIER_RBAC_ENFORCED: z.preprocess((raw) => parseBooleanEnvVar(raw, 'VERIFIER_RBAC_ENFORCED', false), z.boolean()),
  // G1 header-trust closure — staged rollout of verified Clerk session JWTs
  // (middleware/verifiedIdentity.ts). off = no-op; shadow = verify + log,
  // never block; enforce = identity only from a verified token (401 on
  // identity-header-without-token, role-bypass headers stripped when
  // unverified). Same shadow-first pattern as VERIFIER_RBAC_ENFORCED, and
  // likewise NOT in the SYSTEM_FROZEN blocklist.
  CLERK_JWT_VERIFICATION: z.enum(['off', 'shadow', 'enforce']).default('off'),
  // G1 org-context binding — staged closure of "presence of a caller-supplied
  // `x-org-id` is treated as authorization" (middleware/tenantGuard.ts
  // #bindOrganizationContext). off = no-op; shadow = resolve verified
  // membership and log what enforce would deny, never block; enforce = org
  // context comes only from verified membership (403 on asserted mismatch,
  // no org context at all without a verified membership).
  //
  // Depends on CLERK_JWT_VERIFICATION: `verifiedAuth` is only populated in
  // shadow/enforce, so binding at enforce while JWT verification is off would
  // deny every org-scoped request. envValidation makes that combination fatal.
  TENANT_ORG_BINDING: z.enum(['off', 'shadow', 'enforce']).default('off'),
  // Clerk frontend-API origin, e.g. https://clerk.vitalcv.com — JWKS is fetched
  // from `${CLERK_ISSUER}/.well-known/jwks.json`. Required for shadow/enforce
  // (envValidation fails the boot on enforce-without-issuer).
  CLERK_ISSUER: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw).trim()),
    z.string(),
  ),
  // Optional comma-separated `azp` allowlist (Clerk authorizedParties), e.g.
  // "https://vitalcv.com,https://www.vitalcv.com". Empty = azp not checked.
  CLERK_AUTHORIZED_PARTIES: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string().transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ),
  // Platform administrators granted by configuration, never by hand (W0-14).
  // Comma-separated Clerk user ids — identifiers, not secrets. Read ONCE here
  // at boot; `services/platform/platformAdminGrant.ts` promotes every listed
  // id that has a `User` row to role ADMIN + status ACTIVE at startup and when
  // its row is first created. Promotion only: removing an id never demotes.
  // The list is never read from a request (header, body, or query).
  PLATFORM_ADMIN_CLERK_IDS: z.preprocess(
    (raw) => (raw === undefined ? '' : String(raw)),
    z.string().transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

function resolveValue(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function getProductionEnvCheck(): ProductionEnvCheckReport {
  const missing = PRODUCTION_REQUIRED_VARS.filter((name) => !resolveValue(process.env[name]).length);

  return {
    ok: missing.length === 0,
    missing,
  };
}

/**
 * Parse and validate environment variables.
 * Throws on missing required vars so the process fails fast before serving traffic.
 */
export function loadEnv(): Env {
  const productionMode =
    process.env.NODE_ENV === 'production' ||
    String(process.env.NODE_ENV).trim().toLowerCase() === 'production';
  if (productionMode) {
    const missing = getProductionEnvCheck();
    if (!missing.ok) {
      const formatted = missing.missing.map((name) => `${name}: required in production`).join('\n');
      log('error', `environment validation failed: ${formatted}`, {
        event: 'production_env_validation_failed',
        missing: missing.missing,
        details: formatted,
        node_env: process.env.NODE_ENV ?? 'development',
        railway_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
        railway_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      });
      throw new Error(`Environment validation failed:\n${formatted}`);
    }
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    const missingKeys = result.error.issues
      .filter((i) => i.code === 'too_small' || i.message.toLowerCase().includes('required'))
      .map((i) => i.path.join('.'));
    const invalidKeys = result.error.issues
      .filter((i) => i.code !== 'too_small' && !i.message.toLowerCase().includes('required'))
      .map((i) => i.path.join('.'));
    log('error', `environment validation failed: ${formatted}`, {
      event: 'env_validation_failed',
      missing_keys: missingKeys,
      invalid_keys: invalidKeys,
      fields: result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
      railway_branch: process.env.RAILWAY_GIT_BRANCH ?? null,
      railway_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
    });
    throw new Error(`Environment validation failed:\n${formatted}`);
  }

  // Wave 34: Fail fast if production runs with demo mode enabled.
  // YC_DEMO_MODE=true in production is a safety violation unless SYSTEM_FROZEN overrides it.
  if (
    productionMode &&
    result.data.YC_DEMO_MODE &&
    !result.data.SYSTEM_FROZEN
  ) {
    throw new Error(
      'YC_DEMO_MODE cannot be enabled in production. Set YC_DEMO_MODE=false or enable SYSTEM_FROZEN.',
    );
  }

  const frozen = result.data.SYSTEM_FROZEN;
  if (frozen) {
    // YC_DEMO_MODE is intentionally exempt — it is allowed in production
    // when SYSTEM_FROZEN=true (validated by the guard above).
    const blockedFlags = {
      ENTERPRISE_MODE: result.data.ENTERPRISE_MODE,
      REAL_NURSYS_ENABLED: result.data.REAL_NURSYS_ENABLED,
      SAM_GOV_ENABLED: result.data.SAM_GOV_ENABLED,
      LOW_FRICTION_MODE: result.data.LOW_FRICTION_MODE,
    } as const;

    for (const [name, value] of Object.entries(blockedFlags) as Array<
      [keyof typeof blockedFlags, boolean]
    >) {
      if (!value) {
        continue;
      }

      log('warn', 'feature flag blocked by SYSTEM_FROZEN', {
        event: 'feature_lock_blocked',
        feature: name,
      });
      process.env[name] = 'false';
    }

    result.data = {
      ...result.data,
      ENTERPRISE_MODE: false,
      REAL_NURSYS_ENABLED: false,
      SAM_GOV_ENABLED: false,
      LOW_FRICTION_MODE: false,
    };
  }

  _env = result.data;
  return _env;
}

/**
 * Access validated env after loadEnv() has been called.
 * Throws if called before loadEnv().
 */
export function env(): Env {
  if (!_env) {
    throw new Error('env() called before loadEnv(). Call loadEnv() during server startup.');
  }
  return _env;
}
