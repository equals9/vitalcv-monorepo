'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import {
  Building2,
  Database,
  FilePlus,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useState } from 'react';

import { BulkImportPanel } from './BulkImportPanel';
import { CredentialRegistry } from './CredentialRegistry';
import { IssueCredentialForm } from './IssueCredentialForm';
import { RevocationModal } from './RevocationModal';
import type {
  CredentialRecord,
  ImportRow,
  IssuancePayload,
} from './issuer-types';

/* ------------------------------------------------------------------ */
/*  Demo data                                                          */
/* ------------------------------------------------------------------ */

const DEMO_CREDENTIALS: CredentialRecord[] = [
  {
    id: 'cred-001',
    credentialType: 'STATE_LICENSE',
    subjectName: 'Example Clinician A',
    subjectNpi: '1234567890',
    status: 'ACTIVE',
    claimLevel: 'L3',
    issuedAt: '2024-03-15T00:00:00Z',
    expiresAt: '2026-03-15T00:00:00Z',
  },
  {
    id: 'cred-002',
    credentialType: 'BOARD_CERTIFICATION',
    subjectName: 'Example Clinician B',
    subjectNpi: '2345678901',
    status: 'ACTIVE',
    claimLevel: 'L2',
    issuedAt: '2024-01-10T00:00:00Z',
    expiresAt: '2027-01-10T00:00:00Z',
  },
  {
    id: 'cred-003',
    credentialType: 'DEA_REGISTRATION',
    subjectName: 'Example Clinician C',
    subjectNpi: '3456789012',
    status: 'EXPIRED',
    claimLevel: 'L3',
    issuedAt: '2022-06-01T00:00:00Z',
    expiresAt: '2024-06-01T00:00:00Z',
  },
  {
    id: 'cred-004',
    credentialType: 'STATE_LICENSE',
    subjectName: 'Example Clinician D',
    subjectNpi: '4567890123',
    status: 'REVOKED',
    claimLevel: 'L3',
    issuedAt: '2023-09-20T00:00:00Z',
    revokedAt: '2024-11-15T00:00:00Z',
    revocationReason: 'Disciplinary action',
  },
  {
    id: 'cred-005',
    credentialType: 'EDUCATION',
    subjectName: 'Example Clinician E',
    subjectNpi: '5678901234',
    status: 'PENDING',
    claimLevel: 'L0',
    issuedAt: '2025-01-05T00:00:00Z',
  },
  {
    id: 'cred-006',
    credentialType: 'MALPRACTICE_INSURANCE',
    subjectName: 'Example Clinician A',
    subjectNpi: '1234567890',
    status: 'ACTIVE',
    claimLevel: 'L2',
    issuedAt: '2024-08-01T00:00:00Z',
    expiresAt: '2025-08-01T00:00:00Z',
  },
];

/* ------------------------------------------------------------------ */
/*  Tab type                                                           */
/* ------------------------------------------------------------------ */

type IssuerTab = 'registry' | 'issue' | 'import';

const TABS: { key: IssuerTab; label: string; icon: React.ReactNode }[] = [
  { key: 'registry', label: 'Registry', icon: <Database className="h-4 w-4" /> },
  { key: 'issue', label: 'Issue', icon: <FilePlus className="h-4 w-4" /> },
  { key: 'import', label: 'Bulk Import', icon: <FileSpreadsheet className="h-4 w-4" /> },
];

/* ------------------------------------------------------------------ */
/*  IssuerPortal — orchestrator                                        */
/* ------------------------------------------------------------------ */

export function IssuerPortal() {
  const [activeTab, setActiveTab] = useState<IssuerTab>('registry');
  const [credentials, setCredentials] = useState<CredentialRecord[]>(DEMO_CREDENTIALS);
  const [issueLoading, setIssueLoading] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);

  /* Revocation modal */
  const [revokeTarget, setRevokeTarget] = useState<CredentialRecord | null>(null);

  /* ---- Handlers ---- */

  const handleIssue = useCallback(
    (payload: IssuancePayload) => {
      setIssueLoading(true);
      // Simulate network delay
      setTimeout(() => {
        const newCred: CredentialRecord = {
          id: `cred-${Date.now()}`,
          credentialType: payload.credentialType,
          subjectName: payload.subjectName,
          subjectNpi: payload.subjectNpi,
          status: 'ACTIVE',
          claimLevel: 'L1',
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
        };
        setCredentials((prev) => [newCred, ...prev]);
        setIssueLoading(false);
        setActiveTab('registry');
      }, 1200);
    },
    [],
  );

  const handleRevoke = useCallback(
    (credentialId: string, reason: string, _context: string) => {
      setRevokeLoading(true);
      setTimeout(() => {
        setCredentials((prev) =>
          prev.map((c) =>
            c.id === credentialId
              ? {
                  ...c,
                  status: 'REVOKED' as const,
                  revokedAt: new Date().toISOString(),
                  revocationReason: reason,
                }
              : c,
          ),
        );
        setRevokeLoading(false);
        setRevokeTarget(null);
      }, 1000);
    },
    [],
  );

  const handleImport = useCallback((file: File) => {
    setImporting(true);
    // Simulate CSV parsing + row-by-row processing
    const mockRows: ImportRow[] = [
      { rowNumber: 1, subjectNpi: '6789012345', credentialType: 'STATE_LICENSE', status: 'PENDING' },
      { rowNumber: 2, subjectNpi: '7890123456', credentialType: 'BOARD_CERTIFICATION', status: 'PENDING' },
      { rowNumber: 3, subjectNpi: '8901234567', credentialType: 'DEA_REGISTRATION', status: 'PENDING' },
      { rowNumber: 4, subjectNpi: 'INVALID', credentialType: 'STATE_LICENSE', status: 'PENDING' },
      { rowNumber: 5, subjectNpi: '9012345678', credentialType: 'EDUCATION', status: 'PENDING' },
    ];
    setImportRows(mockRows);

    // Simulate row-by-row processing
    mockRows.forEach((row, i) => {
      setTimeout(() => {
        setImportRows((prev) =>
          prev.map((r) =>
            r.rowNumber === row.rowNumber
              ? {
                  ...r,
                  status: row.subjectNpi === 'INVALID' ? ('ERROR' as const) : ('SUCCESS' as const),
                  error: row.subjectNpi === 'INVALID' ? 'Invalid NPI format' : undefined,
                }
              : r,
          ),
        );
        if (i === mockRows.length - 1) {
          setImporting(false);
        }
      }, 600 * (i + 1));
    });
  }, []);

  const handleManageStatus = useCallback((credential: CredentialRecord) => {
    setRevokeTarget(credential);
  }, []);

  /* ---- Stats ---- */

  const activeCount = credentials.filter((c) => c.status === 'ACTIVE').length;
  const revokedCount = credentials.filter((c) => c.status === 'REVOKED').length;
  const totalCount = credentials.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-[var(--glass-border)] bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20">
                <Building2 className="h-5 w-5 text-[var(--accent)]" />
              </div>
              <div>
                <h1 className="text-lg font-heading font-semibold">Issuer Portal</h1>
                <p className="text-xs text-muted-foreground">
                  Credential Issuance & Lifecycle Management
                </p>
              </div>
            </div>

            {/* Quick stats */}
            <div className="hidden sm:flex items-center gap-4">
              <StatPill label="Total" value={totalCount} />
              <StatPill label="Active" value={activeCount} color="text-[var(--trust-green)]" />
              <StatPill label="Revoked" value={revokedCount} color="text-destructive" />
            </div>
          </div>

          {/* Tab navigation */}
          <nav aria-label="Issuer portal sections" className="flex gap-1 mt-4 -mb-px">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-[var(--accent)] text-foreground bg-muted/20'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border/40'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Issuer identity anchor */}
        <GlassCard weight="light">
          <GlassCardContent className="py-3 px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--trust-green)]" />
              <span>
                Issuing as{' '}
                <span className="font-medium text-foreground">
                  Medical Board of California
                </span>{' '}
                —{' '}
                <span className="font-mono text-[10px]">
                  did:web:mbc.ca.gov
                </span>
              </span>
              <Badge
                variant="outline"
                className="text-[10px] text-[var(--trust-green)] border-[var(--trust-green)]/20 ml-auto"
              >
                DID Verified
              </Badge>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Tab content */}
        {activeTab === 'registry' && (
          <CredentialRegistry
            credentials={credentials}
            onManageStatus={handleManageStatus}
          />
        )}

        {activeTab === 'issue' && (
          <IssueCredentialForm onIssue={handleIssue} loading={issueLoading} />
        )}

        {activeTab === 'import' && (
          <BulkImportPanel
            onImport={handleImport}
            importing={importing}
            importRows={importRows}
          />
        )}
      </main>

      {/* Revocation modal */}
      <RevocationModal
        open={revokeTarget !== null}
        onClose={() => setRevokeTarget(null)}
        credential={revokeTarget}
        onRevoke={handleRevoke}
        loading={revokeLoading}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatPill — header metric                                           */
/* ------------------------------------------------------------------ */

function StatPill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-semibold ${color || 'text-foreground'}`}>
        {value}
      </span>
    </div>
  );
}
