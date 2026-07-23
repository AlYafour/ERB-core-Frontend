'use client';

/**
 * Account detail — click any bank / sub-account / cash box on the Banking
 * page and land INSIDE it: identity, balance, and every ledger movement
 * (transfers, cash-ins, vouchers, opening) each linking to its journal.
 */

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui';
import RouteGuard from '@/components/auth/RouteGuard';
import { accountingApi } from '@/lib/api/accounting';
import { getApiError } from '@/lib/utils/error';

const fmt = (v: string | number) =>
  `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dmy = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const CARD: React.CSSProperties = {
  background: 'var(--surface-1, var(--card-bg))',
  border: '1px solid var(--border-primary, var(--border-subtle))',
  borderRadius: 'var(--radius-lg)', padding: 16,
};
const TD: React.CSSProperties = {
  padding: '8px 10px', fontSize: 'var(--text-sm)',
  borderBottom: '1px solid var(--border-primary, var(--border-subtle))',
};
const NUM: React.CSSProperties = { ...TD, textAlign: 'right', fontFamily: 'monospace' };
const KIND_LABEL: Record<string, string> = { bank: 'Bank', cash: 'Cash box', petty_cash: 'Petty cash' };

export default function BankAccountDetailPage() {
  return (
    <RouteGuard requiredPermission={{ category: 'banking', action: 'view' }}
                anyOfPermissions={[{ category: 'expense', action: 'approve' }]}
                redirectTo="/accounting/banking">
      <Content />
    </RouteGuard>
  );
}

function Content() {
  const params = useParams();
  const id = String(params?.id ?? '');

  const { data, isLoading, error } = useQuery({
    queryKey: ['bank-account-statement', id],
    queryFn: () => accountingApi.getBankAccountStatement(id),
    enabled: !!id,
  });

  const acc = data?.account;

  return (
    <MainLayout>
      <PageShell>
        <div>
          <Link href="/accounting/banking" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textDecoration: 'none' }}>← Banking</Link>
          <h1 style={{ margin: '6px 0 0', fontSize: 'var(--text-xl)', fontWeight: 800 }}>{acc?.name ?? '…'}</h1>
        </div>
        {isLoading ? (
          <div className="animate-pulse" style={{ height: 220, background: 'var(--bg-secondary)', borderRadius: 12 }} />
        ) : error || !data ? (
          <p style={{ color: 'var(--status-error)' }}>{getApiError(error, 'Account not found')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Identity */}
            <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--brand)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16 }}>
                {(data.account.bank_name || data.account.name).slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 800, fontSize: 'var(--text-lg)' }}>{data.account.name}</span>
                  <Badge variant="default">{KIND_LABEL[data.account.kind] ?? data.account.kind}</Badge>
                  {data.account.parent_name && <Badge variant="info">Sub of {data.account.parent_name}</Badge>}
                  {!data.account.is_active && <Badge variant="error">Inactive</Badge>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  {data.account.bank_name && <span>{data.account.bank_name}</span>}
                  {data.account.account_number && <span dir="ltr" style={{ fontFamily: 'monospace' }}>A/C {data.account.account_number}</span>}
                  {data.account.iban && <span dir="ltr" style={{ fontFamily: 'monospace' }}>{data.account.iban}</span>}
                  {data.account.ledger_code && <span>Ledger {data.account.ledger_code}</span>}
                  {data.account.custodian_name && <span>Custodian: {data.account.custodian_name}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {data.account.kind === 'petty_cash' && (
                  <Link href={`/expenses/cash-boxes/${data.account.id}`} style={{ alignSelf: 'center', color: 'var(--brand)', fontWeight: 700, fontSize: 'var(--text-sm)', textDecoration: 'none' }}>
                    Open box workspace →
                  </Link>
                )}
              </div>
            </div>

            {/* Totals */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Money In', value: data.totals.in, color: 'var(--text-primary)' },
                { label: 'Money Out', value: data.totals.out, color: 'var(--text-primary)' },
                { label: 'Balance', value: data.totals.balance,
                  color: Number(data.totals.balance) < 0 ? 'var(--status-error)' : 'var(--brand)' },
              ].map(k => (
                <div key={k.label} style={{ ...CARD, padding: '12px 16px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: k.color }}>{fmt(k.value)}</div>
                </div>
              ))}
            </div>

            {/* Movements */}
            <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', fontWeight: 800 }}>
                Movements <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>— every transfer, cash-in and voucher that touched this account</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Date', 'Type', 'Description', 'Reference', 'Journal', 'In', 'Out'].map(h => (
                        <th key={h} style={{ ...TD, textAlign: h === 'In' || h === 'Out' ? 'right' : 'left',
                          fontSize: 'var(--text-xs)', textTransform: 'uppercase', color: 'var(--text-secondary)', background: 'var(--surface-secondary)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((m, i) => (
                      <tr key={i}>
                        <td style={{ ...TD, whiteSpace: 'nowrap' }}>{dmy(m.date)}</td>
                        <td style={TD}><Badge variant={m.source === 'Bank transfer' ? 'info' : 'default'}>{m.source}</Badge>
                          {m.status === 'draft' && <Badge variant="warning">draft</Badge>}</td>
                        <td style={{ ...TD, maxWidth: 420 }}>{m.description || '—'}</td>
                        <td style={{ ...TD, fontFamily: 'monospace' }}>{m.reference || '—'}</td>
                        <td style={TD}>
                          {m.journal_number
                            ? <Link href={`/accounting/journal/${m.journal_id}`} style={{ color: 'var(--brand)', fontFamily: 'monospace', textDecoration: 'none', fontWeight: 600 }}>{m.journal_number}</Link>
                            : <span style={{ color: 'var(--text-secondary)' }}>draft</span>}
                        </td>
                        <td style={{ ...NUM, color: Number(m.in) > 0 ? 'var(--status-success, #2e7d32)' : 'var(--text-muted)' }}>{Number(m.in) > 0 ? fmt(m.in) : '—'}</td>
                        <td style={{ ...NUM, color: Number(m.out) > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>{Number(m.out) > 0 ? fmt(m.out) : '—'}</td>
                      </tr>
                    ))}
                    {!data.movements.length && (
                      <tr><td colSpan={7} style={{ ...TD, color: 'var(--text-secondary)' }}>No movements yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
