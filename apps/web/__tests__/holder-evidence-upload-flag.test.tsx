/**
 * `/holder` renders the evidence upload panel only when
 * `EVIDENCE_UPLOAD_ENABLED=enabled`.
 *
 * The upload lane behind this panel (parse → ingest → confirm) is being
 * made honest in stages: the backend now fails closed instead of answering
 * every provider fault with a fixture licence, and stores what it does read
 * as self-attested. Until the lane is confirmed working end to end on
 * production, the panel stays off the page by default and a founder flips
 * one Railway variable to show it — the same staging this repo uses for its
 * other consequential switches (DIRECTORY_SITEMAP, CLERK_JWT_VERIFICATION).
 *
 * Rendered, not source-scanned: the page is an async server component and
 * is rendered here with `renderToStaticMarkup`. Children that reach the
 * network or the database are stubbed; the flag read is real.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/clinician-record/ownerRecord', () => ({
  loadOwnerRecord: vi.fn(async () => ({
    state: 'ready',
    npi: '1234567890',
    record: { identity: { data: { displayName: 'Test Clinician' } } },
  })),
}));

vi.mock('@/components/mobile/EvidenceUploadPanel', () => ({
  default: () => <div data-testid="evidence-upload-panel" />,
}));
vi.mock('@/components/mobile/ClinicianSupportCard', () => ({ ClinicianSupportCard: () => null }));
vi.mock('@/components/recognition/ShareRecognitionPanel', () => ({ ShareRecognitionPanel: () => null }));
vi.mock('@/components/holder/ShareBundleCard', () => ({ ShareBundleCard: () => null }));
vi.mock('@/components/clinician-record/ClinicianRecordDetail', () => ({ ClinicianRecordDetail: () => null }));
vi.mock('@/components/wallet/CredentialWallet', () => ({ CredentialWallet: () => null }));
vi.mock('@/components/wallet/CVWalletRegistrySummary', () => ({ CVWalletRegistrySummary: () => null }));
vi.mock('@/components/wallet/WalletPassport', () => ({ WalletPassport: () => null }));

const PANEL = 'data-testid="evidence-upload-panel"';
const SECTION = 'id="add-evidence"';
const LINK = 'Add a document';

async function renderHolder(): Promise<string> {
  const { default: HolderPage } = await import('../app/holder/page');
  return renderToStaticMarkup(await HolderPage());
}

describe('/holder evidence upload panel is flag-gated', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.EVIDENCE_UPLOAD_ENABLED;
  });

  afterEach(() => {
    if (saved === undefined) delete process.env.EVIDENCE_UPLOAD_ENABLED;
    else process.env.EVIDENCE_UPLOAD_ENABLED = saved;
  });

  it('renders the page at all (anti-vacuity)', async () => {
    delete process.env.EVIDENCE_UPLOAD_ENABLED;
    const html = await renderHolder();
    expect(html).toContain('Test Clinician');
    expect(html).toContain('id="credentials"');
  });

  it('hides the panel, its section and its header link when the variable is unset', async () => {
    delete process.env.EVIDENCE_UPLOAD_ENABLED;
    const html = await renderHolder();
    expect(html).not.toContain(PANEL);
    expect(html).not.toContain(SECTION);
    expect(html).not.toContain(LINK);
  });

  it.each(['true', '1', 'on', 'ENABLED', 'yes'])('stays hidden for the non-literal value %s', async (value) => {
    process.env.EVIDENCE_UPLOAD_ENABLED = value;
    const html = await renderHolder();
    expect(html).not.toContain(PANEL);
    expect(html).not.toContain(SECTION);
    expect(html).not.toContain(LINK);
  });

  it('shows the panel, its section and its header link for the literal "enabled"', async () => {
    process.env.EVIDENCE_UPLOAD_ENABLED = 'enabled';
    const html = await renderHolder();
    expect(html.split(PANEL).length - 1).toBe(1);
    expect(html).toContain(SECTION);
    expect(html).toContain(LINK);
  });
});
