'use client';

/**
 * HeroAppPreview — Sandbox Brutalist Design
 * Simple isometric preview with brutalist styling - no gradients, no glow
 */

import { Shield, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

// ── Mock data rows ────────────────────────────────────────────────────────

const MOCK_ROWS = [
  { name: 'Example Clinician A',    specialty: 'Cardiology',       score: 95, band: 'GREEN',  status: 'Issuer-confirmed' },
  { name: 'Example Clinician B',   specialty: 'Emergency Med.',   score: 88, band: 'GREEN',  status: 'Monitoring' },
  { name: 'Example Clinician C',    specialty: 'Internal Med.',    score: 80, band: 'YELLOW', status: 'Expiring' },
  { name: 'Example Clinician D',  specialty: 'Neurology',        score: 95, band: 'GREEN',  status: 'Issuer-confirmed' },
] as const;

const BAND_COLORS = {
  GREEN:  { bg: 'bg-[var(--vt-status-resolved)]/10', text: 'text-[var(--vt-status-resolved)]', ring: 'border-[var(--vt-status-resolved)]/40' },
  YELLOW: { bg: 'bg-[var(--vt-severity-high)]/10',   text: 'text-[var(--vt-severity-high)]',   ring: 'border-[var(--vt-severity-high)]/40'   },
  RED:    { bg: 'bg-[var(--vt-severity-critical)]/10',     text: 'text-[var(--vt-severity-critical)]',     ring: 'border-[var(--vt-severity-critical)]/40'     },
} as const;

// ── Component ─────────────────────────────────────────────────────────────

export function HeroAppPreview() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      {/* ── Outer chrome frame ────────────────────────── */}
      <div className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] overflow-hidden">

        {/* Window traffic-light bar */}
        <div className="flex items-center gap-2 border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--vt-text-muted)]" />
          <span className="ml-4 text-[10px] font-mono font-bold uppercase tracking-widest opacity-40 text-[var(--vt-text-primary)]">
            vitalcv.ai/verifier
          </span>
        </div>

        {/* ── App shell ──────────────────────────────── */}
        <div className="flex flex-col md:flex-row h-[400px]">

          {/* Sidebar */}
          <div className="hidden md:flex w-48 shrink-0 border-r border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-4 flex-col gap-1">
            <div className="mb-4 flex items-center gap-2 px-2">
              <Shield className="h-4 w-4 text-[var(--vt-status-resolved)]" />
              <span className="text-xs font-semibold text-[var(--vt-text-secondary)]">VitalCV</span>
            </div>
            {[
              { label: 'Verify Provider', active: true },
              { label: 'My Pipeline',     active: false },
              { label: 'Analytics',       active: false },
              { label: 'Audit Logs',      active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
                className={[
                  'flex items-center gap-2.5 rounded-sm px-3 py-2 text-xs',
                  active
                    ? 'bg-[var(--vt-status-resolved)]/10 text-[var(--vt-status-resolved)]'
                    : 'text-[var(--vt-text-muted)] hover:text-[var(--vt-text-secondary)]',
                ].join(' ')}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Main panel */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Header bar */}
            <div className="flex items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-3">
              <div>
                <p className="text-xs font-semibold text-[var(--vt-text-primary)]">Provider Verification</p>
                <p className="text-[10px] text-[var(--vt-text-muted)]">4 clinicians in queue</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-status-resolved)]/10 px-3 py-1.5">
                <CheckCircle2 className="h-3 w-3 text-[var(--vt-status-resolved)]" />
                <span className="text-[10px] font-medium text-[var(--vt-status-resolved)]">Live</span>
              </div>
            </div>

            {/* Table rows */}
            <div className="flex-1 overflow-hidden px-4 py-3 space-y-2">
              {MOCK_ROWS.map((row, i) => {
                const colors = BAND_COLORS[row.band];
                return (
                  <div
                    key={row.name}
                    className="flex items-center justify-between rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] px-4 py-2.5"
                  >
                    {/* Name + specialty */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-[var(--vt-text-primary)]">{row.name}</p>
                      <p className="text-[10px] text-[var(--vt-text-muted)]">{row.specialty}</p>
                    </div>

                    {/* CRS score mini ring */}
                    <div className="flex items-center gap-3">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-sm border ${colors.bg} ${colors.ring}`}>
                        <span className={`text-[10px] font-bold tabular-nums ${colors.text}`}>
                          {row.score}
                        </span>
                      </div>

                      {/* Status badge */}
                      <span className={`hidden rounded-sm border px-2.5 py-0.5 text-[10px] font-medium sm:inline-block ${colors.bg} ${colors.text} ${colors.ring}`}>
                        {row.status}
                      </span>

                      {/* Accept button */}
                      <div className="hidden rounded-sm border border-[var(--vt-border)] bg-[var(--vt-status-resolved)]/10 px-2.5 py-1 text-[10px] font-semibold text-[var(--vt-status-resolved)] lg:block">
                        Accept
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer stat bar */}
            <div className="flex items-center gap-6 border-t border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] px-5 py-2.5">
              {[
                { icon: CheckCircle2, label: '3 Issuer-confirmed', color: 'text-[var(--vt-status-resolved)]' },
                { icon: Clock,        label: '1 Expiring',   color: 'text-[var(--vt-severity-high)]'   },
                { icon: CheckCircle2, label: '↓ 88% faster', color: 'text-[var(--vt-text-muted)]'    },
              ].map(({ icon: Icon, label, color }) => (
                <div key={label} className={`flex items-center gap-1.5 text-[10px] font-medium ${color}`}>
                  <Icon className="h-3 w-3 shrink-0" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
