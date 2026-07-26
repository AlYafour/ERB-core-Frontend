'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader, Button, Loader } from '@/components/ui';
import HRSettingsNav from '@/components/hr/HRSettingsNav';
import { hrLegalEntitiesApi } from '@/lib/api/hr';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { HRLegalEntity } from '@/types';

const INPUT_CS: React.CSSProperties = {
  width: '100%', padding: '8px 11px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none', boxSizing: 'border-box',
};
const LBL_CS: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 5,
};

export default function LegalEntitiesPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['hr-legal-entities-all'],
    queryFn: () => hrLegalEntitiesApi.getAll({ page: 1 }),
    staleTime: 120_000,
  });
  const entities = data?.results ?? [];

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Companies"
          description="Your legal entities — set each company's Arabic name so notices and documents are signed with the right company in both languages."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Settings', href: '/hr/settings' }, { label: 'Companies' }]}
        />
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          <HRSettingsNav />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {isLoading ? (
              <Loader />
            ) : entities.length === 0 ? (
              <div className="card" style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                No companies yet. Legal entities are created from the employee roster.
              </div>
            ) : (
              entities.map(e => <EntityRow key={e.id} entity={e} onSaved={() => qc.invalidateQueries({ queryKey: ['hr-legal-entities-all'] })} />)
            )}
          </div>
        </div>
      </PageShell>
    </MainLayout>
  );
}

function EntityRow({ entity, onSaved }: { entity: HRLegalEntity; onSaved: () => void }) {
  const [name, setName] = useState(entity.name);
  const [nameAr, setNameAr] = useState(entity.name_ar ?? '');
  useEffect(() => { setName(entity.name); setNameAr(entity.name_ar ?? ''); }, [entity]);

  const dirty = name !== entity.name || nameAr !== (entity.name_ar ?? '');

  const save = useMutation({
    mutationFn: () => hrLegalEntitiesApi.update(entity.id, { name: name.trim(), name_ar: nameAr.trim() }),
    onSuccess: () => { toast('Company saved', 'success'); onSaved(); },
    onError: (err) => toast(getApiError(err, 'Could not save the company'), 'error'),
  });

  return (
    <div className="card" style={{ padding: 'var(--space-5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>{entity.name}</p>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
          {entity.employee_count} employee{entity.employee_count === 1 ? '' : 's'}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
        <div>
          <label style={LBL_CS}>Company name (English)</label>
          <input style={INPUT_CS} value={name} onChange={e => setName(e.target.value)} placeholder="AL YAFOUR GENERAL CONTRACTING & TRANSPORT LLC" />
        </div>
        <div>
          <label style={LBL_CS}>Company name (Arabic)</label>
          <input style={{ ...INPUT_CS, direction: 'rtl' }} value={nameAr} onChange={e => setNameAr(e.target.value)} placeholder="شركة ال يافور للمقاولات والنقليات العامة ذ.م.م" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
        <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || !name.trim() || save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
