'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppListPage } from '@/components/app/AppListPage';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge, Button } from '@/components/ui';
import { teamTypesApi, TeamType } from '@/lib/api/team-types';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';

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

const EMPTY_FORM = { name: '', code: '', is_active: true };
type FormState = typeof EMPTY_FORM;

// ── Modal ─────────────────────────────────────────────────────────────────────

function TeamTypeModal({
  item,
  onClose,
  onSave,
  isSaving,
}: {
  item: TeamType | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    item ? { name: item.name, code: item.code, is_active: item.is_active } : EMPTY_FORM,
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
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 'var(--space-6)', position: 'relative' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {item ? 'Edit Team Type' : 'Create Team Type'}
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
              placeholder="e.g. Site Crew"
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
                placeholder="e.g. SITE_CREW"
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)', fontFamily: 'monospace' }}
              />
            </div>
          )}

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

export default function TeamTypesPage() {
  const { hasPermission } = useMyPermissions();
  const canEdit = hasPermission('settings.settings.update');
  const queryClient = useQueryClient();
  const tableState = useTableState();
  const { search } = tableState;

  const [modalItem, setModalItem] = useState<TeamType | null | 'new'>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['team-types'],
    queryFn: () => teamTypesApi.getTeamTypes(),
    staleTime: 60_000,
  });

  const allItems: TeamType[] = raw?.results ?? [];

  const filtered = !search
    ? allItems
    : allItems.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.code.toLowerCase().includes(search.toLowerCase())
      );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['team-types'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => teamTypesApi.createTeamType(data),
    onSuccess: () => { invalidate(); setModalItem(null); toast('Team type created', 'success'); },
    onError: () => toast('Failed to create team type', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => teamTypesApi.updateTeamType(id, data),
    onSuccess: () => { invalidate(); setModalItem(null); toast('Team type updated', 'success'); },
    onError: () => toast('Failed to update team type', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teamTypesApi.deleteTeamType(id),
    onSuccess: () => { invalidate(); toast('Team type deleted', 'success'); },
    onError: () => toast('Failed to delete team type', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalItem === 'new') {
      createMutation.mutate(data);
    } else if (modalItem) {
      updateMutation.mutate({ id: modalItem.id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const columns: Column<TeamType>[] = [
    {
      key: 'code',
      header: 'Code',
      width: '120px',
      render: (t) => (
        <span style={{
          fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
          color: 'var(--primary-foreground)', background: 'var(--brand)',
          padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block',
          opacity: t.is_active ? 1 : 0.5,
        }}>
          {t.code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (t) => (
        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
          {t.name}
        </p>
      ),
    },
    {
      key: 'is_active',
      header: 'Status',
      width: '90px',
      render: (t) => (
        <Badge variant={t.is_active ? 'active' : 'inactive'} size="sm">
          {t.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '48px',
      render: (t) => (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => setModalItem(t) },
            { separator: true },
            {
              label: 'Delete',
              variant: 'danger',
              onClick: async () => {
                if (await confirm(`Delete team type "${t.name}"?`)) {
                  deleteMutation.mutate(t.id);
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
      title="Team Types"
      description="Define the categories of work teams used across your organisation."
      sideNav={<HRSettingsNav />}
      breadcrumbs={[
        { label: 'Home', href: '/' },
        { label: 'HR' },
        { label: 'Settings', href: '/hr/settings' },
        { label: 'Team Types' },
      ]}
      totalCount={allItems.length}
      createAction={
        canEdit ? (
          <Button variant="primary" size="sm" onClick={() => setModalItem('new')}>
            + Add Team Type
          </Button>
        ) : undefined
      }
      selectable={false}
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      emptyTitle="No team types defined yet."
      tableState={tableState}
      searchPlaceholder="Search team types..."
    >
      {modalItem !== null && (
        <TeamTypeModal
          item={modalItem === 'new' ? null : modalItem}
          onClose={() => setModalItem(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </AppListPage>
  );
}