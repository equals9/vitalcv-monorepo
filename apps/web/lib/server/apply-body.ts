/**
 * Apply-request body hygiene for the server-side proxy.
 *
 * The subject of an application is the verified session's clinician. The
 * backend names them from the session token and reads their NPI from the
 * bound profile; a client-supplied `npi` is never consulted. The proxy strips
 * it before forwarding so a stale client cannot even send one through.
 */

/**
 * Forward the apply body minus any client-asserted `npi`. A body that is not a
 * JSON object is forwarded untouched — the backend's parser rejects it, and
 * rewriting it here would hide that from the caller.
 */
export function withoutClientNpi(raw: string): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rest: Record<string, unknown> = { ...(parsed as Record<string, unknown>) };
      delete rest.npi;
      return JSON.stringify(rest);
    }
  } catch {
    // not JSON
  }
  return raw;
}
