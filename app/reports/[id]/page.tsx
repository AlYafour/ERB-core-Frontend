'use client';

import { usePersistentState } from '@/lib/hooks/use-persistent-state';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReportDefinition,
  previewReport,
  exportReport,
  runReport,
  getReportExecutions,
  triggerDownload,
  type ReportResult,
  type ReportExecution,
} from '@/lib/api/reporting';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge } from '@/components/ui';

interface PageProps {
  params: { id: string };
}

const STATUS_COLOR: Record<string, string> = {
  pending:   '#f59e0b',
  running:   '#3b82f6',
  completed: '#22c55e',
  failed:    '#ef4444',
};

export default function ReportDetailPage({ params }: PageProps) {
  const router = useRouter();
  const qc     = useQueryClient();
  const id     = params.id;

  const [result, setResult]     = useState<ReportResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [page, setPage]         = usePersistentState('page', 1);
  const pageSize                = 50;

  const { data: definition, isLoading: defLoading } = useQuery({
    queryKey: ['report-def', id],
    queryFn:  () => getReportDefinition(id),
  });

  const { data: executions = [] } = useQuery<ReportExecution[]>({
    queryKey: ['report-execs', id],
    queryFn:  () => getReportExecutions(id),
    refetchInterval: 5000,
  });

  async function handlePreview(p = 1) {
    setLoading(true);
    setPage(p);
    try {
      const res = await previewReport(id, { page: p, page_size: pageSize });
      setResult(res);
    } catch {
      toast({ title: 'Preview failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(fmt: 'csv' | 'xlsx') {
    try {
      const blob = await exportReport(id, fmt);
      triggerDownload(blob, `${definition?.name ?? 'report'}.${fmt}`);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }

  async function handleRun() {
    try {
      await runReport(id);
      toast({ title: 'Report queued for background execution' });
      qc.invalidateQueries({ queryKey: ['report-execs', id] });
    } catch {
      toast({ title: 'Failed to queue report', variant: 'destructive' });
    }
  }

  if (defLoading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--muted-foreground)' }}>Loading…</div>;
  }

  if (!definition) {
    return <div style={{ padding: '48px', textAlign: 'center' }}>Report not found.</div>;
  }

  const totalPages = result ? Math.ceil(result.total_count / pageSize) : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <button onClick={() => router.push('/reports')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '20px' }}>←</button>
            <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>{definition.name}</h1>
            {definition.is_built_in && <Badge variant="default">Built-in</Badge>}
            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>v{definition.version}</span>
          </div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', margin: '0 0 0 36px' }}>
            Source: {definition.source_label}
          </p>
          {definition.description && (
            <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', margin: '4px 0 0 36px' }}>
              {definition.description}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => handlePreview(1)} disabled={loading}>
            {loading ? 'Loading…' : 'Preview'}
          </Button>
          <Button variant="secondary" onClick={() => handleExport('csv')}>Export CSV</Button>
          <Button variant="secondary" onClick={() => handleExport('xlsx')}>Export Excel</Button>
          <Button onClick={handleRun}>Run in Background</Button>
        </div>
      </div>

      {/* Preview table */}
      {result && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', marginBottom: '24px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              Preview — {result.total_count.toLocaleString()} row{result.total_count !== 1 ? 's' : ''}
              {result.truncated && <span style={{ color: 'var(--destructive)', marginLeft: '8px', fontSize: '12px' }}>⚠ truncated at 10,000</span>}
            </span>
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                <button
                  onClick={() => handlePreview(page - 1)}
                  disabled={page <= 1 || loading}
                  style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: 'var(--background)', color: 'var(--foreground)' }}
                >
                  ←
                </button>
                <span>Page {page} / {totalPages}</span>
                <button
                  onClick={() => handlePreview(page + 1)}
                  disabled={page >= totalPages || loading}
                  style={{ padding: '4px 10px', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', background: 'var(--background)', color: 'var(--foreground)' }}
                >
                  →
                </button>
              </div>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  {result.columns.map((col) => (
                    <th key={col.key} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={result.columns.length} style={{ padding: '24px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                      No data
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      {result.columns.map((col) => (
                        <td key={col.key} style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                          {row[col.key] === null || row[col.key] === undefined
                            ? <span style={{ color: 'var(--muted-foreground)' }}>—</span>
                            : String(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Summaries */}
          {Object.keys(result.summaries).length > 0 && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: '24px', fontSize: '13px' }}>
              {Object.entries(result.summaries).map(([k, v]) => (
                <span key={k}><strong>{k}:</strong> {String(v)}</span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Execution history */}
      {executions.length > 0 && (
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Execution History</h2>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--muted)' }}>
                  {['Triggered', 'Via', 'Status', 'Rows', 'Duration', 'Started'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {executions.map((ex) => (
                  <tr key={ex.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 12px' }}>{ex.triggered_by_username ?? '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{ex.triggered_via}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[ex.status] ?? '#888', flexShrink: 0 }} />
                        {ex.status}
                      </span>
                    </td>
                    <td style={{ padding: '7px 12px' }}>{ex.row_count?.toLocaleString() ?? '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{ex.duration_ms != null ? `${ex.duration_ms} ms` : '—'}</td>
                    <td style={{ padding: '7px 12px' }}>{ex.started_at ? new Date(ex.started_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
