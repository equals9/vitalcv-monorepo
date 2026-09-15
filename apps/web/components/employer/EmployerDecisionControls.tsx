'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HireToStartCase } from '@/lib/applications/hireToStart';

type DecisionAction = 'accept' | 'request_info' | 'reject';

export function EmployerDecisionControls({ data }: { data: HireToStartCase }) {
  const router = useRouter();
  const [busy, setBusy] = useState<DecisionAction | null>(null);
  const [message, setMessage] = useState('');
  const [field, setField] = useState('application');
  const [intendedStartDate, setIntendedStartDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sealed = data.submission.mode === 'sealed' ? data.submission.submittedPacket : null;
  const canAccept = Boolean(sealed && sealed.lifecycle === 'active' && data.packetBinding.integrity === 'valid');
  const decisionClosed = data.decision?.state === 'accepted_as_head_start' || data.decision?.state === 'not_proceeding';

  async function decide(action: DecisionAction) {
    if (action === 'request_info' && (!field.trim() || !message.trim())) {
      setError('Name the field and clarification needed.');
      return;
    }
    if (action === 'reject' && !window.confirm('Record that this application will not proceed?')) return;
    if (action === 'accept' && !window.confirm('Accept this exact packet as a head start? Institution review still remains.')) return;

    setBusy(action);
    setError(null);
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(data.application.id)}/workflow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ...(action === 'accept' ? {
            packetVersion: sealed?.packetVersion,
            packetHash: sealed?.packetHash,
            intendedStartDate: intendedStartDate ? new Date(`${intendedStartDate}T12:00:00.000Z`).toISOString() : null,
          } : {}),
          ...(action === 'request_info' ? { requests: [{ field: field.trim(), message: message.trim() }] } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error ?? payload.message ?? 'The decision could not be recorded.');
      setMessage('');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The decision could not be recorded.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="employer-decision-title" className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 text-white sm:p-6">
      <h2 id="employer-decision-title" className="text-xl font-semibold">Employer decision</h2>
      <p className="mt-2 text-sm leading-6 text-white/65">
        Act on the exact packet shown above. Acceptance opens the remaining work as a head start; credentialing and privileging authority remain with the institution.
      </p>

      {decisionClosed ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80">
          {data.decision?.state === 'accepted_as_head_start'
            ? 'This exact packet was accepted as a head start. Work the remaining items in the joined case.'
            : 'The employer recorded that this application will not proceed.'}
        </p>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="clarification-field" className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Clarification field</label>
              <Input id="clarification-field" value={field} onChange={(event) => setField(event.target.value)} className="mt-2 border-white/15 bg-black/20 text-white" />
            </div>
            <div>
              <label htmlFor="intended-start" className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Intended start (optional)</label>
              <Input id="intended-start" type="date" value={intendedStartDate} onChange={(event) => setIntendedStartDate(event.target.value)} className="mt-2 border-white/15 bg-black/20 text-white" />
            </div>
          </div>
          <div>
            <label htmlFor="clarification-message" className="text-xs font-semibold uppercase tracking-[0.12em] text-white/55">Clarification needed</label>
            <textarea
              id="clarification-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-2 min-h-24 w-full rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-emerald-400"
              placeholder="Describe the exact information needed from the clinician."
            />
          </div>
          {error ? <p role="alert" className="text-sm text-rose-200">{error}</p> : null}
          {!canAccept ? (
            <p className="text-xs leading-5 text-amber-200">Head-start acceptance is unavailable because an active, integrity-valid exact packet is not bound to this application.</p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={busy !== null} variant="outline" onClick={() => void decide('request_info')} className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white">
              {busy === 'request_info' ? 'Recording…' : 'Request clarification'}
            </Button>
            <Button type="button" disabled={busy !== null || !canAccept} onClick={() => void decide('accept')} className="bg-[var(--vt-action-primary-inverse-bg-rest)] text-[var(--vt-action-primary-inverse-fg-rest)] hover:bg-[var(--vt-action-primary-inverse-bg-hover)] hover:text-[var(--vt-action-primary-inverse-fg-hover)] focus-visible:bg-[var(--vt-action-primary-inverse-bg-focus)] focus-visible:text-[var(--vt-action-primary-inverse-fg-focus)] active:bg-[var(--vt-action-primary-inverse-bg-press)] active:text-[var(--vt-action-primary-inverse-fg-press)] disabled:bg-[var(--vt-action-primary-inverse-bg-disabled)] disabled:text-[var(--vt-action-primary-inverse-fg-disabled)]">
              {busy === 'accept' ? 'Recording…' : 'Accept as a head start'}
            </Button>
            <Button type="button" disabled={busy !== null} variant="ghost" onClick={() => void decide('reject')} className="text-rose-200 hover:bg-rose-500/10 hover:text-rose-100">
              {busy === 'reject' ? 'Recording…' : 'Do not proceed'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
