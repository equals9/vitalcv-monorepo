/**
 * W0-14 — platform admin role granted by configuration, against a REAL
 * database.
 *
 * What this pins, by outcome:
 *   - a listed id with a row is promoted to ADMIN + ACTIVE by the boot sweep;
 *   - a listed id with NO row at boot is promoted the moment its row is created
 *     by the normal first-sign-in path (`GET /api/me/role`);
 *   - a non-listed id is never promoted — not by the sweep, and not by a
 *     request that carries the "list" in every channel a caller controls
 *     (header, query, body) alongside every role-assertion header;
 *   - removing an id from the list never demotes;
 *   - `ensurePlatformAdmin` admits the promoted account's verified session and
 *     refuses a second, non-listed account.
 *
 * The configured list is set through the environment and re-parsed with
 * `loadEnv()`, exactly the path production takes. Nothing here reaches into
 * the service to hand it a list.
 */
import express from 'express';
import request from 'supertest';
import { PrismaClient, UserRole, UserStatus } from '@prisma/client';

import { loadEnv } from '../../../config/env';
import { ensurePlatformAdmin } from '../../../middleware/platformAdmin';
import { registerRoleRoutes } from '../../../routes/role';
import { ensureWorkspaceUser } from '../../workspace/workspaceService';
import {
  grantConfiguredPlatformAdmins,
  isConfiguredPlatformAdmin,
} from '../platformAdminGrant';

const prisma = new PrismaClient();

const suffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`;
const LISTED_EXISTING = `user_w014_listed_existing_${suffix}`;
const LISTED_LATER = `user_w014_listed_later_${suffix}`;
const UNLISTED = `user_w014_unlisted_${suffix}`;
const ALL_IDS = [LISTED_EXISTING, LISTED_LATER, UNLISTED];

const ORIGINAL_LIST = process.env.PLATFORM_ADMIN_CLERK_IDS;

function configureList(value: string | undefined): void {
  if (value === undefined) delete process.env.PLATFORM_ADMIN_CLERK_IDS;
  else process.env.PLATFORM_ADMIN_CLERK_IDS = value;
  loadEnv();
}

async function rowFor(clerkUserId: string) {
  return prisma.user.findUnique({
    where: { clerkUserId },
    select: { role: true, status: true },
  });
}

/** The real role route, mounted the way `app.ts` mounts it. */
function buildRoleApp() {
  const app = express();
  app.use(express.json());
  registerRoleRoutes(app);
  return app;
}

/** Publishes `req.verifiedAuth` only for a caller the test declares verified. */
function buildGuardedApp() {
  const app = express();
  app.use((req, _res, next) => {
    const verified = req.headers['x-test-verified-user'];
    if (typeof verified === 'string' && verified.length > 0) {
      (req as unknown as { verifiedAuth: unknown }).verifiedAuth = {
        outcome: 'verified',
        verifiedUserId: verified,
      };
    }
    next();
  });
  app.get('/guarded', async (req, res) => {
    if (!(await ensurePlatformAdmin(req, res))) return;
    res.status(200).json({ ok: true });
  });
  return app;
}

beforeAll(async () => {
  // Deliberate whitespace around the ids: the parser must trim, because a
  // value typed into a dashboard field will carry it.
  configureList(` ${LISTED_EXISTING} , ${LISTED_LATER} `);

  await prisma.user.createMany({
    data: [
      {
        clerkUserId: LISTED_EXISTING,
        email: `${LISTED_EXISTING}@w014.local`,
        role: UserRole.CLINICIAN,
        status: UserStatus.ACTIVE,
      },
      {
        clerkUserId: UNLISTED,
        email: `${UNLISTED}@w014.local`,
        role: UserRole.CLINICIAN,
        status: UserStatus.ACTIVE,
      },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { clerkUserId: { in: ALL_IDS } } });
  configureList(ORIGINAL_LIST);
  await prisma.$disconnect();
});

describe('configured list', () => {
  it('is a membership test on the trimmed configured ids and nothing else', () => {
    expect(isConfiguredPlatformAdmin(LISTED_EXISTING)).toBe(true);
    expect(isConfiguredPlatformAdmin(LISTED_LATER)).toBe(true);
    expect(isConfiguredPlatformAdmin(`  ${LISTED_LATER}  `)).toBe(true);
    expect(isConfiguredPlatformAdmin(UNLISTED)).toBe(false);
    expect(isConfiguredPlatformAdmin('')).toBe(false);
    expect(isConfiguredPlatformAdmin('   ')).toBe(false);
  });
});

describe('boot sweep', () => {
  it('promotes a listed id with a row, leaves a non-listed row alone, and reports a listed id with no row', async () => {
    const sweep = await grantConfiguredPlatformAdmins();

    expect(sweep).toEqual({ configured: 2, promoted: 1, alreadyGranted: 0, withoutRow: 1 });
    await expect(rowFor(LISTED_EXISTING)).resolves.toEqual({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
    await expect(rowFor(UNLISTED)).resolves.toEqual({
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    });
    // Never fabricates a row for a listed id that has not signed in.
    await expect(rowFor(LISTED_LATER)).resolves.toBeNull();
  });

  it('is idempotent on a second run', async () => {
    const sweep = await grantConfiguredPlatformAdmins();
    expect(sweep).toEqual({ configured: 2, promoted: 0, alreadyGranted: 1, withoutRow: 1 });
  });
});

describe('promotion on row creation', () => {
  it('promotes a listed id the moment its row is created by GET /api/me/role', async () => {
    const res = await request(buildRoleApp())
      .get('/api/me/role')
      .set('x-clerk-user-id', LISTED_LATER)
      .set('x-clerk-user-email', `${LISTED_LATER}@w014.local`);

    expect(res.status).toBe(200);
    expect(res.body.role).toBe(UserRole.ADMIN);
    await expect(rowFor(LISTED_LATER)).resolves.toEqual({
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
    });
  });
});

describe('the list is never read from a request', () => {
  it('does not promote a non-listed id that carries the list and every role assertion a caller can type', async () => {
    const res = await request(buildRoleApp())
      .get(`/api/me/role?PLATFORM_ADMIN_CLERK_IDS=${encodeURIComponent(UNLISTED)}&role=ADMIN`)
      .set('x-clerk-user-id', UNLISTED)
      .set('x-clerk-user-email', `${UNLISTED}@w014.local`)
      .set('x-platform-admin-clerk-ids', UNLISTED)
      .set('platform-admin-clerk-ids', UNLISTED)
      .set('x-user-role', 'ADMIN')
      .set('x-verifier-role', 'super-admin')
      .set('x-role', 'super-admin')
      .set('x-vitalcv-role', 'ADMIN')
      .send({ PLATFORM_ADMIN_CLERK_IDS: UNLISTED, role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe(UserRole.CLINICIAN);
    await expect(rowFor(UNLISTED)).resolves.toEqual({
      role: UserRole.CLINICIAN,
      status: UserStatus.ACTIVE,
    });
  });
});

describe('promotion only', () => {
  it('never demotes when an id leaves the list', async () => {
    configureList('');
    try {
      const sweep = await grantConfiguredPlatformAdmins();
      expect(sweep).toEqual({ configured: 0, promoted: 0, alreadyGranted: 0, withoutRow: 0 });

      await expect(rowFor(LISTED_EXISTING)).resolves.toEqual({
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      });
      // The per-row hook does not demote either.
      const resolved = await ensureWorkspaceUser(LISTED_EXISTING);
      expect(resolved.role).toBe(UserRole.ADMIN);
      expect(resolved.status).toBe(UserStatus.ACTIVE);
    } finally {
      configureList(` ${LISTED_EXISTING} , ${LISTED_LATER} `);
    }
  });
});

describe('ensurePlatformAdmin on the granted account', () => {
  it('admits the promoted account\'s verified session', async () => {
    const res = await request(buildGuardedApp())
      .get('/guarded')
      .set('x-test-verified-user', LISTED_EXISTING);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('refuses a second, non-listed account even with every role header set', async () => {
    const res = await request(buildGuardedApp())
      .get('/guarded')
      .set('x-test-verified-user', UNLISTED)
      .set('x-user-role', 'ADMIN')
      .set('x-role', 'super-admin');
    expect(res.status).toBe(403);
  });

  it('refuses an unverified caller that names the listed id in a header', async () => {
    const res = await request(buildGuardedApp())
      .get('/guarded')
      .set('x-clerk-user-id', LISTED_EXISTING)
      .set('x-user-role', 'ADMIN');
    expect(res.status).toBe(401);
  });
});
