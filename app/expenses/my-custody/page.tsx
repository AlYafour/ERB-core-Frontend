'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Badge } from '@/components/ui';
import { expensesApi, type MyCustody } from '@/lib/api/expenses';
import { formatPrice } from '@/lib/utils/format';

const money = (v: string) => formatPrice(Number(v) || 0);

export default function MyCustodyPage() {
  const { data: custodies = [], isLoading } = useQuery({
    queryKey: ['my-custody'],
    queryFn: expensesApi.myCustody,
    refetchInterval: 60_000,
  });

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="My Custody"
          description="The petty-cash you personally hold — what you received, what you spent, and your balance"
          breadcrumbs={[{ label: 'Expenses', href: '/expenses' }, { label: 'My Custody' }]}
        />

        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : custodies.length === 0 ? (
          <div style={{
            padding: '60px 24px', textAlign: 'center',
            background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💼</div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>No custody assigned</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>
              You are not registered to hold cash from any petty-cash box yet.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {custodies.map((c) => <CustodyCard key={c.worker_id} custody={c} />)}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}

function CustodyCard({ custody }: { custody: MyCustody }) {
  const [open, setOpen] = useState(false);
  const balance = Number(custody.balance) || 0;
  const balanceColor = balance < 0 ? 'var(--status-error)' : 'var(--text-primary)';

  const { data: vouchers = [], isLoading } = useQuery({
    queryKey: ['my-custody-vouchers', custody.worker_id],
    queryFn: () => expensesApi.myCustodyVouchers(custody.worker_id),
    enabled: open,
  });

  const stat = (label: string, value: string, color?: string) => (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, fontFamily: 'monospace', color: color ?? 'var(--text-primary)' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '18px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-md)', color: 'var(--text-primary)', marginBottom: 14 }}>
          {custody.box_name}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {stat('Received', money(custody.received))}
          {stat('Spent', money(custody.spent))}
          {stat('Balance', money(custody.balance), balanceColor)}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '10px 20px', textAlign: 'left', cursor: 'pointer',
          background: 'var(--surface-secondary)', border: 'none', borderTop: '1px solid var(--border-subtle)',
          color: 'var(--brand)', fontSize: 'var(--text-sm)', fontWeight: 600,
        }}>
        {open ? 'Hide vouchers ▲' : 'Show my vouchers ▼'}
      </button>
      {open && (
        <div style={{ padding: '4px 20px 16px' }}>
          {isLoading ? (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading…</div>
          ) : vouchers.length === 0 ? (
            <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No vouchers charged to you on this box.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Number', 'Date', 'Description', 'Amount', 'Status'].map((h, i) => (
                    <th key={h} style={{
                      padding: '8px 10px', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)',
                      textTransform: 'uppercase', borderBottom: '1px solid var(--border-subtle)',
                      textAlign: i === 3 ? 'right' : 'left',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id}>
                    <td style={{ padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)', fontFamily: 'monospace' }}>{v.number}</td>
                    <td style={{ padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' }}>{v.date}</td>
                    <td style={{ padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' }}>{v.description || '—'}</td>
                    <td style={{ padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'right', fontFamily: 'monospace' }}>{money(v.amount)}</td>
                    <td style={{ padding: '9px 10px', fontSize: 'var(--text-sm)', borderBottom: '1px solid var(--border-subtle)' }}><Badge variant="default">{v.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
