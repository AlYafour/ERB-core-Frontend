'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrLocationTypesApi, hrLocationsApi } from '@/lib/api/hr';
import { HRLocationType, HRLocation } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, Badge, Loader, PageHeader, PageShell, SearchInput, Drawer } from '@/components/ui';

const PRESET_ICONS  = ['🏢', '🏗️', '🔧', '🏭', '🏪', '🏠', '📍', '🗺️', '⚙️', '🏛️', '🚧', '🏕️'];
const PRESET_COLORS = ['#3b82f6','#f97316','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899','#6b7280'];

type DrawerMode = 'type-create' | 'type-edit' | 'loc-create' | 'loc-edit' | null;

const tdStyle: React.CSSProperties = { padding: 'var(--space-3) var(--space-4)' };

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.is_superuser;

  const [selectedType,  setSelectedType]  = useState<HRLocationType | null>(null);
  const [searchLoc,     setSearchLoc]     = useState('');
  const [expandedIds,   setExpandedIds]   = useState<Set<number>>(new Set());
  const [drawerMode,    setDrawerMode]    = useState<DrawerMode>(null);
  const [editTarget,    setEditTarget]    = useState<HRLocationType | HRLocation | null>(null);

  const [typeForm, setTypeForm] = useState({ name: '', name_ar: '', icon: '📍', color: '#6b7280' });
  const [locForm,  setLocForm]  = useState({ name: '', name_ar: '', parent: '' as any, address: '', description: '', is_active: true });

  const { data: typesData, isLoading: loadingTypes } = useQuery({
    queryKey: ['hr-location-types'],
    queryFn: () => hrLocationTypesApi.getAll(),
  });
  const types: HRLocationType[] = typesData?.results ?? [];

  const { data: locsData, isLoading: loadingLocs } = useQuery({
    queryKey: ['hr-locations', selectedType?.id, searchLoc],
    queryFn: () => hrLocationsApi.getAll({
      location_type: selectedType?.id,
      search: searchLoc || undefined,
      page_size: 500,
    } as any),
    enabled: !!selectedType,
  });
  const allLocs: HRLocation[] = locsData?.results ?? [];
  const topLocs = allLocs.filter(l => !l.parent);
  const childrenOf = (id: number) => allLocs.filter(l => l.parent === id);

  const createTypeMut = useMutation({
    mutationFn: hrLocationTypesApi.create,
    onSuccess: (t) => {
      queryClient.invalidateQueries({ queryKey: ['hr-location-types'] });
      setSelectedType(t);
      setDrawerMode(null);
      toast('Type created', 'success');
    },
    onError: () => toast('Failed', 'error'),
  });
  const updateTypeMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRLocationType> }) => hrLocationTypesApi.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['hr-location-types'] });
      if (selectedType?.id === updated.id) setSelectedType(updated);
      setDrawerMode(null);
      toast('Updated', 'success');
    },
    onError: () => toast('Failed', 'error'),
  });
  const deleteTypeMut = useMutation({
    mutationFn: hrLocationTypesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-location-types'] });
      if (selectedType) setSelectedType(null);
      toast('Deleted', 'success');
    },
    onError: () => toast('Cannot delete — has locations', 'error'),
  });

  const createLocMut = useMutation({
    mutationFn: hrLocationsApi.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); setDrawerMode(null); toast('Location created', 'success'); },
    onError: () => toast('Failed', 'error'),
  });
  const updateLocMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRLocation> }) => hrLocationsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); setDrawerMode(null); toast('Updated', 'success'); },
    onError: () => toast('Failed', 'error'),
  });
  const deleteLocMut = useMutation({
    mutationFn: hrLocationsApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); toast('Deleted', 'success'); },
    onError: () => toast('Cannot delete — has employees or sub-locations', 'error'),
  });

  const openTypeCreate = () => {
    setTypeForm({ name: '', name_ar: '', icon: '📍', color: '#6b7280' });
    setEditTarget(null);
    setDrawerMode('type-create');
  };
  const openTypeEdit = (t: HRLocationType) => {
    setTypeForm({ name: t.name, name_ar: t.name_ar, icon: t.icon, color: t.color });
    setEditTarget(t);
    setDrawerMode('type-edit');
  };
  const openLocCreate = (parentId?: number) => {
    setLocForm({ name: '', name_ar: '', parent: parentId ?? '', address: '', description: '', is_active: true });
    setEditTarget(null);
    setDrawerMode('loc-create');
  };
  const openLocEdit = (l: HRLocation) => {
    setLocForm({ name: l.name, name_ar: l.name_ar, parent: l.parent ?? '', address: l.address, description: l.description, is_active: l.is_active });
    setEditTarget(l);
    setDrawerMode('loc-edit');
  };

  const saveType = () => {
    if (!typeForm.name.trim()) { toast('Name required', 'error'); return; }
    if (drawerMode === 'type-edit' && editTarget) {
      updateTypeMut.mutate({ id: (editTarget as HRLocationType).id, data: typeForm });
    } else {
      createTypeMut.mutate(typeForm);
    }
  };
  const saveLoc = () => {
    if (!locForm.name.trim()) { toast('Name required', 'error'); return; }
    const payload: Partial<HRLocation> = {
      ...locForm,
      location_type: selectedType?.id ?? null,
      parent: locForm.parent !== '' ? Number(locForm.parent) : null,
    };
    if (drawerMode === 'loc-edit' && editTarget) {
      updateLocMut.mutate({ id: (editTarget as HRLocation).id, data: payload });
    } else {
      createLocMut.mutate(payload);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const isSavingType = createTypeMut.isPending || updateTypeMut.isPending;
  const isSavingLoc  = createLocMut.isPending  || updateLocMut.isPending;

  const LocRow = ({ loc, depth = 0 }: { loc: HRLocation; depth?: number }) => {
    const kids = childrenOf(loc.id);
    const expanded = expandedIds.has(loc.id);
    return (
      <>
        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <td style={tdStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', paddingLeft: depth * 22 }}>
              {kids.length > 0 ? (
                <button onClick={() => toggleExpand(loc.id)}
                  style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer' }}>
                  {expanded ? '▼' : '▶'}
                </button>
              ) : <span style={{ width: 20, flexShrink: 0 }} />}
              <div>
                <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>{loc.name}</p>
                {loc.name_ar && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }} dir="rtl">{loc.name_ar}</p>}
              </div>
            </div>
          </td>
          <td style={{ ...tdStyle, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{loc.parent_name || <span style={{ fontSize: 'var(--text-xs)', fontStyle: 'italic' }}>Top level</span>}</td>
          <td style={{ ...tdStyle, fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{loc.address || '—'}</td>
          <td style={{ ...tdStyle, textAlign: 'center' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-bold)' }}>{loc.employee_count}</span>
          </td>
          <td style={tdStyle}>
            <Badge variant={loc.is_active ? 'success' : 'error'}>{loc.is_active ? 'Active' : 'Inactive'}</Badge>
          </td>
          {isAdmin && (
            <td style={{ ...tdStyle, textAlign: 'right' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                <button onClick={() => openLocCreate(loc.id)} title="Add sub-location"
                  style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>
                  + Sub
                </button>
                <button onClick={() => openLocEdit(loc)}
                  style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>
                  Edit
                </button>
                <button onClick={async () => { if (await confirm(`Delete "${loc.name}"?`)) deleteLocMut.mutate(loc.id); }}
                  style={{ fontSize: 'var(--text-xs)', padding: 'var(--space-1) var(--space-2)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>
                  Del
                </button>
              </div>
            </td>
          )}
        </tr>
        {expanded && kids.map(c => <LocRow key={c.id} loc={c} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Locations"
          description="Create location types then add your offices, sites, and sub-locations"
          breadcrumbs={[{ label: 'HR' }, { label: 'Locations' }]}
          actions={isAdmin ? <Button variant="primary" onClick={openTypeCreate}>+ New Type</Button> : undefined}
        />

        <div style={{ display: 'flex', gap: 'var(--space-5)', alignItems: 'flex-start' }}>

          {/* Left: types list */}
          <div style={{ width: 256, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '0 var(--space-1)', margin: 0 }}>Location Types</p>

            {loadingTypes ? <Loader /> : types.length === 0 ? (
              <div className="card empty-state" style={{ padding: 'var(--space-6) var(--space-4)' }}>
                <p className="empty-state-title" style={{ fontSize: 'var(--text-xs)' }}>No types yet</p>
                {isAdmin && (
                  <button onClick={openTypeCreate} style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', fontWeight: 'var(--weight-medium)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: 'var(--space-2)' }}>
                    + Create first type
                  </button>
                )}
              </div>
            ) : (
              types.map(t => {
                const isSelected = selectedType?.id === t.id;
                return (
                  <div key={t.id}
                    onClick={() => { setSelectedType(t); setSearchLoc(''); setExpandedIds(new Set()); }}
                    style={{
                      borderRadius: 'var(--radius-md)',
                      border: isSelected ? `2px solid ${t.color}` : '1px solid var(--border-subtle)',
                      background: isSelected ? t.color + '15' : 'var(--card-bg)',
                      cursor: 'pointer',
                      padding: 'var(--space-3)',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
                        <span style={{ fontSize: 'var(--text-lg)', flexShrink: 0 }}>{t.icon}</span>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{t.name}</p>
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{t.locations_count} locations</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 'var(--space-1)', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                          <button onClick={() => openTypeEdit(t)}
                            style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-1-5)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>✎</button>
                          <button onClick={async () => { if (await confirm(`Delete type "${t.name}"?`)) deleteTypeMut.mutate(t.id); }}
                            style={{ fontSize: 'var(--text-xs)', padding: '2px var(--space-1-5)', borderRadius: 'var(--radius-sm)', color: 'var(--color-error)', background: 'var(--surface-subtle)', border: 'none', cursor: 'pointer' }}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right: locations */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {!selectedType ? (
              <div className="card empty-state">
                <p className="empty-state-title">Select a location type</p>
                <p className="empty-state-desc">
                  {types.length === 0 && isAdmin
                    ? 'Start by creating a location type (e.g. "Office", "Site")'
                    : 'Choose a type from the list on the left to view its locations'}
                </p>
              </div>
            ) : (
              <>
                {/* Sub-header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span style={{ fontSize: 'var(--text-2xl)' }}>{selectedType.icon}</span>
                    <div>
                      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: 0 }}>{selectedType.name}</h2>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>{allLocs.length} locations total</p>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <SearchInput placeholder="Search..." value={searchLoc} onChange={setSearchLoc} width={220} />
                    {allLocs.length > 0 && (
                      <button onClick={() => setExpandedIds(new Set(allLocs.map(l => l.id)))}
                        style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', padding: '0 var(--space-2)', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer' }}>
                        Expand all
                      </button>
                    )}
                    {isAdmin && (
                      <Button variant="primary" size="sm" onClick={() => openLocCreate()}>
                        + Add Location
                      </Button>
                    )}
                  </div>
                </div>

                {loadingLocs ? (
                  <div className="card empty-state"><Loader /></div>
                ) : allLocs.length === 0 ? (
                  <div className="card empty-state">
                    <p className="empty-state-title">No locations yet for "{selectedType.name}"</p>
                    {isAdmin && (
                      <Button variant="primary" size="sm" onClick={() => openLocCreate()}>+ Add First Location</Button>
                    )}
                  </div>
                ) : (
                  <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <table style={{ width: '100%' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          {['Name', 'Parent', 'Address', 'Staff', 'Status', ...(isAdmin ? [''] : [])].map(h => (
                            <th key={h} style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {topLocs.map(loc => <LocRow key={loc.id} loc={loc} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </PageShell>

      <Drawer
        isOpen={drawerMode !== null}
        onClose={() => setDrawerMode(null)}
        title={
          drawerMode === 'type-create' ? 'New Location Type'
            : drawerMode === 'type-edit' ? `Edit Type — ${(editTarget as HRLocationType)?.name}`
            : drawerMode === 'loc-create' ? `New Location (${selectedType?.name})`
            : `Edit — ${(editTarget as HRLocation)?.name}`
        }
        footer={<>
          <Button variant="secondary" onClick={() => setDrawerMode(null)}>Cancel</Button>
          <Button variant="primary"
            onClick={(drawerMode ?? '').startsWith('type') ? saveType : saveLoc}
            isLoading={isSavingType || isSavingLoc}>
            {(drawerMode ?? '').includes('edit') ? 'Save' : 'Create'}
          </Button>
        </>}
      >
        {/* Type form */}
        {(drawerMode === 'type-create' || drawerMode === 'type-edit') && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-field">
              <label className="form-label">Name (EN)</label>
              <input className="form-input" value={typeForm.name}
                onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Office" />
            </div>
            <div className="form-field">
              <label className="form-label">Name (AR)</label>
              <input className="form-input" dir="rtl" value={typeForm.name_ar}
                onChange={e => setTypeForm(p => ({ ...p, name_ar: e.target.value }))}
                placeholder="مثال: مكتب" />
            </div>
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Icon</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              {PRESET_ICONS.map(ic => (
                <button key={ic} onClick={() => setTypeForm(p => ({ ...p, icon: ic }))}
                  style={{ fontSize: 'var(--text-xl)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', border: `2px solid ${typeForm.icon === ic ? 'var(--brand)' : 'var(--border-subtle)'}`, background: typeForm.icon === ic ? 'var(--surface-subtle)' : 'transparent', cursor: 'pointer' }}>
                  {ic}
                </button>
              ))}
              <input className="form-input" style={{ width: 64, textAlign: 'center', fontSize: 'var(--text-xl)' }} value={typeForm.icon}
                onChange={e => setTypeForm(p => ({ ...p, icon: e.target.value }))} maxLength={2} />
            </div>
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Color</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setTypeForm(p => ({ ...p, color: c }))}
                  style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${typeForm.color === c ? '#000' : 'transparent'}`, background: c, transform: typeForm.color === c ? 'scale(1.2)' : 'scale(1)', cursor: 'pointer' }} />
              ))}
              <input type="color" value={typeForm.color}
                onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))}
                style={{ width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', border: 0 }} title="Custom color" />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--text-2xl)' }}>{typeForm.icon}</span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', padding: 'var(--space-1) var(--space-3)', borderRadius: 9999, background: typeForm.color + '20', color: typeForm.color, border: `1px solid ${typeForm.color}44` }}>
                {typeForm.name || 'Preview'}
              </span>
            </div>
          </div>
        </>}

        {/* Location form */}
        {(drawerMode === 'loc-create' || drawerMode === 'loc-edit') && <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-field">
              <label className="form-label">Name (EN)</label>
              <input className="form-input" value={locForm.name}
                onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Abu Dhabi Office" />
            </div>
            <div className="form-field">
              <label className="form-label">Name (AR)</label>
              <input className="form-input" dir="rtl" value={locForm.name_ar}
                onChange={e => setLocForm(p => ({ ...p, name_ar: e.target.value }))}
                placeholder="مكتب أبوظبي" />
            </div>
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Parent Location (optional)</label>
            <select className="form-select" value={locForm.parent ?? ''}
              onChange={e => setLocForm(p => ({ ...p, parent: e.target.value }))}>
              <option value="">— None (top level) —</option>
              {allLocs
                .filter(l => l.id !== (editTarget as HRLocation)?.id)
                .map(l => (
                  <option key={l.id} value={l.id}>
                    {l.parent_name ? `${l.parent_name} › ` : ''}{l.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Address</label>
            <textarea className="form-textarea" rows={2} value={locForm.address}
              onChange={e => setLocForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Street, area, city..." />
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} value={locForm.description}
              onChange={e => setLocForm(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="form-field" style={{ marginTop: 'var(--space-4)' }}>
            <label className="form-label">Status</label>
            <select className="form-select" value={locForm.is_active ? 'true' : 'false'}
              onChange={e => setLocForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </>}
      </Drawer>
    </MainLayout>
  );
}
