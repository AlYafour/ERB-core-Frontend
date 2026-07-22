'use client';

/**
 * Journal Entries list. Creating, viewing and editing entries all happen on
 * the full-page QuickBooks-style editor (shared JournalEntryEditor):
 *   /accounting/journal/new    — create
 *   /accounting/journal/<id>   — view / edit / post / reverse
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, type JournalEntry, type JournalStatus } from '@/lib/api/accounting';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';

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

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Friendly names for where a system entry came from. */
const MODULE_LABEL: Record<string, string> = {
  expenses:          'Petty Cash',
  expenses_cashin:   'Cash In',
  expenses_history:  'Historical (cutover)',
  banking:           'Bank',
  purchase_invoices: 'Supplier Bill',
  subcontractors:    'Subcontractors',
  accounting:        'Opening / Closing',
};

const filterFields: FilterField[] = [
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: (Object.entries(STATUS_LABEL) as [JournalStatus, string][]).map(
      ([value, label]) => ({ value, label }),
    ),
  },
  {
    name: 'source_module', label: 'Source', type: 'select', group: 'Filters',
    options: Object.entries(MODULE_LABEL).map(([value, label]) => ({ value, label })),
  },
];

export default function JournalPage() {
  const tableState = useTableState();
  const { page, search, filters, ordering } = tableState;
  const queryClient = useQueryClient();
  const router = useRouter();

  // Deep link: /accounting/journal?entry=<id> → the entry's own page (used by
  // the Open-journal links on source documents like purchase invoices).
  const searchParams = useSearchParams();
  const deepLinkId = searchParams.get('entry');
  useEffect(() => {
    if (deepLinkId) router.replace(`/accounting/journal/${deepLinkId}`);
  }, [deepLinkId, router]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['acc-journal', page, search, filters, ordering],
    queryFn:  () => accountingApi.listJournal({
      page, search, ordering: ordering || undefined, ...filters,
    }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['acc-journal'] });
    queryClient.invalidateQueries({ queryKey: ['acc-journal-one'] });
  };

  const bulkPostMutation = useMutation({
    mutationFn: () => accountingApi.bulkPostJournals({ all_drafts: true }),
    onSuccess: (r) => {
      invalidate();
      let msg = `${r.posted} entries posted to the ledger`;
      if (r.skipped.length) msg += ` — ${r.skipped.length} skipped (source document deleted)`;
      if (r.errors.length) msg += ` — ${r.errors.length} failed`;
      toast(msg, r.errors.length ? 'error' : 'success');
    },
    onError: () => toast('Bulk posting failed', 'error'),
  });
  const handlePostAllDrafts = async () => {
    if (await confirm(
      'Post ALL draft entries to the general ledger? Posted entries are permanent and will appear in every financial report. Drafts whose source document was deleted are skipped automatically.')) {
      bulkPostMutation.mutate();
    }
  };

  const records    = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const columns: Column<JournalEntry>[] = [
    {
      key: 'number', header: 'Number', sortKey: 'number',
      render: r => <span className="font-mono font-medium">{r.number || '(draft)'}</span>,
    },
    {
      key: 'posting_date', header: 'Posting Date', sortKey: 'posting_date',
      render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtDate(r.posting_date)}</span>,
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
      key: 'source_module', header: 'Source',
      render: r => {
        const doc = r.source_doc;
        if (doc) {
          const href = doc.kind === 'expense' ? `/expenses/${doc.id}` : '/expenses/cash-boxes';
          return (
            <Link href={href} onClick={e => e.stopPropagation()}
              style={{ color: 'var(--brand)', fontWeight: 600, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
              {doc.label}{doc.ref ? <span className="font-mono" style={{ fontSize: 'var(--text-xs)', marginInlineStart: 6, color: 'var(--text-secondary)' }}>{doc.ref}</span> : null}
            </Link>
          );
        }
        return (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {MODULE_LABEL[r.source_module] ?? (r.source_module || 'Manual')}
          </span>
        );
      },
    },
    {
      key: 'created_at', header: 'Recorded', sortKey: 'created_at',
      render: r => <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{fmtDate(r.created_at)}</span>,
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
          { label: 'Open', onClick: () => router.push(`/accounting/journal/${r.id}`) },
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
      headerExtra={
        <Button variant="success" size="sm" onClick={handlePostAllDrafts}
                isLoading={bulkPostMutation.isPending}>
          ✓ Post all drafts
        </Button>
      }
      createAction={
        <Button variant="primary" size="sm" onClick={() => router.push('/accounting/journal/new')}>
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
      onRowClick={r => router.push(`/accounting/journal/${r.id}`)}
      searchPlaceholder="Search by number, memo or reference…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No journal entries found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    />
  );
}
