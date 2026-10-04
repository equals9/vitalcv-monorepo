/**
 * platformAdminGrant.ts — platform admin role granted by configuration, never
 * by hand (W0-14).
 *
 * WHAT THIS CLOSES
 * `User.role = ADMIN` could only be set by a hand-run SQL statement. Every
 * platform-operator surface already authorizes on the DATABASE role — a
 * verified Clerk session resolved to a `User` row with role ADMIN and status
 * ACTIVE (`middleware/platformAdmin.ts`, `middleware/platformAdminContext.ts`)
 * — so without a reviewed path that writes the row, the founder could not reach
 * `/admin/*` at all.
 *
 * HOW THE GRANT WORKS
 * `PLATFORM_ADMIN_CLERK_IDS` (comma-separated Clerk user ids, parsed ONCE at
 * boot by `config/env.ts`) is the only source of the list. Two hooks consume it:
 *
 *   1. `grantConfiguredPlatformAdmins()` — the boot sweep. For every listed id
 *      that already has a `User` row, set role ADMIN + status ACTIVE.
 *   2. `applyConfiguredPlatformAdminGrant(user)` — the per-row hook, called by
 *      `ensureWorkspaceUser` on every path that returns a row. A listed id with
 *      no row at boot is promoted the moment its row is created (first
 *      `/api/me/role`), and an already-existing listed row that was somehow
 *      missed is promoted on its next resolution.
 *
 * INVARIANTS
 *   - Promotion only. Removing an id from the list never demotes or suspends;
 *     demotion stays a deliberate, reviewed act.
 *   - The list is NEVER read from a request. No header, body, or query value
 *     participates; the only input is the configured list and the row itself.
 *   - Rows are never created here. A listed id without a `User` row is not
 *     fabricated — the row is created by the normal sign-in path and promoted
 *     when it appears.
 *   - Ids are never logged. Counts only.
 */

import type { User } from '@prisma/client';
import { UserRole, UserStatus } from '@prisma/client';

import prisma from '../../graphql/prisma_client';
import { env } from '../../config/env';
import { log } from '../../obs/logger';

/**
 * The configured set. Rebuilt only when the parsed env array changes identity
 * (i.e. `loadEnv()` ran again); the common case is one Set for the process.
 */
let cachedSource: readonly string[] | null = null;
let cachedSet: ReadonlySet<string> = new Set();

function configuredIds(): ReadonlySet<string> {
  const source = env().PLATFORM_ADMIN_CLERK_IDS;
  if (source !== cachedSource) {
    cachedSource = source;
    cachedSet = new Set(source);
  }
  return cachedSet;
}

/** Is this Clerk user id on the configured platform-admin list? */
export function isConfiguredPlatformAdmin(clerkUserId: string): boolean {
  const id = clerkUserId.trim();
  return id.length > 0 && configuredIds().has(id);
}

/** Already holds the grant — nothing to write. */
function alreadyGranted(user: Pick<User, 'role' | 'status'>): boolean {
  return user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE;
}

/**
 * Per-row hook. Returns the row unchanged for every id not on the list (the
 * ~100% case — one Set lookup, no I/O), and the promoted row for a listed id
 * that does not yet hold ADMIN + ACTIVE.
 */
export async function applyConfiguredPlatformAdminGrant(user: User): Promise<User> {
  if (!isConfiguredPlatformAdmin(user.clerkUserId) || alreadyGranted(user)) {
    return user;
  }

  const promoted = await prisma.user.update({
    where: { id: user.id },
    data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
  });
  log('info', 'platform_admin_granted', {
    event: 'platform_admin_granted',
    trigger: 'row_resolution',
    fromRole: user.role,
    fromStatus: user.status,
  });
  return promoted;
}

export interface PlatformAdminGrantSweep {
  /** Ids on the configured list. */
  configured: number;
  /** Rows written to ADMIN + ACTIVE by this sweep. */
  promoted: number;
  /** Listed ids whose row already held ADMIN + ACTIVE. */
  alreadyGranted: number;
  /** Listed ids with no `User` row yet — promoted when the row is created. */
  withoutRow: number;
}

/**
 * Boot sweep. Idempotent; safe to run on every start. Never creates rows and
 * never touches a row whose id is not on the list.
 */
export async function grantConfiguredPlatformAdmins(): Promise<PlatformAdminGrantSweep> {
  const ids = [...configuredIds()];
  const sweep: PlatformAdminGrantSweep = {
    configured: ids.length,
    promoted: 0,
    alreadyGranted: 0,
    withoutRow: 0,
  };

  if (ids.length === 0) {
    log('info', 'platform_admin_grant_skipped', {
      event: 'platform_admin_grant_skipped',
      reason: 'no_ids_configured',
    });
    return sweep;
  }

  const rows = await prisma.user.findMany({
    where: { clerkUserId: { in: ids } },
    select: { id: true, clerkUserId: true, role: true, status: true },
  });
  const byClerkId = new Map(rows.map((row) => [row.clerkUserId, row]));

  for (const id of ids) {
    const row = byClerkId.get(id);
    if (!row) {
      sweep.withoutRow += 1;
      continue;
    }
    if (alreadyGranted(row)) {
      sweep.alreadyGranted += 1;
      continue;
    }
    await prisma.user.update({
      where: { id: row.id },
      data: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    });
    sweep.promoted += 1;
  }

  log('info', 'platform_admin_grant_sweep', {
    event: 'platform_admin_grant_sweep',
    ...sweep,
  });
  return sweep;
}
