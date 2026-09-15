import Link from 'next/link';
import { VerifierOnboardingGuide } from '@/components/verifier/VerifierOnboardingGuide';

export const metadata = {
  title: 'Verifier Guide',
  description:
    'Full reference for hospital credentialing reviewers. Trust tiers, replay continuity, degraded states, and signature verification.',
};

export default function VerifierGuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      {/* Nav */}
      <nav aria-label="Verify guide" className="mb-8 flex items-center gap-4 text-sm">
        <Link
          href="/verify"
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
        >
          ← Back to Verifier
        </Link>
        <span className="text-gray-300">|</span>
        <a
          href="/.well-known/trust.json"
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          trust.json
        </a>
        <span className="text-gray-300">|</span>
        <a
          href="/.well-known/jwks.json"
          className="text-blue-600 hover:text-blue-800 underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          jwks.json
        </a>
        <span className="text-gray-300">|</span>
        <PrintButton />
      </nav>

      <h1 className="mb-1 text-3xl font-bold tracking-tight">Verifier Guide</h1>
      <p className="mb-8 text-sm text-gray-500">
        Full reference for hospital credentialing reviewers. No jargon without explanation.
      </p>

      {/* Guide — always expanded on this page */}
      <VerifierOnboardingGuide collapsible={false} />

      {/* Offline note */}
      <div className="mt-10 rounded-lg border border-gray-200 bg-gray-50 px-5 py-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Offline Verification
        </h2>
        <p className="text-xs text-gray-600 leading-relaxed">
          T4 credentials can be verified offline. The public key set is available at{' '}
          <a
            href="/.well-known/jwks.json"
            className="font-mono text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            /.well-known/jwks.json
          </a>
          . Use any JWT library to validate the ES256 signature against the published{' '}
          <code className="font-mono text-[11px] bg-gray-100 px-1 py-0.5 rounded">kid</code>.
          No network call to VitalCV required.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Trust policy:{' '}
          <a
            href="/.well-known/trust.json"
            className="font-mono text-blue-600 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            /.well-known/trust.json
          </a>
        </p>
      </div>
    </main>
  );
}

// Client component for print button
function PrintButton() {
  return (
    <PrintButtonClient />
  );
}

// Separate client component since we need onClick in a Server Component page
import PrintButtonClient from './PrintButtonClient';
