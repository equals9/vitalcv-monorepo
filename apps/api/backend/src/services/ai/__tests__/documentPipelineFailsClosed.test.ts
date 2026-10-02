/**
 * The document-reading lane fails closed.
 *
 * Before this guard, the OCR dispatcher answered EVERY fault with a fixed
 * fixture — a California medical licence with a name, a licence number and
 * dates — whenever no provider was configured or the configured provider
 * failed (missing key, HTTP error, timeout). That text then flowed through
 * classification and field extraction and was stored as a durable artifact
 * under a real account. A stub that answers on every fault is not a fallback;
 * it is a document the clinician never uploaded.
 *
 * Contract pinned here, as outcomes:
 *   - The fixture answers ONLY under NODE_ENV=test with no real provider
 *     selected. That is the single path on which it may run.
 *   - Every other fault rejects with DocumentReadingUnavailableError, and
 *     nothing resembling the fixture is ever returned — not in production,
 *     not in development, and not under test when a real provider was asked
 *     for and failed.
 */
jest.mock('../../../obs/logger', () => ({ log: jest.fn() }));

import { DocumentReadingUnavailableError, documentPipeline } from '../documentPipeline';

const FIXTURE_MARKERS = ['Medical Board of California', 'A123456', 'Jane A. Smith'];
const BUFFER = Buffer.from('not-a-real-image');
const MIME = 'image/png';

const ENV_KEYS = ['NODE_ENV', 'OCR_PROVIDER', 'OPENAI_API_KEY'] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

function setEnv(vars: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>): void {
  for (const key of ENV_KEYS) {
    const value = vars[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

async function expectFailsClosed(): Promise<DocumentReadingUnavailableError> {
  let caught: unknown;
  try {
    const result = await documentPipeline.extractFromDocument(BUFFER, MIME);
    throw new Error(`expected rejection, got a document: ${JSON.stringify(result).slice(0, 200)}`);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(DocumentReadingUnavailableError);
  const error = caught as DocumentReadingUnavailableError;
  // Truth contract: the failure copy may not read as a verification outcome.
  expect(error.message).not.toMatch(/verified/i);
  for (const marker of FIXTURE_MARKERS) expect(error.message).not.toContain(marker);
  return error;
}

describe('documentPipeline fails closed', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    for (const key of ENV_KEYS) saved[key] = process.env[key];
    fetchSpy = jest.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    setEnv(saved);
    fetchSpy.mockRestore();
  });

  it('production with no provider configured rejects — it does not invent a licence', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: undefined, OPENAI_API_KEY: undefined });
    await expectFailsClosed();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('development with no provider configured rejects too — the fixture is not a dev convenience', async () => {
    setEnv({ NODE_ENV: 'development', OCR_PROVIDER: undefined, OPENAI_API_KEY: undefined });
    await expectFailsClosed();
  });

  it('asking for the stub by name outside test is refused', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: 'stub', OPENAI_API_KEY: undefined });
    await expectFailsClosed();
  });

  it('an unknown provider name is refused rather than silently stubbed', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: 'some_future_provider', OPENAI_API_KEY: undefined });
    await expectFailsClosed();
  });

  it('openai selected with no key rejects before any network call', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: 'openai', OPENAI_API_KEY: undefined });
    await expectFailsClosed();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('openai network fault (timeout / connection error) rejects — no fixture fallback', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-not-real' });
    fetchSpy.mockRejectedValue(new Error('The operation was aborted due to timeout'));
    await expectFailsClosed();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('openai HTTP error rejects — no fixture fallback', async () => {
    setEnv({ NODE_ENV: 'production', OCR_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-not-real' });
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => 'upstream unavailable',
    } as unknown as Response);
    await expectFailsClosed();
  });

  it('under NODE_ENV=test, a real provider that fails still rejects — test mode is not a licence to fabricate', async () => {
    setEnv({ NODE_ENV: 'test', OCR_PROVIDER: 'openai', OPENAI_API_KEY: 'test-key-not-real' });
    fetchSpy.mockRejectedValue(new Error('connection refused'));
    await expectFailsClosed();
  });

  it('under NODE_ENV=test with no provider, the fixture answers — the ONLY path on which it may', async () => {
    setEnv({ NODE_ENV: 'test', OCR_PROVIDER: undefined, OPENAI_API_KEY: undefined });
    const result = await documentPipeline.extractFromDocument(BUFFER, MIME);
    expect(result.rawOcrText).toContain(FIXTURE_MARKERS[0]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
