'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader } from '@/components/ui';
import {
  approvalsApi,
  type RequestType,
  type ApprovalPolicy,
  type ApprovalStep,
} from '@/lib/api/approvals';

// ─── Icons ────────────────────────────────────────────────────────────────────

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
    style={{ transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const Trash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" />
  </svg>
);

const Check = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Doc type metadata ────────────────────────────────────────────────────────

const DOC_META: Record<string, { emoji: string; sub: string }> = {
  purchase_request: { emoji: '📋', sub: 'Purchase requests submitted to suppliers' },
  purchase_order:   { emoji: '📦', sub: 'Formal purchase orders' },
  leave_request:    { emoji: '🏖️', sub: 'Employee leave requests' },
};

// ─── Static document types — always visible even if API returns nothing ───────

const STATIC_DOC_TYPES: RequestType[] = [
  { id: -1, code: 'purchase_request', name: 'Purchase Request', name_ar: 'طلب شراء', is_active: true },
  { id: -2, code: 'purchase_order',   name: 'Purchase Order',   name_ar: 'أمر شراء',  is_active: true },
];

// ─── Roles hook ───────────────────────────────────────────────────────────────

function useRoles() {
  return useQuery({
    queryKey: ['roles-list'],
    queryFn: async () => {
      const { default: apiClient } = await import('@/lib/api/client');
      const res = await apiClient.get('/permissions/roles/?page_size=500');
      return (res.data?.results ?? res.data) as { id: number; name: string }[];
    },
  });
}

// ─── Step draft ───────────────────────────────────────────────────────────────

interface StepDraft {
  _key: number;
  id?: number;
  order: number;
  approver_strategy: 'ROLE' | 'DIRECT_MANAGER' | 'INDIRECT_MANAGER';
  role: number | null;
  role_display: string | null;
  escalation_after_hours: number | null;
  sod_fallback_strategy: string | null;
}

function blankStep(order: number): StepDraft {
  return {
    _key: Date.now() + order,
    order,
    approver_strategy: 'ROLE',
    role: null,
    role_display: null,
    escalation_after_hours: null,
    sod_fallback_strategy: 'DIRECT_MANAGER',
  };
}

// ─── Small chip helper ────────────────────────────────────────────────────────

function Chip({ children, brand, success, muted }: {
  children: React.ReactNode;
  brand?: boolean; success?: boolean; muted?: boolean;
}) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
      background: brand   ? 'color-mix(in srgb, var(--brand) 14%, transparent)'
                : success ? 'rgba(16,185,129,0.12)'
                :           'var(--surface-subtle)',
      color:  brand   ? 'var(--brand)'
            : success ? '#10b981'
            :           'var(--text-muted)',
      border: `1px solid ${brand   ? 'color-mix(in srgb, var(--brand) 30%, transparent)'
                          : success ? 'rgba(16,185,129,0.3)'
                          :           'var(--border-default)'}`,
    }}>
      {children}
    </span>
  );
}

// ─── Single step card ─────────────────────────────────────────────────────────

function StepCard({
  step, index, roles, onChange, onRemove,
}: {
  step: StepDraft;
  index: number;
  roles: { id: number; name: string }[];
  onChange: (patch: Partial<StepDraft>) => void;
  onRemove: () => void;
}) {
  const [advanced, setAdvanced] = useState(false);

  const sel: React.CSSProperties = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: '1.5px solid var(--border-default)',
    background: 'var(--surface-primary)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
  };

  const needsRole = step.approver_strategy === 'ROLE';
  const missing   = needsRole && !step.role;

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {/* Step number bubble */}
      <div style={{ flexShrink: 0, paddingTop: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'color-mix(in srgb, var(--brand) 14%, transparent)',
          border: '2px solid var(--brand)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: 'var(--brand)',
        }}>{index + 1}</div>
      </div>

      {/* Card */}
      <div style={{
        flex: 1,
        background: 'var(--card-bg)',
        border: `1.5px solid ${missing ? 'rgba(239,68,68,0.4)' : 'var(--card-border)'}`,
        borderRadius: 12, padding: '14px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>

        {/* Row 1: strategy + role + delete */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: '0 0 180px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Approver
            </div>
            <select value={step.approver_strategy}
              onChange={e => onChange({ approver_strategy: e.target.value as StepDraft['approver_strategy'], role: null, role_display: null })}
              style={sel}>
              <option value="ROLE">By Role</option>
              <option value="DIRECT_MANAGER">Direct Manager</option>
              <option value="INDIRECT_MANAGER">Indirect Manager</option>
            </select>
          </div>

          {needsRole && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Role
              </div>
              <select
                value={step.role ?? ''}
                onChange={e => {
                  const r = roles.find(r => r.id === +e.target.value);
                  onChange({ role: r?.id ?? null, role_display: r?.name ?? null });
                }}
                style={{ ...sel, borderColor: missing ? 'rgba(239,68,68,0.6)' : 'var(--border-default)' }}>
                <option value="">Select a role...</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          )}

          <button onClick={onRemove} title="Remove step" style={{
            background: 'none', border: '1px solid var(--border-default)',
            borderRadius: 8, padding: '8px', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            flexShrink: 0, marginBottom: 1,
          }}>
            <Trash />
          </button>
        </div>

        {/* Advanced toggle */}
        <button type="button" onClick={() => setAdvanced(v => !v)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, padding: 0,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          <ChevronDown open={advanced} />
          Advanced options (escalation, SoD fallback)
        </button>

        {advanced && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, paddingTop: 2 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Escalate after (hours)
              </div>
              <input type="number" min={1} placeholder="e.g. 24"
                value={step.escalation_after_hours ?? ''}
                onChange={e => onChange({ escalation_after_hours: e.target.value ? +e.target.value : null })}
                style={sel} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Auto-escalate if no response</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                If approver = requester (SoD)
              </div>
              <select value={step.sod_fallback_strategy ?? ''}
                onChange={e => onChange({ sod_fallback_strategy: e.target.value || null })}
                style={sel}>
                <option value="">None</option>
                <option value="DIRECT_MANAGER">Go to direct manager</option>
                <option value="INDIRECT_MANAGER">Go to indirect manager</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chain editor ─────────────────────────────────────────────────────────────
// realTypeId: the actual DB ID of this RequestType (resolved from API).
// May be -1 if API didn't return this type yet; we resolve it at save time.

function ChainEditor({ requestType, realTypeId, policies, roles, onRefresh }: {
  requestType: RequestType;
  realTypeId: number;
  policies: ApprovalPolicy[];
  roles: { id: number; name: string }[];
  onRefresh: () => void;
}) {
  // Find existing active policy for this type (only if we have a real ID)
  const policy = realTypeId > 0
    ? (policies.find(p => p.request_types.includes(realTypeId) && p.is_active) ?? null)
    : null;

  const [steps, setSteps] = useState<StepDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  useEffect(() => {
    if (policy?.steps?.length) {
      setSteps(
        [...policy.steps].sort((a, b) => a.order - b.order).map((s, i) => ({
          _key: s.id ?? i,
          id: s.id,
          order: s.order,
          approver_strategy: (s.approver_strategy as StepDraft['approver_strategy']) ?? 'ROLE',
          role: s.role,
          role_display: s.role_display,
          escalation_after_hours: s.escalation_after_hours,
          sod_fallback_strategy: s.sod_fallback_strategy,
        }))
      );
    } else {
      setSteps([]);
    }
    setSaved(false);
  }, [policy?.id]);

  const addStep    = () => { setSteps(p => [...p, blankStep(p.length + 1)]); setSaved(false); };
  const removeStep = (key: number) => { setSteps(p => p.filter(s => s._key !== key).map((s, i) => ({ ...s, order: i + 1 }))); setSaved(false); };
  const updateStep = (key: number, patch: Partial<StepDraft>) => { setSteps(p => p.map(s => s._key === key ? { ...s, ...patch } : s)); setSaved(false); };

  async function save() {
    setError('');
    if (steps.some(s => s.approver_strategy === 'ROLE' && !s.role)) {
      setError('Please select a role for every step.');
      return;
    }
    setSaving(true);
    try {
      // Resolve the real DB ID (may need API call if using static fallback)
      let finalRtId = realTypeId;
      if (finalRtId < 0) {
        const allTypes = await approvalsApi.getRequestTypes();
        const found = allTypes.find(rt => rt.code === requestType.code);
        if (found) {
          finalRtId = found.id;
        } else {
          setError('Document type not found on the server. Please contact support.');
          setSaving(false);
          return;
        }
      }

      let savedPolicy: ApprovalPolicy;
      const base = {
        name: policy?.name ?? `${requestType.name} — Default`,
        is_active: true,
        priority: policy?.priority ?? 10,
        request_types: policy?.request_types ?? [finalRtId],
        condition_field: '', condition_operator: '', condition_value: '',
      };

      if (policy) {
        savedPolicy = await approvalsApi.updatePolicy(policy.id, base);
        const keptIds = new Set(steps.filter(s => s.id).map(s => s.id));
        for (const old of policy.steps ?? []) {
          if (old.id && !keptIds.has(old.id)) await approvalsApi.deleteStep(old.id);
        }
      } else {
        savedPolicy = await approvalsApi.createPolicy(base);
      }

      for (const step of steps) {
        const payload = {
          policy: savedPolicy.id, order: step.order,
          approver_strategy: step.approver_strategy,
          role: step.approver_strategy === 'ROLE' ? step.role : null,
          sod_fallback_role: null, sod_fallback_strategy: step.sod_fallback_strategy || null,
          sod_fallback_user: null, specific_user: null,
          escalation_after_hours: step.escalation_after_hours,
          role_name: '', sod_fallback_role_name: '',
        };
        if (step.id) await approvalsApi.updateStep(step.id, payload);
        else await approvalsApi.createStep(payload as Omit<ApprovalStep, 'id'>);
      }

      setSaved(true);
      onRefresh();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? JSON.stringify(e?.response?.data) ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  // Active flow preview (from saved policy)
  const flowSteps = [...(policy?.steps ?? [])].sort((a, b) => a.order - b.order);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Flow preview */}
      {flowSteps.length > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: 12,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.2)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Active flow
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Chip muted>Requester</Chip>
            {flowSteps.map((s, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <Chip brand>
                  {s.role_display
                    ?? (s.approver_strategy === 'DIRECT_MANAGER' ? 'Direct Manager'
                    :  s.approver_strategy === 'INDIRECT_MANAGER' ? 'Indirect Manager' : '—')}
                </Chip>
              </span>
            ))}
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <Chip success>Approved</Chip>
          </div>
        </div>
      )}

      {/* Empty state */}
      {steps.length === 0 && (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          border: '2px dashed var(--border-default)', borderRadius: 14,
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>⚡</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
            No approvals configured
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
            Add steps to define who must approve {requestType.name} submissions
          </div>
          <button onClick={addStep} style={{
            padding: '10px 28px', borderRadius: 10, border: 'none',
            background: 'var(--brand)', color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}>
            + Add First Step
          </button>
        </div>
      )}

      {/* Step list */}
      {steps.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((step, idx) => (
            <StepCard
              key={step._key}
              step={step} index={idx} roles={roles}
              onChange={patch => updateStep(step._key, patch)}
              onRemove={() => removeStep(step._key)}
            />
          ))}
        </div>
      )}

      {/* Add step */}
      {steps.length > 0 && (
        <button onClick={addStep} style={{
          width: '100%', padding: '10px', borderRadius: 10,
          border: '1.5px dashed var(--border-default)',
          background: 'transparent', color: 'var(--text-muted)',
          fontSize: 13, cursor: 'pointer', transition: 'all 150ms',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)'; e.currentTarget.style.color = 'var(--brand)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.color = 'var(--text-muted)'; }}>
          + Add Another Step
        </button>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#ef4444', fontSize: 13,
        }}>{error}</div>
      )}

      {/* Save */}
      {steps.length > 0 && (
        <button onClick={save} disabled={saving} style={{
          padding: '12px', borderRadius: 12, border: 'none',
          background: saved ? '#10b981' : 'var(--brand)',
          color: '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.7 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          transition: 'background 300ms',
        }}>
          {saving ? 'Saving...' : saved ? <><Check /> Saved</> : 'Save Approval Chain'}
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApprovalChainsPage() {
  const qc = useQueryClient();
  // Start with purchase_request selected (uses static code so it works before API loads)
  const [selectedCode, setSelectedCode] = useState<string>('purchase_request');

  const { data: apiTypes = [], isLoading: rtLoad } = useQuery({
    queryKey: ['approval-request-types'],
    queryFn: approvalsApi.getRequestTypes,
  });

  const { data: allPolicies = [], isLoading: polLoad } = useQuery({
    queryKey: ['approval-policies'],
    queryFn: () => approvalsApi.getPolicies(),
  });

  const { data: roles = [] } = useRoles();
  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ['approval-policies'] }), [qc]);

  // Procurement types from API — deduplicated by code (tenant-specific wins over global)
  const byCode = new Map<string, RequestType>();
  [...apiTypes]
    .filter(rt => ['purchase_request', 'purchase_order'].includes(rt.code))
    .sort((a, b) => b.id - a.id)           // highest ID first → tenant-specific wins
    .forEach(rt => byCode.set(rt.code, rt));
  const apiProcurementTypes = Array.from(byCode.values());

  const requestTypes: RequestType[] = apiProcurementTypes.length > 0
    ? apiProcurementTypes
    : STATIC_DOC_TYPES;

  // Map code → real DB ID (populated when API returns data)
  const realIdByCode: Record<string, number> = Object.fromEntries(
    apiTypes.map(rt => [rt.code, rt.id])
  );

  // The displayed type is selected by code so it survives the static→API transition
  const selectedType = requestTypes.find(rt => rt.code === selectedCode) ?? requestTypes[0] ?? null;

  // Real DB ID for the selected type (-1 if API hasn't returned it yet)
  const realTypeId = selectedType ? (realIdByCode[selectedType.code] ?? selectedType.id) : -1;

  // Check if a policy exists for each type (for the status dot)
  function hasActivePolicy(code: string): boolean {
    const id = realIdByCode[code];
    if (!id) return false;
    return allPolicies.some(p => p.request_types.includes(id) && p.is_active);
  }

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Approval Chains"
          description="Configure who approves each document type and in what order"
          breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Approval Chains' }]}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left sidebar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              padding: '0 4px', marginBottom: 4,
            }}>Document Type</div>

            {requestTypes.map(rt => {
              const meta   = DOC_META[rt.code] ?? { emoji: '📄', sub: '' };
              const active = selectedCode === rt.code;
              const hasPol = hasActivePolicy(rt.code);

              return (
                <button key={rt.code} onClick={() => setSelectedCode(rt.code)} style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  padding: '12px 14px', borderRadius: 12,
                  border: active ? '2px solid var(--brand)' : '1.5px solid var(--border-default)',
                  background: active ? 'color-mix(in srgb, var(--brand) 7%, var(--card-bg))' : 'var(--card-bg)',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 150ms',
                }}>
                  <span style={{ fontSize: 20 }}>{meta.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {rt.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{meta.sub}</div>
                  </div>
                  {/* Status dot: green = has active chain, grey = not configured */}
                  <span title={hasPol ? 'Chain configured' : 'Not configured'} style={{
                    width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                    background: hasPol ? '#10b981' : 'var(--border-default)',
                  }} />
                </button>
              );
            })}

            {/* Loading indicator when API is fetching */}
            {rtLoad && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 6px' }}>
                Loading from server...
              </div>
            )}
          </div>

          {/* ── Right panel ── */}
          {selectedType ? (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 16, padding: '24px',
            }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{DOC_META[selectedType.code]?.emoji ?? '📄'}</span>
                  <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>
                    {selectedType.name}
                  </div>
                </div>
                <div style={{
                  fontSize: 13, color: 'var(--text-secondary)',
                  padding: '10px 14px', borderRadius: 10,
                  background: 'var(--surface-subtle)',
                  border: '1px solid var(--border-default)',
                  lineHeight: 1.6,
                }}>
                  When someone submits a <strong>{selectedType.name}</strong>, it is routed through the steps below for approval in order. If no steps are configured, submissions will be blocked.
                </div>
              </div>

              <ChainEditor
                key={selectedType.code}
                requestType={selectedType}
                realTypeId={realTypeId}
                policies={allPolicies}
                roles={roles}
                onRefresh={refresh}
              />
            </div>
          ) : (
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 16, padding: 40, textAlign: 'center', color: 'var(--text-muted)',
            }}>
              Select a document type on the left
            </div>
          )}
        </div>
      </PageShell>
    </MainLayout>
  );
}
