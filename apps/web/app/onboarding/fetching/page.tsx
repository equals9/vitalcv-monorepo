'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

import { ResolverProgressIndicator } from '@/components/onboarding/ResolverProgressIndicator';
import { ObaRoot, ObaStage } from '@/components/onboarding/ActivationScene';

/**
 * /onboarding/fetching — the hand-off beat between NPI entry and the profile
 * review step. Kicks off the background credential ingest and paces the
 * transition forward.
 *
 * REGISTER (design-only, 2026-08-16): recomposed into the Direction A `.oba`
 * island. The previous treatment was authored for a dark surface
 * (`text-white` on white/10 panels) while the route-group layout painted
 * light paper — white-on-white copy in production. The register pass renders
 * ink on warm paper, the NPI as a mono machine fact, and the paced resolver
 * rows in the island grammar. Every redirect, storage read, ingest POST, and
 * error path is unchanged.
 */

function readStoredNpi(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem('onboarding_npi') ?? window.localStorage.getItem('onboarding_npi') ?? '';
}

function formatNpi(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function buildOnboardingHref(path: string, returnTo: string | null): string {
  if (!returnTo || !returnTo.startsWith('/')) {
    return path;
  }

  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

function OnboardingFetchingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const [npi, setNpi] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const storedNpi = readStoredNpi();

    if (!/^\d{10}$/.test(storedNpi)) {
      router.replace(buildOnboardingHref('/onboarding', returnTo));
      return;
    }

    setNpi(storedNpi);

    void fetch('/api/credentials/ingest-npi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npi: storedNpi }),
    }).catch(() => {
      setError('That is taking longer than expected. Your next step stays ready.');
    });
  }, [returnTo, router]);

  const nextHref = React.useMemo(
    () => buildOnboardingHref('/onboarding/identity', returnTo),
    [returnTo],
  );

  return (
    <ObaRoot>
      <main className="oba-step-wrap flex min-h-[100dvh] flex-col justify-center">
        <ObaStage>
          <p className="oba-k">Reading your public record</p>

          <h1 className="oba-h1 mt-4">Bringing your record forward</h1>
          <div className="oba-rule" aria-hidden="true" />
          <p className="oba-lede mt-4">
            VitalCV is reading the public registry record for your NPI. Your next
            step opens on its own.
          </p>

          {npi ? (
            <p className="oba-data mt-5">NPI {formatNpi(npi)}</p>
          ) : null}

          <div className="mt-8">
            <ResolverProgressIndicator
              durationPerStep={540}
              onComplete={() => {
                router.replace(nextHref);
              }}
            />
          </div>

          {error ? (
            <p role="alert" className="oba-err mt-5">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-4">
            <Link href={buildOnboardingHref('/onboarding', returnTo)} className="oba-quiet">
              Back
            </Link>
            <button
              type="button"
              onClick={() => router.replace(nextHref)}
              className="oba-ghost"
            >
              Continue
            </button>
          </div>
        </ObaStage>
      </main>
    </ObaRoot>
  );
}

export default function OnboardingFetchingPage() {
  return (
    <React.Suspense fallback={null}>
      <OnboardingFetchingContent />
    </React.Suspense>
  );
}
