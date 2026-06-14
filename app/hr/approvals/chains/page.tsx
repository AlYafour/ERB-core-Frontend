'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrApprovalsApi, hrEmployeeGroupsApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { ROLES } from '@/lib/constants/roles';
import type { ApprovalPolicy, ApprovalStep, ApproverStrategy, ConditionOperator, EmployeeGroup, HREmployee } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const isAdmin = (user: any) =>
  !!(user?.role === 'admin' || user?.role === 'super_admin' || user?.is_staff || user?.is_superuser);

const STRATEGIES: { value: ApproverStrategy; label: string }[] = [
  { value: 'DIRECT_MANAGER',   label: 'Direct Manager' },
  { value: 'INDIRECT_MANAGER', label: 'Indirect Manager' },
  { value: 'ROLE',             label: 'Role' },
  { value: 'SPECIFIC_USER',    label: 'Specific Person' },
];

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'gte', label: '>= (at least)' },
  { value: 'gt',  label: '> (more than)' },
  { value: 'lte', label: '<= (at most)' },
  { value: 'lt',  label: '< (less than)' },
  { value: 'eq',  label: '= (exactly)' },
];

// Only fields the engine actually receives via request_data at submit time.
const CONDITION_FIELDS = [
  { value: 'days',   label: 'days — leave duration' },
  { value: 'amount', label: 'amount — advance / payment' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type StageRow = {
  _key: string;
  id: number | null;
  strategy: ApproverStrategy;
  role_name: string;
  specific_user: number | null;
};

const EMPTY_STAGE = (): StageRow => ({
  _key: Math.random().toString(36).slice(2),
  id: null,
  strategy: 'DIRECT_MANAGER',
  role_name: '',
  specific_user: null,
});

type FormState = {
  name: string;
  is_active: boolean;
  priority: number;
  employee_group: number | null;
  request_type: number | null;
  condition_field: string;
  condition_operator: ConditionOperator | '';
  condition_value: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  is_active: true,
  priority: 0,
  employee_group: null,
  request_type: null,
  condition_field: '',
  condition_operator: '',
  condition_value: '',
};

// ── Style helpers ─────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.05em', display: 'block', marginBottom: 'var(--space-1-5)',
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '6px 10px',
  border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
  background: 'var(--bg-input)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
};

const SELECT: React.CSSProperties = { ...INPUT, cursor: 'pointer' };

// ── Specific-person picker (reuses ManagerPicker pattern from groups page) ────

function PersonPicker({
  value, onChange, employees, placeholder = '— pick a person —',
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  employees: HREmployee[];
  placeholder?: string;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const selected = value ? employees.find(e => e.id === value) : null;
  const filtered = employees.filter(e =>
    !search ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const hasAccount = (e: HREmployee) => !!e.user_id;
  const isActive   = (e: HREmployee) => (e as any).is_active !== false;

  const dot = (e: HREmployee) => {
    if (!isActive(e)) return { bg: '#9ca3af', title: 'Inactive' };
    if (!hasAccount(e)) return { bg: '#f59e0b', title: 'No user account — cannot receive approvals' };
    return { bg: '#22c55e', title: 'Active with account' };
  };

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          ...INPUT, display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', justifyContent: 'space-between',
        }}
      >
        {selected ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: dot(selected).bg, flexShrink: 0,
            }} title={dot(selected).title} />
            <span>{selected.full_name}</span>
          </span>
        ) : (
          <span style={{ color: 'var(--text-tertiary)' }}>{placeholder}</span>
        )}
        <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 220, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name or ID..."
              style={{ ...INPUT, padding: '4px 8px' }}
            />
          </div>
          <div style={{ overflowY: 'auto' }}>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); setSearch(''); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 12px', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              — None —
            </button>
            {filtered.map(e => {
              const d = dot(e);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { onChange(e.id); setOpen(false); setSearch(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    textAlign: 'left', padding: '6px 12px', background: 'none',
                    border: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
                    color: 'var(--text-primary)',
                    opacity: !isActive(e) ? 0.55 : 1,
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: d.bg, flexShrink: 0,
                  }} title={d.title} />
                  <span>{e.full_name}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--text-tertiary)', fontSize: 11 }}>
                    {e.employee_id}
                  </span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '8px 12px', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
                No results
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Stage row ─────────────────────────────────────────────────────────────────

function StageRowUI({
  stage, index, total, employees,
  onChange, onMove, onRemove,
}: {
  stage: StageRow;
  index: number;
  total: number;
  employees: HREmployee[];
  onChange: (patch: Partial<StageRow>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px',
      background: 'var(--bg-subtle)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
    }}>
      {/* Ordinal badge */}
      <span style={{
        minWidth: 22, height: 22, borderRadius: '50%',
        background: 'var(--color-primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0,
      }}>
        {index + 1}
      </span>

      {/* Strategy selector */}
      <select
        value={stage.strategy}
        onChange={e => onChange({ strategy: e.target.value as ApproverStrategy, role_name: '', specific_user: null })}
        style={{ ...SELECT, minWidth: 160, flex: '0 0 auto' }}
      >
        {STRATEGIES.map(s => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>

      {/* Conditional target input */}
      {stage.strategy === 'ROLE' && (
        <select
          value={stage.role_name}
          onChange={e => onChange({ role_name: e.target.value })}
          style={{ ...SELECT, flex: 1 }}
        >
          <option value="">— select role —</option>
          {ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      )}

      {stage.strategy === 'SPECIFIC_USER' && (
        <PersonPicker
          value={stage.specific_user}
          onChange={id => onChange({ specific_user: id })}
          employees={employees}
        />
      )}

      {(stage.strategy === 'DIRECT_MANAGER' || stage.strategy === 'INDIRECT_MANAGER') && (
        <span style={{ flex: 1, fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', paddingLeft: 4 }}>
          resolved from employee's org chart at submission
        </span>
      )}

      {/* Reorder + remove */}
      <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          title="Move up"
          style={{
            width: 26, height: 26, border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
            cursor: index === 0 ? 'not-allowed' : 'pointer',
            opacity: index === 0 ? 0.35 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          title="Move down"
          style={{
            width: 26, height: 26, border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface)',
            cursor: index === total - 1 ? 'not-allowed' : 'pointer',
            opacity: index === total - 1 ? 0.35 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          title="Remove stage"
          style={{
            width: 26, height: 26, border: '1px solid #fca5a5',
            borderRadius: 'var(--radius-sm)', background: '#fff1f2',
            cursor: 'pointer', color: '#dc2626',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

// ── Chain builder modal ───────────────────────────────────────────────────────

function ChainBuilder({
  editing,
  groups,
  requestTypes,
  employees,
  onClose,
}: {
  editing: ApprovalPolicy | null;
  groups: EmployeeGroup[];
  requestTypes: import('@/lib/api/hr').HRRequestType[];
  employees: HREmployee[];
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          is_active: editing.is_active,
          priority: editing.priority,
          employee_group: editing.employee_group,
          request_type: editing.request_type,
          condition_field: editing.condition_field,
          condition_operator: (editing.condition_operator as ConditionOperator | '') || '',
          condition_value: editing.condition_value ?? '',
        }
      : EMPTY_FORM
  );

  const [stages, setStages] = useState<StageRow[]>(() =>
    editing?.steps?.length
      ? editing.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(s => ({
            _key: String(s.id),
            id: s.id,
            strategy: s.approver_strategy,
            role_name: s.role_name,
            specific_user: s.specific_user,
          }))
      : [EMPTY_STAGE()]
  );

  const [saving, setSaving] = useState(false);

  const setField = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const updateStage = (i: number, patch: Partial<StageRow>) =>
    setStages(s => s.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  const moveStage = (i: number, dir: -1 | 1) => {
    setStages(s => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const removeStage = (i: number) =>
    setStages(s => s.filter((_, idx) => idx !== i));

  const addStage = () => setStages(s => [...s, EMPTY_STAGE()]);

  // ── Diff-based step sync ────────────────────────────────────────────────────
  const syncSteps = async (policyId: number) => {
    // Fetch current DB steps for this policy (skip for brand-new policies)
    let existing: ApprovalStep[] = [];
    if (editing) {
      existing = await hrApprovalsApi.getSteps(policyId);
    }

    const remaining = new Map(existing.map(s => [s.id, s]));

    // Walk builder stages in order → PATCH existing IDs, POST new ones
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      const payload = {
        policy: policyId,
        order: i + 1,
        approver_strategy: stage.strategy,
        role_name: stage.role_name || '',
        specific_user: stage.specific_user ?? null,
      };
      if (stage.id !== null && remaining.has(stage.id)) {
        await hrApprovalsApi.updateStep(stage.id, payload);
        remaining.delete(stage.id);
      } else {
        await hrApprovalsApi.createStep(payload);
      }
    }

    // DELETE stages removed from the builder
    for (const id of remaining.keys()) {
      await hrApprovalsApi.deleteStep(id);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Chain name is required', 'error'); return; }
    if (!form.request_type) { toast('Request type is required', 'error'); return; }
    if (stages.length === 0) { toast('At least one stage is required', 'error'); return; }

    // Validate stage targets
    for (let i = 0; i < stages.length; i++) {
      const s = stages[i];
      if (s.strategy === 'ROLE' && !s.role_name) {
        toast(`Stage ${i + 1}: select a role`, 'error'); return;
      }
      if (s.strategy === 'SPECIFIC_USER' && !s.specific_user) {
        toast(`Stage ${i + 1}: select a person`, 'error'); return;
      }
    }

    setSaving(true);
    try {
      const header: Partial<ApprovalPolicy> = {
        name: form.name.trim(),
        is_active: form.is_active,
        priority: form.priority,
        employee_group: form.employee_group,
        request_type: form.request_type!,
        condition_field: form.condition_field,
        condition_operator: (form.condition_operator || '') as ConditionOperator,
        condition_value: form.condition_value || null,
      };

      let policy: ApprovalPolicy;
      if (editing) {
        policy = await hrApprovalsApi.updatePolicy(editing.id, header);
      } else {
        policy = await hrApprovalsApi.createPolicy(header);
      }

      await syncSteps(policy.id);
      await qc.invalidateQueries({ queryKey: ['approval-chains'] });
      toast(editing ? 'Chain updated' : 'Chain created', 'success');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data
        ? Object.values(err.response.data).flat().join(' ')
        : 'Save failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const hasCondition = !!(form.condition_field || form.condition_operator || form.condition_value);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>
            {editing ? 'Edit Chain' : 'New Chain'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-secondary)' }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Row 1: Name + Active */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={LABEL}>Chain Name</label>
              <input
                style={INPUT}
                value={form.name}
                onChange={e => setField({ name: e.target.value })}
                placeholder="e.g. Site Leave — 2 Stage"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <label style={LABEL}>Active</label>
              <button
                type="button"
                onClick={() => setField({ is_active: !form.is_active })}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: form.is_active ? 'var(--color-primary)' : '#d1d5db',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: form.is_active ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            </div>
          </div>

          {/* Row 2: Group + Type + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
            <div>
              <label style={LABEL}>Group</label>
              <select
                value={form.employee_group ?? ''}
                onChange={e => setField({ employee_group: e.target.value ? Number(e.target.value) : null })}
                style={SELECT}
              >
                <option value="">Any group (catch-all)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Request Type</label>
              <select
                value={form.request_type ?? ''}
                onChange={e => setField({ request_type: e.target.value ? Number(e.target.value) : null })}
                style={SELECT}
              >
                <option value="">— select type —</option>
                {requestTypes.map(rt => (
                  <option key={rt.id} value={rt.id}>{rt.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Priority</label>
              <input
                type="number"
                min={0}
                style={INPUT}
                value={form.priority}
                onChange={e => setField({ priority: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Condition section */}
          <div style={{
            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...LABEL, margin: 0 }}>Condition (optional)</span>
              {hasCondition && (
                <button
                  type="button"
                  onClick={() => setField({ condition_field: '', condition_operator: '', condition_value: '' })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', fontSize: 11 }}
                >
                  Clear
                </button>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 100px', gap: 8 }}>
              <select
                value={form.condition_field}
                onChange={e => setField({ condition_field: e.target.value })}
                style={SELECT}
              >
                <option value="">— no condition —</option>
                {CONDITION_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <select
                value={form.condition_operator}
                onChange={e => setField({ condition_operator: e.target.value as ConditionOperator | '' })}
                disabled={!form.condition_field}
                style={{ ...SELECT, opacity: form.condition_field ? 1 : 0.45 }}
              >
                <option value="">— op —</option>
                {OPERATORS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="number"
                placeholder="value"
                value={form.condition_value}
                onChange={e => setField({ condition_value: e.target.value })}
                disabled={!form.condition_field}
                style={{ ...INPUT, opacity: form.condition_field ? 1 : 0.45 }}
              />
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--text-tertiary)' }}>
              Leave blank to match all requests of this type regardless of value.
            </p>
          </div>

          {/* Stages */}
          <div>
            <label style={LABEL}>Stages — approvers in order</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stages.map((stage, i) => (
                <StageRowUI
                  key={stage._key}
                  stage={stage}
                  index={i}
                  total={stages.length}
                  employees={employees}
                  onChange={patch => updateStage(i, patch)}
                  onMove={dir => moveStage(i, dir)}
                  onRemove={() => removeStage(i)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={addStage}
              style={{
                marginTop: 8, padding: '6px 14px',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                background: 'none', cursor: 'pointer',
                color: 'var(--color-primary)',
                fontSize: 'var(--text-sm)', fontWeight: 500,
              }}
            >
              + Add Stage
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 18px', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)',
              cursor: 'pointer', fontSize: 'var(--text-sm)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 20px', border: 'none',
              borderRadius: 'var(--radius-md)',
              background: saving ? '#9ca3af' : 'var(--color-primary)',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 600,
            }}
          >
            {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Chain')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ApprovalChainsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const admin = isAdmin(user);

  const [filterGroup, setFilterGroup]   = useState<string>('');
  const [filterType,  setFilterType]    = useState<string>('');
  const [modalOpen,   setModalOpen]     = useState(false);
  const [editing,     setEditing]       = useState<ApprovalPolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['approval-chains'],
    queryFn: hrApprovalsApi.getPolicies,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async (): Promise<EmployeeGroup[]> => {
      const res = await hrEmployeeGroupsApi.getAll();
      return res.results ?? [];
    },
  });

  const { data: requestTypes = [] } = useQuery({
    queryKey: ['approval-request-types'],
    queryFn: hrApprovalsApi.getRequestTypes,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => {
      const res = await hrEmployeesApi.getAll();
      return res.results ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      hrApprovalsApi.updatePolicy(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approval-chains'] }),
    onError: () => toast('Failed to update', 'error'),
  });

  const deleteChain = useMutation({
    mutationFn: (id: number) => hrApprovalsApi.deletePolicy(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['approval-chains'] }); toast('Chain deleted', 'success'); },
    onError: () => toast('Delete failed', 'error'),
  });

  const openNew  = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (p: ApprovalPolicy) => { setEditing(p); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleDelete = useCallback(async (p: ApprovalPolicy) => {
    const { confirm } = await import('@/lib/hooks/use-toast');
    const ok = await confirm(`Delete chain "${p.name}"? This cannot be undone.`);
    if (ok) deleteChain.mutate(p.id);
  }, [deleteChain]);

  // Client-side filters
  const filtered = policies.filter(p => {
    if (filterGroup) {
      if (filterGroup === '__null__' && p.employee_group !== null) return false;
      if (filterGroup !== '__null__' && String(p.employee_group) !== filterGroup) return false;
    }
    if (filterType && String(p.request_type) !== filterType) return false;
    return true;
  });

  const rtName = (id: number | null) =>
    requestTypes.find(rt => rt.id === id)?.name ?? String(id);

  const GRID = '2fr 140px 140px 50px 50px 60px 90px';

  return (
    <MainLayout>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 }}>
          Approval Chains
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>
          Configure multi-stage approval chains per employee group and request type.
        </p>
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginBottom: 'var(--space-4)', flexWrap: 'wrap',
      }}>
        <select
          value={filterGroup}
          onChange={e => setFilterGroup(e.target.value)}
          style={{ ...SELECT, width: 'auto', minWidth: 160 }}
        >
          <option value="">All Groups</option>
          <option value="__null__">Any (catch-all)</option>
          {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ ...SELECT, width: 'auto', minWidth: 180 }}
        >
          <option value="">All Request Types</option>
          {requestTypes.map(rt => <option key={rt.id} value={String(rt.id)}>{rt.name}</option>)}
        </select>

        <div style={{ marginLeft: 'auto' }}>
          {admin && (
            <button
              onClick={openNew}
              style={{
                padding: '8px 18px', border: 'none',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-primary)', color: '#fff',
                cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600,
              }}
            >
              + New Chain
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)', overflow: 'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display: 'grid', gridTemplateColumns: GRID,
          padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-subtle)',
        }}>
          {['Chain Name', 'Group', 'Request Type', 'Stages', 'Pri', 'Active', ''].map(h => (
            <span key={h} style={{
              fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Loading…
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
            {policies.length === 0
              ? 'No chains yet. Click "+ New Chain" to create the first one.'
              : 'No chains match the current filters.'}
          </div>
        )}

        {filtered.map((p, idx) => (
          <div
            key={p.id}
            style={{
              display: 'grid', gridTemplateColumns: GRID,
              padding: '10px 16px', alignItems: 'center',
              borderBottom: idx < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              background: p.is_active ? 'transparent' : 'var(--bg-subtle)',
            }}
          >
            {/* Name */}
            <div>
              <span style={{
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
                color: p.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)',
              }}>
                {p.name}
              </span>
              {p.condition_field && (
                <span style={{
                  marginLeft: 8, fontSize: 10, padding: '1px 6px',
                  background: '#ede9fe', color: '#5b21b6',
                  borderRadius: 10, fontWeight: 500,
                }}>
                  if {p.condition_field} {p.condition_operator} {p.condition_value}
                </span>
              )}
            </div>

            {/* Group */}
            <span style={{
              fontSize: 'var(--text-xs)',
              color: p.employee_group ? 'var(--text-primary)' : 'var(--text-tertiary)',
              fontStyle: p.employee_group ? 'normal' : 'italic',
            }}>
              {p.employee_group_name ?? 'Any (catch-all)'}
            </span>

            {/* Request Type */}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {rtName(p.request_type)}
            </span>

            {/* Stage count */}
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 24, height: 24, borderRadius: '50%',
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 11, fontWeight: 700,
            }}>
              {p.steps?.length ?? 0}
            </span>

            {/* Priority */}
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {p.priority}
            </span>

            {/* Active toggle */}
            {admin ? (
              <button
                type="button"
                onClick={() => toggleActive.mutate({ id: p.id, val: !p.is_active })}
                title={p.is_active ? 'Click to deactivate' : 'Click to activate'}
                style={{
                  width: 36, height: 20, borderRadius: 10, border: 'none',
                  background: p.is_active ? 'var(--color-primary)' : '#d1d5db',
                  cursor: 'pointer', position: 'relative',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2,
                  left: p.is_active ? 18 : 2,
                  width: 16, height: 16, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            ) : (
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: p.is_active ? '#22c55e' : '#d1d5db',
                display: 'inline-block',
              }} />
            )}

            {/* Actions */}
            {admin ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => openEdit(p)}
                  style={{
                    padding: '4px 10px', fontSize: 11,
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)', cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(p)}
                  style={{
                    padding: '4px 10px', fontSize: 11,
                    border: '1px solid #fca5a5',
                    borderRadius: 'var(--radius-sm)',
                    background: '#fff1f2', color: '#dc2626', cursor: 'pointer',
                  }}
                >
                  Del
                </button>
              </div>
            ) : (
              <span />
            )}
          </div>
        ))}
      </div>

      {/* Builder modal */}
      {modalOpen && (
        <ChainBuilder
          editing={editing}
          groups={groups}
          requestTypes={requestTypes}
          employees={employees}
          onClose={closeModal}
        />
      )}
    </MainLayout>
  );
}
