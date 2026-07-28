'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import { costCategoriesApi, CostCategory } from '@/lib/api/project-costs';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const COST_TYPE_OPTIONS = [
  { value: 'labor',         label: 'Labor' },
  { value: 'material',      label: 'Material' },
  { value: 'equipment',     label: 'Equipment' },
  { value: 'expense',       label: 'Expense' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'fuel',          label: 'Fuel' },
  { value: 'transport',     label: 'Transport' },
  { value: 'custom',        label: 'Custom' },
];

const COST_TYPE_COLORS: Record<string, string> = {
  labor:         'var(--color-info)',
  material:      'var(--color-warning)',
  equipment:     'var(--color-success)',
  expense:       'var(--text-secondary)',
  subcontractor: 'var(--color-error)',
  fuel:          'var(--brand)',
  transport:     'var(--color-info)',
  custom:        'var(--text-tertiary)',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugifyCode(name: string): string {
  return name.toUpperCase().trim().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

// ── Styles ────────────────────────────────────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

// ── Form state ────────────────────────────────────────────────────────────────

const EMPTY_FORM = { name: '', code: '', cost_type: 'custom', is_active: true };
type FormState = typeof EMPTY_FORM;

// ── Modal ─────────────────────────────────────────────────────────────────────

function CostCategoryModal({
  item,
  onClose,
  onSave,
  isSaving,
}: {
  item: CostCategory | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    item
      ? { name: item.name, code: item.code, cost_type: item.cost_type, is_active: item.is_active }
      : EMPTY_FORM,
  );

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) return;
    onSave(form);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: 'var(--space-8) var(--space-4)',
        overflowY: 'auto',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 'var(--space-6)', position: 'relative' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {item ? 'Edit Cost Category' : 'Create Cost Category'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

          {/* Name */}
          <div>
            <label style={LABEL_STYLE}>Name <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input
              value={form.name}
              onChange={e => {
                const v = e.target.value;
                setForm(prev => ({ ...prev, name: v, ...(item ? {} : { code: slugifyCode(v) }) }));
              }}
              placeholder="e.g. Diesel Fuel"
              required
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)' }}
            />
            {form.code && !item && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0', fontFamily: 'monospace' }}>
                Code: <strong>{form.code}</strong>
              </p>
            )}
          </div>

          {/* Code — editable when editing */}
          {item && (
            <div>
              <label style={LABEL_STYLE}>Code <span style={{ color: 'var(--color-error)' }}>*</span></label>
              <input
                value={form.code}
                onChange={e => set('code', slugifyCode(e.target.value) || e.target.value.toUpperCase())}
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}
              />
            </div>
          )}

          {/* Cost Type */}
          <div>
            <label style={LABEL_STYLE}>Cost Type <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <select
              value={form.cost_type}
              onChange={e => set('cost_type', e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: 'var(--text-sm)' }}
            >
              {COST_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 40, height: 22, borderRadius: 99, flexShrink: 0,
                background: form.is_active ? 'var(--brand)' : 'var(--border-default)',
                position: 'relative', cursor: 'pointer', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: 'var(--primary-foreground)',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {form.is_active ? 'Active' : 'Inactive'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.name.trim() || !form.code.trim()}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--brand)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? 'Saving...' : item ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CostCategoriesPage() {
  const { hasPermission } = useMyPermissions();
  const canEdit = hasPermission('settings.settings.update');
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const { search } = tableState;

  const [modalItem, setModalItem] = useState<CostCategory | null | 'new'>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['cost-categories'],
    queryFn: () => costCategoriesApi.getCostCategories(),
    staleTime: 60_000,
  });

  const filtered = !search
    ? items
    : items.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.cost_type.toLowerCase().includes(search.toLowerCase())
      );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['cost-categories'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => costCategoriesApi.createCostCategory(data),
    onSuccess: () => { invalidate(); setModalItem(null); toast('Cost category created', 'success'); },
    onError: () => toast('Failed to create cost category', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => costCategoriesApi.updateCostCategory(id, data),
    onSuccess: () => { invalidate(); setModalItem(null); toast('Cost category updated', 'success'); },
    onError: () => toast('Failed to update cost category', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => costCategoriesApi.deleteCostCategory(id),
    onSuccess: () => { invalidate(); toast('Cost category deleted', 'success'); },
    onError: () => toast('Failed to delete cost category', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalItem === 'new') {
      createMutation.mutate(data);
    } else if (modalItem) {
      updateMutation.mutate({ id: modalItem.id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<CostCategory>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '130px',
      render: (c) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
          color: 'var(--primary-foreground)', background: 'var(--brand)',
          padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block',
          opacity: c.is_active ? 1 : 0.5,
        }}>
          {c.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (c) => (
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
          {c.name}
        </p>
      ),
    },
    {
      key: 'cost_type',
      header: 'Cost Type',
      width: '130px',
      render: (c) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1-5)',
          fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-medium)',
          padding: '2px 8px', borderRadius: 'var(--radius-sm)',
          background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: COST_TYPE_COLORS[c.cost_type] ?? 'var(--text-tertiary)',
          }} />
          {c.cost_type_display ?? c.cost_type}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: (c) => (
        <Badge variant={c.is_active ? 'active' : 'inactive'} size="sm">
          {c.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: (c) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => setModalItem(c) },
            { separator: true },
            {
              label: 'Delete',
              variant: 'danger',
              onClick: async () => {
                if (await confirm(`Delete cost category "${c.name}"?`)) {
                  deleteMutation.mutate(c.id);
                }
              },
            },
          ]}
        />
      ),
    },
  ];

  return (
    <AppListPage
      title="Cost Categories"
      description="Define cost categories used to classify project expenses and work logs."
      sideNav={<HRSettingsNav />}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'HR' },
        { label: 'Settings', href: '/hr/settings' },
        { label: 'Cost Categories' },
      ]}
      totalCount={items.length}
      createAction={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => setModalItem('new')}>
            + Add Category
          </Button>
        ) : undefined
      }
      selectable={false}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No cost categories defined yet."
      tableState={tableState}
      searchPlaceholder="Search categories..."
    >
      {modalItem !== null && (
        <CostCategoryModal
          item={modalItem === 'new' ? null : modalItem}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </AppListPage>
  );
}