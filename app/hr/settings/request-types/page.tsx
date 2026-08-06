'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrApprovalsApi, type HRRequestType } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';

const INPUT_CS: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};
const LBL_CS: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 5,
};
const DURATION_OPTS = [
  { value: 'days',  label: 'Full days (date range)' },
  { value: 'hours', label: 'Hourly (time window)' },
  { value: 'both',  label: 'Either full day or hourly' },
  { value: 'none',  label: 'No dates' },
];

type Kind = 'shared' | 'custom' | 'hidden';
function kindOf(t: HRRequestType): Kind {
  if (t.is_global) return 'shared';
  return t.is_active ? 'custom' : 'hidden';
}
const BADGE: Record<Kind, { label: string; color: string; bg: string }> = {
  shared: { label: 'Common', color: 'var(--text-secondary)', bg: 'var(--surface-subtle)' },
  custom: { label: 'Custom',  color: 'var(--brand)', bg: 'var(--brand-subtle)' },
  hidden: { label: 'Hidden',  color: 'var(--status-warning)', bg: 'var(--status-warning-bg)' },
};

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 50);
}

export default function RequestTypesPage() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [duration, setDuration] = useState('days');

  const { data = [], isLoading } = useQuery({
    queryKey: ['hr-managed-request-types'],
    queryFn: hrApprovalsApi.getManagedRequestTypes,
    staleTime: 60_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['hr-managed-request-types'] });
    qc.invalidateQueries({ queryKey: ['request-types'] });
    qc.invalidateQueries({ queryKey: ['hr-request-types'] });
  };

  const create = useMutation({
    mutationFn: () => hrApprovalsApi.createRequestType({
      code: slugify(name) || `type_${Date.now()}`, name: name.trim(), name_ar: nameAr.trim(),
      duration_mode: duration as HRRequestType['duration_mode'], is_active: true,
    }),
    onSuccess: () => {
      toast('Request type added', 'success');
      setAdding(false); setName(''); setNameAr(''); setDuration('days');
      invalidate();
    },
    onError: (err) => toast(getApiError(err, 'Could not add the request type'), 'error'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => hrApprovalsApi.deleteRequestType(id),
    onSuccess: () => invalidate(),
    onError: (err) => toast(getApiError(err, 'Action failed'), 'error'),
  });

  // Reversible show/hide for a company's OWN type (e.g. Missing Punch): flips
  // is_active, so employees stop/start seeing it without losing its settings.
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      hrApprovalsApi.updateRequestType(id, { is_active: active }),
    onSuccess: () => invalidate(),
    onError: (err) => toast(getApiError(err, 'Action failed'), 'error'),
  });

  // "Counts as" — how much of a working day each approved day of this type is
  // worth on the attendance report (e.g. Work From Home = ½ day).
  const setCredit = useMutation({
    mutationFn: ({ id, credit }: { id: number; credit: number }) =>
      hrApprovalsApi.updateRequestType(id, { day_credit: credit }),
    onSuccess: () => { toast('Updated', 'success'); invalidate(); },
    onError: (err) => toast(getApiError(err, 'Could not update — for a shared type, add a company copy first'), 'error'),
  });

  const busy = remove.isPending || toggle.isPending || setCredit.isPending;

  // Hiding a SHARED (global) type = a per-tenant inactive override (destroy).
  const hideShared = async (t: HRRequestType) => {
    if (await confirm(`Hide "${t.name}" for your company? Employees won't see it. You can restore it anytime.`))
      remove.mutate(t.id);
  };
  const del = async (t: HRRequestType) => {
    if (await confirm(`Delete "${t.name}" permanently for your company?`))
      remove.mutate(t.id);
  };

  const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Request Types"
          description="The request types employees can submit. Hide the ones you don't use (reversible — Show brings them back), or add your own. Common types are shared across all companies."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Request Types' }]}
        />
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {!adding && <Button size="sm" onClick={() => setAdding(true)}>+ Add request type</Button>}
            </div>

            {adding && (
              <section className="card" style={{ padding: 'var(--space-5)' }}>
                <p style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>New request type</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                  <div>
                    <label style={LBL_CS}>Name (English)</label>
                    <input style={INPUT_CS} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Tools Reimbursement" autoFocus />
                  </div>
                  <div>
                    <label style={LBL_CS}>Name (Arabic)</label>
                    <input style={{ ...INPUT_CS, direction: 'rtl' }} value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="مثلاً استرداد أدوات" />
                  </div>
                  <div>
                    <label style={LBL_CS}>Measured as</label>
                    <select style={INPUT_CS} value={duration} onChange={e => setDuration(e.target.value)}>
                      {DURATION_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                  <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setName(''); setNameAr(''); }}>Cancel</Button>
                  <Button size="sm" onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
                    {create.isPending ? 'Adding…' : 'Add'}
                  </Button>
                </div>
              </section>
            )}

            <section className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {isLoading ? (
                <div style={{ padding: 'var(--space-6)' }}><Loader /></div>
              ) : sorted.length === 0 ? (
                <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No request types.</div>
              ) : (
                sorted.map((t, i) => {
                  const k = kindOf(t);
                  const b = BADGE[k];
                  return (
                    <div key={t.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                      padding: 'var(--space-3) var(--space-5)',
                      borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                      opacity: k === 'hidden' ? 0.6 : 1,
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', textDecoration: k === 'hidden' ? 'line-through' : 'none' }}>{t.name}</span>
                          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: b.color, background: b.bg, padding: '2px 8px', borderRadius: 999 }}>{b.label}</span>
                        </div>
                        {t.name_ar && <span dir="rtl" style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{t.name_ar}</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexShrink: 0 }}>
                        {k !== 'shared' && (t.duration_mode === 'days' || t.duration_mode === 'both') && (
                          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            Counts as
                            <select
                              value={String(Number(t.day_credit ?? 1))}
                              onChange={e => setCredit.mutate({ id: t.id, credit: Number(e.target.value) })}
                              disabled={busy}
                              style={{ padding: '3px 6px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: 'var(--text-xs)' }}
                            >
                              <option value="1">Full day</option>
                              <option value="0.5">½ day</option>
                              <option value="0.25">¼ day</option>
                            </select>
                          </label>
                        )}
                        {k === 'shared' && (
                          <Button variant="ghost" size="sm" onClick={() => hideShared(t)} disabled={busy}>Hide</Button>
                        )}
                        {k === 'custom' && (
                          <>
                            <Button variant="secondary" size="sm" onClick={() => toggle.mutate({ id: t.id, active: false })} disabled={busy}>Hide</Button>
                            <Button variant="ghost" size="sm" onClick={() => del(t)} disabled={busy}>Delete</Button>
                          </>
                        )}
                        {k === 'hidden' && (
                          <>
                            <Button variant="success" size="sm" onClick={() => toggle.mutate({ id: t.id, active: true })} disabled={busy}>Show</Button>
                            <Button variant="ghost" size="sm" onClick={() => del(t)} disabled={busy}>Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}
