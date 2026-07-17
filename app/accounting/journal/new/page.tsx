'use client';

/**
 * New journal entry — thin wrapper around the shared JournalEntryEditor
 * (one component drives create, view and edit so the three flows can
 * never drift apart).
 */

import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import JournalEntryEditor from '@/components/accounting/JournalEntryEditor';

export default function NewJournalEntryPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'journal_entry', action: 'create' }}
                redirectTo="/accounting/journal">
      <MainLayout>
        <PageShell>
          <JournalEntryEditor />
        </PageShell>
      </MainLayout>
    </RouteGuard>
  );
}
