'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { goodsReceivingApi } from '@/lib/api/goods-receiving';
import { PurchaseOrder, Supplier } from '@/types';
import MainLayout from '@/components/layout/MainLayout';
import Link from 'next/link';
import { canCreateInvoice } from '@/lib/utils/workflow-guards';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { useAuth } from '@/lib/hooks/use-auth';
import { usePermissions } from '@/lib/hooks/use-permissions';
import { Button, Badge, PageShell, PageHeader } from '@/components/ui';
import { GRN_STATUS } from '@/lib/utils/status-colors';

const QUALITY_COLOR: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  good: 'success', damaged: 'warning', defective: 'error', missing: 'info',
};
const QUALITY_LABEL: Record<string, string> = {
  good: 'Good', damaged: 'Damaged', defective: 'Defective', missing: 'Missing',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', partial: 'Partial', completed: 'Completed', cancelled: 'Cancelled',
};

const lbl = {
  fontSize: 'var(--text-xs)', fontWeight: 600, letterSpacing: '.5px',
  textTransform: 'uppercase' as const, color: 'var(--text-secondary)', marginBottom: 4,
};
const val = { fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 500 };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={lbl}>{label}</div>
      <div style={val}>{children}</div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '.8px',
      textTransform: 'uppercase', color: 'var(--text-secondary)',
      borderBottom: '1.5px solid var(--border)', paddingBottom: 8, marginBottom: 16,
    }}>{children}</div>
  );
}

export default function GRNDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();

  const isSuperuser      = user?.is_superuser ?? false;
  const isAdmin          = user?.role === 'admin' || isSuperuser;
  const canMarkInvoice   = isAdmin || (user?.role === 'procurement_officer' && (hasPermission('goods_receiving', 'update') ?? false));
  const canCreateInvoicePerm = isAdmin || ((hasPermission('purchase_invoice', 'create') ?? false) && user?.role !== 'site_engineer');

  const { data: grn, isLoading } = useQuery({
    queryKey: ['goods-receiving', id],
    queryFn: () => goodsReceivingApi.getById(id),
  });

  const markInvoiceDeliveredMutation = useMutation({
    mutationFn: () => goodsReceivingApi.markInvoiceDelivered(id),
    onSuccess: () => {
      toast('Invoice marked as delivered to office', 'success');
      queryClient.invalidateQueries({ queryKey: ['goods-receiving', id] });
    },
    onError: (e: any) => toast(getApiError(e, 'Failed to mark invoice as delivered'), 'error'),
  });

  if (isLoading) return (
    <MainLayout>
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>
    </MainLayout>
  );

  if (!grn) return (
    <MainLayout>
      <div className="card empty-state">
        <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>GRN not found.</p>
        <Button variant="primary" onClick={() => router.push('/goods-receiving')}>Back to GRNs</Button>
      </div>
    </MainLayout>
  );

  const po       = typeof grn.purchase_order === 'object' && grn.purchase_order ? grn.purchase_order as PurchaseOrder : null;
  const supplier = po && typeof po.supplier === 'object' && po.supplier ? po.supplier as Supplier : null;

  const totalOrdered  = grn.items.reduce((s, i) => s + Number(i.ordered_quantity  ?? 0), 0);
  const totalReceived = grn.items.reduce((s, i) => s + Number(i.received_quantity  ?? 0), 0);
  const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejected_quantity  ?? 0), 0);

  return (
    <MainLayout>
      <PageShell>

        {/* ── Header ── */}
        <PageHeader
          backHref="/goods-receiving"
          breadcrumbs={[{ label: 'Goods Receiving', href: '/goods-receiving' }, { label: `GRN ${grn.grn_number}` }]}
          title={`GRN ${grn.grn_number}`}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Badge variant={GRN_STATUS[grn.status] ?? 'info'}>{STATUS_LABEL[grn.status] || grn.status}</Badge>
              <Button variant="secondary" onClick={() => window.open(`/print/grn/${id}`, '_blank')}>🖨 Print GRN</Button>
            </div>
          }
        />

        {/* ── Top: Overview + Supplier ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>

          {/* Overview */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <SectionHeading>Receipt Overview</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              <Field label="GRN Number">
                <span className="font-mono font-semibold">{grn.grn_number}</span>
              </Field>
              <Field label="Receipt Date">
                {new Date(grn.receipt_date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Field>
              <Field label="Received By">{grn.received_by_name || '—'}</Field>
              <Field label="Status">
                <Badge variant={GRN_STATUS[grn.status] ?? 'info'}>{STATUS_LABEL[grn.status] || grn.status}</Badge>
              </Field>
              <Field label="Invoice Delivery">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge variant={grn.invoice_delivery_status === 'delivered' ? 'success' : 'warning'}>
                    {grn.invoice_delivery_status === 'delivered' ? 'Delivered' : 'Not Delivered'}
                  </Badge>
                  {grn.invoice_delivery_status === 'not_delivered' && canMarkInvoice && (
                    <button
                      onClick={() => markInvoiceDeliveredMutation.mutate()}
                      disabled={markInvoiceDeliveredMutation.isPending}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 20,
                        border: '1.5px solid var(--color-success)', color: 'var(--color-success)',
                        background: 'transparent', cursor: 'pointer',
                      }}
                    >
                      {markInvoiceDeliveredMutation.isPending ? '…' : 'Mark Delivered'}
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Created At">
                {new Date(grn.created_at).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Field>
            </div>
          </div>

          {/* Linked PO + Supplier */}
          <div className="card" style={{ padding: '20px 24px' }}>
            <SectionHeading>Purchase Order</SectionHeading>
            {po ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={lbl}>LPO Reference</div>
                    <Link href={`/purchase-orders/${po.id}`}
                      style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-brand)', fontFamily: 'monospace' }}>
                      {po.order_number}
                    </Link>
                  </div>
                  {po.payment_terms && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={lbl}>Payment Terms</div>
                      <div style={{ ...val, fontSize: 'var(--text-xs)' }}>{po.payment_terms}</div>
                    </div>
                  )}
                </div>
                {(po.project_name || (po as any).pr_created_by_name) && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {po.project_name && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--text-primary)', borderRadius: '0 6px 6px 0',
                        padding: '4px 10px', fontSize: 12,
                      }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11 }}>Project</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{po.project_name}</span>
                        {po.project_code && (
                          <span style={{
                            background: 'var(--text-primary)', color: '#fff',
                            borderRadius: 3, padding: '0 5px', fontSize: 10, fontWeight: 700,
                          }}>{po.project_code}</span>
                        )}
                      </div>
                    )}
                    {(po as any).pr_created_by_name && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'var(--surface-subtle)', border: '1px solid var(--border)',
                        borderLeft: '3px solid var(--text-secondary)', borderRadius: '0 6px 6px 0',
                        padding: '4px 10px', fontSize: 12,
                      }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11 }}>Engineer</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(po as any).pr_created_by_name}</span>
                      </div>
                    )}
                  </div>
                )}
                {supplier && (
                  <div>
                    <div style={lbl}>Supplier</div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {supplier.business_name || supplier.name}
                    </div>
                    {supplier.phone && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Tel: {supplier.phone}</div>}
                    {(supplier.city || supplier.country) && (
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{[supplier.city, supplier.country].filter(Boolean).join(', ')}</div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No purchase order linked.</div>
            )}
          </div>
        </div>

        {/* ── Notes ── */}
        {grn.notes && (
          <div className="card" style={{
            padding: '12px 20px',
            borderLeft: '3px solid var(--border)',
            background: 'var(--surface-subtle)',
          }}>
            <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>NOTES</span>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{grn.notes}</span>
          </div>
        )}

        {/* ── Material Images + Invoice ── */}
        {((grn.material_images && grn.material_images.length > 0) || grn.supplier_invoice_file_url) && (
          <div className="card" style={{ padding: '20px 24px' }}>
            <SectionHeading>Attachments</SectionHeading>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)' }}>
              {/* Material Photos */}
              <div>
                <div style={{ ...lbl, marginBottom: 10 }}>Material Photos</div>
                {grn.material_images && grn.material_images.length > 0 ? (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {grn.material_images.map((img: any, idx: number) => (
                      <img key={img.id ?? idx} src={img.image_url || img.image}
                        alt={`Material ${idx + 1}`}
                        onClick={() => window.open(img.image_url || img.image, '_blank')}
                        style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6,
                          border: '1px solid var(--border)', cursor: 'pointer' }} />
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No photos uploaded.</div>
                )}
              </div>
              {/* Supplier Invoice */}
              <div>
                <div style={{ ...lbl, marginBottom: 10 }}>Supplier Invoice</div>
                {grn.supplier_invoice_file_url ? (
                  grn.supplier_invoice_file_url.endsWith('.pdf') ? (
                    <a href={grn.supplier_invoice_file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="secondary">View PDF</Button>
                    </a>
                  ) : (
                    <img src={grn.supplier_invoice_file_url} alt="Supplier Invoice"
                      onClick={() => window.open(grn.supplier_invoice_file_url!, '_blank')}
                      style={{ maxWidth: 200, maxHeight: 200, objectFit: 'contain', borderRadius: 6,
                        border: '1px solid var(--border)', cursor: 'pointer' }} />
                  )
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>No invoice uploaded.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Items Table ── */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <SectionHeading>Received Items</SectionHeading>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr>
                  <th style={{ width: 28, textAlign: 'center' }}>#</th>
                  <th>Product</th>
                  <th style={{ width: 60, textAlign: 'center' }}>Unit</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Ordered</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Received</th>
                  <th style={{ width: 90, textAlign: 'right' }}>Rejected</th>
                  <th style={{ width: 110, textAlign: 'center' }}>Quality</th>
                </tr>
              </thead>
              <tbody>
                {grn.items.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 24 }}>No items.</td></tr>
                ) : grn.items.map((item, idx) => (
                  <tr key={item.id ?? idx}>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.product?.name || 'N/A'}</div>
                      {item.product?.code && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.product.code}</div>}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{item.product?.unit?.toUpperCase() || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(item.ordered_quantity).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>
                      {Number(item.received_quantity).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'right', color: Number(item.rejected_quantity) > 0 ? 'var(--color-error)' : 'var(--text-secondary)' }}>
                      {Number(item.rejected_quantity).toFixed(2)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge variant={QUALITY_COLOR[item.quality_status] ?? 'info'}>
                        {QUALITY_LABEL[item.quality_status] || item.quality_status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary row */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 'var(--space-3)', marginTop: 16,
            padding: '14px 0 0', borderTop: '1px solid var(--border)',
          }}>
            {[
              { label: 'Total Items',        value: grn.total_items ?? grn.items.length,  color: 'var(--text-primary)' },
              { label: 'Total Ordered',      value: totalOrdered.toFixed(2),              color: 'var(--text-secondary)' },
              { label: 'Total Received',     value: totalReceived.toFixed(2),             color: 'var(--color-success)' },
              { label: 'Total Rejected',     value: totalRejected.toFixed(2),             color: totalRejected > 0 ? 'var(--color-error)' : 'var(--text-secondary)' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ ...lbl, marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Actions ── */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', paddingBottom: 'var(--space-6)' }}>
          {grn.invoices && grn.invoices.length > 0 ? (
            <Link href={`/purchase-invoices/${grn.invoices[0].id}`}>
              <Button variant="primary">View Invoice</Button>
            </Link>
          ) : (
            po && po.status === 'approved' && canCreateInvoicePerm && (
              <Button
                variant="primary"
                onClick={async () => {
                  const guard = canCreateInvoice(po.status);
                  if (!guard.canProceed) { toast(guard.reason || 'Cannot create invoice', 'error'); return; }
                  if (guard.warning && !await confirm(guard.warning + '\n\nDo you want to continue?')) return;
                  router.push(`/purchase-invoices/new?purchase_order_id=${po.id}&grn_id=${id}`);
                }}
              >
                Create Invoice
              </Button>
            )
          )}
        </div>

      </PageShell>
    </MainLayout>
  );
}
