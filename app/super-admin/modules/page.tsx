'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantApi } from '@/lib/api/tenants';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import type { TenantInfo } from '@/types/saas';

const ALL_MODULES = [
  { key: 'procurement',    label: 'Procurement',     description: 'Purchase requests, orders, quotations, GRN, invoices' },
  { key: 'inventory',      label: 'Inventory',       description: 'Stock tracking and product catalog' },
  { key: 'hr',             label: 'HR',              description: 'Employees, attendance, payroll, requests' },
  { key: 'crm',            label: 'CRM / Customers', description: 'Customer management and relations' },
  { key: 'projects',       label: 'Projects',        description: 'Project tracking and cost codes' },
  { key: 'tasks',          label: 'Tasks',           description: 'Task management and team collaboration' },
  { key: 'subcontractors', label: 'Subcontractors',  description: 'Subcontractor contracts, payments, BOQ library' },
  { key: 'violations',     label: 'Violations',      description: 'Municipal violation tracking and alerts' },
  { key: 'ai',             label: 'AI Assistant',    description: 'AI-powered procurement insights' },
];

export default function ModulesPage() {
  const [selectedId, setSelectedId] = useState('');
  const [toggles, setToggles] = useState<Record<string, boolean>>({});
  const [isDirty, setIsDirty] = useState(false);
  const qc = useQueryClient();

  const { data: allTenants } = useQuery({
    queryKey: ['super', 'tenants-all'],
    queryFn: tenantApi.listAllTenants,
    staleTime: 60_000,
  });
  const tenants: TenantInfo[] = allTenants ?? [];

  const { data: tenantDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ['super', 'tenant', selectedId],
    queryFn: () => tenantApi.getTenant(selectedId),
    enabled: !!selectedId,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!tenantDetail?.modules) return;
    const map: Record<string, boolean> = {};
    tenantDetail.modules.forEach((m) => { map[m.module_key] = m.is_enabled; });
    setToggles(map);
    setIsDirty(false);
  }, [tenantDetail]);

  const updateMut = useMutation({
    mutationFn: () => tenantApi.updateModules(selectedId, toggles),
    onSuccess: () => {
      toast('Modules updated', 'success');
      qc.invalidateQueries({ queryKey: ['super', 'tenant', selectedId] });
      setIsDirty(false);
    },
    onError: (err: unknown) => toast(getApiError(err, 'Failed to update modules'), 'error'),
  });

  const toggle = (key: string) => {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    setIsDirty(true);
  };

  return (
    <div style={{ maxWidth: 760 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Module Management</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '6px 0 0' }}>
            Enable or disable modules for each company. Changes take effect on next login.
          </p>
        </div>

        {/* Company selector */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Select Company</label>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--surface-input)', color: 'var(--text-primary)', fontSize: 14, minWidth: 280, outline: 'none' }}
          >
            <option value="">— choose a company —</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
            ))}
          </select>
        </div>

        {selectedId && (
          loadingDetail ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Loading modules…</div>
          ) : (
            <div>
              <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
                {ALL_MODULES.map((mod, idx) => {
                  const enabled = toggles[mod.key] ?? false;
                  return (
                    <div
                      key={mod.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 20px',
                        borderBottom: idx < ALL_MODULES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{mod.label}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{mod.description}</div>
                      </div>
                      {/* Toggle */}
                      <button
                        onClick={() => toggle(mod.key)}
                        aria-label={`Toggle ${mod.label}`}
                        style={{
                          position: 'relative',
                          width: 44,
                          height: 24,
                          borderRadius: 99,
                          border: 'none',
                          cursor: 'pointer',
                          background: enabled ? 'var(--color-success)' : 'var(--border-subtle)',
                          transition: 'background 150ms',
                          flexShrink: 0,
                        }}
                      >
                        <span style={{
                          position: 'absolute',
                          top: 3, left: enabled ? 22 : 3,
                          width: 18, height: 18,
                          borderRadius: '50%',
                          background: '#fff',
                          transition: 'left 150ms',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                        }} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => updateMut.mutate()}
                  disabled={!isDirty || updateMut.isPending}
                  style={{
                    padding: '9px 24px', borderRadius: 8, border: 'none',
                    background: 'var(--wine-500)', color: '#fff',
                    fontSize: 13, fontWeight: 600,
                    cursor: !isDirty || updateMut.isPending ? 'not-allowed' : 'pointer',
                    opacity: !isDirty || updateMut.isPending ? 0.5 : 1,
                  }}
                >
                  {updateMut.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          )
        )}
      </div>
  );
}
