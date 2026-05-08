'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrLocationTypesApi, hrLocationsApi } from '@/lib/api/hr';
import { HRLocationType, HRLocation } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, TextField, Badge, Loader } from '@/components/ui';

const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const sel = `${inp} h-[38px]`;
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const PRESET_ICONS  = ['🏢', '🏗️', '🔧', '🏭', '🏪', '🏠', '📍', '🗺️', '⚙️', '🏛️', '🚧', '🏕️'];
const PRESET_COLORS = ['#3b82f6','#f97316','#8b5cf6','#10b981','#ef4444','#f59e0b','#06b6d4','#ec4899','#6b7280'];

type DrawerMode = 'type-create' | 'type-edit' | 'loc-create' | 'loc-edit' | null;

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const [selectedType,  setSelectedType]  = useState<HRLocationType | null>(null);
  const [searchLoc,     setSearchLoc]     = useState('');
  const [expandedIds,   setExpandedIds]   = useState<Set<number>>(new Set());
  const [drawerMode,    setDrawerMode]    = useState<DrawerMode>(null);
  const [editTarget,    setEditTarget]    = useState<HRLocationType | HRLocation | null>(null);

  // Form state for type
  const [typeForm, setTypeForm] = useState({ name: '', name_ar: '', icon: '📍', color: '#6b7280' });
  // Form state for location
  const [locForm,  setLocForm]  = useState({ name: '', name_ar: '', parent: '' as any, address: '', description: '', is_active: true });

  // ── Queries ────────────────────────────────────────────────────────────────
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

  // ── Type mutations ─────────────────────────────────────────────────────────
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

  // ── Location mutations ─────────────────────────────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
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

  // ── Location row (recursive) ───────────────────────────────────────────────
  const LocRow = ({ loc, depth = 0 }: { loc: HRLocation; depth?: number }) => {
    const kids = childrenOf(loc.id);
    const expanded = expandedIds.has(loc.id);
    return (
      <>
        <tr className="border-b hover:bg-muted/20 transition-colors" style={{ borderColor: 'var(--border)' }}>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 22 }}>
              {kids.length > 0 ? (
                <button onClick={() => toggleExpand(loc.id)}
                  className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground hover:text-foreground flex-shrink-0">
                  {expanded ? '▼' : '▶'}
                </button>
              ) : <span className="w-5 flex-shrink-0" />}
              <div>
                <p className="text-sm font-semibold text-foreground">{loc.name}</p>
                {loc.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{loc.name_ar}</p>}
              </div>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-muted-foreground">{loc.parent_name || <span className="text-xs italic">Top level</span>}</td>
          <td className="px-4 py-3 text-sm text-muted-foreground truncate max-w-[200px]">{loc.address || '—'}</td>
          <td className="px-4 py-3 text-center">
            <span className="text-sm font-bold text-foreground">{loc.employee_count}</span>
          </td>
          <td className="px-4 py-3">
            <Badge variant={loc.is_active ? 'success' : 'error'}>{loc.is_active ? 'Active' : 'Inactive'}</Badge>
          </td>
          {isAdmin && (
            <td className="px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-1">
                <button onClick={() => openLocCreate(loc.id)} title="Add sub-location"
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground" style={{ background: 'var(--muted)' }}>
                  + Sub
                </button>
                <button onClick={() => openLocEdit(loc)}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground" style={{ background: 'var(--muted)' }}>
                  Edit
                </button>
                <button onClick={async () => { if (await confirm(`Delete "${loc.name}"?`)) deleteLocMut.mutate(loc.id); }}
                  className="text-xs px-2 py-1 rounded text-destructive" style={{ background: 'var(--muted)' }}>
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
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Locations</h1>
            <p className="text-sm text-muted-foreground mt-1">Create location types then add your offices, sites, and sub-locations</p>
          </div>
          {isAdmin && (
            <Button variant="primary" onClick={openTypeCreate}>+ New Type</Button>
          )}
        </div>

        <div className="flex gap-5 items-start">

          {/* ── LEFT: types list ── */}
          <div className="w-64 flex-shrink-0 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Location Types</p>

            {loadingTypes ? <Loader className="mx-auto mt-4" /> : types.length === 0 ? (
              <div className="card text-center py-8 space-y-2">
                <p className="text-2xl">📍</p>
                <p className="text-xs text-muted-foreground">No types yet</p>
                {isAdmin && (
                  <button onClick={openTypeCreate} className="text-xs font-medium" style={{ color: 'var(--sidebar-active-text)' }}>
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
                    className="rounded-lg border cursor-pointer transition-all p-3"
                    style={{
                      borderColor: isSelected ? t.color : 'var(--border)',
                      borderWidth: isSelected ? 2 : 1,
                      background: isSelected ? t.color + '15' : 'var(--card)',
                    }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg flex-shrink-0">{t.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.locations_count} locations</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openTypeEdit(t)}
                            className="text-xs px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground"
                            style={{ background: 'var(--muted)' }}>✎</button>
                          <button onClick={async () => { if (await confirm(`Delete type "${t.name}"?`)) deleteTypeMut.mutate(t.id); }}
                            className="text-xs px-1.5 py-0.5 rounded text-destructive"
                            style={{ background: 'var(--muted)' }}>✕</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── RIGHT: locations ── */}
          <div className="flex-1 min-w-0 space-y-4">
            {!selectedType ? (
              <div className="card text-center py-20 space-y-2">
                <p className="text-3xl">👈</p>
                <p className="text-muted-foreground text-sm">Select a type to view its locations</p>
                {types.length === 0 && isAdmin && (
                  <p className="text-xs text-muted-foreground">Start by creating a location type (e.g. "Office", "Site")</p>
                )}
              </div>
            ) : (
              <>
                {/* Sub-header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{selectedType.icon}</span>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">{selectedType.name}</h2>
                      <p className="text-xs text-muted-foreground">{allLocs.length} locations total</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TextField placeholder="Search..." value={searchLoc}
                      onChange={e => setSearchLoc(e.target.value)} className="max-w-xs" />
                    {allLocs.length > 0 && (
                      <button onClick={() => setExpandedIds(new Set(allLocs.map(l => l.id)))}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 whitespace-nowrap">
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
                  <div className="card text-center py-16"><Loader className="mx-auto" /></div>
                ) : allLocs.length === 0 ? (
                  <div className="card text-center py-16 space-y-3">
                    <p className="text-3xl">{selectedType.icon}</p>
                    <p className="text-foreground font-semibold">No locations yet for "{selectedType.name}"</p>
                    {isAdmin && (
                      <Button variant="primary" size="sm" onClick={() => openLocCreate()}>+ Add First Location</Button>
                    )}
                  </div>
                ) : (
                  <div className="card p-0 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Name', 'Parent', 'Address', 'Staff', 'Status', ...(isAdmin ? [''] : [])].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
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
      </div>

      {/* ══ DRAWER ════════════════════════════════════════════════════════════════ */}
      {drawerMode && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDrawerMode(null)}>
          <div className="ml-auto w-full max-w-md h-full flex flex-col shadow-2xl"
            style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-foreground">
                {drawerMode === 'type-create' ? 'New Location Type'
                  : drawerMode === 'type-edit' ? `Edit Type — ${(editTarget as HRLocationType)?.name}`
                  : drawerMode === 'loc-create' ? `New Location (${selectedType?.name})`
                  : `Edit — ${(editTarget as HRLocation)?.name}`}
              </h2>
              <button onClick={() => setDrawerMode(null)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* ── Type form ── */}
              {(drawerMode === 'type-create' || drawerMode === 'type-edit') && <>
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}>
                    <label className={lbl}>Name (EN)</label>
                    <input className={inp} value={typeForm.name}
                      onChange={e => setTypeForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Office" />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Name (AR)</label>
                    <input className={inp} dir="rtl" value={typeForm.name_ar}
                      onChange={e => setTypeForm(p => ({ ...p, name_ar: e.target.value }))}
                      placeholder="مثال: مكتب" />
                  </div>
                </div>

                <div className={fld}>
                  <label className={lbl}>Icon</label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_ICONS.map(ic => (
                      <button key={ic} onClick={() => setTypeForm(p => ({ ...p, icon: ic }))}
                        className="text-xl p-2 rounded-lg border-2 transition-all"
                        style={{ borderColor: typeForm.icon === ic ? 'var(--sidebar-active-text)' : 'var(--border)', background: typeForm.icon === ic ? 'var(--sidebar-active-bg)' : 'transparent' }}>
                        {ic}
                      </button>
                    ))}
                    <input className={`${inp} w-16 text-center text-xl`} value={typeForm.icon}
                      onChange={e => setTypeForm(p => ({ ...p, icon: e.target.value }))} maxLength={2} />
                  </div>
                </div>

                <div className={fld}>
                  <label className={lbl}>Color</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setTypeForm(p => ({ ...p, color: c }))}
                        className="w-8 h-8 rounded-full border-2 transition-all"
                        style={{ background: c, borderColor: typeForm.color === c ? '#000' : 'transparent', transform: typeForm.color === c ? 'scale(1.2)' : 'scale(1)' }} />
                    ))}
                    <input type="color" value={typeForm.color}
                      onChange={e => setTypeForm(p => ({ ...p, color: e.target.value }))}
                      className="w-8 h-8 rounded-full cursor-pointer border-0" title="Custom color" />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-2xl">{typeForm.icon}</span>
                    <span className="text-sm font-semibold px-3 py-1 rounded-full"
                      style={{ background: typeForm.color + '20', color: typeForm.color, border: `1px solid ${typeForm.color}44` }}>
                      {typeForm.name || 'Preview'}
                    </span>
                  </div>
                </div>
              </>}

              {/* ── Location form ── */}
              {(drawerMode === 'loc-create' || drawerMode === 'loc-edit') && <>
                <div className="grid grid-cols-2 gap-4">
                  <div className={fld}>
                    <label className={lbl}>Name (EN)</label>
                    <input className={inp} value={locForm.name}
                      onChange={e => setLocForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Abu Dhabi Office" />
                  </div>
                  <div className={fld}>
                    <label className={lbl}>Name (AR)</label>
                    <input className={inp} dir="rtl" value={locForm.name_ar}
                      onChange={e => setLocForm(p => ({ ...p, name_ar: e.target.value }))}
                      placeholder="مكتب أبوظبي" />
                  </div>
                </div>

                <div className={fld}>
                  <label className={lbl}>Parent Location (optional)</label>
                  <select className={sel} value={locForm.parent ?? ''}
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

                <div className={fld}>
                  <label className={lbl}>Address</label>
                  <textarea className={inp} rows={2} value={locForm.address}
                    onChange={e => setLocForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Street, area, city..." />
                </div>

                <div className={fld}>
                  <label className={lbl}>Description</label>
                  <textarea className={inp} rows={2} value={locForm.description}
                    onChange={e => setLocForm(p => ({ ...p, description: e.target.value }))} />
                </div>

                <div className={fld}>
                  <label className={lbl}>Status</label>
                  <select className={sel} value={locForm.is_active ? 'true' : 'false'}
                    onChange={e => setLocForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </>}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setDrawerMode(null)}>Cancel</Button>
              <Button variant="primary"
                onClick={drawerMode.startsWith('type') ? saveType : saveLoc}
                isLoading={isSavingType || isSavingLoc}>
                {drawerMode.includes('edit') ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
