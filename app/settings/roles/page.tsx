'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { rolesApi, Role } from '@/lib/api/roles';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { Button, Checkbox, Loader, PageShell, PageHeader, Drawer } from '@/components/ui';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: color || 'var(--text-tertiary)',
        flexShrink: 0,
      }}
    />
  );
}

const LEVEL_OPTIONS = [
  { value: 0,   label: '0 — Employee' },
  { value: 15,  label: '15 — Officer / Team Lead' },
  { value: 20,  label: '20 — Manager' },
  { value: 30,  label: '30 — HR Operations' },
  { value: 35,  label: '35 — HR Admin' },
  { value: 40,  label: '40 — Admin' },
  { value: 100, label: '100 — Super' },
];

const EMPTY_FORM = { name: '', description: '', color: '#2563EB', level: 0, parent: '' };

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RolesPage() {
  const { isTenantAdmin, isPlatformAdmin } = useMyPermissions();
  const isAdmin = isTenantAdmin || isPlatformAdmin;
  const queryClient = useQueryClient();

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [rightTab, setRightTab] = useState<'permissions' | 'compare'>('permissions');
  const [compareRoleId, setCompareRoleId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
  const toggleModule = (key: string) =>
    setCollapsedModules(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => rolesApi.getAll(),
    enabled: isAdmin,
  });

  const { data: catalog } = useQuery({
    queryKey: ['roles-catalog'],
    queryFn: () => rolesApi.getCatalog(),
    enabled: isAdmin,
  });

  const { data: selectedRole, isLoading: roleLoading } = useQuery({
    queryKey: ['role', selectedRoleId],
    queryFn: () => rolesApi.getById(selectedRoleId!),
    enabled: !!selectedRoleId,
  });

  const { data: compareRole } = useQuery({
    queryKey: ['role', compareRoleId],
    queryFn: () => rolesApi.getById(compareRoleId!),
    enabled: !!compareRoleId,
  });

  // Reset compare when selected role changes
  useEffect(() => { setCompareRoleId(null); }, [selectedRoleId]);

  // Pre-fill edit form when opening
  useEffect(() => {
    if (drawerMode === 'edit' && selectedRole) {
      setForm({
        name: selectedRole.name,
        description: selectedRole.description ?? '',
        color: selectedRole.color || '#2563EB',
        level: selectedRole.level,
        parent: selectedRole.parent?.toString() ?? '',
      });
    } else if (drawerMode === 'create') {
      setForm({ ...EMPTY_FORM });
    }
  }, [drawerMode, drawerOpen, selectedRole]);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      rolesApi.create({ ...data, parent: data.parent ? Number(data.parent) : null }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast('Role created', 'success');
      setDrawerOpen(false);
      setSelectedRoleId(created.id);
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to create role'), 'error');
    },
  });

  const updateMetaMutation = useMutation({
    mutationFn: (data: typeof EMPTY_FORM) =>
      rolesApi.update(selectedRoleId!, { ...data, parent: data.parent ? Number(data.parent) : null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', selectedRoleId] });
      toast('Role updated', 'success');
      setDrawerOpen(false);
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to update role'), 'error');
    },
  });

  const permMutation = useMutation({
    mutationFn: (permissionIds: number[]) =>
      rolesApi.update(selectedRoleId!, { permission_ids: permissionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', selectedRoleId] });
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to save permissions'), 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => rolesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast('Role deleted', 'success');
      setDrawerOpen(false);
      setSelectedRoleId(null);
    },
    onError: (err: unknown) => {
      toast(getApiError(err, 'Failed to delete role'), 'error');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePermToggle = (permId: number, checked: boolean) => {
    if (!selectedRole || !selectedRole.is_editable) return;
    const current = selectedRole.granted_permission_ids;
    const next = checked ? [...current, permId] : current.filter((id) => id !== permId);
    permMutation.mutate(next);
  };

  const handleCatToggle = (catPerms: { id: number }[], grant: boolean) => {
    if (!selectedRole?.is_editable) return;
    const ids = catPerms.map(p => p.id);
    const idSet = new Set(ids);
    const current = selectedRole.granted_permission_ids;
    const next = grant ? [...new Set([...current, ...ids])] : current.filter(id => !idSet.has(id));
    permMutation.mutate(next);
  };

  const handleModToggle = (modAllIds: number[], grant: boolean) => {
    if (!selectedRole?.is_editable) return;
    const modSet = new Set(modAllIds);
    const current = selectedRole.granted_permission_ids;
    const next = grant ? [...new Set([...current, ...modAllIds])] : current.filter(id => !modSet.has(id));
    permMutation.mutate(next);
  };

  const handleGrantAll = () => {
    if (!selectedRole?.is_editable || !catalog) return;
    const allIds = catalog.modules.flatMap(m => m.categories.flatMap(c => c.permissions.map(p => p.id)));
    permMutation.mutate([...new Set(allIds)]);
  };

  const handleRevokeAll = async () => {
    if (!selectedRole?.is_editable) return;
    const { confirm } = await import('@/lib/hooks/use-toast');
    const ok = await confirm(`Remove all permissions from "${selectedRole.name}"?`);
    if (!ok) return;
    permMutation.mutate([]);
  };

  const handleSaveForm = () => {
    if (!form.name.trim()) { toast('Role name is required', 'error'); return; }
    if (drawerMode === 'create') createMutation.mutate(form);
    else updateMetaMutation.mutate(form);
  };

  const handleDelete = async () => {
    if (!selectedRole) return;
    const { confirm } = await import('@/lib/hooks/use-toast');
    const ok = await confirm(`Delete role "${selectedRole.name}"? This cannot be undone.`);
    if (!ok) return;
    deleteMutation.mutate(selectedRole.id);
  };

  // ── Filtered role list ─────────────────────────────────────────────────────
  const filteredRoles = roles.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  );

  // ── Access gate ────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Access denied. Company admin only.</p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const cardBase: React.CSSProperties = {
    padding: 'var(--space-3)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    backgroundColor: 'var(--surface-default)',
    marginBottom: 'var(--space-2)',
  };
  const cardSelected: React.CSSProperties = {
    ...cardBase,
    border: '2px solid var(--brand)',
    backgroundColor: 'var(--surface-subtle)',
  };

  // ── Compare diff ───────────────────────────────────────────────────────────
  const diffData = (() => {
    if (!selectedRole || !compareRole) return null;
    const aIds = new Set(selectedRole.granted_permission_ids);
    const bIds = new Set(compareRole.granted_permission_ids);
    const onlyInA: number[] = [...aIds].filter((id) => !bIds.has(id));
    const onlyInB: number[] = [...bIds].filter((id) => !aIds.has(id));
    const inBoth: number[] = [...aIds].filter((id) => bIds.has(id));
    return { onlyInA, onlyInB, inBoth };
  })();

  // Build a flat permission map from catalog for labels
  const permLabelMap: Record<number, string> = {};
  catalog?.modules.forEach((mod) =>
    mod.categories.forEach((cat) =>
      cat.permissions.forEach((p) => {
        permLabelMap[p.id] = `${cat.label} — ${p.action_label}`;
      }),
    ),
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Role Management"
          description="Create and configure roles, assign permissions via the matrix, and assign roles to employees."
          breadcrumbs={[{ label: 'Settings' }, { label: 'Roles' }]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-6)', alignItems: 'flex-start' }}>

          {/* ══ LEFT SIDEBAR ══════════════════════════════════════════════ */}
          <div>
            <Button
              variant="primary"
              size="sm"
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
              onClick={() => { setDrawerMode('create'); setDrawerOpen(true); }}
            >
              + New Role
            </Button>

            <div style={{ marginBottom: 'var(--space-3)' }}>
              <input
                className="form-input"
                placeholder="Search roles…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {rolesLoading ? (
              <Loader />
            ) : filteredRoles.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 'var(--space-4)' }}>
                No roles found
              </p>
            ) : (
              filteredRoles.map((role) => (
                <div
                  key={role.id}
                  style={selectedRoleId === role.id ? cardSelected : cardBase}
                  onClick={() => { setSelectedRoleId(role.id); setRightTab('permissions'); }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <ColorDot color={role.color} />
                    <span style={{ fontWeight: 500, fontSize: '0.875rem', flex: 1 }}>{role.name}</span>
                    {role.is_system && (
                      <span style={{ fontSize: '0.6875rem', padding: '1px 6px', borderRadius: 4, background: 'var(--surface-subtle)', color: 'var(--text-tertiary)', border: '1px solid var(--border-subtle)' }}>
                        System
                      </span>
                    )}
                  </div>
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                    Level {role.level} · {role.permissions_count} permissions
                    {role.parent_name && ` · inherits ${role.parent_name}`}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* ══ RIGHT PANEL ═══════════════════════════════════════════════ */}
          <div>
            {!selectedRoleId ? (
              <div className="card empty-state">
                <p className="empty-state-title">Select a role</p>
                <p className="empty-state-desc">Click a role on the left to view and edit its permissions.</p>
              </div>
            ) : roleLoading ? (
              <Loader />
            ) : selectedRole ? (
              <>
                {/* Role header */}
                <div className="card" style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: selectedRole.color || 'var(--border-subtle)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{selectedRole.name}</span>
                        {selectedRole.is_system && (
                          <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                            System Role
                          </span>
                        )}
                      </div>
                      {selectedRole.description && (
                        <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{selectedRole.description}</p>
                      )}
                      <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                        Level {selectedRole.level}
                        {selectedRole.parent_name && ` · Inherits from: ${selectedRole.parent_name}`}
                      </p>
                    </div>
                    {selectedRole.is_editable && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setDrawerMode('edit'); setDrawerOpen(true); }}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                {/* Right tabs */}
                <div className="tab-row" style={{ marginBottom: 'var(--space-4)' }}>
                  <button className={`tab-row-item${rightTab === 'permissions' ? ' active' : ''}`} onClick={() => setRightTab('permissions')}>
                    Permissions
                  </button>
                  <button className={`tab-row-item${rightTab === 'compare' ? ' active' : ''}`} onClick={() => setRightTab('compare')}>
                    Compare
                  </button>
                </div>

                {/* ── Permissions tab ── */}
                {rightTab === 'permissions' && (() => {
                  const totalPerms = catalog?.modules.reduce((s, m) => s + m.categories.reduce((s2, c) => s2 + c.permissions.length, 0), 0) ?? 0;
                  const grantedCount = selectedRole.granted_permission_ids.length;
                  const pct = totalPerms > 0 ? Math.round((grantedCount / totalPerms) * 100) : 0;
                  return (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

                      {/* ── Sticky toolbar ── */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
                        background: 'var(--surface-default)',
                        position: 'sticky', top: 0, zIndex: 2,
                        gap: 'var(--space-3)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                          {/* Progress bar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 120, height: 6, borderRadius: 3, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 3,
                                background: pct === 100 ? 'var(--status-success)' : pct > 50 ? 'var(--brand)' : 'var(--status-warning)',
                                width: `${pct}%`, transition: 'width 200ms',
                              }} />
                            </div>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              <strong style={{ color: 'var(--text-primary)' }}>{grantedCount}</strong>
                              {' / '}{totalPerms}
                              <span style={{ color: 'var(--text-tertiary)', marginLeft: 4 }}>({pct}%)</span>
                            </span>
                          </div>
                          {permMutation.isPending && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg style={{ animation: 'spin 1s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                              Saving…
                            </span>
                          )}
                        </div>
                        {selectedRole.is_editable && (
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button
                              onClick={handleGrantAll}
                              disabled={permMutation.isPending || grantedCount === totalPerms}
                              style={{
                                fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                border: '1px solid var(--brand)', color: 'var(--brand)',
                                background: 'transparent', cursor: 'pointer',
                                opacity: (permMutation.isPending || grantedCount === totalPerms) ? 0.4 : 1,
                                transition: 'all 120ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--brand-subtle)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                            >
                              Grant All
                            </button>
                            <button
                              onClick={handleRevokeAll}
                              disabled={permMutation.isPending || grantedCount === 0}
                              style={{
                                fontSize: '0.75rem', fontWeight: 600, padding: '4px 10px', borderRadius: 6,
                                border: '1px solid var(--error)', color: 'var(--error)',
                                background: 'transparent', cursor: 'pointer',
                                opacity: (permMutation.isPending || grantedCount === 0) ? 0.4 : 1,
                                transition: 'all 120ms',
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--status-error-bg)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                            >
                              Revoke All
                            </button>
                          </div>
                        )}
                      </div>

                      {/* ── Modules ── */}
                      {!catalog ? (
                        <div style={{ padding: 'var(--space-4)' }}><Loader /></div>
                      ) : catalog.modules.length === 0 ? (
                        <p style={{ padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No permissions in catalog.</p>
                      ) : catalog.modules.map((mod) => {
                        const modAllIds = mod.categories.flatMap(c => c.permissions.map(p => p.id));
                        const grantedInMod = modAllIds.filter(id => selectedRole.granted_permission_ids.includes(id));
                        const allModGranted = modAllIds.length > 0 && grantedInMod.length === modAllIds.length;
                        const someModGranted = grantedInMod.length > 0 && !allModGranted;
                        const isCollapsed = collapsedModules.has(mod.key);

                        return (
                          <div key={mod.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>

                            {/* Module header — clickable to collapse */}
                            <div
                              onClick={() => toggleModule(mod.key)}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 16px',
                                background: 'var(--surface-subtle)',
                                cursor: 'pointer', userSelect: 'none',
                              }}
                            >
                              {selectedRole.is_editable && (
                                <input
                                  type="checkbox"
                                  checked={allModGranted}
                                  ref={el => { if (el) el.indeterminate = someModGranted; }}
                                  onChange={e => { e.stopPropagation(); handleModToggle(modAllIds, e.target.checked); }}
                                  onClick={e => e.stopPropagation()}
                                  disabled={permMutation.isPending}
                                  title={allModGranted ? 'Deselect module' : 'Select all in module'}
                                  style={{ width: 15, height: 15, accentColor: 'var(--brand)', cursor: 'pointer', flexShrink: 0 }}
                                />
                              )}
                              <span style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-secondary)', flex: 1 }}>
                                {mod.label || mod.key}
                              </span>
                              <span style={{
                                fontSize: '0.6875rem', fontWeight: 600, padding: '1px 7px', borderRadius: 10,
                                background: allModGranted ? 'var(--status-success-bg)' : someModGranted ? 'var(--brand-subtle)' : 'var(--surface-default)',
                                color: allModGranted ? 'var(--status-success)' : someModGranted ? 'var(--brand)' : 'var(--text-tertiary)',
                                border: '1px solid',
                                borderColor: allModGranted ? 'var(--status-success)' : someModGranted ? 'var(--brand)' : 'var(--border-subtle)',
                              }}>
                                {grantedInMod.length}/{modAllIds.length}
                              </span>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ flexShrink: 0, color: 'var(--text-tertiary)', transition: 'transform 150ms', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                <path d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>

                            {/* Categories */}
                            {!isCollapsed && (
                              <div style={{ padding: '4px 0 8px' }}>
                                {mod.categories.map((cat) => {
                                  const catIds = cat.permissions.map(p => p.id);
                                  const grantedInCat = catIds.filter(id => selectedRole.granted_permission_ids.includes(id));
                                  const allCatGranted = catIds.length > 0 && grantedInCat.length === catIds.length;
                                  const someCatGranted = grantedInCat.length > 0 && !allCatGranted;

                                  return (
                                    <div
                                      key={cat.key}
                                      style={{
                                        display: 'grid', gridTemplateColumns: '220px 1fr',
                                        gap: 'var(--space-3)', padding: '6px 16px',
                                        alignItems: 'center', borderRadius: 0,
                                        transition: 'background 100ms',
                                      }}
                                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                      {/* Category label + row-select */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                        {selectedRole.is_editable && (
                                          <input
                                            type="checkbox"
                                            checked={allCatGranted}
                                            ref={el => { if (el) el.indeterminate = someCatGranted; }}
                                            onChange={e => handleCatToggle(cat.permissions, e.target.checked)}
                                            disabled={permMutation.isPending}
                                            title={allCatGranted ? 'Deselect row' : 'Select all in row'}
                                            style={{ width: 14, height: 14, accentColor: 'var(--brand)', cursor: 'pointer', flexShrink: 0 }}
                                          />
                                        )}
                                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          {cat.label}
                                        </span>
                                      </div>

                                      {/* Permission chips */}
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                                        {cat.permissions.map((perm) => {
                                          const checked = selectedRole.granted_permission_ids.includes(perm.id);
                                          return (
                                            <label
                                              key={perm.id}
                                              style={{
                                                display: 'flex', alignItems: 'center', gap: 5,
                                                padding: '3px 9px', borderRadius: 6,
                                                border: '1px solid',
                                                borderColor: checked ? 'var(--brand)' : 'var(--border-subtle)',
                                                background: checked ? 'var(--brand-subtle)' : 'transparent',
                                                fontSize: '0.75rem', fontWeight: checked ? 600 : 400,
                                                color: checked ? 'var(--brand)' : 'var(--text-secondary)',
                                                cursor: selectedRole.is_editable ? 'pointer' : 'default',
                                                opacity: selectedRole.is_editable ? 1 : 0.6,
                                                transition: 'all 100ms',
                                                userSelect: 'none',
                                              }}
                                            >
                                              <Checkbox
                                                checked={checked}
                                                disabled={!selectedRole.is_editable || permMutation.isPending}
                                                onChange={(e) => handlePermToggle(perm.id, e.target.checked)}
                                              />
                                              {perm.action_label}
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ── Compare tab ── */}
                {rightTab === 'compare' && (
                  <div className="card">
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                      Compare <strong>{selectedRole.name}</strong> with another role:
                    </p>
                    <select
                      className="form-select"
                      value={compareRoleId ?? ''}
                      onChange={(e) => setCompareRoleId(e.target.value ? Number(e.target.value) : null)}
                      style={{ maxWidth: 280, marginBottom: 'var(--space-5)' }}
                    >
                      <option value="">Select a role to compare…</option>
                      {roles.filter((r) => r.id !== selectedRoleId).map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>

                    {compareRoleId && diffData && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                        {/* Only in A */}
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#15803d', marginBottom: 'var(--space-2)' }}>
                            Only in {selectedRole.name} ({diffData.onlyInA.length})
                          </p>
                          {diffData.onlyInA.length === 0 ? (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>None</p>
                          ) : (
                            diffData.onlyInA.map((id) => (
                              <div key={id} style={{ fontSize: '0.8125rem', padding: '3px 8px', borderRadius: 4, background: '#f0fdf4', color: '#166534', marginBottom: 2 }}>
                                {permLabelMap[id] ?? `Permission #${id}`}
                              </div>
                            ))
                          )}
                        </div>
                        {/* Only in B */}
                        <div>
                          <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#c2410c', marginBottom: 'var(--space-2)' }}>
                            Only in {compareRole?.name} ({diffData.onlyInB.length})
                          </p>
                          {diffData.onlyInB.length === 0 ? (
                            <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>None</p>
                          ) : (
                            diffData.onlyInB.map((id) => (
                              <div key={id} style={{ fontSize: '0.8125rem', padding: '3px 8px', borderRadius: 4, background: '#fff7ed', color: '#9a3412', marginBottom: 2 }}>
                                {permLabelMap[id] ?? `Permission #${id}`}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {compareRoleId && diffData && (
                      <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
                          {diffData.inBoth.length} permission(s) shared by both roles.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* ══ Create / Edit Drawer ══════════════════════════════════════════ */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={drawerMode === 'create' ? 'New Role' : `Edit: ${selectedRole?.name ?? ''}`}
          footer={
            <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
              {drawerMode === 'edit' && selectedRole?.is_editable && (
                <Button
                  variant="ghost"
                  size="sm"
                  style={{ color: 'var(--error)', marginRight: 'auto' }}
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                >
                  Delete Role
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveForm}
                disabled={createMutation.isPending || updateMetaMutation.isPending}
              >
                {createMutation.isPending || updateMetaMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-field">
              <label className="form-label">Name *</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Procurement Viewer"
              />
            </div>

            <div className="form-field">
              <label className="form-label">Description</label>
              <textarea
                className="form-textarea"
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                placeholder="Optional description"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-field">
                <label className="form-label">Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    style={{ width: 36, height: 36, border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2 }}
                  />
                  <input
                    className="form-input"
                    value={form.color}
                    onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                    placeholder="#2563EB"
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Level</label>
                <select
                  className="form-select"
                  value={form.level}
                  onChange={(e) => setForm((p) => ({ ...p, level: Number(e.target.value) }))}
                >
                  {LEVEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-field">
              <label className="form-label">Parent Role (inherits permissions)</label>
              <select
                className="form-select"
                value={form.parent}
                onChange={(e) => setForm((p) => ({ ...p, parent: e.target.value }))}
              >
                <option value="">— No parent —</option>
                {roles
                  .filter((r) => r.id !== selectedRoleId)
                  .map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
              </select>
            </div>
          </div>
        </Drawer>
      </PageShell>
    </MainLayout>
  );
}
