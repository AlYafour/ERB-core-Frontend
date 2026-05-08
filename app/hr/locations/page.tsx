'use client';

import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrLocationsApi } from '@/lib/api/hr';
import { HRLocation } from '@/types';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { useAuth } from '@/lib/hooks/use-auth';
import { Button, TextField, Badge, Loader } from '@/components/ui';

// ── Constants ──────────────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: '',         label: 'All Types' },
  { value: 'office',   label: 'Office' },
  { value: 'site',     label: 'Site' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'other',    label: 'Other' },
];

const TYPE_ICON: Record<string, string> = {
  office:   '🏢',
  site:     '🏗️',
  workshop: '🔧',
  other:    '📍',
};

const TYPE_COLOR: Record<string, string> = {
  office:   '#3b82f6',
  site:     '#f97316',
  workshop: '#8b5cf6',
  other:    '#6b7280',
};

const inp = 'w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40';
const sel = `${inp} h-[38px]`;
const fld = 'flex flex-col gap-1';
const lbl = 'text-xs font-medium text-muted-foreground uppercase tracking-wide';

const EMPTY_FORM = { name: '', name_ar: '', location_type: 'office' as HRLocation['location_type'], parent: '' as any, address: '', description: '', is_active: true };

// ── Page ───────────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;

  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('');
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [editing,     setEditing]     = useState<HRLocation | null>(null);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['hr-locations', search, typeFilter],
    queryFn: () => hrLocationsApi.getAll({
      search:        search       || undefined,
      location_type: typeFilter   || undefined,
      page_size:     200,
    } as any),
  });

  const all: HRLocation[] = data?.results ?? [];

  // Build tree: top-level = no parent OR parent not in results
  const topLevel  = all.filter(l => !l.parent);
  const childrenOf = (id: number) => all.filter(l => l.parent === id);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (d: Partial<HRLocation>) => hrLocationsApi.create(d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); setDrawerOpen(false); toast('Location created', 'success'); },
    onError: () => toast('Failed to create', 'error'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<HRLocation> }) => hrLocationsApi.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); setDrawerOpen(false); toast('Updated', 'success'); },
    onError: () => toast('Failed to update', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: hrLocationsApi.delete,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-locations'] }); toast('Deleted', 'success'); },
    onError: () => toast('Cannot delete — has employees or sub-locations', 'error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const openCreate = (parentId?: number) => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, parent: parentId ?? '' as any });
    setDrawerOpen(true);
  };

  const openEdit = (loc: HRLocation) => {
    setEditing(loc);
    setForm({
      name: loc.name, name_ar: loc.name_ar,
      location_type: loc.location_type,
      parent: loc.parent ?? '' as any,
      address: loc.address, description: loc.description,
      is_active: loc.is_active,
    });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { toast('Name is required', 'error'); return; }
    const payload: Partial<HRLocation> = {
      ...form,
      parent: form.parent !== '' ? Number(form.parent) : null,
    };
    if (editing) updateMutation.mutate({ id: editing.id, data: payload });
    else createMutation.mutate(payload);
  };

  const handleDelete = async (loc: HRLocation) => {
    const ok = await confirm(`Delete "${loc.name}"?`);
    if (ok) deleteMutation.mutate(loc.id);
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Location row ──────────────────────────────────────────────────────────
  const LocationRow = ({ loc, depth = 0 }: { loc: HRLocation; depth?: number }) => {
    const kids = childrenOf(loc.id);
    const isExpanded = expandedIds.has(loc.id);
    const color = TYPE_COLOR[loc.location_type] ?? '#6b7280';

    return (
      <>
        <tr className="border-b hover:bg-muted/20 transition-colors" style={{ borderColor: 'var(--border)' }}>
          {/* Name */}
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: depth * 24 }}>
              {kids.length > 0 ? (
                <button onClick={() => toggleExpand(loc.id)}
                  className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0 text-xs">
                  {isExpanded ? '▼' : '▶'}
                </button>
              ) : (
                <span className="w-5 flex-shrink-0" />
              )}
              <span className="text-base flex-shrink-0">{TYPE_ICON[loc.location_type]}</span>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">{loc.name}</p>
                {loc.name_ar && <p className="text-xs text-muted-foreground" dir="rtl">{loc.name_ar}</p>}
              </div>
            </div>
          </td>

          {/* Type */}
          <td className="px-4 py-3">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
              style={{ background: color + '18', color, border: `1px solid ${color}44` }}>
              {loc.location_type}
            </span>
          </td>

          {/* Parent */}
          <td className="px-4 py-3">
            <span className="text-sm text-muted-foreground">{loc.parent_name || '—'}</span>
          </td>

          {/* Address */}
          <td className="px-4 py-3">
            <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{loc.address || '—'}</span>
          </td>

          {/* Counts */}
          <td className="px-4 py-3 text-center">
            <span className="text-sm font-semibold text-foreground">{loc.employee_count}</span>
          </td>

          {/* Status */}
          <td className="px-4 py-3">
            <Badge variant={loc.is_active ? 'success' : 'error'}>
              {loc.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </td>

          {/* Actions */}
          {isAdmin && (
            <td className="px-4 py-3">
              <div className="flex items-center gap-2 justify-end">
                <button onClick={() => openCreate(loc.id)}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                  style={{ background: 'var(--muted)' }} title="Add sub-location">
                  + Sub
                </button>
                <button onClick={() => openEdit(loc)}
                  className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground"
                  style={{ background: 'var(--muted)' }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(loc)}
                  className="text-xs px-2 py-1 rounded text-destructive hover:opacity-70"
                  style={{ background: 'var(--muted)' }}>
                  Del
                </button>
              </div>
            </td>
          )}
        </tr>

        {/* Children */}
        {isExpanded && kids.map(child => (
          <LocationRow key={child.id} loc={child} depth={depth + 1} />
        ))}
      </>
    );
  };

  // Stats
  const officeCount   = all.filter(l => l.location_type === 'office').length;
  const siteCount     = all.filter(l => l.location_type === 'site').length;
  const workshopCount = all.filter(l => l.location_type === 'workshop').length;
  const totalStaff    = topLevel.reduce((s, l) => s + l.employee_count, 0);

  return (
    <MainLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Locations</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage offices, sites and workshops — assign employees to each location</p>
          </div>
          {isAdmin && (
            <Button variant="primary" onClick={() => openCreate()}>+ New Location</Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Offices',   value: officeCount,   color: '#3b82f6', icon: '🏢' },
            { label: 'Sites',     value: siteCount,     color: '#f97316', icon: '🏗️' },
            { label: 'Workshops', value: workshopCount, color: '#8b5cf6', icon: '🔧' },
            { label: 'Staff Assigned', value: totalStaff, color: '#10b981', icon: '👷' },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="card flex items-center gap-4"
              style={{ borderTop: `3px solid ${color}` }}>
              <span className="text-2xl">{icon}</span>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card flex items-center gap-3 flex-wrap">
          <TextField
            placeholder="Search by name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[220px] max-w-sm"
          />
          <select className={sel} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {(search || typeFilter) && (
            <button onClick={() => { setSearch(''); setTypeFilter(''); }}
              className="text-sm text-muted-foreground hover:text-foreground px-2">
              Clear
            </button>
          )}
          {topLevel.length > 0 && (
            <button
              onClick={() => setExpandedIds(new Set(all.map(l => l.id)))}
              className="text-xs text-muted-foreground hover:text-foreground px-2">
              Expand all
            </button>
          )}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="card text-center py-16"><Loader className="mx-auto" /></div>
        ) : all.length === 0 ? (
          <div className="card text-center py-16 space-y-3">
            <p className="text-4xl">📍</p>
            <p className="text-foreground font-semibold">No locations yet</p>
            <p className="text-sm text-muted-foreground">Create your first office or site to start assigning employees</p>
            {isAdmin && <Button variant="primary" onClick={() => openCreate()}>+ New Location</Button>}
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Location', 'Type', 'Parent', 'Address', 'Staff', 'Status', ...(isAdmin ? [''] : [])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topLevel.map(loc => (
                  <LocationRow key={loc.id} loc={loc} depth={0} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setDrawerOpen(false)}>
          <div className="ml-auto w-full max-w-md h-full flex flex-col shadow-2xl"
            style={{ background: 'var(--card)' }} onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <h2 className="font-semibold text-foreground">
                {editing ? `Edit — ${editing.name}` : 'New Location'}
              </h2>
              <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground text-lg">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              <div className={fld}>
                <label className={lbl}>Type</label>
                <select className={sel} value={form.location_type}
                  onChange={e => setForm(p => ({ ...p, location_type: e.target.value as any }))}>
                  {TYPE_OPTIONS.filter(t => t.value).map(t => (
                    <option key={t.value} value={t.value}>{TYPE_ICON[t.value]} {t.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className={fld}>
                  <label className={lbl}>Name (EN)</label>
                  <input className={inp} value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Abu Dhabi Office" />
                </div>
                <div className={fld}>
                  <label className={lbl}>Name (AR)</label>
                  <input className={inp} dir="rtl" value={form.name_ar}
                    onChange={e => setForm(p => ({ ...p, name_ar: e.target.value }))}
                    placeholder="مكتب أبوظبي" />
                </div>
              </div>

              <div className={fld}>
                <label className={lbl}>Parent Location</label>
                <select className={sel} value={form.parent ?? ''}
                  onChange={e => setForm(p => ({ ...p, parent: e.target.value as any }))}>
                  <option value="">— None (top level) —</option>
                  {all.filter(l => l.id !== editing?.id).map(l => (
                    <option key={l.id} value={l.id}>
                      {TYPE_ICON[l.location_type]} {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={fld}>
                <label className={lbl}>Address</label>
                <textarea className={inp} rows={2} value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Street, area, city..." />
              </div>

              <div className={fld}>
                <label className={lbl}>Description</label>
                <textarea className={inp} rows={2} value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div className={fld}>
                <label className={lbl}>Status</label>
                <select className={sel} value={form.is_active ? 'true' : 'false'}
                  onChange={e => setForm(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-3" style={{ borderColor: 'var(--border)' }}>
              <Button variant="secondary" onClick={() => setDrawerOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}
                isLoading={createMutation.isPending || updateMutation.isPending}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
