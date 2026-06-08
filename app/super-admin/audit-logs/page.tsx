'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import type { AuditLogEntry } from '@/types/saas';

const ACTION_OPTIONS = [
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT',
  'APPROVE', 'REJECT', 'ENABLE', 'DISABLE',
  'EXPORT', 'INVITE', 'GENERATE_CODE', 'PLAN_CHANGE', 'MODULE_TOGGLE',
];

const ACTION_COLORS: Record<string, string> = {
  CREATE:        'var(--color-success)',
  UPDATE:        'var(--color-info)',
  DELETE:        'var(--color-error)',
  LOGIN:         'var(--color-success)',
  LOGOUT:        'var(--text-secondary)',
  APPROVE:       'var(--color-success)',
  REJECT:        'var(--color-error)',
  ENABLE:        'var(--color-success)',
  DISABLE:       'var(--color-warning)',
  PLAN_CHANGE:   'var(--wine-500)',
  MODULE_TOGGLE: 'var(--color-warning)',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function ActionBadge({ action }: { action: string }) {
  const color = ACTION_COLORS[action] ?? 'var(--text-secondary)';
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 7px',
      borderRadius: 99,
      fontSize: 11, fontWeight: 600,
      color,
      background: `${color}18`,
    }}>
      {action}
    </span>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['super', 'audit-logs', page, action],
    queryFn: () => tenantApi.listAuditLogs({ page, action: action || undefined }),
    staleTime: 30_000,
  });

  const logs: AuditLogEntry[] = data?.results ?? [];
  const totalPages = data ? Math.ceil(data.count / 20) : 1;

  const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' };
  const tdStyle: React.CSSProperties = { padding: '11px 14px', fontSize: 12, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'middle' };

  return (
    <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Audit Logs</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            {data ? `${data.count} events` : '…'}
          </p>
        </div>

        {/* Filter */}
        <div style={{ marginBottom: 16 }}>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-input)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}
          >
            <option value="">All Actions</option>
            {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'auto' }}>
          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>Loading…</div>
          ) : logs.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>No logs found.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  <th style={thStyle}>Time</th>
                  <th style={thStyle}>Actor</th>
                  <th style={thStyle}>Action</th>
                  <th style={thStyle}>Resource</th>
                  <th style={thStyle}>Company</th>
                  <th style={thStyle}>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {formatDate(log.created_at)}
                    </td>
                    <td style={tdStyle}>{log.actor_username ?? 'system'}</td>
                    <td style={tdStyle}><ActionBadge action={log.action} /></td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{log.resource}</span>
                      {log.resource_id && <span style={{ color: 'var(--text-secondary)' }}> #{log.resource_id}</span>}
                    </td>
                    <td style={tdStyle}>{log.tenant_name ?? '—'}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                      {log.ip_address ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 16, justifyContent: 'flex-end' }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1 }}>
              Prev
            </button>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-primary)', fontSize: 13, cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        )}
      </div>
  );
}
