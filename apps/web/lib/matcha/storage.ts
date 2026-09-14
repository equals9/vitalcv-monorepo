/**
 * MATCHA client persistence + memory diffing.
 *
 * Preferences are the clinician's own data, so the browser holds a working copy while the
 * auth-scoped server store is the durable home for a signed-in account. This module is pure
 * and SSR-safe — no React, guards on `window`.
 *
 * Every read and write is scoped to an identity. Before scoping, one global key held whatever
 * the last person on the browser had answered, so a second account signing in on the same
 * device rendered the first account's preferences — and the derived "MATCHA understands you"
 * profile — as its own. A cache with no identity on it cannot be attributed to an identity,
 * so {@link accountScope} keys each account's copy separately and {@link DEVICE_SCOPE} holds
 * the signed-out, device-local bucket.
 *
 * The pre-scoping key is never silently adopted into an account. It is unbound data: it may
 * belong to the person signing in, or to whoever used the browser before them, and nothing
 * on disk distinguishes the two. The device scope inherits it (identical meaning — this
 * browser, no account), while an account scope only ever receives it through
 * {@link adoptUnboundPreferences}, which is an explicit act by the person reading the screen.
 *
 * {@link diffPreferences} powers Wave 10 ("MATCHA remembers") by turning two preference
 * snapshots into plain-language memory notes. Every note is grounded in a real change, so
 * MATCHA only ever "remembers" something the clinician actually did.
 */

import {
  type MatchaPreferences,
  type PreferenceField,
  countAnsweredFields,
  isFieldAnswered,
} from './preferences';

/**
 * The pre-scoping keys. Written by every build before preferences were bound to an
 * account; still present on returning devices, so they are read (once, into the device
 * bucket) and offered for adoption rather than deleted out from under anyone.
 */
export const LEGACY_PREFERENCES_STORAGE_KEY = 'vitalcv.matcha.preferences';
export const LEGACY_PREFERENCES_UPDATED_KEY = 'vitalcv.matcha.preferences.updatedAt';

const SCOPED_KEY_PREFIX = 'vitalcv.matcha.preferences.v2';

/**
 * Which bucket of browser storage a read or write belongs to. Compared by value so it can
 * sit directly in a React dependency list.
 */
export type PreferenceScope = string;

/** The signed-out bucket: this browser, no account attached. */
export const DEVICE_SCOPE: PreferenceScope = 'device';

/** The bucket for one signed-in Clerk account. */
export function accountScope(userId: string): PreferenceScope {
  return `u.${userId}`;
}

export function isAccountScope(scope: PreferenceScope): boolean {
  return scope !== DEVICE_SCOPE;
}

function storageKey(scope: PreferenceScope): string {
  return `${SCOPED_KEY_PREFIX}.${scope}`;
}

function updatedAtKey(scope: PreferenceScope): string {
  return `${SCOPED_KEY_PREFIX}.${scope}.updatedAt`;
}

interface StoredEnvelope {
  version: 1;
  updatedAt: string;
  preferences: MatchaPreferences;
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function readKey(ls: Storage, key: string): MatchaPreferences {
  try {
    const raw = ls.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredEnvelope | MatchaPreferences;
    if (parsed && typeof parsed === 'object' && 'preferences' in parsed) {
      return (parsed as StoredEnvelope).preferences ?? {};
    }
    return (parsed as MatchaPreferences) ?? {};
  } catch {
    return {};
  }
}

function writeKey(ls: Storage, scope: PreferenceScope, prefs: MatchaPreferences, at: string): boolean {
  try {
    const envelope: StoredEnvelope = { version: 1, updatedAt: at, preferences: prefs };
    ls.setItem(storageKey(scope), JSON.stringify(envelope));
    ls.setItem(updatedAtKey(scope), at);
    return true;
  } catch {
    return false;
  }
}

function removeLegacyKeys(ls: Storage): void {
  try {
    ls.removeItem(LEGACY_PREFERENCES_STORAGE_KEY);
    ls.removeItem(LEGACY_PREFERENCES_UPDATED_KEY);
  } catch {
    /* no-op */
  }
}

/**
 * The pre-scoping blob, if any answers survive in it. Returns `{}` once it has been
 * inherited by the device scope, adopted into an account, or discarded.
 */
export function readUnboundPreferences(): MatchaPreferences {
  const ls = safeLocalStorage();
  if (!ls) return {};
  return readKey(ls, LEGACY_PREFERENCES_STORAGE_KEY);
}

/**
 * Move the unbound blob into `scope` because the person on the screen said it is theirs.
 * Returns what was adopted so the caller can render it without a second read.
 */
export function adoptUnboundPreferences(
  scope: PreferenceScope,
  at: string,
): MatchaPreferences {
  const ls = safeLocalStorage();
  if (!ls) return {};
  const unbound = readKey(ls, LEGACY_PREFERENCES_STORAGE_KEY);
  if (countAnsweredFields(unbound) === 0) return {};
  writeKey(ls, scope, unbound, at);
  removeLegacyKeys(ls);
  return unbound;
}

/** Drop the unbound blob because the person on the screen said it is not theirs. */
export function discardUnboundPreferences(): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  removeLegacyKeys(ls);
}

export function loadStoredPreferences(scope: PreferenceScope): MatchaPreferences {
  const ls = safeLocalStorage();
  if (!ls) return {};
  const scoped = readKey(ls, storageKey(scope));
  if (countAnsweredFields(scoped) > 0 || isAccountScope(scope)) return scoped;

  // Device scope only: the pre-scoping key meant exactly this — this browser, nobody
  // signed in — so inherit it once and retire the old key.
  const unbound = readKey(ls, LEGACY_PREFERENCES_STORAGE_KEY);
  if (countAnsweredFields(unbound) === 0) return scoped;
  writeKey(ls, scope, unbound, ls.getItem(LEGACY_PREFERENCES_UPDATED_KEY) ?? new Date(0).toISOString());
  removeLegacyKeys(ls);
  return unbound;
}

export function savePreferences(
  scope: PreferenceScope,
  prefs: MatchaPreferences,
  at: string,
): boolean {
  const ls = safeLocalStorage();
  if (!ls) return false;
  return writeKey(ls, scope, prefs, at);
}

export function clearStoredPreferences(scope: PreferenceScope): void {
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.removeItem(storageKey(scope));
    ls.removeItem(updatedAtKey(scope));
  } catch {
    /* no-op */
  }
}

// ── Memory diffing (Wave 10) ────────────────────────────────────────────────

export type MemoryChangeKind = 'added' | 'updated' | 'removed';

export interface MemoryNote {
  field: PreferenceField;
  kind: MemoryChangeKind;
  /** Plain-language note, e.g. "I remember you added California." */
  message: string;
}

const FIELD_LABELS: Partial<Record<PreferenceField, string>> = {
  preferredStates: 'where you want to work',
  desiredSpecialties: 'the specialties you want to move toward',
  currentSpecialties: 'what you practice',
  minimumSalary: 'your minimum compensation',
  desiredSalary: 'your target compensation',
  remoteInterest: 'your interest in remote work',
  employmentTypes: 'the arrangements that work for you',
  hardConstraints: 'the terms you will not move on',
  startUrgency: 'how soon you want to start',
  leadershipAspiration: 'your leadership goals',
  workLifeBalanceImportance: 'how much work–life balance matters',
};

function readable(field: PreferenceField): string {
  return FIELD_LABELS[field] ?? String(field).replace(/([A-Z])/g, ' $1').toLowerCase();
}

function describeValue(value: unknown): string | null {
  if (Array.isArray(value)) return value.length ? value.join(', ') : null;
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value.replace(/_/g, ' ');
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return null;
}

/**
 * Compare two preference snapshots and return grounded memory notes.
 * Only fields that genuinely changed produce a note.
 */
export function diffPreferences(
  before: MatchaPreferences,
  after: MatchaPreferences,
  fields: readonly PreferenceField[],
): MemoryNote[] {
  const notes: MemoryNote[] = [];
  for (const field of fields) {
    const b = before[field];
    const a = after[field];
    const hadBefore = isFieldAnswered(b);
    const hasAfter = isFieldAnswered(a);
    if (!hadBefore && !hasAfter) continue;
    if (JSON.stringify(b ?? null) === JSON.stringify(a ?? null)) continue;

    if (!hadBefore && hasAfter) {
      const v = describeValue(a);
      notes.push({
        field,
        kind: 'added',
        message: v
          ? `I noted ${readable(field)}: ${v}.`
          : `I noted ${readable(field)}.`,
      });
    } else if (hadBefore && !hasAfter) {
      notes.push({ field, kind: 'removed', message: `You cleared ${readable(field)}.` });
    } else {
      const v = describeValue(a);
      notes.push({
        field,
        kind: 'updated',
        message: v
          ? `You updated ${readable(field)} to ${v}.`
          : `You updated ${readable(field)}.`,
      });
    }
  }
  return notes;
}
