'use client';

/**
 * Expense voucher — redesigned as a financial DOCUMENT, not a field dump:
 *  · hero: the money (gross large, VAT + net beneath) with status & dates
 *  · Classification: each tier of the cost-code tree on its OWN labeled row
 *    (Cost Type → Main Category → Sub Category → Cost Code → Project/Office)
 *  · Payment: who was paid, invoice details, description
 *  · sidebar: approval trail, accounting links, receipts, record info
 */

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, Button, Badge, PageHeader } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import { expensesApi, type ExpenseStatus } from '@/lib/api/expenses';
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
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const ROW_LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
  color: 'var(--text-muted)', flex: '0 0 150px', paddingTop: 2,
};
const SECTION_TITLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'var(--brand)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
};

/** One labeled row — label column left, roomy value right, hairline below. */
function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex', gap: 16, alignItems: 'flex-start', padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
    }}>
      <span style={ROW_LABEL}>{label}</span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {children ?? <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
      </span>
    </div>
  );
}

/** A code tier: monospace code chip + full description, never truncated. */
function CodeValue({ code, desc }: { code: string; desc?: string | null }) {
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
      <span style={{
        fontFamily: 'monospace', fontWeight: 700, fontSize: 13,
        background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
        borderRadius: 6, padding: '2px 8px', whiteSpace: 'nowrap',
      }}>{code}</span>
      {desc ? <span style={{ color: 'var(--text-secondary)' }}>{desc}</span> : null}
    </span>
  );
}

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

  // The code chain, split into NAMED tiers — never one crammed breadcrumb.
  const path = exp.cost_code_path ?? [];
  const tiers: Array<{ label: string; code: string; desc: string }> = [];
  if (path.length >= 1) tiers.push({ label: 'Main Category', code: path[0].code, desc: path[0].description });
  if (path.length === 3) tiers.push({ label: 'Sub Category', code: path[1].code, desc: path[1].description });
  if (path.length >= 2) tiers.push({ label: 'Cost Code', code: path[path.length - 1].code, desc: path[path.length - 1].description });
  if (path.length === 1) tiers[0].label = 'Cost Code';
  if (!path.length && exp.cost_code_code) tiers.push({ label: 'Cost Code', code: exp.cost_code_code, desc: exp.cost_code_desc || '' });

  const paidTo = exp.supplier_name || exp.payee_worker_name || exp.payee_name || exp.vehicle_label;
  const gross = Number(exp.amount || 0);
  const vat = Number(exp.vat_amount || 0);
  const net = Number(exp.net_amount || 0);

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={exp.voucher_number || exp.number}
          description={`Petty-cash voucher · ${exp.number}`}
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Petty Cash & Expenses', href: '/expenses' }, { label: exp.voucher_number || exp.number }]}
          backHref="/expenses"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {isDraft && canEdit && <Button variant="edit" size="sm" onClick={() => router.push(`/expenses/${id}/edit`)}>Edit</Button>}
              {isDraft && canEdit && <Button variant="secondary" size="sm" onClick={() => submitM.mutate()} isLoading={submitM.isPending}>Submit</Button>}
              {s === 'submitted' && canApprove && <Button variant="success" size="sm" onClick={() => approveM.mutate()} isLoading={approveM.isPending}>Approve</Button>}
              {s === 'submitted' && canApprove && <Button variant="destructive" size="sm" onClick={handleReject} isLoading={rejectM.isPending}>Reject</Button>}
              {isDraft && canEdit && <Button variant="destructive" size="sm" onClick={handleDelete} isLoading={deleteM.isPending}>Delete</Button>}
            </div>
          }
        />

        {exp.rejection_reason && (
          <div style={{ marginBottom: 'var(--space-4)', padding: '12px 16px', borderRadius: 10, background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)', borderInlineStart: '4px solid var(--status-error)' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--status-error)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejected</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)' }}>{exp.rejection_reason || 'No reason recorded.'}</div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: 'var(--space-4)', alignItems: 'start' }}>

          {/* ── Main column ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>

            {/* Hero — the money */}
            <div className="card" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                    Amount Paid (Gross)
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1.1, color: 'var(--text-primary)' }}>
                    {formatPrice(gross)}
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 'var(--text-sm)' }}>
                    {exp.vat_liable ? (
                      <>
                        <span style={{ color: 'var(--text-secondary)' }}>VAT 5%: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatPrice(vat)}</span></span>
                        <span style={{ color: 'var(--text-secondary)' }}>Net to expense: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatPrice(net)}</span></span>
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>Not VAT liable — full amount to expense</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <Badge variant={STATUS_VARIANT[s] ?? 'default'}>{STATUS_LABEL[s] ?? s}</Badge>
                  <div style={{ textAlign: 'end', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>Voucher date:</span> <strong>{fmtDate(exp.expense_date)}</strong></div>
                    <div style={{ marginTop: 2 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cash box:</span>{' '}
                      {exp.cash_box ? (
                        <Link href={`/expenses/cash-boxes/${exp.cash_box}`} style={{ color: 'var(--brand)', fontWeight: 700, textDecoration: 'none' }}>
                          {exp.cash_box_name}
                        </Link>
                      ) : <strong>{exp.cash_box_name || '—'}</strong>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Classification — every tier on its own row */}
            <div className="card" style={{ padding: '18px 24px' }}>
              <div style={SECTION_TITLE}>Classification</div>
              <Row label="Cost Type">{exp.cost_type_label}</Row>
              {tiers.map(t => (
                <Row key={t.label + t.code} label={t.label}>
                  <CodeValue code={t.code} desc={t.desc} />
                </Row>
              ))}
              {(exp as any).overhead_category_label
                ? <Row label="Office / Location" last>{(exp as any).overhead_category_label}</Row>
                : <Row label="Project" last>{exp.project_name}</Row>}
            </div>

            {/* Payment details */}
            <div className="card" style={{ padding: '18px 24px' }}>
              <div style={SECTION_TITLE}>Payment</div>
              <Row label="Paid To">
                {paidTo ? (
                  <span style={{ fontWeight: 600 }}>
                    {paidTo}
                    {exp.supplier_name ? <span style={{ marginInlineStart: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>(supplier)</span>
                      : exp.payee_worker_name ? <span style={{ marginInlineStart: 8, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>(box worker)</span>
                      : null}
                  </span>
                ) : null}
              </Row>
              {exp.vehicle_label && <Row label="Vehicle">{exp.vehicle_label}</Row>}
              <Row label="Invoice No.">{exp.invoice_no ? <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{exp.invoice_no}</span> : null}</Row>
              <Row label="Invoice Date">{exp.invoice_date ? fmtDate(exp.invoice_date) : null}</Row>
              <Row label="Description" last>{exp.description}</Row>
            </div>
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', minWidth: 0 }}>

            {(exp as any).approval_status && (
              <ApprovalStatusWidget approvalStatus={(exp as any).approval_status} />
            )}

            {/* Accounting */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={SECTION_TITLE}>Accounting</div>
              {exp.journal_entry ? (
                <Link href={`/accounting/journal/${exp.journal_entry.id}`}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand)' }}>
                    {exp.journal_entry.number || 'Draft entry'}
                  </span>
                  <Badge variant={exp.journal_entry.status === 'posted' ? 'success' : 'default'}>
                    {exp.journal_entry.status}
                  </Badge>
                </Link>
              ) : (
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)', margin: 0 }}>
                  Journal entry is created automatically when the voucher is approved.
                </p>
              )}
            </div>

            {/* Receipts */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={SECTION_TITLE}>Receipts {exp.attachments?.length ? `(${exp.attachments.length})` : ''}</div>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                minHeight: 48, padding: '10px', cursor: 'pointer',
                border: '1.5px dashed var(--border-default)', borderRadius: 10,
                color: 'var(--brand)', fontSize: 'var(--text-sm)', fontWeight: 700,
              }}>
                📎 Add receipt
                <input type="file" multiple hidden onChange={e => {
                  const chosen = Array.from(e.target.files ?? []).filter(f => f.size <= 20 * 1024 * 1024);
                  uploadReceipt(chosen); e.target.value = '';
                }} />
              </label>
              {exp.attachments && exp.attachments.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, fontSize: 'var(--text-sm)' }}>
                  {exp.attachments.map(a => (
                    <li key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                      {a.url ? <a href={a.url} target="_blank" rel="noreferrer" style={{ color: 'var(--brand)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none', fontWeight: 600 }}>{a.name}</a> : <span>{a.name}</span>}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{(a.size / 1024).toFixed(0)} KB</span>
                        <button onClick={async () => { if (await confirm(`Remove "${a.name}"?`)) { try { await expensesApi.deleteAttachment(id, a.id); invalidate(); } catch (err) { toast(getApiError(err, 'Delete failed'), 'error'); } } }}
                                style={{ background: 'none', border: 'none', color: 'var(--status-error)', cursor: 'pointer', fontSize: 14 }}>×</button>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: '8px 0 0' }}>No receipts attached yet.</p>}
            </div>

            {/* Record info */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={SECTION_TITLE}>Record</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>System no.:</span> <span style={{ fontFamily: 'monospace' }}>{exp.number}</span></div>
                <div><span style={{ color: 'var(--text-muted)' }}>Entered by:</span> {exp.created_by_name || '—'}</div>
                <div><span style={{ color: 'var(--text-muted)' }}>Entered on:</span> {fmtDate(exp.created_at)}</div>
                {exp.approved_at && <div><span style={{ color: 'var(--text-muted)' }}>Approved on:</span> {fmtDate(exp.approved_at)}</div>}
              </div>
            </div>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
