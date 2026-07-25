'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  getSources,
  getSourceColumns,
  createReportDefinition,
  previewReport,
  type FilterSpec,
  type ReportSource,
} from '@/lib/api/reporting';
import { toast } from '@/lib/hooks/use-toast';
import { Button } from '@/components/ui';

const FILTER_OPS = ['eq', 'neq', 'contains', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null'] as const;

export default function NewReportPage() {
  const router = useRouter();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [source, setSource]           = useState('');
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [filters, setFilters]         = useState<FilterSpec[]>([]);
  const [sortBy, setSortBy]           = useState('');
  const [previewData, setPreviewData] = useState<{ columns: any[]; rows: any[] } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const { data: sources = [] } = useQuery({
    queryKey: ['report-sources'],
    queryFn:  getSources,
  });

  const { data: columns = [] } = useQuery({
    queryKey: ['report-columns', source],
    queryFn:  () => getSourceColumns(source),
    enabled:  Boolean(source),
  });

  const createMutation = useMutation({
    mutationFn: createReportDefinition,
    onSuccess: (rd) => {
      toast({ title: 'Report created' });
      router.push(`/reports/${rd.id}`);
    },
    onError: () => toast({ title: 'Failed to create report', variant: 'destructive' }),
  });

  function toggleColumn(key: string) {
    setSelectedCols((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function addFilter() {
    if (!columns.length) return;
    setFilters((prev) => [...prev, { column: columns[0].key, operator: 'eq', value: '' }]);
  }

  function removeFilter(idx: number) {
    setFilters((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateFilter(idx: number, patch: Partial<FilterSpec>) {
    setFilters((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handlePreview() {
    if (!source) return;
    setIsPreviewing(true);
    // Create a temporary definition to preview; for new reports use a fake ID placeholder
    // We call previewReport — but we don't have an ID yet. Instead use a temp definition
    // by saving then immediately previewing (or just show the preview from the runner directly).
    // Since we need a report ID to preview, we save first (unsaved = can't preview).
    // Simple workaround: show a message.
    toast({ title: 'Save the report first, then use Open to preview' });
    setIsPreviewing(false);
  }

  async function handleSave() {
    if (!name.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    if (!source)      { toast({ title: 'Source is required', variant: 'destructive' }); return; }

    createMutation.mutate({
      name,
      description,
      source,
      columns: selectedCols,
      filters,
      sort_by: sortBy ? [sortBy] : [],
      group_by: [],
      aggregations: [],
    });
  }

  const filterable = columns.filter((c) => c.filterable);

  return (
    <div style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: '24px' }}
        >
          ←
        </button>
        <h1 style={{ fontSize: '22px', fontWeight: 700, margin: 0 }}>New Report</h1>
      </div>

      <div style={{ display: 'grid', gap: '20px' }}>
        {/* Basic info */}
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }}>Basic Information</h2>
          <div style={{ display: 'grid', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Report name *</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monthly Headcount"
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="What does this report show?"
                style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)', resize: 'vertical' }}
              />
            </label>
          </div>
        </section>

        {/* Data source */}
        <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }}>Data Source *</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '8px' }}>
            {sources.map((s: ReportSource) => (
              <button
                key={s.key}
                onClick={() => { setSource(s.key); setSelectedCols([]); setFilters([]); }}
                style={{
                  padding: '10px 14px', border: `2px solid ${source === s.key ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '8px', background: source === s.key ? 'var(--primary)' : 'var(--background)',
                  color: source === s.key ? 'var(--primary-foreground)' : 'var(--foreground)',
                  cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: 500,
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* Columns */}
        {source && columns.length > 0 && (
          <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }}>
              Columns <span style={{ fontWeight: 400, color: 'var(--muted-foreground)', fontSize: '13px' }}>
                ({selectedCols.length} selected — leave empty for all)
              </span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
              {columns.map((col) => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={selectedCols.includes(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                  {col.sensitive && <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>🔒</span>}
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Filters */}
        {source && filterable.length > 0 && (
          <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Filters</h2>
              <Button size="sm" variant="secondary" onClick={addFilter}>+ Add Filter</Button>
            </div>
            {filters.length === 0 ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: '13px', margin: 0 }}>No filters — showing all rows.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {filters.map((f, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select
                      value={f.column}
                      onChange={(e) => updateFilter(idx, { column: e.target.value })}
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)' }}
                    >
                      {filterable.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                    <select
                      value={f.operator}
                      onChange={(e) => updateFilter(idx, { operator: e.target.value as FilterSpec['operator'] })}
                      style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)' }}
                    >
                      {FILTER_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                    <input
                      value={String(f.value ?? '')}
                      onChange={(e) => updateFilter(idx, { value: e.target.value })}
                      placeholder="value"
                      style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)' }}
                    />
                    <button onClick={() => removeFilter(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--destructive)', fontSize: '18px', lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Sort */}
        {source && columns.filter((c) => c.sortable).length > 0 && (
          <section style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '20px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 12px' }}>Sort By</h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--background)', color: 'var(--foreground)', minWidth: '220px' }}
            >
              <option value="">— No sort —</option>
              {columns.filter((c) => c.sortable).map((c) => (
                <>
                  <option key={c.key} value={c.key}>{c.label} (ASC)</option>
                  <option key={`-${c.key}`} value={`-${c.key}`}>{c.label} (DESC)</option>
                </>
              ))}
            </select>
          </section>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => router.back()}>Cancel</Button>
          <Button onClick={handleSave} disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
