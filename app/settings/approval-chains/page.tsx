'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { PageShell, PageHeader } from '@/components/ui';
import { approvalsApi, type RequestType, type ApprovalPolicy, type ApprovalStep } from '@/lib/api/approvals';

// ── helpers ──────────────────────────────────────────────────────────────────

const STRATEGY_OPTIONS = [
  { value: 'ROLE',             label: 'By Role' },
  { value: 'DIRECT_MANAGER',   label: 'Direct Manager' },
  { value: 'INDIRECT_MANAGER', label: 'Indirect Manager' },
  { value: 'SPECIFIC_USER',    label: 'Specific User' },
] as const;

const SOD_STRATEGY_OPTIONS = [
  { value: '',                 label: 'None' },
  { value: 'DIRECT_MANAGER',  label: 'Direct Manager' },
  { value: 'INDIRECT_MANAGER', label: 'Indirect Manager' },
  { value: 'ROLE',             label: 'Another Role' },
] as const;

const CONDITION_OPERATORS = [
  { value: '',   label: 'Always (no condition)' },
  { value: '>',  label: 'Amount >' },
  { value: '>=', label: 'Amount >=' },
  { value: '<',  label: 'Amount <' },
  { value: '<=', label: 'Amount <=' },
  { value: '=',  label: 'Amount =' },
];

type StepDraft = Omit<ApprovalStep, 'id' | 'policy'> & { _key: number; id?: number };

function emptyStep(order: number): StepDraft {
  return {
    _key: Date.now() + order,
    order,
    approver_strategy: 'ROLE',
    role: null, role_display: null,
    sod_fallback_role: null, sod_role_display: null,
    sod_fallback_strategy: null, sod_fallback_user: null,
    specific_user: null,
    escalation_after_hours: null,
  };
}

// ── Roles picker (from permissions API) ──────────────────────────────────────

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

// ── Step editor ───────────────────────────────────────────────────────────────

function StepEditor({
  step, index, onUpdate, onRemove, roles,
}: {
  step: StepDraft;
  index: number;
  onUpdate: (patch: Partial<StepDraft>) => void;
  onRemove: () => void;
  roles: { id: number; name: string }[];
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: 8,
    border: '1.5px solid var(--border-default)',
    background: 'var(--surface-subtle)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  };

  return (
    <div style={{
      border: '1.5px solid var(--border-default)', borderRadius: 12,
      padding: '16px', background: 'var(--surface-subtle)',
      display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--brand)',
          background: 'color-mix(in srgb, var(--brand) 12%, transparent)',
          padding: '2px 10px', borderRadius: 20,
        }}>Step {index + 1}</span>
        <button onClick={onRemove} title="Remove step" style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 2,
        }}>x</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Strategy */}
        <div>
          <span style={labelStyle}>Approver by</span>
          <select
            value={step.approver_strategy}
            onChange={e => onUpdate({ approver_strategy: e.target.value as StepDraft['approver_strategy'] })}
            style={inputStyle}
          >
            {STRATEGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Role picker — shown when strategy = ROLE */}
        {step.approver_strategy === 'ROLE' && (
          <div>
            <span style={labelStyle}>Role</span>
            <select
              value={step.role ?? ''}
              onChange={e => onUpdate({ role: e.target.value ? +e.target.value : null })}
              style={inputStyle}
            >
              <option value="">Select role...</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        )}

        {/* Escalation */}
        <div>
          <span style={labelStyle}>Escalate after (hours)</span>
          <input
            type="number" min={1} placeholder="e.g. 24"
            value={step.escalation_after_hours ?? ''}
            onChange={e => onUpdate({ escalation_after_hours: e.target.value ? +e.target.value : null })}
            style={inputStyle}
          />
        </div>

        {/* SoD fallback */}
        <div>
          <span style={labelStyle}>SoD Fallback (if requester = approver)</span>
          <select
            value={step.sod_fallback_strategy ?? ''}
            onChange={e => onUpdate({ sod_fallback_strategy: (e.target.value || null) as StepDraft['sod_fallback_strategy'] })}
            style={inputStyle}
          >
            {SOD_STRATEGY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// ── Policy drawer ─────────────────────────────────────────────────────────────

function PolicyDrawer({
  policy, requestTypes, onClose, onSaved,
}: {
  policy: ApprovalPolicy | null;
  requestTypes: RequestType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = policy !== null;
  const [name, setName] = useState(policy?.name ?? '');
  const [isActive, setIsActive] = useState(policy?.is_active ?? true);
  const [priority, setPriority] = useState(policy?.priority ?? 10);
  const [selectedRTIds, setSelectedRTIds] = useState<number[]>(policy?.request_types ?? []);
  const [condOp, setCondOp] = useState(policy?.condition_operator ?? '');
  const [condVal, setCondVal] = useState(policy?.condition_value ?? '');
  const [steps, setSteps] = useState<StepDraft[]>(
    policy?.steps?.map((s, i) => ({ ...s, _key: i, order: s.order ?? i + 1 })) ?? [emptyStep(1)]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: roles = [] } = useRoles();

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px', borderRadius: 8,
    border: '1.5px solid var(--border-default)',
    background: 'var(--surface-subtle)', color: 'var(--text-primary)',
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, display: 'block',
  };

  function addStep() {
    setSteps(prev => [...prev, emptyStep(prev.length + 1)]);
  }

  function removeStep(idx: number) {
    setSteps(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  function updateStep(idx: number, patch: Partial<StepDraft>) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  }

  async function handleSave() {
    if (!name.trim()) { setError('Policy name is required.'); return; }
    if (selectedRTIds.length === 0) { setError('Select at least one document type.'); return; }
    if (steps.length === 0) { setError('Add at least one approval step.'); return; }
    setSaving(true); setError('');
    try {
      let savedPolicy: ApprovalPolicy;
      const policyPayload = {
        name: name.trim(),
        is_active: isActive,
        priority,
        request_types: selectedRTIds,
        condition_field: condOp ? 'amount' : '',
        condition_operator: condOp,
        condition_value: condOp ? condVal : '',
      };
      if (isEdit && policy) {
        savedPolicy = await approvalsApi.updatePolicy(policy.id, policyPayload);
        // Delete removed steps
        const existingIds = new Set(steps.filter(s => s.id).map(s => s.id));
        for (const old of policy.steps ?? []) {
          if (!existingIds.has(old.id)) await approvalsApi.deleteStep(old.id!);
        }
      } else {
        savedPolicy = await approvalsApi.createPolicy(policyPayload);
      }
      // Upsert steps
      for (const step of steps) {
        const stepPayload = {
          policy: savedPolicy.id,
          order: step.order,
          approver_strategy: step.approver_strategy,
          role: step.role,
          sod_fallback_role: step.sod_fallback_role,
          sod_fallback_strategy: step.sod_fallback_strategy,
          sod_fallback_user: step.sod_fallback_user,
          specific_user: step.specific_user,
          escalation_after_hours: step.escalation_after_hours,
          role_name: '', sod_fallback_role_name: '',
        };
        if (step.id) {
          await approvalsApi.updateStep(step.id, stepPayload);
        } else {
          await approvalsApi.createStep(stepPayload as Omit<ApprovalStep, 'id'>);
        }
      }
      onSaved();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } } };
      setError(err?.response?.data?.detail ?? JSON.stringify(err?.response?.data) ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(2px)' }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 560,
        height: '100vh',
        background: 'var(--card-bg)', borderLeft: '1px solid var(--card-border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {isEdit ? 'Edit Policy' : 'New Approval Policy'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Define who approves what, in which order
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 22, lineHeight: 1,
          }}>x</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1 }}>

          {/* Name */}
          <div>
            <label style={labelStyle}>Policy Name *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Purchase Request — Standard"
              style={inputStyle}
            />
          </div>

          {/* Document types */}
          <div>
            <label style={labelStyle}>Document Types *</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {requestTypes.map(rt => {
                const selected = selectedRTIds.includes(rt.id);
                return (
                  <button key={rt.id} type="button"
                    onClick={() => setSelectedRTIds(prev =>
                      selected ? prev.filter(x => x !== rt.id) : [...prev, rt.id]
                    )}
                    style={{
                      padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                      border: selected ? '2px solid var(--brand)' : '1.5px solid var(--border-default)',
                      background: selected ? 'color-mix(in srgb, var(--brand) 12%, transparent)' : 'var(--surface-subtle)',
                      color: selected ? 'var(--brand)' : 'var(--text-secondary)',
                      fontWeight: selected ? 700 : 400,
                      transition: 'all 120ms',
                    }}>
                    {rt.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Priority + Active */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={labelStyle}>Priority (higher = preferred)</label>
              <input
                type="number"
                value={priority}
                onChange={e => setPriority(+e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 2 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={e => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--brand)' }}
                />
                <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>Active</span>
              </label>
            </div>
          </div>

          {/* Condition */}
          <div>
            <label style={labelStyle}>Condition (optional)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <select value={condOp} onChange={e => setCondOp(e.target.value)} style={inputStyle}>
                {CONDITION_OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              {condOp && (
                <input
                  type="number" placeholder="Value (e.g. 50000)"
                  value={condVal} onChange={e => setCondVal(e.target.value)}
                  style={inputStyle}
                />
              )}
            </div>
            {condOp && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                This policy applies only when amount {condOp} {condVal || '...'}
              </p>
            )}
          </div>

          {/* Steps */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Approval Steps *</label>
              <button onClick={addStep} style={{
                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                background: 'var(--brand)', color: '#fff', border: 'none', cursor: 'pointer',
              }}>+ Add Step</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {steps.map((step, idx) => (
                <StepEditor
                  key={step._key}
                  step={step} index={idx}
                  onUpdate={patch => updateStep(idx, patch)}
                  onRemove={() => removeStep(idx)}
                  roles={roles}
                />
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444', fontSize: 13,
            }}>{error}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-default)',
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          <button
            onClick={handleSave} disabled={saving}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
              background: 'var(--brand)', color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
            }}>
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Policy'}
          </button>
          <button onClick={onClose} style={{
            padding: '10px 20px', borderRadius: 10,
            border: '1px solid var(--border-default)',
            background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
            fontSize: 14, cursor: 'pointer',
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
      background: active ? 'rgba(16,185,129,0.12)' : 'var(--surface-subtle)',
      color: active ? '#10b981' : 'var(--text-muted)',
      border: `1px solid ${active ? 'rgba(16,185,129,0.3)' : 'var(--border-default)'}`,
    }}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ApprovalChainsPage() {
  const qc = useQueryClient();

  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null);
  const [drawerPolicy, setDrawerPolicy] = useState<ApprovalPolicy | null | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data: requestTypes = [], isLoading: rtLoading } = useQuery({
    queryKey: ['approval-request-types'],
    queryFn: approvalsApi.getRequestTypes,
  });

  const { data: allPolicies = [], isLoading: polLoading } = useQuery({
    queryKey: ['approval-policies'],
    queryFn: () => approvalsApi.getPolicies(),
  });

  // Auto-select first type
  useEffect(() => {
    if (requestTypes.length > 0 && selectedTypeId === null) {
      setSelectedTypeId(requestTypes[0].id);
    }
  }, [requestTypes, selectedTypeId]);

  const filteredPolicies = selectedTypeId
    ? allPolicies.filter(p => p.request_types.includes(selectedTypeId))
    : allPolicies;

  const selectedType = requestTypes.find(rt => rt.id === selectedTypeId);

  async function handleDelete(id: number) {
    setDeletingId(id);
    try {
      await approvalsApi.deletePolicy(id);
      qc.invalidateQueries({ queryKey: ['approval-policies'] });
    } finally {
      setDeletingId(null);
    }
  }

  const isLoading = rtLoading || polLoading;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title="Approval Chains"
          description="Configure who approves what, in what order, for each document type"
          breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Approval Chains' }]}
          actions={
            <button
              onClick={() => setDrawerPolicy(null)}
              style={{
                padding: '8px 18px', borderRadius: 10, border: 'none',
                background: 'var(--brand)', color: '#fff',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}>
              + New Policy
            </button>
          }
        />

        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>

            {/* Left — Document Types */}
            <div style={{
              background: 'var(--card-bg)', border: '1px solid var(--card-border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              <div style={{
                padding: '12px 16px', borderBottom: '1px solid var(--border-default)',
                fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.07em',
              }}>
                Document Types
              </div>
              {requestTypes.map(rt => {
                const policyCount = allPolicies.filter(p => p.request_types.includes(rt.id)).length;
                const isSelected = selectedTypeId === rt.id;
                return (
                  <button key={rt.id} type="button" onClick={() => setSelectedTypeId(rt.id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '11px 16px',
                      background: isSelected ? 'color-mix(in srgb, var(--brand) 10%, transparent)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--brand)' : '3px solid transparent',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'background 120ms',
                    }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, color: 'var(--text-primary)' }}>
                        {rt.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{rt.code}</div>
                    </div>
                    {policyCount > 0 && (
                      <span style={{
                        minWidth: 20, height: 20, borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: 'var(--brand)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px',
                      }}>{policyCount}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right — Policies */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Section header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedType ? selectedType.name : 'All'} Policies
                  <span style={{ marginLeft: 8, fontSize: 13, color: 'var(--text-muted)', fontWeight: 400 }}>
                    ({filteredPolicies.length})
                  </span>
                </div>
              </div>

              {filteredPolicies.length === 0 ? (
                <div style={{
                  background: 'var(--card-bg)', border: '2px dashed var(--border-default)',
                  borderRadius: 14, padding: '48px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>&#128279;</div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 6 }}>
                    No approval policy configured
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                    Create a policy to define who must approve {selectedType?.name ?? 'documents'} and in what order.
                  </div>
                  <button onClick={() => setDrawerPolicy(null)} style={{
                    padding: '9px 22px', borderRadius: 10, border: 'none',
                    background: 'var(--brand)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>+ Create First Policy</button>
                </div>
              ) : (
                filteredPolicies.map(policy => (
                  <div key={policy.id} style={{
                    background: 'var(--card-bg)', border: '1px solid var(--card-border)',
                    borderRadius: 14, padding: '16px 20px',
                  }}>
                    {/* Policy header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{policy.name}</span>
                        <StatusBadge active={policy.is_active} />
                        {policy.condition_operator && (
                          <span style={{
                            padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                            background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                            border: '1px solid rgba(99,102,241,0.3)',
                          }}>
                            Amount {policy.condition_operator} {policy.condition_value}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setDrawerPolicy(policy)} style={{
                          padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          border: '1px solid var(--border-default)',
                          background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
                          cursor: 'pointer',
                        }}>Edit</button>
                        <button
                          onClick={() => handleDelete(policy.id)}
                          disabled={deletingId === policy.id}
                          style={{
                            padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            border: '1px solid rgba(239,68,68,0.3)',
                            background: 'rgba(239,68,68,0.06)', color: '#ef4444',
                            cursor: 'pointer', opacity: deletingId === policy.id ? 0.5 : 1,
                          }}>
                          {deletingId === policy.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>

                    {/* Steps timeline */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(policy.steps ?? []).sort((a, b) => a.order - b.order).map((step, idx) => (
                        <div key={step.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                            background: 'color-mix(in srgb, var(--brand) 15%, transparent)',
                            border: '2px solid var(--brand)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, fontWeight: 700, color: 'var(--brand)',
                          }}>{step.order}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                            <strong>
                              {step.approver_strategy === 'ROLE'
                                ? (step.role_display ?? 'Role TBD')
                                : step.approver_strategy === 'DIRECT_MANAGER'
                                  ? 'Direct Manager'
                                  : step.approver_strategy === 'INDIRECT_MANAGER'
                                    ? 'Indirect Manager'
                                    : 'Specific User'}
                            </strong>
                            {step.escalation_after_hours && (
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                                · escalates after {step.escalation_after_hours}h
                              </span>
                            )}
                            {step.sod_fallback_strategy && (
                              <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                                · SoD: {step.sod_fallback_strategy.replace('_', ' ').toLowerCase()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {(policy.steps?.length ?? 0) === 0 && (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          No steps configured yet — edit to add.
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
                      Priority: {policy.priority} · {policy.request_type_names?.join(', ')}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Drawer */}
        {drawerPolicy !== undefined && (
          <PolicyDrawer
            policy={drawerPolicy}
            requestTypes={requestTypes}
            onClose={() => setDrawerPolicy(undefined)}
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ['approval-policies'] });
              setDrawerPolicy(undefined);
            }}
          />
        )}
      </PageShell>
    </MainLayout>
  );
}
