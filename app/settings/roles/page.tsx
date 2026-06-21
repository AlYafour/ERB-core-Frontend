'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { rolesApi, Role } from '@/lib/api/roles';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
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
    onError: (err: any) => {
      const msg = err?.response?.data?.name?.[0] ?? err?.response?.data?.detail ?? 'Failed to create role';
      toast(msg, 'error');
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
    onError: (err: any) => {
      const msg = err?.response?.data?.name?.[0] ?? err?.response?.data?.detail ?? 'Failed to update role';
      toast(msg, 'error');
    },
  });

  const permMutation = useMutation({
    mutationFn: (permissionIds: number[]) =>
      rolesApi.update(selectedRoleId!, { permission_ids: permissionIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role', selectedRoleId] });
    },
    onError: (err: any) => {
      toast(err?.response?.data?.detail ?? 'Failed to save permissions', 'error');
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
    onError: (err: any) => {
      toast(err?.response?.data?.detail ?? 'Failed to delete role', 'error');
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handlePermToggle = (permId: number, checked: boolean) => {
    if (!selectedRole || !selectedRole.is_editable) return;
    const current = selectedRole.granted_permission_ids;
    const next = checked ? [...current, permId] : current.filter((id) => id !== permId);
    permMutation.mutate(next);
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
                  {selectedRole.is_system && (
                    <p style={{ margin: 'var(--space-3) 0 0', fontSize: '0.8125rem', color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-2)' }}>
                      System roles are read-only. You can assign them to users but cannot modify their permissions.
                    </p>
                  )}
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
                {rightTab === 'permissions' && (
                  <div className="card">
                    {permMutation.isPending && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-3)' }}>
                        Saving…
                      </div>
                    )}
                    {!catalog ? (
                      <Loader />
                    ) : catalog.modules.length === 0 ? (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.875rem' }}>No permissions in catalog.</p>
                    ) : (
                      catalog.modules.map((mod) => (
                        <div key={mod.key}>
                          <div style={{ borderBottom: '1px solid var(--border-subtle)', padding: 'var(--space-2) 0', marginBottom: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
                              {mod.label || mod.key}
                            </span>
                          </div>
                          {mod.categories.map((cat) => (
                            <div
                              key={cat.key}
                              style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 'var(--space-2)', marginBottom: 'var(--space-3)', alignItems: 'center' }}
                            >
                              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{cat.label}</span>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                                {cat.permissions.map((perm) => {
                                  const checked = selectedRole.granted_permission_ids.includes(perm.id);
                                  return (
                                    <label
                                      key={perm.id}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                                        cursor: selectedRole.is_editable ? 'pointer' : 'default',
                                        opacity: selectedRole.is_editable ? 1 : 0.6,
                                      }}
                                    >
                                      <Checkbox
                                        checked={checked}
                                        disabled={!selectedRole.is_editable || permMutation.isPending}
                                        onChange={(e) => handlePermToggle(perm.id, e.target.checked)}
                                      />
                                      <span style={{ fontSize: '0.75rem' }}>{perm.action_label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}

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
