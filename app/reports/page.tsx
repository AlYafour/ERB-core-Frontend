'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReportDefinitions,
  deleteReportDefinition,
  exportReport,
  triggerDownload,
  type ReportDefinition,
} from '@/lib/api/reporting';
import { confirm } from '@/lib/hooks/use-toast';
import { toast } from '@/lib/hooks/use-toast';
import { Button, Badge } from '@/components/ui';

export default function ReportsPage() {
  const router       = useRouter();
  const qc           = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['reports', search],
    queryFn:  () => getReportDefinitions(search ? { name: search } : undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteReportDefinition,
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['reports'] }); },
  });

  async function handleDelete(rd: ReportDefinition) {
    const ok = await confirm(`Delete report "${rd.name}"?`);
    if (!ok) return;
    deleteMutation.mutate(rd.id);
  }

  async function handleExport(rd: ReportDefinition, fmt: 'csv' | 'xlsx') {
    try {
      const blob = await exportReport(rd.id, fmt);
      triggerDownload(blob, `${rd.name}.${fmt}`);
    } catch {
      toast({ title: 'Export failed', variant: 'destructive' });
    }
  }

  const reports = data?.results ?? [];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Reports</h1>
          <p style={{ color: 'var(--muted-foreground)', margin: '4px 0 0' }}>
            Build, run, and export tenant reports
          </p>
        </div>
        <Button onClick={() => router.push('/reports/new')}>New Report</Button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          placeholder="Search reports…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '300px', padding: '8px 12px',
            border: '1px solid var(--border)', borderRadius: '6px',
            background: 'var(--background)', color: 'var(--foreground)',
          }}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted-foreground)' }}>
          Loading…
        </div>
      ) : reports.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '64px',
          border: '2px dashed var(--border)', borderRadius: '12px',
          color: 'var(--muted-foreground)',
        }}>
          <p style={{ fontSize: '16px', margin: '0 0 16px' }}>No reports found</p>
          <Button onClick={() => router.push('/reports/new')}>Create your first report</Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {reports.map((rd) => (
            <div
              key={rd.id}
              style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: '10px', padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '16px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>{rd.name}</span>
                  {rd.is_built_in && (
                    <Badge variant="secondary" style={{ fontSize: '11px' }}>Built-in</Badge>
                  )}
                  <span style={{
                    fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                    background: 'var(--muted)', color: 'var(--muted-foreground)',
                  }}>
                    {rd.source_label}
                  </span>
                </div>
                {rd.description && (
                  <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', margin: 0 }}>
                    {rd.description}
                  </p>
                )}
                <p style={{ color: 'var(--muted-foreground)', fontSize: '12px', margin: '4px 0 0' }}>
                  v{rd.version} · Updated {new Date(rd.updated_at).toLocaleDateString()}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <Button size="sm" variant="outline" onClick={() => router.push(`/reports/${rd.id}`)}>
                  Open
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport(rd, 'csv')}>
                  CSV
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleExport(rd, 'xlsx')}>
                  Excel
                </Button>
                {!rd.is_built_in && (
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(rd)}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
