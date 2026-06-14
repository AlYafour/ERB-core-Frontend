'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import type { EmployeeGroup } from '@/types';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isAdmin = (user: any) =>
  !!(user?.role === 'admin' || user?.role === 'super_admin' || user?.is_staff || user?.is_superuser);

const EMPTY_FORM = { name: '', name_ar: '', code: '', description: '', is_active: true };
type FormState = typeof EMPTY_FORM;

// ── Modal ─────────────────────────────────────────────────────────────────────
function GroupModal({
  group,
  onClose,
  onSave,
  isSaving,
}: {
  group: EmployeeGroup | null;
  onClose: () => void;
  onSave: (data: FormState) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<FormState>(
    group
      ? { name: group.name, name_ar: group.name_ar, code: group.code, description: group.description, is_active: group.is_active }
      : EMPTY_FORM,
  );

  const set = (key: keyof FormState, value: string | boolean) =>
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
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
      }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 520, padding: 'var(--space-6)', position: 'relative' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-5)' }}>
          {group ? 'Edit Group' : 'Create Employee Group'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Code */}
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)' }}>
              Code <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              value={form.code}
              onChange={e => set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="e.g. SITE, OFFICE, MAINTENANCE"
              required
              className="form-input"
              style={{ width: '100%', fontFamily: 'monospace', fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}
              maxLength={30}
            />
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 'var(--space-1) 0 0' }}>
              Uppercase letters, numbers, underscores only. Used by the approval engine — cannot change once assigned.
            </p>
          </div>

          {/* Name */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)' }}>
                Name <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Site Workers"
                required
                className="form-input"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)' }}>
                Name (Arabic)
              </label>
              <input
                value={form.name_ar}
                onChange={e => set('name_ar', e.target.value)}
                placeholder="الاسم بالعربية"
                className="form-input"
                dir="rtl"
                style={{ width: '100%', fontSize: 'var(--text-sm)' }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)' }}>
              Description
            </label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional — describe what this group covers"
              className="form-input"
              rows={3}
              style={{ width: '100%', fontSize: 'var(--text-sm)', resize: 'vertical' }}
            />
          </div>

          {/* Active toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', userSelect: 'none' }}>
            <div
              onClick={() => set('is_active', !form.is_active)}
              style={{
                width: 40, height: 22, borderRadius: 99, flexShrink: 0,
                background: form.is_active ? '#10b981' : 'var(--border-default)',
                position: 'relative', cursor: 'pointer', transition: 'background 200ms',
              }}
            >
              <div style={{
                position: 'absolute', top: 3, left: form.is_active ? 21 : 3,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>
              {form.is_active ? 'Active — employees can be assigned to this group' : 'Inactive — hidden from assignment pickers'}
            </span>
          </label>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', paddingTop: 'var(--space-2)', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="button" onClick={onClose} disabled={isSaving}
              style={{ padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !form.name.trim() || !form.code.trim()}
              style={{ padding: 'var(--space-2) var(--space-5)', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', opacity: isSaving ? 0.6 : 1 }}>
              {isSaving ? 'Saving…' : group ? 'Save Changes' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function EmployeeGroupsPage() {
  const { user: me } = useAuth();
  const admin = isAdmin(me);
  const queryClient = useQueryClient();

  const [modalGroup, setModalGroup] = useState<EmployeeGroup | null | 'new'>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ['hr-employee-groups'],
    queryFn: () => hrEmployeeGroupsApi.getAll(),
    staleTime: 60_000,
  });

  const groups: EmployeeGroup[] = raw?.results ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['hr-employee-groups'] });

  const createMutation = useMutation({
    mutationFn: (data: FormState) => hrEmployeeGroupsApi.create(data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group created', 'success'); },
    onError: (err: any) => toast(err?.response?.data?.code?.[0] ?? 'Failed to create group', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: FormState }) => hrEmployeeGroupsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalGroup(null); toast('Group updated', 'success'); },
    onError: (err: any) => toast(err?.response?.data?.code?.[0] ?? 'Failed to update group', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrEmployeeGroupsApi.delete(id),
    onSuccess: () => { invalidate(); setDeletingId(null); toast('Group deleted', 'success'); },
    onError: () => toast('Failed to delete group', 'error'),
  });

  const handleSave = (data: FormState) => {
    if (modalGroup === 'new') {
      createMutation.mutate(data);
    } else if (modalGroup) {
      updateMutation.mutate({ id: modalGroup.id, data });
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!admin) {
    return (
      <MainLayout>
        <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-error)', margin: 0, fontSize: 'var(--text-sm)' }}>
            Admin access required.
          </p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-4)' }}>
          <div>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 'var(--weight-bold)', margin: '0 0 var(--space-1)' }}>
              Employee Groups
              {!isLoading && (
                <span style={{ marginLeft: 'var(--space-2)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-normal)', color: 'var(--text-secondary)' }}>
                  {groups.length} {groups.length === 1 ? 'group' : 'groups'}
                </span>
              )}
            </h1>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
              Workforce categories that carry default shift, approval policy, and reporting line.
            </p>
          </div>
          <button
            onClick={() => setModalGroup('new')}
            style={{
              padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)',
              background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)',
              border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: 'var(--weight-semibold)', whiteSpace: 'nowrap', flexShrink: 0,
            }}
          >
            + Create Group
          </button>
        </div>

        {/* Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 1fr 90px 80px 100px',
            gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)',
          }}>
            {['Code', 'Name', 'Name (Arabic)', 'Members', 'Status', ''].map(h => (
              <span key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {isLoading ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: 'var(--text-sm)' }}>Loading…</p>
            </div>
          ) : groups.length === 0 ? (
            <div style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--text-2xl)', margin: '0 0 var(--space-3)' }}>🗂</p>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', margin: '0 0 var(--space-1)' }}>No groups yet</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                Create your first group to start organising employees by workforce category.
              </p>
            </div>
          ) : (
            groups.map((group, idx) => {
              const isLast = idx === groups.length - 1;
              const isDeleting = deletingId === group.id;

              return (
                <div key={group.id} style={{ borderBottom: !isLast ? '1px solid var(--border-subtle)' : 'none' }}>
                  {/* Main row */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '100px 1fr 1fr 90px 80px 100px',
                    gap: 'var(--space-3)', padding: 'var(--space-4) var(--space-5)', alignItems: 'center',
                  }}>
                    {/* Code */}
                    <span style={{
                      fontFamily: 'monospace', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)',
                      color: 'var(--sidebar-active-text)', background: 'var(--sidebar-active-bg)',
                      padding: '2px 8px', borderRadius: 'var(--radius-sm)', display: 'inline-block',
                      opacity: group.is_active ? 1 : 0.5,
                    }}>
                      {group.code}
                    </span>

                    {/* Name */}
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {group.name}
                      </p>
                      {group.description && (
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {group.description}
                        </p>
                      )}
                    </div>

                    {/* Name AR */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'rtl', textAlign: 'right' }}>
                      {group.name_ar || '—'}
                    </p>

                    {/* Member count */}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
                      {group.member_count} active
                    </p>

                    {/* Status */}
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '3px 8px', borderRadius: 99, fontSize: 'var(--text-xs)',
                      fontWeight: 'var(--weight-semibold)',
                      background: group.is_active ? '#d1fae5' : 'var(--surface-subtle)',
                      color: group.is_active ? '#065f46' : 'var(--text-secondary)',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: group.is_active ? '#10b981' : '#9ca3af' }} />
                      {group.is_active ? 'Active' : 'Inactive'}
                    </span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setModalGroup(group)}
                        title="Edit"
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingId(isDeleting ? null : group.id)}
                        title="Delete"
                        style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', color: isDeleting ? '#dc2626' : 'var(--text-secondary)' }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Inline delete confirmation */}
                  {isDeleting && (
                    <div style={{
                      padding: 'var(--space-3) var(--space-5)',
                      borderTop: '1px solid var(--border-subtle)',
                      background: '#fef2f2',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)',
                    }}>
                      <div>
                        <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: '#7f1d1d', margin: 0 }}>
                          Delete {group.code}?
                        </p>
                        {group.member_count > 0 && (
                          <p style={{ fontSize: 'var(--text-xs)', color: '#991b1b', margin: '2px 0 0' }}>
                            {group.member_count} active {group.member_count === 1 ? 'employee' : 'employees'} will have their group cleared.
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', flexShrink: 0 }}>
                        <button
                          onClick={() => setDeletingId(null)}
                          style={{ padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)', background: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)' }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(group.id)}
                          disabled={deleteMutation.isPending}
                          style={{ padding: 'var(--space-1-5) var(--space-3)', borderRadius: 'var(--radius-sm)', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', opacity: deleteMutation.isPending ? 0.6 : 1 }}
                        >
                          {deleteMutation.isPending ? 'Deleting…' : 'Confirm Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Context note — shown once there are groups */}
        {!isLoading && groups.length > 0 && (
          <div style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--surface-subtle)', border: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              <strong>Phase G2 — foundation only.</strong> Default shift (G3), approval policy (G4), and reporting-line manager (G5) will be wired to each group in subsequent phases. Assign employees to groups from the{' '}
              <a href="/hr/employees" style={{ color: 'var(--sidebar-active-text)', textDecoration: 'none', fontWeight: 'var(--weight-semibold)' }}>Employees page</a>.
            </p>
          </div>
        )}

      </div>

      {/* Modal */}
      {modalGroup !== null && (
        <GroupModal
          group={modalGroup === 'new' ? null : modalGroup}
          onClose={() => setModalGroup(null)}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </MainLayout>
  );
}
