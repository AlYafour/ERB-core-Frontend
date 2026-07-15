'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';
import { accountingApi } from '@/lib/api/accounting';
import { Button } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
const toastOk = (m: string) => toast(m, 'success');
const toastErr = (m: string) => toast(m, 'error');
const toastInfo = (m: string) => toast(m, 'info');
import { getApiError } from '@/lib/utils/error';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmt = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === ''
    ? '—'
    : `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const CARD: React.CSSProperties = {
  background: 'var(--card-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5)',
};

const KPI_LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  fontWeight: 700,
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 8px 0',
};

const KPI_VALUE: React.CSSProperties = {
  fontSize: 'var(--text-2xl)',
  fontWeight: 700,
  color: 'var(--text-primary)',
  fontVariantNumeric: 'tabular-nums',
  margin: 0,
};

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

// ── Activation Wizard ─────────────────────────────────────────────────────────

function ActivationWizard({
  templates,
  onActivated,
}: {
  templates: { key: string; label: string; label_ar: string }[];
  onActivated: () => void;
}) {
  const [template, setTemplate] = useState(templates[0]?.key ?? '');
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1);
  const [baseCurrency, setBaseCurrency] = useState('AED');

  const activateMutation = useMutation({
    mutationFn: () =>
      accountingApi.activate({
        template,
        fiscal_start_month: fiscalStartMonth,
        base_currency: baseCurrency.trim().toUpperCase(),
      }),
    onSuccess: () => {
      toast('Accounting activated — chart of accounts seeded', 'success');
      onActivated();
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to activate accounting'), 'error'),
  });

  const handleActivate = () => {
    if (!template) { toast('Please select a chart of accounts template', 'error'); return; }
    if (!baseCurrency.trim()) { toast('Please enter a base currency', 'error'); return; }
    activateMutation.mutate();
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div style={CARD}>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
          Activate Accounting
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Set up your general ledger. Choose an industry template, your fiscal year start, and base currency.
        </p>

        {/* Template picker — radio cards */}
        <p style={{ ...LABEL, marginBottom: 8 }}>Chart of Accounts Template <span style={{ color: 'var(--color-error)' }}>*</span></p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)', marginBottom: 20 }}>
          {templates.map(t => {
            const selected = t.key === template;
            return (
              <label
                key={t.key}
                style={{
                  display: 'block',
                  cursor: 'pointer',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: selected ? '2px solid var(--brand)' : '1px solid var(--border-subtle)',
                  background: selected ? 'var(--surface-subtle)' : 'var(--input-bg)',
                }}
              >
                <input
                  type="radio"
                  name="coa-template"
                  value={t.key}
                  checked={selected}
                  onChange={() => setTemplate(t.key)}
                  style={{ marginRight: 8, accentColor: 'var(--brand)' }}
                />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2, marginLeft: 22 }} dir="rtl">
                  {t.label_ar}
                </div>
              </label>
            );
          })}
          {templates.length === 0 && (
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>No templates available.</p>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 20 }}>
          <div>
            <label style={LABEL}>Fiscal Year Starts In <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select value={fiscalStartMonth} onChange={e => setFiscalStartMonth(parseInt(e.target.value))} style={INPUT}>
              {MONTH_NAMES.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL}>Base Currency <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input
              type="text" maxLength={3} placeholder="AED"
              value={baseCurrency}
              onChange={e => setBaseCurrency(e.target.value)}
              style={{ ...INPUT, textTransform: 'uppercase' }}
            />
          </div>
        </div>

        {/* Warning */}
        <div style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid var(--status-warning)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 14px',
          marginBottom: 20,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}>
          Activation seeds a full chart of accounts from the selected template. Account names and categories
          can be renamed later from the Chart of Accounts page — nothing here is permanent except the ledger itself.
        </div>

        <Button
          variant="primary"
          onClick={handleActivate}
          isLoading={activateMutation.isPending}
          disabled={!template}
        >
          Activate Accounting
        </Button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const QUICK_LINKS: { href: string; label: string }[] = [
  { href: '/accounting/journal',  label: 'Journal' },
  { href: '/accounting/payments', label: 'Payments' },
  { href: '/accounting/banking',  label: 'Banking' },
  { href: '/accounting/reports',  label: 'Reports' },
  { href: '/accounting/accounts', label: 'Chart of Accounts' },
  { href: '/accounting/settings', label: 'Settings' },
];

function AccountingDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['accounting-dashboard'],
    queryFn: () => accountingApi.getDashboard(),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading dashboard…</p>;
  }
  if (error || !data) {
    return <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>{getApiError(error, 'Failed to load dashboard')}</p>;
  }

  const monthNet = Number(data.month.net_profit);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {QUICK_LINKS.map(l => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--card-bg)',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>

        {/* Cash */}
        <div style={CARD}>
          <p style={KPI_LABEL}>Cash & Bank</p>
          <p style={KPI_VALUE}>{fmt(data.cash.total)}</p>
          {data.cash.accounts.length > 0 && (
            <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.cash.accounts.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', gap: 8 }}>
                  <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.name}
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)', marginLeft: 6 }}>{a.kind.replace('_', ' ')}</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, flexShrink: 0 }}>{fmt(a.balance)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Receivables */}
        <div style={CARD}>
          <p style={KPI_LABEL}>Receivables</p>
          <p style={KPI_VALUE}>{fmt(data.receivables)}</p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Owed to us by customers</p>
        </div>

        {/* Payables */}
        <div style={CARD}>
          <p style={KPI_LABEL}>Payables</p>
          <p style={KPI_VALUE}>{fmt(data.payables)}</p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Owed by us to suppliers</p>
        </div>

        {/* VAT */}
        <div style={CARD}>
          <p style={KPI_LABEL}>VAT Net</p>
          <p style={KPI_VALUE}>{fmt(data.vat_net)}</p>
          <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Output tax minus recoverable input tax</p>
        </div>

        {/* This month */}
        <div style={CARD}>
          <p style={KPI_LABEL}>This Month</p>
          <p style={{ ...KPI_VALUE, color: monthNet < 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
            {fmt(data.month.net_profit)}
          </p>
          <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Revenue</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(data.month.revenue)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Expenses</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(data.month.expenses)}</span>
            </div>
          </div>
        </div>

        {/* Attention */}
        <div style={CARD}>
          <p style={KPI_LABEL}>Needs Attention</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link href="/accounting/journal" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Draft journal entries</span>
              <span style={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: data.attention.draft_journals > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)',
              }}>
                {data.attention.draft_journals}
              </span>
            </Link>
            <Link href="/accounting/payments" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-sm)', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Draft payments</span>
              <span style={{
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: data.attention.draft_payments > 0 ? 'var(--status-warning)' : 'var(--text-tertiary)',
              }}>
                {data.attention.draft_payments}
              </span>
            </Link>
          </div>
          <p style={{ margin: '10px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
            As of {data.as_of}
          </p>
        </div>

      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountingPage() {
  const queryClient = useQueryClient();

  const { data: setup, isLoading, error } = useQuery({
    queryKey: ['accounting-setup'],
    queryFn: () => accountingApi.getSetup(),
  });

  const handleActivated = () => {
    queryClient.invalidateQueries({ queryKey: ['accounting-setup'] });
    queryClient.invalidateQueries({ queryKey: ['accounting-dashboard'] });
  };

  return (
    <MainLayout>
      <div style={{ padding: 'var(--space-5)', maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            Accounting
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            General ledger, payments, banking and financial reports.
          </p>
        </div>

        {isLoading && (
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>Loading…</p>
        )}

        {!isLoading && error && (
          <p style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>
            {getApiError(error, 'Failed to load accounting setup')}
          </p>
        )}

        {!isLoading && !error && setup && (
          setup.activated
            ? <AccountingDashboard />
            : <ActivationWizard templates={setup.templates} onActivated={handleActivated} />
        )}
      </div>
    </MainLayout>
  );
}
