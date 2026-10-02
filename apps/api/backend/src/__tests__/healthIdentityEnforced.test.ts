/**
 * W0-09 — `/health` publishes exactly one identity fact, as a boolean.
 *
 * `identityEnforced` is true only when `CLERK_JWT_VERIFICATION` is in its
 * blocking mode and false for every other mode, including unset. The response
 * must not carry the mode name itself: this is a public endpoint on a public
 * repository, and the boolean is the whole disclosure.
 *
 * The mode is set through the environment and re-parsed with `loadEnv()`, the
 * same path the server takes, and the request goes through the served app.
 */
import request from 'supertest';

import app from '../app';
import { loadEnv } from '../config/env';

const ORIGINAL = process.env.CLERK_JWT_VERIFICATION;

function setMode(mode: string | undefined): void {
  if (mode === undefined) delete process.env.CLERK_JWT_VERIFICATION;
  else process.env.CLERK_JWT_VERIFICATION = mode;
  loadEnv();
}

afterAll(() => {
  setMode(ORIGINAL);
});

describe('GET /health identityEnforced', () => {
  it.each([
    ['off', false],
    ['shadow', false],
    ['enforce', true],
  ])('mode %s → identityEnforced %s', async (mode, expected) => {
    setMode(mode);
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.identityEnforced).toBe(expected);
    expect(typeof res.body.identityEnforced).toBe('boolean');
  });

  it('is false when the mode is unset', async () => {
    setMode(undefined);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.identityEnforced).toBe(false);
  });

  it('never publishes the mode name, only the boolean', async () => {
    for (const mode of ['off', 'shadow', 'enforce']) {
      setMode(mode);
      const res = await request(app).get('/health');
      // No value in the payload is the configured mode string.
      const values = Object.values(res.body as Record<string, unknown>).map((v) =>
        typeof v === 'string' ? v : null,
      );
      expect(values).not.toContain(mode);
    }
  });
});
