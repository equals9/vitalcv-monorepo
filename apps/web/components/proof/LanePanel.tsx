'use client';
/**
 * LanePanel — wave-133
 * Left pane: source lanes quick scan.
 * Right pane: deep inspection (claims, receipts, limitations).
 * Typography: monospace for IDs/timestamps, tabular for scores.
 */

import { useState } from 'react';
import { StatusBadge } from './TrustLabel';
import {
  STATUS_COLORS, STATUS_EXPLANATIONS, KNOWN_LANES,
  type LaneSnapshot, type SourceStatus,
} from './trust-types';

// ─── Split-Pane Layout ────────────────────────────────────────────

export function ProofSplitPane({
  lanes,
  npi,
  name,
  score,
  generatedAt,
  proofTier,
  limitations,
}: {
  lanes: LaneSnapshot[];
  npi: string;
  name: string;
  score: number | null;
  generatedAt: number;
  proofTier: 'none' | 'partial' | 'decision_grade';
  limitations: string[];
}) {
  const [selected, setSelected] = useState<string | null>(lanes[0]?.laneId ?? null);
  const selectedLane = lanes.find(l => l.laneId === selected);
  const selectedDef  = KNOWN_LANES.find(d => d.laneId === selected);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-0 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* LEFT: Quick Scan */}
      <div className="border-b lg:border-b-0 lg:border-r border-slate-200">
        {/* Identity Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
          <p className="font-bold text-slate-900 text-sm">{name}</p>
          <p className="font-mono text-xs text-slate-500 mt-0.5 tracking-wider">{npi}</p>
          {score !== null && (
            <p className="font-mono text-lg font-black text-slate-800 mt-1 tabular-nums">
              {score}<span className="text-xs font-normal text-slate-400 ml-0.5">% coverage</span>
            </p>
          )}
          {score === null && (
            <p className="text-xs text-slate-400 mt-1 italic">Score unavailable — waiting for verified sources</p>
          )}
        </div>

        {/* Lane List */}
        <nav aria-label="Source checks" className="divide-y divide-slate-100">
          {lanes.map(lane => {
            const def = KNOWN_LANES.find(d => d.laneId === lane.laneId);
            const colors = STATUS_COLORS[lane.status as SourceStatus] ?? STATUS_COLORS.not_checked;
            const isSelected = lane.laneId === selected;

            return (
              <button
                key={lane.laneId}
                onClick={() => setSelected(lane.laneId)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors ${isSelected ? 'bg-slate-50 border-l-2 border-slate-900' : ''}`}
              >
                <div>
                  <p className={`text-sm font-semibold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                    {def?.displayName ?? lane.laneId.replace(/_/g, ' ')}
                  </p>
                  {def?.isRequired && (
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">Required</p>
                  )}
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100">
          <p className="font-mono text-[10px] text-slate-400">
            {new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>

      {/* RIGHT: Deep Inspection */}
      <div className="p-6 overflow-auto">
        {selectedLane && selectedDef ? (
          <LaneDetail lane={selectedLane} def={selectedDef} limitations={limitations} />
        ) : (
          <div className="text-slate-400 text-sm">Select a source lane to inspect.</div>
        )}
      </div>
    </div>
  );
}

// ─── Lane Detail Panel ────────────────────────────────────────────

function LaneDetail({
  lane,
  def,
  limitations,
}: {
  lane: LaneSnapshot;
  def: typeof KNOWN_LANES[0];
  limitations: string[];
}) {
  const status = lane.status as SourceStatus;
  const colors = STATUS_COLORS[status] ?? STATUS_COLORS.not_checked;
  const explanation = STATUS_EXPLANATIONS[status];
  const isSystemState = ['unavailable', 'access_required', 'not_checked', 'in_progress'].includes(status);

  return (
    <div className="space-y-6">
      {/* Lane Header */}
      <div>
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">{def.displayName}</h3>
            <p className="text-sm text-slate-500 mt-0.5">Source: {def.source}</p>
          </div>
          <StatusBadge status={status} />
        </div>
        <div className={`rounded-lg px-4 py-3 border text-sm ${colors.bg} ${colors.border} ${colors.text}`}>
          {explanation}
          {isSystemState && (
            <p className="text-xs mt-1.5 opacity-75 font-medium">
              This is a system state — not a reflection of this clinician's credentials.
            </p>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Details</h4>
        <MetaRow label="Lane ID"       value={lane.laneId}    mono />
        <MetaRow label="Freshness"     value={def.freshnessWindowLabel} />
        {lane.checkedAt && (
          <MetaRow
            label="Checked at"
            value={new Date(lane.checkedAt).toLocaleString()}
            mono
          />
        )}
        {lane.value && (
          <MetaRow label="Value"       value={lane.value} />
        )}
        {lane.receiptId && (
          <MetaRow label="Receipt ID"  value={lane.receiptId} mono />
        )}
      </div>

      {/* Receipt / Proof */}
      {lane.receiptId ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Receipt</h4>
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 font-mono text-xs text-slate-600 space-y-1">
            <div className="flex justify-between"><span>receipt_id</span><span className="text-slate-400">{lane.receiptId.slice(0, 16)}…</span></div>
            <div className="flex justify-between"><span>source</span><span className="text-slate-400">{def.source}</span></div>
            {lane.checkedAt && <div className="flex justify-between"><span>checked_at</span><span className="text-slate-400">{lane.checkedAt}</span></div>}
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
          No receipt for this lane — it has not been verified in this session.
        </div>
      )}

      {/* Relevant limitations */}
      {limitations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Limitations</h4>
          <ul className="space-y-1">
            {limitations.map((lim, i) => (
              <li key={i} className="text-xs text-slate-500 flex gap-2">
                <span className="flex-shrink-0 text-slate-300">·</span>
                {lim}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className={`text-slate-700 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}
