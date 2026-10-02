/**
 * platformAdmin.ts — the platform-admin answer for `/admin/*` pages and
 * `/api/admin/*` route handlers, read from the DATABASE role (W0-07).
 *
 * WHAT THIS REPLACES
 * Every admin surface decided "is this an admin?" from the Clerk session-token
 * custom claim `sessionClaims.vitalcv.role`. That claim was never configured on
 * the production Clerk instance, so the check was always undefined and every
 * admin page redirected every signed-in user — including the founder — to `/`.
 *
 * WHERE THE ANSWER COMES FROM NOW
 * The backend `User.role`, which is the same thing every backend platform-
 * operator guard already authorizes on. Two readers, in order:
 *
 *   1. The signed `vitalcv_role` cookie. It is minted ONLY by
 *      `/api/auth/resolve-role` from the backend's `/api/me/role` answer and is
 *      HMAC-signed with a server-only secret; a forged or tampered value fails
 *      verification. This is the same cookie the middleware already trusts to
 *      route `/admin/*`, so page and middleware now agree.
 *   2. The backend `/api/me/role`, called with the VERIFIED Clerk session
 *      identity (`buildIdentityHeaders`), when no valid cookie is present —
 *      e.g. an `/api/admin/*` call that never passed through the interstitial.
 *
 * WHAT NEVER PARTICIPATES
 *   - The Clerk session-token custom claim. It is not read here at all.
 *   - Any request header. `x-user-role`, `x-role`, `x-vitalcv-role` and their
 *     kin are attacker-typed strings on a public origin; the admin role is a
 *     database fact and nothing a caller sends can assert it.
 *
 * FAIL-CLOSED
 * No session, no valid cookie and no reachable backend → not an admin. A
 * backend error or a role the web app does not know → not an admin.
 */

import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

import { buildIdentityHeaders } from './forwardIdentity';
import { ROLE_COOKIE_NAME, verifyRoleCookie } from './roleCookie';
import { UserRole, type UserRoleType } from './roles';

const VALID_ROLES = new Set<string>(Object.values(UserRole));

/** Same precedence as `/api/auth/resolve-role`, evaluated at call time. */
function backendBase(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE ||
    'http://localhost:4000'
  );
}

export type SignedInRole =
  | { status: 'unauthenticated' }
  | { status: 'resolved'; userId: string; role: UserRoleType; source: 'cookie' | 'backend' }
  | { status: 'unresolved'; userId: string };

/**
 * Resolve the signed-in user's VitalCV role from the database-backed sources
 * above. Read-only: never mints a cookie (server components cannot set one,
 * and the resolving interstitial already does).
 */
export async function resolveSignedInRole(): Promise<SignedInRole> {
  const { userId } = await auth();
  if (!userId) {
    return { status: 'unauthenticated' };
  }

  const store = await cookies();
  const cookieRole = await verifyRoleCookie(store.get(ROLE_COOKIE_NAME)?.value);
  if (cookieRole) {
    return { status: 'resolved', userId, role: cookieRole, source: 'cookie' };
  }

  try {
    const headers = await buildIdentityHeaders({ userId });
    const res = await fetch(`${backendBase()}/api/me/role`, { headers, cache: 'no-store' });
    if (!res.ok) {
      return { status: 'unresolved', userId };
    }
    const body = (await res.json()) as { role?: unknown };
    const role = typeof body.role === 'string' ? body.role : '';
    if (!VALID_ROLES.has(role)) {
      return { status: 'unresolved', userId };
    }
    return { status: 'resolved', userId, role: role as UserRoleType, source: 'backend' };
  } catch {
    return { status: 'unresolved', userId };
  }
}

export type PlatformAdminCheck =
  | { admitted: true; userId: string }
  | { admitted: false; reason: 'unauthenticated' }
  | { admitted: false; reason: 'not_platform_admin'; userId: string };

/** The authorization answer: admitted only when the database role is ADMIN. */
export async function checkPlatformAdmin(): Promise<PlatformAdminCheck> {
  const resolved = await resolveSignedInRole();
  if (resolved.status === 'unauthenticated') {
    return { admitted: false, reason: 'unauthenticated' };
  }
  if (resolved.status === 'resolved' && resolved.role === UserRole.ADMIN) {
    return { admitted: true, userId: resolved.userId };
  }
  return { admitted: false, reason: 'not_platform_admin', userId: resolved.userId };
}

/**
 * Page guard. Redirects a signed-out visitor to sign-in (returning to
 * `returnTo`) and a signed-in non-admin to `/` — the same outcomes the pages
 * produced before, now decided from the database role. Returns the admitted
 * user id so a page can proceed.
 */
export async function requirePlatformAdminPage(returnTo: string): Promise<string> {
  const check = await checkPlatformAdmin();
  if (check.admitted) {
    return check.userId;
  }
  if (check.reason === 'unauthenticated') {
    redirect(`/sign-in?redirect_url=${encodeURIComponent(returnTo)}`);
  }
  redirect('/');
}

/**
 * Route-handler guard. Returns the denial response to send (401 signed-out,
 * 403 signed-in non-admin) or `null` when the caller is admitted.
 */
export async function platformAdminRouteDenial(): Promise<NextResponse | null> {
  const check = await checkPlatformAdmin();
  if (check.admitted) {
    return null;
  }
  if (check.reason === 'unauthenticated') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ error: 'forbidden' }, { status: 403 });
}
