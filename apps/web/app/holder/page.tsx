import Link from 'next/link';
import EvidenceUploadPanel from '@/components/mobile/EvidenceUploadPanel';
import { ClinicianSupportCard } from '@/components/mobile/ClinicianSupportCard';
import { ShareRecognitionPanel } from '@/components/recognition/ShareRecognitionPanel';
import { ShareBundleCard } from '@/components/holder/ShareBundleCard';
import { ClinicianRecordDetail } from '@/components/clinician-record/ClinicianRecordDetail';
import { CredentialWallet } from '@/components/wallet/CredentialWallet';
import { CVWalletRegistrySummary } from '@/components/wallet/CVWalletRegistrySummary';
import { WalletPassport } from '@/components/wallet/WalletPassport';
import { loadOwnerRecord, type OwnerRecordResult } from '@/lib/clinician-record/ownerRecord';
import { evidenceUploadEnabled } from '@/lib/holder/evidenceUploadFlag';

export const dynamic = 'force-dynamic';

function WalletState({ result }: { result: Exclude<OwnerRecordResult, { state: 'ready' }> }) {
  const content =
    result.state === 'no_npi'
      ? {
          eyebrow: 'Profile setup',
          heading: 'Connect your NPI to build your profile',
          body: 'VitalCV will read the public clinician record tied to your NPI, preserve every field the source returns, and show what still needs separate verification.',
          actionHref: '/onboarding',
          actionLabel: 'Connect my NPI',
        }
      : result.state === 'registry_unavailable'
        ? {
            eyebrow: 'Registry connection',
            heading: `We could not read NPI ${result.npi}`,
            body: 'CMS may be temporarily unavailable, or the NPI may not currently resolve. VitalCV is not hiding an empty record; the source did not return a readable one.',
            actionHref: '/holder',
            actionLabel: 'Try again',
          }
        : {
            eyebrow: 'Profile connection',
            heading: 'We could not load your linked clinician record',
            body: 'The workspace lookup failed before VitalCV could determine which NPI belongs to this account. No conclusion was made about your credentials.',
            actionHref: '/holder',
            actionLabel: 'Try again',
          };

  return (
    <div className="mz mz-paper mz-persona-holder min-h-screen bg-[var(--vt-bg)] text-foreground">
      <main className="mx-auto flex min-h-[70vh] w-full max-w-2xl items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6 shadow-sm sm:p-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
            {content.eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            {content.heading}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--vt-text-secondary)]">
            {content.body}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href={content.actionHref}
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-[var(--vt-accent-editorial,#4338CA)] px-5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              {content.actionLabel}
            </Link>
            <Link
              href="/"
              className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 text-sm font-semibold text-foreground transition hover:bg-[var(--vt-surface-dim)]"
            >
              Return home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

export default async function HolderPage() {
  const result = await loadOwnerRecord();

  if (result.state !== 'ready') {
    return <WalletState result={result} />;
  }

  const { record, npi } = result;
  const displayName = record.identity.data.displayName || `NPI ${npi}`;
  // Upload panel is staged behind EVIDENCE_UPLOAD_ENABLED=enabled; see the
  // helper for why. Its header link goes with it so nothing points at a
  // section that is not on the page.
  const showEvidenceUpload = evidenceUploadEnabled();

  return (
    <div className="mz mz-paper mz-persona-holder min-h-screen bg-[var(--vt-bg)] text-foreground">
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-secondary)]">
                Your VitalCV profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {displayName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--vt-text-secondary)]">
                Your career record in one place: what public sources report, what has been verified, what you added, and what you choose to share.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/clinician/profile"
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-4 text-sm font-semibold text-foreground transition hover:border-[var(--vt-accent-editorial,#4338CA)] hover:bg-[var(--vt-surface-dim)]"
              >
                Add career details
              </Link>
              {showEvidenceUpload ? (
                <a
                  href="#add-evidence"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-xl bg-[var(--vt-accent-editorial,#4338CA)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Add a document
                </a>
              ) : null}
            </div>
          </div>

          <nav aria-label="Profile sections" className="mt-6 flex flex-wrap gap-2 border-t border-[var(--vt-border)] pt-4">
            {[
              ['#career-record', 'Career record'],
              ['#verification', 'Verification'],
              ['#credentials', 'Credentials'],
              ['#all-source-fields', 'All source fields'],
              ['#share-wallet', 'Share'],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--vt-text-secondary)] transition hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <CVWalletRegistrySummary record={record} />

        <section id="verification" aria-labelledby="verification-heading" className="scroll-mt-6 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
              Verification
            </p>
            <h2 id="verification-heading" className="mt-1 text-xl font-semibold text-foreground">
              What has been checked separately
            </h2>
            <p className="mt-1 text-sm text-[var(--vt-text-secondary)]">
              Registry presence and state-board verification are different claims. This section keeps them separate.
            </p>
          </div>
          <WalletPassport npi={npi} pollIntervalMs={30_000} />
        </section>

        <section id="credentials" aria-labelledby="credentials-heading" className="scroll-mt-6 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
              Credentials and documents
            </p>
            <h2 id="credentials-heading" className="mt-1 text-xl font-semibold text-foreground">
              Evidence already attached to your profile
            </h2>
          </div>
          <CredentialWallet subject={npi} />
        </section>

        <details
          id="all-source-fields"
          className="scroll-mt-6 rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 shadow-sm sm:p-6"
        >
          <summary className="min-h-[44px] cursor-pointer text-base font-semibold text-foreground">
            All source fields
            <span className="ml-2 text-sm font-normal text-[var(--vt-text-secondary)]">
              Identity, every taxonomy, identifiers, locations, endpoints, dates, and known gaps
            </span>
          </summary>
          <div className="mt-5 border-t border-[var(--vt-border)] pt-5">
            <ClinicianRecordDetail record={record} mode="owner" />
          </div>
        </details>

        {showEvidenceUpload ? (
          <section id="add-evidence" className="scroll-mt-6">
            <EvidenceUploadPanel
              heading="Add evidence"
              description="Attach a license, certificate, CV, or supporting document. VitalCV keeps uploaded evidence separate from source-reported and source-verified facts."
              returnToHref="/holder"
              returnToLabel="Return to your profile"
            />
          </section>
        ) : null}

        <section id="share-wallet" aria-labelledby="share-wallet-heading" className="scroll-mt-6 space-y-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-secondary)]">
              Share
            </p>
            <h2 id="share-wallet-heading" className="mt-1 text-xl font-semibold text-foreground">
              Share a read-only record
            </h2>
          </div>
          <ShareRecognitionPanel npi={npi} />
          <ShareBundleCard npi={npi} />
        </section>

        <ClinicianSupportCard
          topic="cv-wallet"
          detail="If a source field is missing, stale, or incorrect, tell support which section and source is affected. VitalCV should show the gap rather than silently omit it."
          primaryHref="/holder/readiness"
          primaryLabel="Review readiness"
        />
      </main>
    </div>
  );
}
