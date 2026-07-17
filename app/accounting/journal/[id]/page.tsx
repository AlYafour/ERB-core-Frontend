'use client';

/**
 * Journal entry detail — same shared editor as the create page:
 * read-only view for any status, in-place Edit for drafts,
 * Post / Reverse / Delete actions, attachments.
 */

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import JournalEntryEditor from '@/components/accounting/JournalEntryEditor';
import { accountingApi } from '@/lib/api/accounting';
import { getApiError } from '@/lib/utils/error';

export default function JournalEntryDetailPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'journal_entry', action: 'view' }}
                redirectTo="/accounting/journal">
      <JournalEntryDetailContent />
    </RouteGuard>
  );
}

function JournalEntryDetailContent() {
  const params = useParams();
  const id = String(params?.id ?? '');

  const { data: entry, isLoading, error } = useQuery({
    queryKey: ['acc-journal-one', id],
    queryFn: () => accountingApi.getJournal(id),
    enabled: !!id,
  });

  return (
    <MainLayout>
      <PageShell>
        {isLoading ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="animate-pulse" style={{ height: 32, width: 320, background: 'var(--bg-secondary)', borderRadius: 8 }} />
            <div className="animate-pulse" style={{ height: 220, background: 'var(--bg-secondary)', borderRadius: 8 }} />
          </div>
        ) : error || !entry ? (
          <p style={{ color: 'var(--status-error)' }}>
            {getApiError(error, 'Journal entry not found')}
          </p>
        ) : (
          <JournalEntryEditor key={entry.updated_at ?? entry.id} entry={entry} />
        )}
      </PageShell>
    </MainLayout>
  );
}
