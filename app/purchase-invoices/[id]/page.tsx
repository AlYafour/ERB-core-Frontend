'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';
import { accountingApi } from '@/lib/api/accounting';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { formatPrice, fmtDate } from '@/lib/utils/format';
import RejectionReasonDialog from '@/components/features/RejectionReasonDialog';
import { Button, PageShell } from '@/components/ui';
import DateInput from '@/components/ui/DateInput';
import { INVOICE_STATUS } from '@/lib/utils/status-colors';
import { INVOICE_LABEL } from '@/lib/constants/status-labels';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useProcPermissions } from '@/lib/hooks/use-proc-permissions';
import { ReadOnlyItemsTable } from '@/components/procurement/ReadOnlyItemsTable';
import { FinancialSummary } from '@/components/procurement/shared/FinancialSummary';
import { DocLoadState } from '@/components/procurement/shared/DocLoadState';
import { StickyDocBar } from '@/components/procurement/shared/StickyDocBar';
import { ProcField } from '@/components/procurement/shared/ProcField';

export default function PurchaseInvoiceDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { can } = useProcPermissions();

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentReference, setPaymentReference] = useState('');

  const canApprove  = can('purchase_invoice', 'approve');
  const canReject   = can('purchase_invoice', 'reject');
  const canMarkPaid = can('purchase_invoice', 'mark_paid');

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['purchase-invoices', id],
    queryFn: () => purchaseInvoicesApi.getById(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchase-invoices'] });
    queryClient.invalidateQueries({ queryKey: ['pending-count'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => purchaseInvoicesApi.approve(id),
    onSuccess: () => { invalidate(); toast('Invoice approved!', 'success'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to approve'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => purchaseInvoicesApi.reject(id, reason),
    onSuccess: () => { invalidate(); setRejectDialogOpen(false); toast('Invoice rejected', 'info'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to reject'), 'error'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (payload: { payment_date: string; payment_reference: string }) =>
      purchaseInvoicesApi.markPaid(id, payload),
    onSuccess: () => { invalidate(); setShowPayDialog(false); toast('Invoice marked as paid!', 'success'); },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to mark as paid'), 'error'),
  });

  if (isLoading) return <DocLoadState type="loading" />;
  if (!invoice)  return <DocLoadState type="not-found" message="Invoice not found." />;

  const isDraftOrPending = invoice.status === 'draft' || invoice.status === 'pending';


  const poRef = typeof invoice.purchase_order === 'object' && invoice.purchase_order
    ? { id: (invoice.purchase_order as { id: number; order_number?: string }).id, order_number: (invoice.purchase_order as { id: number; order_number?: string }).order_number }
    : invoice.purchase_order_id ? { id: invoice.purchase_order_id } : null;

  const chainNode = poRef ? (
    <>
      <Link href={`/purchase-orders/${poRef.id}`} className="proc-bar-chain-step">
        {poRef.order_number || `LPO-${poRef.id}`}
      </Link>
      <span className="proc-bar-chain-arrow">→</span>
      <span className="proc-bar-chain-current">{invoice.invoice_number}</span>
    </>
  ) : null;

  return (
    <MainLayout>
      <PageShell compact>

        {/* ── Sticky action bar with inline chain ── */}
        <StickyDocBar
          backHref="/purchase-invoices"
          docTypeLabel="Purchase Invoice"
          docNumber={invoice.invoice_number}
          statusVariant={INVOICE_STATUS[invoice.status] ?? 'info'}
          statusLabel={INVOICE_LABEL[invoice.status] || invoice.status}
          chain={chainNode}
        >
          <Link href={`/print/invoice/${invoice.id}`} target="_blank">
            <Button variant="secondary" size="sm">Print</Button>
          </Link>
          {canApprove && isDraftOrPending && (
            <Button variant="success" size="sm" isLoading={approveMutation.isPending} onClick={() => approveMutation.mutate()}>Approve</Button>
          )}
          {canReject && isDraftOrPending && (
            <Button variant="destructive" size="sm" onClick={() => setRejectDialogOpen(true)}>Reject</Button>
          )}
          {canMarkPaid && invoice.status === 'approved' && !invoice.is_fully_paid && (
            <Button variant="success" size="sm" onClick={() => setShowPayDialog(true)}>Mark as Paid</Button>
          )}
        </StickyDocBar>

        {/* ── Two-column: invoice info left / items + financial right ── */}
        <div className="proc-detail-split">

          {/* LEFT: Invoice information */}
          <div className="proc-detail-info">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">Invoice Information</h3>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{fmtDate(invoice.invoice_date)}</span>
              </div>
              <div className="proc-info-grid">
                <ProcField label="Invoice Number"   value={<span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{invoice.invoice_number}</span>} />
                <ProcField label="Invoice Date"     value={fmtDate(invoice.invoice_date)} />
                {invoice.due_date          && <ProcField label="Due Date"          value={fmtDate(invoice.due_date)} />}
                {invoice.approved_by_name  && <ProcField label="Approved By"       value={invoice.approved_by_name} />}
                {invoice.approved_at       && <ProcField label="Approved At"       value={fmtDate(invoice.approved_at)} />}
                {invoice.payment_date      && <ProcField label="Payment Date"      value={fmtDate(invoice.payment_date)} />}
                {invoice.payment_method    && <ProcField label="Payment Method"    value={invoice.payment_method} />}
                {invoice.payment_reference && <ProcField label="Payment Reference" value={<span style={{ fontFamily: 'monospace' }}>{invoice.payment_reference}</span>} />}
                {poRef && (
                  <ProcField label="Purchase Order" value={
                    <Link href={`/purchase-orders/${poRef.id}`} style={{ color: 'var(--brand)', fontWeight: 'var(--weight-semibold)', textDecoration: 'none' }}>
                      {poRef.order_number || `LPO-${poRef.id}`} ↗
                    </Link>
                  } />
                )}
                {invoice.notes && <ProcField label="Notes" value={invoice.notes} />}
              </div>
              {invoice.rejection_reason && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: 'var(--status-error-bg)', border: '1px solid var(--status-error-border)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--status-error)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rejection Reason</div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--status-error)', lineHeight: 1.5 }}>{invoice.rejection_reason}</div>
                </div>
              )}
            </div>

            <AccountingInfoCard invoiceId={invoice.id} canEdit={can('purchase_invoice', 'update')} />
          </div>

          {/* RIGHT: Items + Financial */}
          <div className="proc-detail-products">
            <div className="card">
              <div className="proc-section-head">
                <h3 className="proc-section-title">
                  Invoice Items
                  <span className="proc-section-count">{invoice.items.length}</span>
                </h3>
              </div>
              <ReadOnlyItemsTable
                items={invoice.items}
                columns={[
                  {
                    header: 'Product',
                    cell: (item) => (
                      <div>
                        <div className="cell-product-name">{item.product?.name || `Product #${item.product_id}`}</div>
                        {item.product?.code && <div className="cell-product-code">{item.product.code}</div>}
                      </div>
                    ),
                  },
                  { header: 'Unit',       align: 'center', cell: (item) => <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>{item.product?.unit?.toUpperCase() || '—'}</span> },
                  { header: 'Qty',        align: 'center', cell: (item) => <span style={{ fontWeight: 'var(--weight-semibold)' }}>{item.quantity}</span> },
                  { header: 'Unit Price', align: 'right',  cell: (item) => <span style={{ fontFamily: 'monospace' }}>{formatPrice(item.unit_price)}</span> },
                  { header: 'Disc %',     align: 'center', cell: (item) => item.discount ? <span style={{ color: 'var(--status-error)', fontWeight: 600 }}>{item.discount}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: 'Tax %',      align: 'center', cell: (item) => item.tax_rate ? <span style={{ color: 'var(--text-secondary)' }}>{item.tax_rate}%</span> : <span style={{ color: 'var(--text-tertiary)' }}>—</span> },
                  { header: 'Total',      align: 'right',  cell: (item) => <span className="col-total">{formatPrice(item.total ?? 0)}</span> },
                ]}
              />
              <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
                <FinancialSummary
                  rows={[
                    { label: 'Subtotal', value: invoice.subtotal, hidden: invoice.subtotal == null },
                    { label: `Discount (${invoice.discount}%)`, value: invoice.discount, hidden: !Number(invoice.discount), variant: 'discount', prefix: '– ' },
                    { label: 'Tax',      value: invoice.tax_amount, hidden: !Number(invoice.tax_amount) },
                  ]}
                  total={invoice.total}
                />
                {(invoice.paid_amount != null || invoice.remaining_amount != null) && (
                  <div className="proc-financial-grid" style={{ marginTop: 'var(--space-3)' }}>
                    <div className="proc-financial-box">
                      {invoice.paid_amount != null && (
                        <div className="proc-financial-row">
                          <span className="proc-financial-row-label">Paid</span>
                          <span style={{ fontWeight: 700, color: 'var(--status-success)', fontFamily: 'monospace' }}>{formatPrice(invoice.paid_amount)}</span>
                        </div>
                      )}
                      {invoice.remaining_amount != null && (
                        <div className="proc-financial-row">
                          <span className="proc-financial-row-label">Remaining</span>
                          <span style={{ fontWeight: 700, color: 'var(--brand)', fontFamily: 'monospace' }}>{formatPrice(invoice.remaining_amount)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {showPayDialog && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', padding: '24px', width: '100%', maxWidth: 420 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>Record Payment</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Payment Date</label>
                  <DateInput
                    value={paymentDate}
                    onChange={(v) => setPaymentDate(v)}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 'var(--text-sm)', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>Payment Reference</label>
                  <input
                    type="text"
                    value={paymentReference}
                    onChange={e => setPaymentReference(e.target.value)}
                    placeholder="Payment reference / cheque number"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 'var(--text-sm)', background: 'var(--surface)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                <Button variant="secondary" size="sm" onClick={() => setShowPayDialog(false)}>Cancel</Button>
                <Button
                  variant="success"
                  size="sm"
                  isLoading={markPaidMutation.isPending}
                  onClick={() => markPaidMutation.mutate({ payment_date: paymentDate, payment_reference: paymentReference })}
                >
                  Confirm Payment
                </Button>
              </div>
            </div>
          </div>
        )}

        <RejectionReasonDialog
          isOpen={rejectDialogOpen}
          onClose={() => setRejectDialogOpen(false)}
          onConfirm={(reason) => rejectMutation.mutate(reason)}
          title="Reject Invoice"
          message="Please provide a reason for rejecting this invoice."
        />
      </PageShell>
    </MainLayout>
  );
}

// ── Accounting Information (accounting-module integration) ───────────────────

function AccountingInfoCard({ invoiceId, canEdit }: { invoiceId: number; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const { data: preview } = useQuery({
    queryKey: ['pi-accounting-preview', invoiceId],
    queryFn: () => accountingApi.previewPurchaseInvoice(invoiceId),
    retry: false,
  });
  const { data: invoice } = useQuery({
    queryKey: ['purchase-invoice', invoiceId],
    queryFn: () => purchaseInvoicesApi.getById(invoiceId),
  });
  const { data: accountsData } = useQuery({
    queryKey: ['acc-postable-accounts-pi'],
    queryFn: () => accountingApi.listAccounts({ is_postable: true, is_active: true, page_size: 500 }),
    enabled: !!preview?.activated && canEdit,
  });
  const accounts = accountsData?.results ?? [];

  const save = useMutation({
    mutationFn: (payload: { expense_account?: number | null; payable_account?: number | null }) =>
      purchaseInvoicesApi.updateAccounts(invoiceId, payload),
    onSuccess: () => {
      toast('Accounting overrides saved.', 'success');
      queryClient.invalidateQueries({ queryKey: ['pi-accounting-preview', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-invoice', invoiceId] });
    },
    onError: (e) => toast(getApiError(e), 'error'),
  });

  if (!preview?.activated) return null;

  const SOURCE_LABEL: Record<string, string> = {
    invoice_override: 'Invoice override',
    item_inventory:   'Item default (inventory)',
    item_expense:     'Item default (expense)',
    supplier_master:  'Supplier master',
    mapping:          'Company default',
  };
  const SELECT: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1px solid var(--border)', fontSize: 'var(--text-sm)',
    background: 'var(--surface)', color: 'var(--text-primary)',
  };
  const TD: React.CSSProperties = {
    padding: '6px 8px', fontSize: 'var(--text-sm)',
    borderBottom: '1px solid var(--border-subtle)',
  };

  return (
    <div className="card" style={{ marginTop: 'var(--space-4)' }}>
      <div className="proc-section-head">
        <h3 className="proc-section-title">Accounting Information</h3>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
          Posting date = invoice date · AED
        </span>
      </div>

      {(preview.warnings?.length ?? 0) > 0 && (
        <div style={{ margin: '8px 0', padding: '8px 12px', borderRadius: 8,
                      background: 'var(--status-warning-bg, #fef3c7)',
                      fontSize: 'var(--text-xs)', color: 'var(--status-warning, #b45309)' }}>
          {preview.warnings.map((w: string, i: number) => <div key={i}>! {w}</div>)}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Account', 'Debit', 'Credit', 'Resolved from'].map(h => (
                <th key={h} style={{ ...TD, textAlign: 'left', color: 'var(--text-secondary)',
                                     fontSize: 'var(--text-xs)', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.lines.map((l: any, i: number) => (
              <tr key={i}>
                <td style={TD}>{l.account_code ? `${l.account_code} — ${l.account_name}` : '—'}</td>
                <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{l.debit ? formatPrice(l.debit) : ''}</td>
                <td style={{ ...TD, textAlign: 'right', fontFamily: 'monospace' }}>{l.credit ? formatPrice(l.credit) : ''}</td>
                <td style={{ ...TD, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{SOURCE_LABEL[l.source] ?? l.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
                            color: 'var(--text-secondary)', marginBottom: 4 }}>
              Debit override (whole invoice)
            </label>
            <select style={SELECT} value={(invoice as any)?.expense_account ?? ''}
                    onChange={e => save.mutate({ expense_account: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Automatic (item defaults)</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
                            color: 'var(--text-secondary)', marginBottom: 4 }}>
              Payable account override
            </label>
            <select style={SELECT} value={(invoice as any)?.payable_account ?? ''}
                    onChange={e => save.mutate({ payable_account: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Automatic (supplier / company AP)</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {(preview.journal_entries?.length ?? 0) > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-secondary)',
                        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Journal entries
          </div>
          {preview.journal_entries.map((je: any) => (
            <div key={je.id} style={{ display: 'flex', alignItems: 'center', gap: 10,
                                      fontSize: 'var(--text-sm)', padding: '4px 0' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{je.number || '(draft)'}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{je.event_code}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{je.status}</span>
              <Link href={`/accounting/journal?entry=${je.id}`}
                    style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
                Open journal
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

