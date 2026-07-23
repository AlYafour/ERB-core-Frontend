'use client';

import RouteGuard from '@/components/auth/RouteGuard';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui';
import { accountingApi } from '@/lib/api/accounting';
import { suppliersApi } from '@/lib/api/suppliers';
import { purchaseInvoicesApi } from '@/lib/api/purchase-invoices';

// ── Helpers ───────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-01-01`;

const money = (v: unknown) => {
  const n = Number(v ?? 0);
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', color: n < 0 ? 'var(--error, #dc2626)' : undefined }}>
      {n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
};

const CARD: React.CSSProperties = {
  background: 'var(--surface-1, var(--card-bg))',
  border: '1px solid var(--border-primary, var(--border-subtle))',
  borderRadius: 'var(--radius-lg)',
  padding: 18,
  overflowX: 'auto',
};

const TH: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', fontSize: 'var(--text-xs)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  borderBottom: '1px solid var(--border-primary, var(--border-subtle))',
  whiteSpace: 'nowrap',
};
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties = {
  padding: '7px 10px', fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-primary, var(--border-subtle))',
};
const TDR: React.CSSProperties = { ...TD, textAlign: 'right' };
const TOTAL_ROW: React.CSSProperties = { fontWeight: 700, background: 'var(--surface-2, transparent)' };

const INPUT: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)',
};

type Section = {
  category_code: string; category_name: string; category_name_ar: string;
  accounts: { account_id: number; code: string; name: string; amount: string }[];
  total: string;
};

function SectionTable({ title, bucket }: { title: string; bucket: { sections: Section[]; total: string } }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontWeight: 700, margin: '10px 0 6px' }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {bucket.sections.map((sec) => (
            <SectionRows key={sec.category_code} sec={sec} />
          ))}
          <tr style={TOTAL_ROW}>
            <td style={TD}>Total {title}</td>
            <td style={TDR}>{money(bucket.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SectionRows({ sec }: { sec: Section }) {
  return (
    <>
      <tr>
        <td style={{ ...TD, fontWeight: 600 }} colSpan={2}>
          {sec.category_name}
          {sec.category_name_ar ? <span style={{ color: 'var(--text-secondary)', marginInlineStart: 8, fontSize: 'var(--text-xs)' }}>{sec.category_name_ar}</span> : null}
        </td>
      </tr>
      {sec.accounts.map((a) => (
        <tr key={a.account_id}>
          <td style={{ ...TD, paddingInlineStart: 26 }}>{a.code} — {a.name}</td>
          <td style={TDR}>{money(a.amount)}</td>
        </tr>
      ))}
    </>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: unknown; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', fontWeight: strong ? 700 : 400, borderBottom: '1px solid var(--border-primary, var(--border-subtle))', fontSize: 'var(--text-sm)' }}>
      <span>{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'tb',  label: 'Trial Balance' },
  { key: 'bs',  label: 'Balance Sheet' },
  { key: 'pl',  label: 'Profit & Loss' },
  { key: 'cf',  label: 'Cash Flow' },
  { key: 'vat', label: 'VAT Return' },
  { key: 'payables', label: 'Payables — Invoices' },
  { key: 'ap',  label: 'AP Aging' },
  { key: 'supplier', label: 'Supplier Statement' },
  { key: 'ar',  label: 'AR Aging' },
] as const;

type TabKey = typeof TABS[number]['key'];

function PayablesTab() {
  const [paidFilter, setPaidFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid'>('unpaid');
  const { data, isLoading, error: payablesError } = useQuery({
    queryKey: ['acc-payables-invoices'],
    // slim server-side view: one flat query, no nested PO serialization
    queryFn: () => purchaseInvoicesApi.payables(),
  });
  const bills = data?.results ?? [];

  const rows = bills.map((i) => {
    const total = Number(i.total || 0);
    const paid = Number(i.paid_amount || 0);
    return { ...i, _total: total, _paid: paid, _due: total - paid,
             _supplier: i.supplier ?? '—',
             _po: i.po_number ?? '' };
  });
  const filtered = rows.filter((r: any) =>
    paidFilter === 'all' ? true
    : paidFilter === 'paid' ? r._due <= 0
    : paidFilter === 'partial' ? (r._paid > 0 && r._due > 0)
    : r._paid === 0 && r._due > 0);

  const sum = (k: '_total' | '_paid' | '_due') => rows.reduce((s: number, r: any) => s + r[k], 0);
  const CARD_S: React.CSSProperties = {
    flex: 1, minWidth: 160, padding: '12px 16px',
    border: '1px solid var(--border-primary, var(--border-subtle))',
    borderRadius: 'var(--radius-md)',
  };
  const FILTERS: ['all' | 'unpaid' | 'partial' | 'paid', string][] = [
    ['unpaid', 'Unpaid'], ['partial', 'Partially paid'], ['paid', 'Fully paid'], ['all', 'All'],
  ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={CARD_S}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total billed</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{money(sum('_total'))}</div>
        </div>
        <div style={CARD_S}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Paid</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--success, #16a34a)' }}>{money(sum('_paid'))}</div>
        </div>
        <div style={CARD_S}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Outstanding (we owe)</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--error, #dc2626)' }}>{money(sum('_due'))}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {FILTERS.map(([key, label]) => (
          <button key={key} onClick={() => setPaidFilter(key)} style={{
            padding: '5px 12px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
            fontSize: 'var(--text-xs)', fontWeight: paidFilter === key ? 700 : 400,
            border: `1px solid ${paidFilter === key ? 'var(--accent-primary, #b8860b)' : 'var(--border-primary, var(--border-subtle))'}`,
            background: 'transparent', color: 'var(--text-primary)',
          }}>{label} ({key === 'all' ? rows.length : rows.filter((r: any) =>
              key === 'paid' ? r._due <= 0 : key === 'partial' ? (r._paid > 0 && r._due > 0) : r._paid === 0 && r._due > 0).length})</button>
        ))}
      </div>

      {payablesError ? (
        <div style={{ color: 'var(--error, #dc2626)' }}>
          Failed to load payables — {String((payablesError as any)?.message || 'try refreshing the page')}
        </div>
      ) : isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Invoice #', 'Supplier', 'LPO', 'Date', 'Total', 'Paid', 'Outstanding', 'Status'].map(h =>
              <th key={h} style={{ ...TH, textAlign: ['Total','Paid','Outstanding'].includes(h) ? 'right' : 'left' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.id}>
                <td style={{ ...TD, fontFamily: 'monospace', fontWeight: 600 }}>{r.invoice_number}</td>
                <td style={TD}>{String(r._supplier).slice(0, 30)}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{r._po}</td>
                <td style={TD}>{r.invoice_date}</td>
                <td style={TDR}>{money(r._total)}</td>
                <td style={{ ...TDR, color: r._paid > 0 ? 'var(--success, #16a34a)' : undefined }}>{money(r._paid)}</td>
                <td style={{ ...TDR, fontWeight: 700 }}>{money(r._due)}</td>
                <td style={TD}><Badge variant={r._due <= 0 ? 'success' : r._paid > 0 ? 'warning' : 'error'}>
                  {r._due <= 0 ? 'Paid' : r._paid > 0 ? 'Partial' : 'Unpaid'}</Badge></td>
              </tr>
            ))}
            {!filtered.length ? <tr><td style={{ ...TD, color: 'var(--text-secondary)' }} colSpan={8}>No invoices in this filter.</td></tr> : null}
          </tbody>
        </table>
      )}
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 8 }}>
        Money view: approved & paid supplier bills. Pending-approval invoices appear here once approved.
      </p>
    </div>
  );
}

function SupplierStatementTab({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) {
  const [supplierId, setSupplierId] = useState('');
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-stmt'],
    queryFn: () => suppliersApi.getAll({ page_size: 500 }),
  });
  const suppliers: any[] = (suppliersData as any)?.results ?? [];
  const { data, isLoading } = useQuery({
    queryKey: ['acc-supplier-stmt', supplierId, dateFrom, dateTo],
    queryFn: () => accountingApi.supplierStatement(supplierId, { date_from: dateFrom, date_to: dateTo }),
    enabled: !!supplierId,
  });
  const stmt: any = data;
  return (
    <div>
      <select style={{ ...INPUT, minWidth: 300, marginBottom: 12 }} value={supplierId}
              onChange={e => setSupplierId(e.target.value)}>
        <option value="">Select supplier…</option>
        {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {!supplierId ? <div style={{ color: 'var(--text-secondary)' }}>Pick a supplier to see the statement — invoices, payments and the running balance, straight from the ledger.</div>
        : isLoading ? <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>
        : stmt ? (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Date', 'Journal', 'Event', 'Reference', 'Description', 'Debit', 'Credit', 'Balance'].map(h =>
              <th key={h} style={{ ...TH, textAlign: ['Debit','Credit','Balance'].includes(h) ? 'right' : 'left' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><td style={TD} colSpan={7}>Opening balance</td><td style={TDR}>{money(stmt.opening_balance)}</td></tr>
            {stmt.rows.map((r: any, i: number) => (
              <tr key={i}>
                <td style={TD}>{r.date}</td>
                <td style={{ ...TD, fontFamily: 'monospace' }}>{r.journal_number}</td>
                <td style={TD}>{r.event_code}</td>
                <td style={TD}>{r.reference || '—'}</td>
                <td style={TD}>{r.description}</td>
                <td style={TDR}>{r.debit && Number(r.debit) ? money(r.debit) : ''}</td>
                <td style={TDR}>{r.credit && Number(r.credit) ? money(r.credit) : ''}</td>
                <td style={TDR}>{money(r.balance)}</td>
              </tr>
            ))}
            <tr style={TOTAL_ROW}><td style={TD} colSpan={7}>Closing balance (we owe)</td><td style={TDR}>{money(stmt.closing_balance)}</td></tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

function AccountingReportsPageInner() {
  const [tab, setTab] = useState<TabKey>('tb');
  const [asOf, setAsOf] = useState(today());
  const [dateFrom, setDateFrom] = useState(yearStart());
  const [dateTo, setDateTo] = useState(today());

  const rangeTabs: TabKey[] = ['pl', 'cf', 'vat', 'supplier'];
  const params = rangeTabs.includes(tab)
    ? { date_from: dateFrom, date_to: dateTo }
    : { as_of: asOf };

  const { data, isLoading, error } = useQuery({
    queryKey: ['acc-report', tab, params],
    queryFn: () => {
      if (tab === 'supplier' || tab === 'payables') return null;
      switch (tab) {
        case 'tb':  return accountingApi.trialBalance({ date_to: asOf });
        case 'bs':  return accountingApi.balanceSheet(asOf);
        case 'pl':  return accountingApi.profitLoss(params);
        case 'cf':  return accountingApi.cashFlow(params);
        case 'vat': return accountingApi.vatReturn(params);
        case 'ap':  return accountingApi.apAging({ as_of: asOf });
        case 'ar':  return accountingApi.arAging({ as_of: asOf });
      }
    },
  });

  return (
    <MainLayout>
      <PageShell>
        <div>
          <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>Financial Reports</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
            Every figure derives from the posted ledger and reconciles with the trial balance.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: tab === t.key ? 700 : 400,
              border: `1px solid ${tab === t.key ? 'var(--accent-primary, #b8860b)' : 'var(--border-primary, var(--border-subtle))'}`,
              background: tab === t.key ? 'var(--surface-2, transparent)' : 'transparent',
              color: 'var(--text-primary)',
            }}>
              {t.label}
            </button>
          ))}
        </div>

        {tab !== 'payables' && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {rangeTabs.includes(tab) ? (
            <>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>From</label>
              <input type="date" style={INPUT} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>To</label>
              <input type="date" style={INPUT} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </>
          ) : (
            <>
              <label style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>As of</label>
              <input type="date" style={INPUT} value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </>
          )}
        </div>
        )}

        <div style={CARD}>
          {isLoading && <div style={{ color: 'var(--text-secondary)' }}>Loading report…</div>}
          {!!error && <div style={{ color: 'var(--error, #dc2626)' }}>Failed to load report.</div>}
          {tab === 'supplier'
            ? <SupplierStatementTab dateFrom={dateFrom} dateTo={dateTo} />
            : tab === 'payables'
            ? <PayablesTab />
            : (!isLoading && !error && data ? <ReportBody tab={tab} data={data as any} /> : null)}
        </div>
      </PageShell>
    </MainLayout>
  );
}

function ReportBody({ tab, data }: { tab: TabKey; data: any }) {
  if (tab === 'tb') {
    const rows = Array.isArray(data) ? data[0] : data.rows;
    const td = Array.isArray(data) ? data[1] : data.total_debit;
    const tc = Array.isArray(data) ? data[2] : data.total_credit;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={TH}>Code</th><th style={TH}>Account</th>
            <th style={THR}>Debit</th><th style={THR}>Credit</th>
            <th style={THR}>Balance Dr</th><th style={THR}>Balance Cr</th>
          </tr>
        </thead>
        <tbody>
          {(rows ?? []).map((r: any) => (
            <tr key={r.account_id}>
              <td style={TD}>{r.code}</td>
              <td style={TD}>{r.name}{r.name_ar ? <span style={{ color: 'var(--text-secondary)', marginInlineStart: 8, fontSize: 'var(--text-xs)' }}>{r.name_ar}</span> : null}</td>
              <td style={TDR}>{money(r.debit)}</td>
              <td style={TDR}>{money(r.credit)}</td>
              <td style={TDR}>{money(r.balance_debit)}</td>
              <td style={TDR}>{money(r.balance_credit)}</td>
            </tr>
          ))}
          <tr style={TOTAL_ROW}>
            <td style={TD} colSpan={2}>Totals</td>
            <td style={TDR}>{money(td)}</td>
            <td style={TDR}>{money(tc)}</td>
            <td style={TD} colSpan={2}>
              <Badge variant={String(td) === String(tc) ? 'success' : 'error'}>
                {String(td) === String(tc) ? 'Balanced' : 'OUT OF BALANCE'}
              </Badge>
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  if (tab === 'bs') {
    return (
      <div>
        <div style={{ marginBottom: 10 }}>
          <Badge variant={data.balanced ? 'success' : 'error'}>
            {data.balanced ? 'Balanced' : 'OUT OF BALANCE'}
          </Badge>
        </div>
        <SectionTable title="Assets" bucket={data.assets} />
        <SectionTable title="Liabilities" bucket={data.liabilities} />
        <SectionTable title="Equity" bucket={data.equity} />
        <SummaryRow label="Current period earnings" value={data.current_period_earnings} />
        <SummaryRow label="Total equity" value={data.total_equity} strong />
        <SummaryRow label="Total liabilities + equity" value={data.total_liabilities_equity} strong />
      </div>
    );
  }

  if (tab === 'pl') {
    return (
      <div>
        <SectionTable title="Revenue" bucket={data.revenue} />
        <SectionTable title="Cost of Sales" bucket={data.cogs} />
        <SummaryRow label="Gross profit" value={data.gross_profit} strong />
        <SectionTable title="Operating Expenses" bucket={data.expenses} />
        <SummaryRow label="Operating profit" value={data.operating_profit} strong />
        <SectionTable title="Other Income" bucket={data.other_income} />
        <SectionTable title="Other Expenses" bucket={data.other_expense} />
        <SummaryRow label="Net profit" value={data.net_profit} strong />
      </div>
    );
  }

  if (tab === 'cf') {
    const op = data.operating;
    return (
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontWeight: 700, margin: '4px 0 6px' }}>Operating activities</div>
        <SummaryRow label="Net profit" value={op.net_profit} />
        <SummaryRow label="Depreciation" value={op.depreciation} />
        <SummaryRow label="Change in receivables" value={op.change_in_receivables} />
        <SummaryRow label="Change in payables" value={op.change_in_payables} />
        <SummaryRow label="Change in inventory" value={op.change_in_inventory} />
        <SummaryRow label="Change in retentions" value={op.change_in_retentions} />
        <SummaryRow label="Cash from operations" value={op.total} strong />
        <div style={{ fontWeight: 700, margin: '14px 0 6px' }}>Investing activities</div>
        <SummaryRow label="Fixed asset movements" value={data.investing.fixed_asset_movements} />
        <SummaryRow label="Cash from investing" value={data.investing.total} strong />
        <div style={{ fontWeight: 700, margin: '14px 0 6px' }}>Financing activities</div>
        <SummaryRow label="Equity movements" value={data.financing.equity_movements} />
        <SummaryRow label="Cash from financing" value={data.financing.total} strong />
        <div style={{ marginTop: 14 }}>
          <SummaryRow label="Unclassified movement" value={data.unclassified} />
          <SummaryRow label="Net change in cash" value={data.net_change_in_cash} strong />
        </div>
      </div>
    );
  }

  if (tab === 'vat') {
    return (
      <div style={{ maxWidth: 620 }}>
        <SummaryRow label="Output tax (on sales)" value={data.output_tax} />
        <SummaryRow label="Recoverable input tax" value={data.recoverable_input_tax} />
        <SummaryRow label="Net VAT payable" value={data.net_payable} strong />
        {data.by_tax_code?.length ? (
          <>
            <div style={{ fontWeight: 700, margin: '14px 0 6px' }}>By tax code</div>
            {data.by_tax_code.map((r: any) => (
              <SummaryRow key={r.tax_code} label={`${r.tax_code} — ${r.name}`} value={r.amount} />
            ))}
          </>
        ) : null}
      </div>
    );
  }

  // AP / AR aging
  const rows = tab === 'ap' ? data.suppliers : data.customers;
  const nameKey = tab === 'ap' ? 'supplier_name' : 'customer_name';
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={TH}>{tab === 'ap' ? 'Supplier' : 'Customer'}</th>
          {data.buckets.map((b: string) => <th key={b} style={THR}>{b}</th>)}
          <th style={THR}>Total</th>
        </tr>
      </thead>
      <tbody>
        {(rows ?? []).map((r: any) => (
          <tr key={r.supplier_id ?? r.customer_id}>
            <td style={TD}>{r[nameKey]}</td>
            {data.buckets.map((b: string) => <td key={b} style={TDR}>{money(r[b])}</td>)}
            <td style={{ ...TDR, fontWeight: 700 }}>{money(r.total)}</td>
          </tr>
        ))}
        <tr style={TOTAL_ROW}>
          <td style={TD}>Totals</td>
          {data.buckets.map((b: string) => <td key={b} style={TDR}>{money(data.totals[b])}</td>)}
          <td style={TDR}>{money(data.totals.total)}</td>
        </tr>
      </tbody>
    </table>
  );
}


export default function AccountingReportsPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'financial_report', action: 'view' }}
                redirectTo="/accounting">
      <AccountingReportsPageInner />
    </RouteGuard>
  );
}
