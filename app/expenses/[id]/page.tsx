'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import { ProcField } from '@/components/procurement/shared/ProcField';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi, type Expense, type ExpenseStatus } from '@/lib/api/expenses';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { formatPrice } from '@/lib/utils/format';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { ApprovalStatusWidget } from '@/components/ui/ApprovalStatusWidget';

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', accounting_approved: 'Accounting Approved',
  approved: 'Approved', posted: 'Posted', rejected: 'Rejected', cancelled: 'Cancelled',
};
const STATUS_VARIANT: Record<ExpenseStatus, 'default' | 'warning' | 'info' | 'success' | 'error'> = {
  draft: 'default', submitted: 'warning', accounting_approved: 'info',
  approved: 'success', posted: 'success', rejected: 'error', cancelled: 'default',
};
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export default function ExpenseDetailPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'expense', action: 'view' }} redirectTo="/expenses">
      <ExpenseDetailContent />
    </RouteGuard>
  );
}

function ExpenseDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const { hasPermission } = usePermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const canApprove = isAdmin || (hasPermission('expense', 'approve') ?? false);
  const canEdit = isAdmin || (hasPermission('expense', 'update') ?? false);

  const { data: exp, isLoading, error } = useQuery({
    queryKey: ['expense', id],
    queryFn: () => expensesApi.getById(id),
    enabled: !!id,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['expense', id] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  };
  const submitM = useMutation({
    mutationFn: () => expensesApi.submit(id),
    onSuccess: () => { invalidate(); toast('Submitted for approval', 'success'); },
    onError: (err) => toast(getApiError(err, 'Action failed'), 'error'),
  });
  const approveM = useMutation({
    mutationFn: () => expensesApi.approve(id),
    onSuccess: () => { invalidate(); toast('Approved — journal entry created', 'success'); },
    onError: (err) => toast(getApiError(err, 'Action failed'), 'error'),
  });
  const rejectM  = useMutation({
    mutationFn: (reason: string) => expensesApi.reject(id, reason),
    onSuccess: () => { invalidate(); toast('Rejected', 'success'); },
    onError: (err) => toast(getApiError(err, 'Reject failed'), 'error'),
  });
  const deleteM = useMutation({
    mutationFn: () => expensesApi.remove(id),
    onSuccess: () => { toast('Deleted', 'success'); router.push('/expenses'); },
    onError: (err) => toast(getApiError(err, 'Delete failed'), 'error'),
  });

  const uploadReceipt = async (files: File[]) => {
    for (const f of files) {
      try { await expensesApi.uploadAttachment(id, f); }
      catch (err) { toast(getApiError(err, `Upload failed: ${f.name}`), 'error'); }
    }
    invalidate();
  };
  const handleReject = async () => {
    if (await confirm('Reject this expense?')) rejectM.mutate('');
  };
  const handleDelete = async () => {
    if (await confirm('Delete this voucher permanently?')) deleteM.mutate();
  };

  if (isLoading) {
    return <MainLayout><PageShell><div className="animate-pulse" style={{ height: 300, background: 'var(--bg-secondary)', borderRadius: 8 }} /></PageShell></MainLayout>;
  }
  if (error || !exp) {
    return <MainLayout><PageShell><PageHeader title="Expense not found" breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: 'Not found' }]} backHref="/expenses" /></PageShell></MainLayout>;
  }

  const s = exp.status;
  const isDraft = s === 'draft' || s === 'rejected';

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={exp.voucher_number || exp.number}
          description={`Expense ${exp.number}`}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: exp.voucher_number || exp.number }]}
          backHref="/expenses"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Badge variant={STATUS_VARIANT[s] ?? 'default'}>{STATUS_LABEL[s] ?? s}</Badge>
              {isDraft && canEdit && <Button variant="edit" size="sm" onClick={() => router.push(`/expenses/${id}/edit`)}>Edit</Button>}
              {isDraft && canEdit && <Button variant="secondary" size="sm" onClick={() => submitM.mutate()} isLoading={submitM.isPending}>Submit</Button>}
              {s === 'submitted' && canApprove && <Button variant="success" size="sm" onClick={() => approveM.mutate()} isLoading={approveM.isPending}>Approve</Button>}
              {s === 'submitted' && canApprove && <Button variant="destructive" size="sm" onClick={handleReject} isLoading={rejectM.isPending}>Reject</Button>}
              {isDraft && canEdit && <Button variant="destructive" size="sm" onClick={handleDelete} isLoading={deleteM.isPending}>Delete</Button>}
            </div>
          }
        />

        {(exp as any).approval_status && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <ApprovalStatusWidget approvalStatus={(exp as any).approval_status} />
          </div>
        )}

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Details</h3></div>
          <div className="proc-info-grid">
            <ProcField label="Voucher Number" value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{exp.voucher_number || '—'}</span>} />
            <ProcField label="System No." value={<span style={{ fontFamily: 'monospace' }}>{exp.number}</span>} />
            <ProcField label="Date" value={fmtDate(exp.expense_date)} />
            <ProcField label="Cash Box" value={exp.cash_box_name} />
            <ProcField label="Cost Type" value={exp.cost_type_label} />
            {(exp as any).overhead_category_label
              ? <ProcField label="Office / Location" value={(exp as any).overhead_category_label} />
              : <ProcField label="Project" value={exp.project_name} />}
            <ProcField label="Cost Code" value={exp.cost_code_path?.length ? (
              <span style={{ display: 'inline-flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 4 }}>
                {exp.cost_code_path.map((seg, i) => {
                  const isLeaf = i === exp.cost_code_path!.length - 1;
                  return (
                    <span key={seg.code} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
                      {i > 0 && <span style={{ color: 'var(--text-tertiary)' }}>›</span>}
                      <span style={{
                        fontFamily: 'monospace', fontWeight: isLeaf ? 700 : 500,
                        color: isLeaf ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}>{seg.code}</span>
                      <span style={{
                        fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                      }}>{seg.description.slice(0, isLeaf ? 40 : 24)}</span>
                    </span>
                  );
                })}
              </span>
            ) : exp.cost_code_code ? (
              <span><span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{exp.cost_code_code}</span>{exp.cost_code_desc ? <span style={{ color: 'var(--text-secondary)', marginInlineStart: 6, fontSize: 'var(--text-xs)' }}>{exp.cost_code_desc.slice(0, 40)}</span> : null}</span>
            ) : undefined} />
            <ProcField label="Supplier" value={exp.supplier_name} />
            <ProcField label="Vehicle" value={exp.vehicle_label} />
            <ProcField label="Payee" value={exp.payee_name} />
            <ProcField label="Invoice No." value={exp.invoice_no ? <span style={{ fontFamily: 'monospace' }}>{exp.invoice_no}</span> : undefined} />
            <ProcField label="Invoice Date" value={exp.invoice_date ? fmtDate(exp.invoice_date) : undefined} />
            <ProcField label="Description" value={exp.description} />
            {exp.journal_entry && (
              <ProcField label="Journal Entry" value={
                <Link href={`/accounting/journal/${exp.journal_entry.id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                  {exp.journal_entry.number || 'Draft'} ({exp.journal_entry.status}) ↗
                </Link>
              } />
            )}
          </div>
          {exp.rejection_reason && (
            <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)' }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--status-error)', textTransform: 'uppercase', marginBottom: 4 }}>Rejection Reason</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>{exp.rejection_reason}</div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="proc-section-head"><h3 className="proc-section-title">Amount</h3></div>
          <div className="proc-info-grid">
            <ProcField label="Gross" value={<span className="font-semibold">{formatPrice(Number(exp.amount || 0))}</span>} />
            <ProcField label="VAT" value={exp.vat_liable ? formatPrice(Number(exp.vat_amount || 0)) : 'Not VAT liable'} />
            <ProcField label="Net (to expense)" value={formatPrice(Number(exp.net_amount || 0))} />
          </div>
        </div>

        <div className="card">
          <div className="proc-section-head"><h3 className="proc-section-title">Receipts</h3></div>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 4, minHeight: 64, padding: 'var(--space-3)', cursor: 'pointer',
            border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)',
            color: 'var(--text-secondary)', fontSize: 'var(--text-sm)',
          }}>
            <span style={{ color: 'var(--brand, #b8860b)', fontWeight: 600 }}>Add receipt</span>
            <input type="file" multiple hidden onChange={e => {
              const chosen = Array.from(e.target.files ?? []).filter(f => f.size <= 20 * 1024 * 1024);
              uploadReceipt(chosen); e.target.value = '';
            }} />
          </label>
          {exp.attachments && exp.attachments.length > 0 ? (
            <ul style={{ listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, fontSize: 'var(--text-sm)' }}>
              {exp.attachments.map(a => (
                <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  {a.url ? <a href={a.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand, #b8860b)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</a> : <span>{a.name}</span>}
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{(a.size / 1024).toFixed(0)} KB</span>
                    <button onClick={async () => { if (await confirm(`Remove "${a.name}"?`)) { try { await expensesApi.deleteAttachment(id, a.id); invalidate(); } catch (err) { toast(getApiError(err, 'Delete failed'), 'error'); } } }}
                            style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer' }}>×</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', marginTop: 8 }}>No receipts attached.</p>}
        </div>
      </PageShell>
    </MainLayout>
  );
}
