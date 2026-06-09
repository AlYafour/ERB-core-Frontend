'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { permissionsApi, Permission, PermissionSet, UserPermission } from '@/lib/api/permissions';
import { usersApi } from '@/lib/api/users';
import { useAuth } from '@/lib/hooks/use-auth';
import { PERMISSIONS_QUERY_KEY } from '@/lib/hooks/use-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { Button, TextField, Checkbox, Loader, Badge, PageShell, PageHeader } from '@/components/ui';
import { User } from '@/types';
import { useT } from '@/lib/i18n/useT';

type ActiveTab = 'sets' | 'users';

export default function PermissionsPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'admin' || currentUser?.is_superuser;
  const queryClient = useQueryClient();
  const t = useT();

  const CATEGORY_LABELS: Record<string, string> = {
    purchase_request:  t('dash', 'purchaseRequest'),
    quotation_request: t('nav', 'qrList'),
    purchase_quotation: t('nav', 'quotationsList'),
    purchase_order:    t('dash', 'purchaseOrder'),
    goods_receiving:   t('nav', 'grnList'),
    purchase_invoice:  t('dash', 'invoice'),
    supplier:          t('nav', 'suppliers'),
    product:           t('nav', 'itemsProducts'),
    project:           t('nav', 'projects'),
    user:              t('nav', 'users'),
    settings:          t('nav', 'settings'),
  };

  const ACTION_LABELS: Record<string, string> = {
    create:   t('btn', 'create'),
    view:     t('btn', 'view'),
    update:   t('btn', 'update'),
    delete:   t('btn', 'delete'),
    approve:  t('btn', 'approve'),
    reject:   t('btn', 'reject'),
    cancel:   t('btn', 'cancel'),
    award:    t('status', 'awarded'),
    convert:  t('btn', 'createPO'),
    mark_paid: t('status', 'paid'),
  };

  const [activeTab, setActiveTab] = useState<ActiveTab>('sets');
  const [selectedPermissionSet, setSelectedPermissionSet] = useState<number | null>(null);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [searchPermissionSet, setSearchPermissionSet] = useState('');
  const [searchUser, setSearchUser] = useState('');
  const [showOverridePanel, setShowOverridePanel] = useState(false);

  /* ─── Queries ─── */
  const { data: permissionsByCategory, isLoading: isLoadingPermissions } = useQuery({
    queryKey: ['permissions', 'by-category'],
    queryFn: () => permissionsApi.getPermissionsByCategory(),
  });

  const { data: permissionSetsData, isLoading: isLoadingSets } = useQuery({
    queryKey: ['permission-sets', searchPermissionSet],
    queryFn: () => permissionsApi.getAllPermissionSets({ search: searchPermissionSet }),
  });

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['users', 'all', searchUser],
    queryFn: () => usersApi.getAll({ search: searchUser }),
  });

  const { data: selectedSetDetails } = useQuery({
    queryKey: ['permission-set', selectedPermissionSet],
    queryFn: () => permissionsApi.getPermissionSetById(selectedPermissionSet!),
    enabled: !!selectedPermissionSet,
  });

  const { data: selectedUserPermissions } = useQuery({
    queryKey: ['user-permission-summary', selectedUser],
    queryFn: () => permissionsApi.getUserPermissionSummary(selectedUser!),
    enabled: !!selectedUser,
  });

  const { data: userCustomOverrides, refetch: refetchOverrides } = useQuery({
    queryKey: ['user-permissions-overrides', selectedUser],
    queryFn: () => permissionsApi.getAllUserPermissions({ user: selectedUser! }),
    enabled: !!selectedUser && showOverridePanel,
  });

  /* ─── Mutations ─── */
  const updatePermissionSetMutation = useMutation({
    mutationFn: ({ id, permissionIds }: { id: number; permissionIds: number[] }) =>
      permissionsApi.assignPermissionsToSet(id, permissionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-set', selectedPermissionSet] });
      queryClient.invalidateQueries({ queryKey: ['permission-sets'] });
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
      toast(t('toast', 'updatedSuccess'), 'success');
    },
    onError: () => toast(t('toast', 'saveFailed'), 'error'),
  });

  const assignPermissionSetMutation = useMutation({
    mutationFn: ({ userId, permissionSetId }: { userId: number; permissionSetId: number | null }) =>
      permissionsApi.assignPermissionSetToUser(userId, permissionSetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permission-summary', selectedUser] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
      toast(t('toast', 'updatedSuccess'), 'success');
    },
    onError: () => toast(t('toast', 'saveFailed'), 'error'),
  });

  const addOverrideMutation = useMutation({
    mutationFn: (data: Partial<UserPermission>) => permissionsApi.createUserPermission(data),
    onSuccess: () => {
      refetchOverrides();
      queryClient.invalidateQueries({ queryKey: ['user-permission-summary', selectedUser] });
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
      toast(t('toast', 'savedSuccess'), 'success');
    },
    onError: () => toast(t('toast', 'saveFailed'), 'error'),
  });

  const removeOverrideMutation = useMutation({
    mutationFn: (id: number) => permissionsApi.deleteUserPermission(id),
    onSuccess: () => {
      refetchOverrides();
      queryClient.invalidateQueries({ queryKey: ['user-permission-summary', selectedUser] });
      queryClient.invalidateQueries({ queryKey: PERMISSIONS_QUERY_KEY });
      toast(t('toast', 'deletedSuccess'), 'success');
    },
    onError: () => toast(t('toast', 'deleteFailed'), 'error'),
  });

  /* ─── Handlers ─── */
  const handlePermissionToggle = (permissionId: number, checked: boolean) => {
    if (!selectedSetDetails) return;
    const current = selectedSetDetails.permissions.map((p) => p.id);
    const next = checked ? [...current, permissionId] : current.filter((id) => id !== permissionId);
    updatePermissionSetMutation.mutate({ id: selectedSetDetails.id, permissionIds: next });
  };

  const handleAssignPermissionSet = (userId: number, permissionSetId: number | null) => {
    assignPermissionSetMutation.mutate({ userId, permissionSetId });
  };

  const handleOverrideToggle = (permission: Permission, existingOverride: UserPermission | undefined, newGranted: boolean) => {
    if (existingOverride) {
      if (existingOverride.granted === newGranted) {
        removeOverrideMutation.mutate(existingOverride.id);
      } else {
        removeOverrideMutation.mutate(existingOverride.id);
        addOverrideMutation.mutate({ user: selectedUser!, permission_id: permission.id, granted: newGranted });
      }
    } else {
      addOverrideMutation.mutate({ user: selectedUser!, permission_id: permission.id, granted: newGranted });
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout>
        <PageShell>
          <div className="card empty-state">
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {t('toast', 'accessDenied')}
            </p>
          </div>
        </PageShell>
      </MainLayout>
    );
  }

  /* ─── Styles ─── */
  const cardStyle: React.CSSProperties = { padding: 'var(--space-3)', cursor: 'pointer', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', backgroundColor: 'var(--surface-default)' };
  const selectedCardStyle: React.CSSProperties = { ...cardStyle, border: '2px solid var(--brand)', backgroundColor: 'var(--surface-subtle)' };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={t('page', 'managePermissions')}
          description={t('perm', 'subtitle')}
          breadcrumbs={[{ label: 'Settings' }, { label: t('page', 'managePermissions') }]}
        />

        {/* Tabs */}
        <div className="tab-row" style={{ marginBottom: 'var(--space-6)' }}>
          <button className={`tab-row-item${activeTab === 'sets' ? ' active' : ''}`} onClick={() => setActiveTab('sets')}>
            {t('perm', 'permSets')}
          </button>
          <button className={`tab-row-item${activeTab === 'users' ? ' active' : ''}`} onClick={() => setActiveTab('users')}>
            {t('perm', 'usersAssign')}
          </button>
        </div>

        {/* ── Tab: Permission Sets ── */}
        {activeTab === 'sets' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-6)' }}>
            {/* Left list */}
            <div className="card" style={{ padding: 'var(--space-4)', alignSelf: 'start' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-3) 0' }}>
                {t('perm', 'roles')}
              </h3>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <TextField type="text" placeholder={t('perm', 'searchRoles')} value={searchPermissionSet} onChange={(e) => setSearchPermissionSet(e.target.value)} className="input" />
              </div>
              {isLoadingSets ? <Loader className="mx-auto" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {permissionSetsData?.results?.map((set: PermissionSet) => (
                    <div key={set.id} onClick={() => setSelectedPermissionSet(set.id)} style={selectedPermissionSet === set.id ? selectedCardStyle : cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{set.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{set.permissions_count} {t('perm', 'permCount')}</div>
                        </div>
                        {set.is_system && <Badge variant="info">{t('perm', 'system')}</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: permission grid */}
            {selectedPermissionSet && selectedSetDetails ? (
              <div className="card" style={{ padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
                    {selectedSetDetails.name}
                    {selectedSetDetails.is_system && (
                      <span style={{ marginLeft: 'var(--space-2)' }}><Badge variant="info">{t('perm', 'systemRole')}</Badge></span>
                    )}
                  </h3>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                    {selectedSetDetails.permissions_count} / {Object.values(permissionsByCategory || {}).flat().length} permissions
                  </span>
                </div>
                {isLoadingPermissions ? <Loader className="mx-auto" /> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                    {Object.entries(permissionsByCategory || {}).map(([category, perms]: [string, Permission[]]) => (
                      <div key={category}>
                        <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', margin: '0 0 var(--space-2) 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {CATEGORY_LABELS[category] || category}
                        </h4>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          {perms.map((permission) => {
                            const isChecked = selectedSetDetails.permissions.some((p) => p.id === permission.id);
                            return (
                              <label key={permission.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', backgroundColor: isChecked ? 'var(--surface-subtle)' : 'var(--surface-subtle)', border: `1px solid ${isChecked ? 'var(--brand)' : 'var(--border-subtle)'}`, fontSize: 'var(--text-sm)' }}>
                                <Checkbox checked={isChecked} onChange={(e) => handlePermissionToggle(permission.id, e.target.checked)} disabled={updatePermissionSetMutation.isPending} />
                                {ACTION_LABELS[permission.action] || permission.action}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card empty-state" style={{ color: 'var(--text-secondary)' }}>
                {t('perm', 'selectRole')}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Users & Assignments ── */}
        {activeTab === 'users' && (
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 'var(--space-6)' }}>
            {/* Left: user list */}
            <div className="card" style={{ padding: 'var(--space-4)', alignSelf: 'start' }}>
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-3) 0' }}>{t('nav', 'users')}</h3>
              <div style={{ marginBottom: 'var(--space-3)' }}>
                <TextField type="text" placeholder={t('perm', 'searchUsers')} value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="input" />
              </div>
              {isLoadingUsers ? <Loader className="mx-auto" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {usersData?.results?.map((user: User) => (
                    <div key={user.id} onClick={() => { setSelectedUser(user.id); setShowOverridePanel(false); }} style={selectedUser === user.id ? selectedCardStyle : cardStyle}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'var(--weight-semibold)', fontSize: 'var(--text-sm)' }}>{user.username}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{user.email}</div>
                        </div>
                        <Badge variant="info">{user.role?.replace('_', ' ')}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: user detail */}
            {selectedUser && selectedUserPermissions ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Assign role card */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-4) 0' }}>
                    {selectedUserPermissions.username} — {t('perm', 'roleAssignment')}
                  </h3>
                  <div style={{ marginBottom: 'var(--space-3)' }}>
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>{t('perm', 'currentRole')}</div>
                    <div style={{ fontWeight: 'var(--weight-semibold)' }}>
                      {selectedUserPermissions.permission_set?.name || <span style={{ color: 'var(--text-secondary)' }}>{t('perm', 'noneAssigned')}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <Button variant="secondary" size="sm" onClick={() => handleAssignPermissionSet(selectedUser, null)} isLoading={assignPermissionSetMutation.isPending}>
                      {t('perm', 'clearRole')}
                    </Button>
                    {permissionSetsData?.results?.map((set: PermissionSet) => (
                      <Button
                        key={set.id}
                        variant={selectedUserPermissions.permission_set?.id === set.id ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleAssignPermissionSet(selectedUser, set.id)}
                        isLoading={assignPermissionSetMutation.isPending}
                      >
                        {set.name}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Effective permissions summary */}
                {selectedUserPermissions.permissions.length > 0 && (
                  <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                      <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>
                        {t('perm', 'effectivePerms')} ({selectedUserPermissions.permissions.length})
                      </h4>
                      <Button variant="ghost" size="sm" onClick={() => setShowOverridePanel(!showOverridePanel)}>
                        {showOverridePanel ? t('perm', 'hideOverrides') : t('perm', 'manageOverrides')}
                      </Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {selectedUserPermissions.permissions.map((perm, i) => (
                        <Badge key={i} variant="info">
                          {CATEGORY_LABELS[perm.category] || perm.category}.{ACTION_LABELS[perm.action] || perm.action}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Per-user overrides panel */}
                {showOverridePanel && (
                  <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h4 style={{ fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', margin: '0 0 var(--space-2) 0' }}>
                      {t('perm', 'perUserOverrides')}
                    </h4>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-4) 0' }}>
                      {t('perm', 'overrideHint')}
                    </p>

                    {/* Existing overrides */}
                    {userCustomOverrides?.results && userCustomOverrides.results.length > 0 && (
                      <div style={{ marginBottom: 'var(--space-4)' }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-2)' }}>{t('perm', 'activeOverrides')}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                          {userCustomOverrides.results.map((o) => (
                            <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', backgroundColor: o.granted ? 'var(--color-success-light, #f0fdf4)' : 'var(--color-error-light, #fef2f2)', border: `1px solid ${o.granted ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)'}` }}>
                              <div style={{ fontSize: 'var(--text-sm)' }}>
                                <strong>{o.granted ? `✓ ${t('perm', 'granted')}` : `✗ ${t('perm', 'denied')}`}</strong>: {CATEGORY_LABELS[o.permission.category] || o.permission.category} — {ACTION_LABELS[o.permission.action] || o.permission.action}
                                {o.notes && <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--space-2)' }}>({o.notes})</span>}
                              </div>
                              <Button variant="destructive" size="sm" onClick={() => removeOverrideMutation.mutate(o.id)} isLoading={removeOverrideMutation.isPending}>
                                {t('perm', 'remove')}
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add new override — permission grid */}
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', marginBottom: 'var(--space-3)' }}>{t('perm', 'addOverride')}</div>
                    {isLoadingPermissions ? <Loader className="mx-auto" /> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                        {Object.entries(permissionsByCategory || {}).map(([category, perms]: [string, Permission[]]) => (
                          <div key={category}>
                            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                              {CATEGORY_LABELS[category] || category}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                              {perms.map((perm) => {
                                const existing = userCustomOverrides?.results?.find((o) => o.permission.id === perm.id);
                                return (
                                  <div key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 'var(--text-xs)' }}>
                                    <span>{ACTION_LABELS[perm.action] || perm.action}</span>
                                    <button title="Grant" onClick={() => handleOverrideToggle(perm, existing, true)} style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', backgroundColor: existing?.granted === true ? 'var(--color-success, #22c55e)' : 'var(--surface-inset)', color: existing?.granted === true ? 'white' : 'inherit' }}>✓</button>
                                    <button title="Deny" onClick={() => handleOverrideToggle(perm, existing, false)} style={{ padding: '2px 6px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', backgroundColor: existing?.granted === false ? 'var(--color-error, #ef4444)' : 'var(--surface-inset)', color: existing?.granted === false ? 'white' : 'inherit' }}>✗</button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="card empty-state" style={{ color: 'var(--text-secondary)' }}>
                {t('perm', 'selectUser')}
              </div>
            )}
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
