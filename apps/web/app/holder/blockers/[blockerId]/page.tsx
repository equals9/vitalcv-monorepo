import type { Metadata } from 'next';
import ClinicianBlockerDetailSurface from '@/components/mobile/ClinicianBlockerDetailSurface';
import { evidenceUploadEnabled } from '@/lib/holder/evidenceUploadFlag';

export const metadata: Metadata = {
  title: 'Blocker',
  description: 'What is blocking you, why it matters, and the next step to clear it.',
};

// Detail page for a single readiness/application blocker. Holder home and the
// applications surface link here via "Resolve blocker" CTAs
// (lib/mobile/clinician-state.ts builds /holder/blockers/{encodeURIComponent(id)}).
// Blocker ids contain ':' separators, so the route param must be decoded before
// the surface looks it up in the shared ClinicianMobileProvider context; the
// surface calls notFound() when the id is unknown.
export default async function HolderBlockerDetailPage({
  params,
}: {
  params: Promise<{ blockerId: string }>;
}) {
  const { blockerId } = await params;
  // The surface is a client component; the upload switch is a runtime server
  // variable, so the decision is made here, per request, and passed down.
  return (
    <ClinicianBlockerDetailSurface
      blockerId={decodeURIComponent(blockerId)}
      evidenceUploadEnabled={evidenceUploadEnabled()}
    />
  );
}
