'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, type JournalEntry, type JournalStatus, type GLAccount } from '@/lib/api/accounting';
import { toast, confirm } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { BaseModal } from '@/components/ui/base/BaseModal';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';
import { getApiError } from '@/lib/utils/error';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_VARIANT: Record<JournalStatus, 'success' | 'info' | 'default' | 'warning' | 'error'> = {
  draft:          'default',
  pending_review: 'warning',
  approved:       'info',
  posted:         'success',
  reversed:       'error',
  cancelled:      'default',
};

const STATUS_LABEL: Record<JournalStatus, string> = {
  draft:          'Draft',
  pending_review: 'Pending Review',
  approved:       'Approved',
  posted:         'Posted',
  reversed:       'Reversed',
  cancelled:      'Cancelled',
};

const fmt = (v: string | number) =>
  Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().slice(0, 10);

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: (Object.entries(STATUS_LABEL) as [JournalStatus, string][]).map(
      ([value, label]) => ({ value, label }),
    ),
  },
];

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 4,
};

const TH: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  padding: '6px 8px',
  fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-subtle)',
  verticalAlign: 'top',
};

// ── Detail modal ──────────────────────────────────────────────────────────────

function JournalDetailModal({
  entryId, initial, onClose, onChanged,
}: {
  entryId: string;
  initial: JournalEntry;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [showReverse, setShowReverse]   = useState(false);
  const [reverseReason, setReverseReason] = useState('');

  const { data } = useQuery({
    queryKey: ['acc-journal-detail', entryId],
    queryFn:  () => accountingApi.getJournal(entryId),
    placeholderData: initial,
  });
  const entry = data ?? initial;

  const postMutation = useMutation({
    mutationFn: () => accountingApi.postJournal(entry.id),
    onSuccess:  () => { toast(`Entry ${entry.number} posted`, 'success'); onChanged(); onClose(); },
    onError:    (err: unknown) => toast(getApiError(err, 'Failed to post entry'), 'error'),
  });

  const reverseMutation = useMutation({
    mutationFn: () => accountingApi.reverseJournal(entry.id, reverseReason.trim()),
    onSuccess:  () => { toast(`Entry ${entry.number} reversed`, 'success'); onChanged(); onClose(); },
    onError:    (err: unknown) => toast(getApiError(err, 'Failed to reverse entry'), 'error'),
  });

  const handlePost = async () => {
    if (await confirm('Post this entry to the general ledger? Posted entries are immutable.')) {
      postMutation.mutate();
    }
  };

  const handleReverse = () => {
    if (!reverseReason.trim()) { toast('A reversal reason is required', 'error'); return; }
    reverseMutation.mutate();
  };

  const headerRows: [string, string][] = [
    ['Number',       entry.number],
    ['Status',       STATUS_LABEL[entry.status] ?? entry.status],
    ['Entry Date',   entry.entry_date],
    ['Posting Date', entry.posting_date],
    ['Memo',         entry.memo || '—'],
    ['Reference',    entry.reference || '—'],
    ['Source',       entry.source_module ? `${entry.source_module}${entry.event_code ? ` · ${entry.event_code}` : ''}` : (entry.event_code || '—')],
    ['Created By',   entry.created_by_name || '—'],
    ['Posted By',    entry.posted_by_name || '—'],
  ];
  if (entry.reversal_of_number) headerRows.push(['Reversal Of', entry.reversal_of_number]);

  return (
    <BaseModal
      isOpen onClose={onClose}
      title={`Journal Entry ${entry.number}`} size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {entry.status === 'draft' && (
            <Button variant="primary" onClick={handlePost} isLoading={postMutation.isPending}>
              Post
            </Button>
          )}
          {entry.status === 'posted' && !showReverse && (
            <Button variant="secondary" onClick={() => setShowReverse(true)}>
              Reverse
            </Button>
          )}
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        {/* Header info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px var(--space-4)' }}>
          {headerRows.map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
              <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
                {label === 'Status'
                  ? <Badge variant={STATUS_VARIANT[entry.status] ?? 'default'}>{value}</Badge>
                  : value}
              </span>
            </div>
          ))}
        </div>

        {/* Lines */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>#</th>
                <th style={TH}>Account</th>
                <th style={TH}>Description</th>
                <th style={{ ...TH, textAlign: 'right' }}>Debit</th>
                <th style={{ ...TH, textAlign: 'right' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines ?? []).map((ln, i) => (
                <tr key={ln.id ?? i}>
                  <td style={{ ...TD, color: 'var(--text-tertiary)' }}>{ln.line_no ?? i + 1}</td>
                  <td style={TD}>
                    <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginRight: 6 }}>
                      {ln.account_code}
                    </span>
                    {ln.account_name}
                  </td>
                  <td style={{ ...TD, color: 'var(--text-secondary)' }}>{ln.description || '—'}</td>
                  <td style={{ ...TD, textAlign: 'right' }} className="font-mono">
                    {Number(ln.debit) !== 0 ? fmt(ln.debit) : ''}
                  </td>
                  <td style={{ ...TD, textAlign: 'right' }} className="font-mono">
                    {Number(ln.credit) !== 0 ? fmt(ln.credit) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ ...TD, borderBottom: 'none' }} colSpan={3}>
                  <strong>Totals</strong>
                </td>
                <td style={{ ...TD, borderBottom: 'none', textAlign: 'right' }} className="font-mono">
                  <strong>{fmt(entry.total_debit)}</strong>
                </td>
                <td style={{ ...TD, borderBottom: 'none', textAlign: 'right' }} className="font-mono">
                  <strong>{fmt(entry.total_credit)}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Reverse reason */}
        {showReverse && entry.status === 'posted' && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
            <label style={LABEL}>Reversal Reason <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                value={reverseReason}
                onChange={e => setReverseReason(e.target.value)}
                placeholder="e.g. Duplicate entry, wrong account…"
                style={{ ...INPUT, flex: 1 }}
              />
              <Button
                variant="primary" size="sm"
                onClick={handleReverse}
                isLoading={reverseMutation.isPending}
                disabled={!reverseReason.trim()}
              >
                Confirm Reversal
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setShowReverse(false); setReverseReason(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

      </div>
    </BaseModal>
  );
}

// ── New entry modal ───────────────────────────────────────────────────────────

interface DraftLine {
  account:     number | null;
  description: string;
  debit:       string;
  credit:      string;
}

const EMPTY_LINE: DraftLine = { account: null, description: '', debit: '', credit: '' };

function NewJournalModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [entryDate,   setEntryDate]   = useState(today());
  const [postingDate, setPostingDate] = useState(today());
  const [memo,        setMemo]        = useState('');
  const [reference,   setReference]   = useState('');
  const [lines,       setLines]       = useState<DraftLine[]>([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);

  useEffect(() => {
    if (isOpen) {
      setEntryDate(today());
      setPostingDate(today());
      setMemo('');
      setReference('');
      setLines([{ ...EMPTY_LINE }, { ...EMPTY_LINE }]);
    }
  }, [isOpen]);

  const { data: accData, isLoading: accLoading } = useQuery({
    queryKey: ['acc-postable-accounts'],
    queryFn:  () => accountingApi.listAccounts({ page_size: 500, is_postable: true, is_active: true }),
    enabled:  isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const accountOptions = useMemo(() =>
    (accData?.results ?? []).map((a: GLAccount) => ({
      value:      a.id,
      label:      `${a.code} — ${a.name}`,
      searchText: `${a.code} ${a.name} ${a.name_ar}`,
    })),
    [accData?.results],
  );

  const totals = useMemo(() => {
    const debit  = lines.reduce((s, l) => s + (parseFloat(l.debit)  || 0), 0);
    const credit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
  }, [lines]);

  const setLine = (idx: number, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const removeLine = (idx: number) =>
    setLines(prev => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));

  const createMutation = useMutation({
    mutationFn: () => accountingApi.createJournal({
      entry_date:   entryDate,
      posting_date: postingDate,
      memo,
      reference,
      lines: lines.map(l => ({
        account:     l.account!,
        description: l.description,
        debit:       (parseFloat(l.debit)  || 0).toFixed(2),
        credit:      (parseFloat(l.credit) || 0).toFixed(2),
      })),
    }),
    onSuccess: (created) => { toast(`Journal entry ${created.number} created`, 'success'); onSuccess(); onClose(); },
    onError:   (err: unknown) => toast(getApiError(err, 'Failed to create journal entry'), 'error'),
  });

  const handleSubmit = () => {
    if (!entryDate || !postingDate)          { toast('Entry date and posting date are required', 'error'); return; }
    if (lines.some(l => !l.account))         { toast('Every line must have an account', 'error'); return; }
    if (lines.some(l => (parseFloat(l.debit) || 0) === 0 && (parseFloat(l.credit) || 0) === 0)) {
      toast('Every line needs a debit or credit amount', 'error'); return;
    }
    if (lines.some(l => (parseFloat(l.debit) || 0) > 0 && (parseFloat(l.credit) || 0) > 0)) {
      toast('A line cannot have both debit and credit', 'error'); return;
    }
    if (!totals.balanced)                    { toast('Entry is not balanced — total debits must equal total credits', 'error'); return; }
    createMutation.mutate();
  };

  return (
    <BaseModal
      isOpen={isOpen} onClose={onClose}
      title="New Journal Entry" size="lg"
      closeOnOverlayClick={false}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={createMutation.isPending}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} isLoading={createMutation.isPending} disabled={!totals.balanced}>
            Save Draft
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={LABEL}>Entry Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Posting Date <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input type="date" value={postingDate} onChange={e => setPostingDate(e.target.value)} style={INPUT} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div>
            <label style={LABEL}>Memo</label>
            <input value={memo} onChange={e => setMemo(e.target.value)} placeholder="What is this entry for?" style={INPUT} />
          </div>
          <div>
            <label style={LABEL}>Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. INV-2026-014" style={INPUT} />
          </div>
        </div>

        {/* Lines editor */}
        <div>
          <label style={LABEL}>Lines <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 220 }}>Account</th>
                  <th style={{ ...TH, minWidth: 140 }}>Description</th>
                  <th style={{ ...TH, width: 120, textAlign: 'right' }}>Debit</th>
                  <th style={{ ...TH, width: 120, textAlign: 'right' }}>Credit</th>
                  <th style={{ ...TH, width: 36 }} />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx}>
                    <td style={TD}>
                      <SearchableDropdown
                        options={accountOptions}
                        value={line.account}
                        onChange={v => setLine(idx, { account: v as number | null })}
                        placeholder={accLoading ? 'Loading…' : 'Select account…'}
                        searchPlaceholder="Search code or name…"
                        emptyMessage="No accounts found"
                        allowClear
                      />
                    </td>
                    <td style={TD}>
                      <input
                        value={line.description}
                        onChange={e => setLine(idx, { description: e.target.value })}
                        placeholder="Optional"
                        style={INPUT}
                      />
                    </td>
                    <td style={TD}>
                      <input
                        type="number" min="0" step="0.01"
                        value={line.debit}
                        onChange={e => setLine(idx, { debit: e.target.value, credit: e.target.value ? '' : line.credit })}
                        style={{ ...INPUT, textAlign: 'right' }}
                      />
                    </td>
                    <td style={TD}>
                      <input
                        type="number" min="0" step="0.01"
                        value={line.credit}
                        onChange={e => setLine(idx, { credit: e.target.value, debit: e.target.value ? '' : line.debit })}
                        style={{ ...INPUT, textAlign: 'right' }}
                      />
                    </td>
                    <td style={{ ...TD, textAlign: 'center' }}>
                      <button
                        onClick={() => removeLine(idx)}
                        disabled={lines.length <= 2}
                        aria-label={`Remove line ${idx + 1}`}
                        style={{
                          background: 'none', border: 'none', cursor: lines.length > 2 ? 'pointer' : 'not-allowed',
                          color: lines.length > 2 ? 'var(--color-error)' : 'var(--text-tertiary)',
                          fontSize: 'var(--text-md)', lineHeight: 1, padding: 4,
                        }}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-2)', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button variant="ghost" size="sm" onClick={() => setLines(prev => [...prev, { ...EMPTY_LINE }])}>
              + Add line
            </Button>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
              <span>
                <span style={{ color: 'var(--text-secondary)' }}>Σ Debit </span>
                <strong className="font-mono">{fmt(totals.debit)}</strong>
              </span>
              <span>
                <span style={{ color: 'var(--text-secondary)' }}>Σ Credit </span>
                <strong className="font-mono">{fmt(totals.credit)}</strong>
              </span>
              <Badge variant={totals.balanced ? 'success' : 'warning'}>
                {totals.balanced ? 'Balanced' : `Off by ${fmt(Math.abs(totals.debit - totals.credit))}`}
              </Badge>
            </div>
          </div>
        </div>

      </div>
    </BaseModal>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AccountingJournalPage() {
  const tableState = useTableState();
  const { page, search, filters, ordering } = tableState;
  const queryClient = useQueryClient();

  const [showNew,     setShowNew]     = useState(false);
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null);

  // Deep link: /accounting/journal?entry=<id> opens that entry (used by the
  // Open-journal links on source documents like purchase invoices).
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('entry');
  const { data: deepLinkEntry } = useQuery({
    queryKey: ['acc-journal-deeplink', deepLinkId],
    queryFn: () => accountingApi.getJournal(deepLinkId as string),
    enabled: !!deepLinkId,
  });
  useEffect(() => {
    if (deepLinkEntry) setDetailEntry(deepLinkEntry);
  }, [deepLinkEntry]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['acc-journal', page, search, filters, ordering],
    queryFn:  () => accountingApi.listJournal({
      page, search, ordering: ordering || undefined, ...filters,
    }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['acc-journal'] });
    queryClient.invalidateQueries({ queryKey: ['acc-journal-detail'] });
  };

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<JournalEntry>[] = [
    {
      key: 'number', header: 'Number', sortKey: 'number',
      render: r => <span className="font-mono font-medium">{r.number}</span>,
    },
    {
      key: 'posting_date', header: 'Posting Date', sortKey: 'posting_date',
      render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{r.posting_date}</span>,
    },
    {
      key: 'memo', header: 'Memo',
      render: r => (
        <span style={{
          display: 'inline-block', maxWidth: 260, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontSize: 'var(--text-sm)', verticalAlign: 'bottom',
        }} title={r.memo}>
          {r.memo || '—'}
        </span>
      ),
    },
    {
      key: 'event_code', header: 'Event',
      render: r => (
        <span className="font-mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {r.event_code || '—'}
        </span>
      ),
    },
    {
      key: 'source_module', header: 'Source',
      render: r => (
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          {r.source_module || 'Manual'}
        </span>
      ),
    },
    {
      key: 'total_debit', header: 'Amount', sortKey: 'total_debit',
      render: r => <span className="font-mono">{fmt(r.total_debit)}</span>,
    },
    {
      key: 'status', header: 'Status',
      render: r => (
        <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>
          {STATUS_LABEL[r.status] ?? r.status}
        </Badge>
      ),
    },
    {
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          { label: 'View', onClick: () => setDetailEntry(r) },
        ]} />
      ),
    },
  ];

  return (
    <AppListPage
      title="Journal Entries"
      description="General ledger journal — manual entries and automated postings."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Accounting' }, { label: 'Journal Entries' }]}
      totalCount={totalCount}
      createAction={
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
          + New Entry
        </Button>
      }
      statusItems={[
        { value: '',         label: 'All' },
        { value: 'draft',    label: 'Draft' },
        { value: 'posted',   label: 'Posted' },
        { value: 'reversed', label: 'Reversed' },
      ]}
      filterFields={filterFields}
      onRowClick={r => setDetailEntry(r)}
      searchPlaceholder="Search by number, memo or reference…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No journal entries found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      <NewJournalModal
        isOpen={showNew}
        onClose={() => setShowNew(false)}
        onSuccess={invalidate}
      />
      {detailEntry && (
        <JournalDetailModal
          entryId={detailEntry.id}
          initial={detailEntry}
          onClose={() => setDetailEntry(null)}
          onChanged={invalidate}
        />
      )}
    </AppListPage>
  );
}
