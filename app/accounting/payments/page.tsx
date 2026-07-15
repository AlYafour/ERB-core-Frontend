'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountingApi, type AccPayment, type PaymentAllocation } from '@/lib/api/accounting';
import { toast, confirm } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { getApiError } from '@/lib/utils/error';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INPUT: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
};
const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', display: 'block', marginBottom: 4,
};

const STATUS_VARIANT: Record<string, 'success' | 'default' | 'error'> = {
  confirmed: 'success', draft: 'default', cancelled: 'error',
};

const filterFields: FilterField[] = [
  {
    name: 'direction', label: 'Direction', type: 'select', group: 'Filters',
    options: [{ value: 'out', label: 'Payments (out)' }, { value: 'in', label: 'Receipts (in)' }],
  },
  {
    name: 'status', label: 'Status', type: 'select', group: 'Filters',
    options: ['draft', 'confirmed', 'cancelled'].map((s) => ({ value: s, label: s })),
  },
];

type Form = {
  direction: 'in' | 'out'; method: string; payment_date: string;
  amount: string; funds_account: string; partner_type: string;
  partner_id: string; partner_name: string; reference: string; notes: string;
  allocations: PaymentAllocation[];
};

const EMPTY: Form = {
  direction: 'out', method: 'bank',
  payment_date: new Date().toISOString().slice(0, 10),
  amount: '', funds_account: '', partner_type: 'supplier',
  partner_id: '', partner_name: '', reference: '', notes: '',
  allocations: [],
};

export default function AccountingPaymentsPage() {
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const [form, setForm] = useState<Form | null>(null);
  const [detail, setDetail] = useState<AccPayment | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['acc-payments', tableState.page, tableState.search, tableState.filters],
    queryFn: () => accountingApi.listPayments({
      page: tableState.page, search: tableState.search || undefined,
      ...tableState.filters,
    }),
  });

  const { data: banks } = useQuery({
    queryKey: ['acc-bank-accounts'],
    queryFn: () => accountingApi.listBankAccounts(),
  });
  const boxes = banks?.results ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['acc-payments'] });

  const create = useMutation({
    mutationFn: (f: Form) => accountingApi.createPayment({
      direction: f.direction, method: f.method, payment_date: f.payment_date,
      amount: f.amount, funds_account: Number(f.funds_account),
      partner_type: f.partner_type, partner_id: f.partner_id,
      partner_name: f.partner_name, reference: f.reference, notes: f.notes,
      allocations: f.allocations.filter((a) => a.target_id && Number(a.amount) > 0),
    }),
    onSuccess: () => { toastOk('Payment saved as draft.'); setForm(null); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const confirmPay = useMutation({
    mutationFn: (id: string) => accountingApi.confirmPayment(id),
    onSuccess: (p) => { toastOk(`Confirmed — journal ${p.journal_number ?? ''} posted.`); setDetail(null); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const cancelPay = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => accountingApi.cancelPayment(id, reason),
    onSuccess: () => { toastOk('Payment cancelled — ledger entry reversed.'); setDetail(null); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => accountingApi.deletePayment(id),
    onSuccess: () => { toastOk('Draft payment deleted.'); invalidate(); },
    onError: (e) => toastErr(getApiError(e)),
  });

  const columns: Column<AccPayment>[] = [
    { key: 'number', header: 'Number', render: (p) => p.number || <span style={{ color: 'var(--text-secondary)' }}>draft</span> },
    {
      key: 'direction', header: 'Type',
      render: (p) => <Badge variant={p.direction === 'in' ? 'success' : 'warning'}>{p.direction === 'in' ? 'Receipt' : 'Payment'}</Badge>,
    },
    { key: 'payment_date', header: 'Date', render: (p) => p.payment_date },
    { key: 'partner_name', header: 'Partner', render: (p) => p.partner_name || '—' },
    { key: 'method', header: 'Method', render: (p) => p.method },
    { key: 'amount', header: 'Amount', render: (p) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(p.amount)}</span> },
    { key: 'journal_number', header: 'Journal', render: (p) => p.journal_number ?? '—' },
    { key: 'status', header: 'Status', render: (p) => <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge> },
    {
      key: 'actions', header: '',
      render: (p) => (
        <RowActions
          actions={[
            { label: 'View', onClick: () => setDetail(p) },
            ...(p.status === 'draft' ? [
              {
                label: 'Confirm',
                onClick: async () => {
                  if (await confirm('Confirm this payment? Its journal entry will be posted and allocated documents updated.')) {
                    confirmPay.mutate(p.id);
                  }
                },
              },
              {
                label: 'Delete', variant: 'danger' as const,
                onClick: async () => {
                  if (await confirm('Delete this draft payment?')) remove.mutate(p.id);
                },
              },
            ] : []),
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <AppListPage
        title="Payments & Receipts"
        description="Unified money movements — confirming posts the ledger entry and settles allocated documents."
        breadcrumbs={[{ label: 'Accounting', href: '/accounting' }, { label: 'Payments' }]}
        totalCount={data?.count ?? 0}
        createAction={<Button onClick={() => setForm(EMPTY)}>+ New Payment</Button>}
        filterFields={filterFields}
        columns={columns}
        data={data?.results ?? []}
        isLoading={isLoading}
        error={error}
        tableState={tableState}
      />

      {form ? (
        <BaseModal isOpen onClose={() => setForm(null)} title="New Payment / Receipt">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Direction</label>
                <select style={INPUT} value={form.direction}
                        onChange={(e) => setForm({ ...form, direction: e.target.value as 'in' | 'out', partner_type: e.target.value === 'in' ? 'customer' : 'supplier' })}>
                  <option value="out">Payment (money out)</option>
                  <option value="in">Receipt (money in)</option>
                </select>
              </div>
              <div>
                <label style={LABEL}>Method</label>
                <select style={INPUT} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                  {['bank', 'cash', 'cheque', 'card'].map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Date</label>
                <input type="date" style={INPUT} value={form.payment_date}
                       onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Amount (AED)</label>
                <input type="number" min="0" step="0.01" style={INPUT} value={form.amount}
                       onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Funds account (cash / bank box)</label>
                <select style={INPUT} value={form.funds_account}
                        onChange={(e) => setForm({ ...form, funds_account: e.target.value })}>
                  <option value="">Select…</option>
                  {boxes.map((b) => (
                    <option key={b.id} value={b.ledger_account}>{b.name} ({b.kind})</option>
                  ))}
                </select>
                {!boxes.length ? (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warning, #b45309)', marginTop: 4 }}>
                    No cash/bank boxes yet — create one under Accounting → Banking.
                  </div>
                ) : null}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Partner type</label>
                <select style={INPUT} value={form.partner_type}
                        onChange={(e) => setForm({ ...form, partner_type: e.target.value })}>
                  <option value="supplier">Supplier</option>
                  <option value="customer">Customer</option>
                  <option value="employee">Employee</option>
                  <option value="">None</option>
                </select>
              </div>
              <div>
                <label style={LABEL}>Partner ID</label>
                <input style={INPUT} value={form.partner_id}
                       onChange={(e) => setForm({ ...form, partner_id: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Partner name</label>
                <input style={INPUT} value={form.partner_name}
                       onChange={(e) => setForm({ ...form, partner_name: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={LABEL}>Reference (cheque no. / transfer ref)</label>
                <input style={INPUT} value={form.reference}
                       onChange={(e) => setForm({ ...form, reference: e.target.value })} />
              </div>
              <div>
                <label style={LABEL}>Notes</label>
                <input style={INPUT} value={form.notes}
                       onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>
                  Allocations (apply to invoices — optional)
                </label>
                <Button variant="secondary" size="sm"
                        onClick={() => setForm({ ...form, allocations: [...form.allocations, { target_type: form.direction === 'in' ? 'client_invoice' : 'purchase_invoice', target_id: '', amount: '' }] })}>
                  + Add allocation
                </Button>
              </div>
              {form.allocations.map((a, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.4fr 1fr auto', gap: 8, marginBottom: 6 }}>
                  <select style={INPUT} value={a.target_type}
                          onChange={(e) => setForm({ ...form, allocations: form.allocations.map((x, j) => j === i ? { ...x, target_type: e.target.value as PaymentAllocation['target_type'] } : x) })}>
                    <option value="purchase_invoice">Supplier invoice</option>
                    <option value="client_invoice">Client invoice</option>
                  </select>
                  <input style={INPUT} placeholder="Invoice ID" value={a.target_id}
                         onChange={(e) => setForm({ ...form, allocations: form.allocations.map((x, j) => j === i ? { ...x, target_id: e.target.value } : x) })} />
                  <input style={INPUT} type="number" min="0" step="0.01" placeholder="Amount" value={a.amount}
                         onChange={(e) => setForm({ ...form, allocations: form.allocations.map((x, j) => j === i ? { ...x, amount: e.target.value } : x) })} />
                  <Button variant="secondary" size="sm"
                          onClick={() => setForm({ ...form, allocations: form.allocations.filter((_, j) => j !== i) })}>
                    ✕
                  </Button>
                </div>
              ))}
              {form.allocations.length ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                  Allocated: {fmt(form.allocations.reduce((s, a) => s + (Number(a.amount) || 0), 0))} / {fmt(Number(form.amount) || 0)}
                </div>
              ) : null}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button variant="secondary" onClick={() => setForm(null)}>Cancel</Button>
              <Button
                disabled={create.isPending}
                onClick={() => {
                  if (!form.amount || Number(form.amount) <= 0 || !form.funds_account) {
                    toastErr('Amount and funds account are required.');
                    return;
                  }
                  create.mutate(form);
                }}
              >
                {create.isPending ? 'Saving…' : 'Save draft'}
              </Button>
            </div>
          </div>
        </BaseModal>
      ) : null}

      {detail ? (
        <PaymentDetailModal
          payment={detail}
          onClose={() => setDetail(null)}
          onConfirm={() => confirmPay.mutate(detail.id)}
          onCancel={(reason) => cancelPay.mutate({ id: detail.id, reason })}
        />
      ) : null}
    </>
  );
}

function PaymentDetailModal({ payment, onClose, onConfirm, onCancel }: {
  payment: AccPayment; onClose: () => void;
  onConfirm: () => void; onCancel: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const rows: [string, React.ReactNode][] = [
    ['Number', payment.number || 'draft'],
    ['Type', payment.direction === 'in' ? 'Receipt' : 'Payment'],
    ['Date', payment.payment_date],
    ['Amount', fmt(payment.amount)],
    ['Funds account', `${payment.funds_account_code ?? ''} ${payment.funds_account_name ?? ''}`],
    ['Partner', `${payment.partner_type || '—'} ${payment.partner_name || payment.partner_id || ''}`],
    ['Reference', payment.reference || '—'],
    ['Journal', payment.journal_number ?? '—'],
    ['Status', payment.status],
  ];
  return (
    <BaseModal isOpen onClose={onClose} title={`Payment ${payment.number || '(draft)'}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-primary, var(--border-subtle))', padding: '5px 0' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{k}</span><span>{v}</span>
          </div>
        ))}
        {payment.allocations?.length ? (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 'var(--text-sm)' }}>Allocations</div>
            {payment.allocations.map((a, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
                <span>{a.target_type} #{a.target_id}</span><span>{fmt(a.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {payment.status === 'draft' ? (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <Button onClick={async () => {
              if (await confirm('Confirm this payment? Its journal entry will be posted and allocated documents updated.')) onConfirm();
            }}>
              Confirm payment
            </Button>
          </div>
        ) : null}
        {payment.status === 'confirmed' ? (
          <div style={{ marginTop: 10 }}>
            <label style={LABEL}>Cancellation reason (required — the ledger entry will be reversed)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={INPUT} value={reason} onChange={(e) => setReason(e.target.value)} />
              <Button variant="destructive" disabled={!reason.trim()} onClick={() => onCancel(reason.trim())}>
                Cancel payment
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </BaseModal>
  );
}
