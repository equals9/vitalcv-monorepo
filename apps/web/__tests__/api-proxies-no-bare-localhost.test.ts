/**
 * No proxy under `app/api` may fall back to a bare `localhost:4000`.
 *
 * Thirteen server-side proxies resolved their backend base as
 * `process.env.BACKEND_URL ?? 'http://localhost:4000'` (or the same shape on
 * `NEXT_PUBLIC_API_URL`) with no public-base fallback. On the Railway web
 * service `BACKEND_URL` is not set, so every one of them dialled
 * 127.0.0.1:4000 inside the container and got connection-refused — the
 * document upload, credential ingest, graph and verify-professional lanes
 * were dead in production while the page in front of them looked fine.
 *
 * Why `NEXT_PUBLIC_API_BASE` specifically: it is the one base variable the
 * web Dockerfile defaults to the production API host, so a proxy that reads
 * it reaches the backend without a runtime variable being set.
 * `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_API_URL` are declared empty at
 * build time and are therefore not a safe fallback on their own.
 *
 * The fix routes those proxies through the shared resolver in
 * `lib/backend-url.ts`, which reads `BACKEND_URL`, then `NEXT_PUBLIC_API_BASE`,
 * then the deployed-environment default. This test is the closure: any file
 * under `app/api` that still names `localhost:4000` must also read
 * `NEXT_PUBLIC_API_BASE` in code (not in a comment), or it is a bare fallback.
 *
 * Directory sweep, not a per-file list, so a fourteenth proxy added later is
 * covered without anyone remembering to extend it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const apiRoot = join(__dirname, '..', 'app', 'api');

function sourceFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFilesUnder(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Drop block comments and whole-line `//` comments. Enough for a gate; not a parser. */
export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n');
}

/**
 * A file has a bare localhost fallback when it names `localhost:4000` and
 * reads no `NEXT_PUBLIC_API_BASE` anywhere in its code. A file that goes
 * through the shared helper names no localhost at all and passes trivially.
 */
export function hasBareLocalhostFallback(src: string): boolean {
  if (!src.includes('localhost:4000')) return false;
  return !/NEXT_PUBLIC_API_BASE/.test(stripComments(src));
}

const API_FILES = sourceFilesUnder(apiRoot);
const label = (file: string): string => relative(join(__dirname, '..'), file).split(sep).join('/');

describe('app/api proxies — no bare localhost fallback', () => {
  it('finds the api route tree (anti-vacuity)', () => {
    expect(API_FILES.length).toBeGreaterThan(50);
  });

  describe('the predicate bites (negative controls)', () => {
    it('flags the two shapes that were live', () => {
      expect(hasBareLocalhostFallback(`const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:4000';`)).toBe(true);
      expect(hasBareLocalhostFallback(`const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';`)).toBe(true);
      expect(hasBareLocalhostFallback(`const B = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';`)).toBe(true);
    });

    it('a public-base mention that lives only in a comment does not count', () => {
      const src = [
        `// falls back to NEXT_PUBLIC_API_BASE in theory`,
        `/* NEXT_PUBLIC_API_BASE */`,
        `const B = process.env.BACKEND_URL ?? 'http://localhost:4000';`,
      ].join('\n');
      expect(hasBareLocalhostFallback(src)).toBe(true);
    });

    it('passes a proxy with a real public-base fallback', () => {
      expect(
        hasBareLocalhostFallback(`const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';`),
      ).toBe(false);
    });

    it('passes a proxy that uses the shared helper and names no localhost', () => {
      expect(hasBareLocalhostFallback(`import { BACKEND_URL } from '@/lib/backend-url';\nfetch(\`\${BACKEND_URL}/x\`);`)).toBe(false);
    });
  });

  it.each(API_FILES.map((f) => [label(f), f] as const))(
    '%s resolves its backend base through a public-base fallback or the shared helper',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');
      expect(
        hasBareLocalhostFallback(src),
        'bare localhost:4000 fallback — import { BACKEND_URL } from "@/lib/backend-url" instead',
      ).toBe(false);
    },
  );
});
