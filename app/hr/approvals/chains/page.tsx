'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hrApprovalsApi, hrEmployeeGroupsApi, hrEmployeesApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast } from '@/lib/hooks/use-toast';
import { useTableState } from '@/lib/hooks/use-table-state';
import { AppListPage } from '@/components/app/AppListPage';
import { type Column } from '@/components/ui/DataTable';
import { type FilterField } from '@/components/ui/FilterPanel';
import { RowActions } from '@/components/ui/RowActions';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { ROLES } from '@/lib/constants/roles';
import type { ApprovalPolicy, ApprovalStep, ApproverStrategy, ConditionOperator, EmployeeGroup, HREmployee } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

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
  sod_fallback_strategy: ApproverStrategy | '';
  sod_fallback_role: string;
  sod_fallback_user: number | null;
};

const EMPTY_STAGE = (): StageRow => ({
  _key: Math.random().toString(36).slice(2),
  id: null,
  strategy: 'DIRECT_MANAGER',
  role_name: '',
  specific_user: null,
  sod_fallback_strategy: '',
  sod_fallback_role: '',
  sod_fallback_user: null,
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
  background: 'var(--input-bg)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  cursor: 'pointer',
  appearance: 'none' as React.CSSProperties['appearance'],
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%23999' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};

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

  const selected = value ? employees.find(e => e.user_id === value) : null;
  const filtered = employees.filter(e =>
    !search ||
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_id.toLowerCase().includes(search.toLowerCase())
  );

  const hasAccount = (e: HREmployee) => !!e.user_id;
  const isActive   = (e: HREmployee) => e.is_active !== false;

  const dot = (e: HREmployee) => {
    if (!isActive(e)) return { bg: 'var(--text-tertiary)', title: 'Inactive' };
    if (!hasAccount(e)) return { bg: 'var(--brand)', title: 'No user account — cannot receive approvals' };
    return { bg: 'var(--brand)', title: 'Active with account' };
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
          background: 'var(--surface-raised)', border: '1px solid var(--border-default)',
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
                  onClick={() => { onChange(e.user_id ?? null); setOpen(false); setSearch(''); }}
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

const STRATEGY_META: Record<ApproverStrategy, { hint: string }> = {
  DIRECT_MANAGER:   { hint: 'Resolved automatically — the employee\'s direct manager from their profile' },
  INDIRECT_MANAGER: { hint: 'One level up — the manager\'s manager in the org chart' },
  ROLE:             { hint: 'Sent to any active user who holds the selected system role' },
  SPECIFIC_USER:    { hint: 'Always sent to the chosen person, regardless of org structure' },
};

const INLINE_SELECT: React.CSSProperties = {
  ...SELECT,
  width: 'auto',
  minWidth: 0,
};

const BTN_ICON: React.CSSProperties = {
  width: 26, height: 26, border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-sm)', background: 'transparent',
  fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
};

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
  const isManager = stage.strategy === 'DIRECT_MANAGER' || stage.strategy === 'INDIRECT_MANAGER';
  const needsTarget = stage.strategy === 'ROLE' || stage.strategy === 'SPECIFIC_USER';
  const hint = STRATEGY_META[stage.strategy]?.hint ?? '';

  return (
    <div style={{
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface-raised)',
      overflow: 'hidden',
    }}>
      {/* ── Top row: badge + type + target + actions ── */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>

        {/* Ordinal badge */}
        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          background: 'var(--brand)', color: 'var(--primary-foreground)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700,
        }}>
          {index + 1}
        </span>

        {/* Strategy type — fixed-width, does NOT grow */}
        <select
          value={stage.strategy}
          onChange={e => onChange({ strategy: e.target.value as ApproverStrategy, role_name: '', specific_user: null })}
          style={{ ...INLINE_SELECT, minWidth: 155 }}
        >
          {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        {/* Target field — grows to fill remaining space */}
        {stage.strategy === 'ROLE' && (
          <select
            value={stage.role_name}
            onChange={e => onChange({ role_name: e.target.value })}
            style={{ ...INLINE_SELECT, flex: 1, minWidth: 120 }}
          >
            <option value="">— select role —</option>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        )}

        {stage.strategy === 'SPECIFIC_USER' && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <PersonPicker
              value={stage.specific_user}
              onChange={id => onChange({ specific_user: id })}
              employees={employees}
            />
          </div>
        )}

        {/* Spacer for manager strategies (no target) */}
        {isManager && <span style={{ flex: 1 }} />}

        {/* Reorder + remove */}
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} title="Move up"
            style={{ ...BTN_ICON, opacity: index === 0 ? 0.3 : 1, cursor: index === 0 ? 'not-allowed' : 'pointer' }}>
            ↑
          </button>
          <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} title="Move down"
            style={{ ...BTN_ICON, opacity: index === total - 1 ? 0.3 : 1, cursor: index === total - 1 ? 'not-allowed' : 'pointer' }}>
            ↓
          </button>
          <button type="button" onClick={onRemove} title="Remove stage"
            style={{ ...BTN_ICON, border: '1px solid var(--status-error-border, #fca5a5)', color: 'var(--color-error)' }}>
            ×
          </button>
        </div>
      </div>

      {/* ── Hint line ── */}
      <div style={{
        padding: needsTarget ? '0 12px 8px 44px' : '0 12px 8px 44px',
        fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic',
        lineHeight: 1.4,
      }}>
        {hint}
      </div>

      {/* ── SoD fallback band (manager strategies only) ── */}
      {isManager && (
        <div style={{
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-subtle)',
          padding: '7px 12px',
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        }}>
          <span style={{
            fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
            whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            If this person would approve their own request:
          </span>
          <select
            value={stage.sod_fallback_strategy}
            onChange={e => onChange({
              sod_fallback_strategy: e.target.value as ApproverStrategy | '',
              sod_fallback_role: '', sod_fallback_user: null,
            })}
            style={{ ...INLINE_SELECT, minWidth: 155, padding: '3px 28px 3px 8px', fontSize: 12 }}
          >
            <option value="">— leave pending for manual review —</option>
            {STRATEGIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {stage.sod_fallback_strategy === 'ROLE' && (
            <select
              value={stage.sod_fallback_role}
              onChange={e => onChange({ sod_fallback_role: e.target.value })}
              style={{ ...INLINE_SELECT, minWidth: 140, padding: '3px 28px 3px 8px', fontSize: 12 }}
            >
              <option value="">— select role —</option>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )}
          {stage.sod_fallback_strategy === 'SPECIFIC_USER' && (
            <div style={{ minWidth: 180, flex: 1 }}>
              <PersonPicker
                value={stage.sod_fallback_user}
                onChange={id => onChange({ sod_fallback_user: id })}
                employees={employees}
                placeholder="— pick fallback person —"
              />
            </div>
          )}
          {(stage.sod_fallback_strategy === 'DIRECT_MANAGER' || stage.sod_fallback_strategy === 'INDIRECT_MANAGER') && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
              escalates up the chain
            </span>
          )}
        </div>
      )}
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
            sod_fallback_strategy: s.sod_fallback_strategy ?? '',
            sod_fallback_role: s.sod_fallback_role ?? '',
            sod_fallback_user: s.sod_fallback_user ?? null,
          }))
      : [EMPTY_STAGE()]
  );

  const [saving, setSaving] = useState(false);

  const setField = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const groupOptions = useMemo(() => [
    { value: '__catchall__', label: 'Any group (catch-all)', searchText: 'any catch-all' },
    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.code})`, searchText: `${g.name} ${g.code}` })),
  ], [groups]);

  const requestTypeOptions = useMemo(() =>
    requestTypes.map(rt => ({ value: rt.id, label: rt.name })),
  [requestTypes]);

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
        sod_fallback_strategy: (stage.sod_fallback_strategy || '') as ApproverStrategy | '',
        sod_fallback_role: stage.sod_fallback_role || '',
        sod_fallback_user: stage.sod_fallback_user,
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
    } catch (err: unknown) {
      const e = err as { response?: { data?: Record<string, unknown[]> } };
      const msg = e?.response?.data
        ? Object.values(e.response.data).flat().join(' ')
        : 'Save failed';
      toast(msg as string, 'error');
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
        background: 'var(--surface-raised)', borderRadius: 'var(--radius-lg)',
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
                  background: form.is_active ? 'var(--brand)' : 'var(--border-default)',
                  cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 3,
                  left: form.is_active ? 22 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--primary-foreground)', transition: 'left 0.15s',
                }} />
              </button>
            </div>
          </div>

          {/* Row 2: Group + Type + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 12 }}>
            <div>
              <label style={LABEL}>Group</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ?? '__catchall__'}
                onChange={v => setField({ employee_group: v === '__catchall__' ? null : v as number })}
                allowClear={false}
                placeholder="Any group (catch-all)"
                onCreateOption={async (label) => {
                  const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                  const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                  qc.invalidateQueries({ queryKey: ['employee-groups'] });
                  return { value: g.id, label: `${g.name} (${g.code})` };
                }}
              />
            </div>
            <div>
              <label style={LABEL}>Request Type</label>
              <SearchableDropdown
                options={requestTypeOptions}
                value={form.request_type}
                onChange={v => setField({ request_type: v as number | null })}
                allowClear
                placeholder="— select type —"
                emptyMessage="No request types found"
              />
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {stages.map((stage, i) => (
                <div key={stage._key}>
                  <StageRowUI
                    stage={stage}
                    index={i}
                    total={stages.length}
                    employees={employees}
                    onChange={patch => updateStage(i, patch)}
                    onMove={dir => moveStage(i, dir)}
                    onRemove={() => removeStage(i)}
                  />
                  {i < stages.length - 1 && (
                    <div style={{
                      height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-tertiary)', fontSize: 12, userSelect: 'none',
                    }}>
                      ↓
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStage}
              style={{
                marginTop: 8, padding: '7px 14px',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                background: 'none', cursor: 'pointer',
                color: 'var(--brand)',
                fontSize: 'var(--text-sm)', fontWeight: 500,
                width: '100%',
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
              borderRadius: 'var(--radius-md)', background: 'var(--surface-raised)',
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
              background: saving ? 'var(--text-tertiary)' : 'var(--brand)',
              color: 'var(--primary-foreground)', cursor: saving ? 'not-allowed' : 'pointer',
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
  const { hasPermission } = useMyPermissions();
  const qc = useQueryClient();
  const admin = hasPermission('hr.hr_approval.view');

  const tableState = useTableState();
  const { search, filters } = tableState;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<ApprovalPolicy | null>(null);

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['approval-chains'],
    queryFn: hrApprovalsApi.getPolicies,
    staleTime: 60_000,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async (): Promise<EmployeeGroup[]> => {
      const res = await hrEmployeeGroupsApi.getAll();
      return res.results ?? [];
    },
    staleTime: 300_000,
  });

  const { data: requestTypes = [] } = useQuery({
    queryKey: ['approval-request-types'],
    queryFn: hrApprovalsApi.getRequestTypes,
    staleTime: 300_000,
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => {
      const res = await hrEmployeesApi.getAll();
      return res.results ?? [];
    },
    staleTime: 300_000,
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

  const openNew    = () => { setEditing(null); setModalOpen(true); };
  const openEdit   = (p: ApprovalPolicy) => { setEditing(p); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleDelete = useCallback(async (p: ApprovalPolicy) => {
    const { confirm } = await import('@/lib/hooks/use-toast');
    const ok = await confirm(`Delete chain "${p.name}"? This cannot be undone.`);
    if (ok) deleteChain.mutate(p.id);
  }, [deleteChain]);

  // Client-side filtering (data is loaded all at once, not paginated)
  const filtered = useMemo(() => policies.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.employee_group) {
      if (filters.employee_group === '__null__' && p.employee_group !== null) return false;
      if (filters.employee_group !== '__null__' && String(p.employee_group) !== String(filters.employee_group)) return false;
    }
    if (filters.request_type && String(p.request_type) !== String(filters.request_type)) return false;
    return true;
  }), [policies, search, filters]);

  const rtName = (id: number | null) =>
    requestTypes.find(rt => rt.id === id)?.name ?? String(id);

  // ── Filter fields ────────────────────────────────────────────────────────────

  const filterFields: FilterField[] = useMemo(() => [
    {
      name: 'employee_group',
      label: 'Group',
      type: 'select',
      group: 'Filters',
      options: [
        { value: '__null__', label: 'Any (catch-all)' },
        ...groups.map(g => ({ value: String(g.id), label: g.name })),
      ],
    },
    {
      name: 'request_type',
      label: 'Request Type',
      type: 'select',
      group: 'Filters',
      options: requestTypes.map(rt => ({ value: String(rt.id), label: rt.name })),
    },
  ], [groups, requestTypes]);

  // ── Columns ──────────────────────────────────────────────────────────────────

  const columns: Column<ApprovalPolicy>[] = useMemo(() => [
    {
      key: 'name',
      header: 'Chain Name',
      width: '2fr',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
            color: p.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}>
            {p.name}
          </span>
          {p.condition_field && (
            <span style={{
              fontSize: 10, padding: '1px 6px',
              background: 'var(--surface-subtle)', color: 'var(--text-secondary)',
              borderRadius: 10, fontWeight: 500,
            }}>
              if {p.condition_field} {p.condition_operator} {p.condition_value}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'group',
      header: 'Group',
      width: 140,
      render: (p) => (
        <span style={{
          fontSize: 'var(--text-xs)',
          color: p.employee_group ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontStyle: p.employee_group ? 'normal' : 'italic',
        }}>
          {p.employee_group_name ?? 'Any (catch-all)'}
        </span>
      ),
    },
    {
      key: 'request_type',
      header: 'Request Type',
      width: 140,
      render: (p) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {rtName(p.request_type)}
        </span>
      ),
    },
    {
      key: 'stages',
      header: 'Stages',
      width: 60,
      render: (p) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 24, height: 24, borderRadius: '50%',
          background: 'var(--brand)', color: 'var(--primary-foreground)',
          fontSize: 11, fontWeight: 700,
        }}>
          {p.steps?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 60,
      render: (p) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', textAlign: 'center', display: 'block' }}>
          {p.priority}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Active',
      width: 70,
      render: (p) => admin ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: p.id, val: !p.is_active }); }}
          title={p.is_active ? 'Click to deactivate' : 'Click to activate'}
          style={{
            width: 36, height: 20, borderRadius: 10, border: 'none',
            background: p.is_active ? 'var(--brand)' : 'var(--border-default)',
            cursor: 'pointer', position: 'relative',
          }}
        >
          <span style={{
            position: 'absolute', top: 2,
            left: p.is_active ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--primary-foreground)', transition: 'left 0.15s',
          }} />
        </button>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: p.is_active ? 'var(--brand)' : 'var(--border-default)',
          display: 'inline-block',
        }} />
      ),
    },
    {
      key: 'actions',
      header: '',
      width: 50,
      render: (p) => admin ? (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(p) },
            { label: 'Delete', variant: 'danger', onClick: () => handleDelete(p) },
          ]}
        />
      ) : null,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [admin, requestTypes, toggleActive, handleDelete]);

  // ── Create action button ─────────────────────────────────────────────────────

  const createAction = admin ? (
    <button
      onClick={openNew}
      style={{
        padding: '8px 18px', border: 'none',
        borderRadius: 'var(--radius-md)',
        background: 'var(--brand)', color: 'var(--primary-foreground)',
        cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 600,
      }}
    >
      + New Chain
    </button>
  ) : undefined;

  return (
    <AppListPage
      title="Approval Chains"
      description="Configure multi-stage approval chains per employee group and request type."
      showBack={false}
      totalCount={filtered.length}
      createAction={createAction}
      filterFields={filterFields}
      searchPlaceholder="Search chains…"
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      tableState={tableState}
      selectable={true}
      emptyTitle={
        policies.length === 0
          ? 'No chains yet. Click "+ New Chain" to create the first one.'
          : 'No chains match the current filters.'
      }
    >
      {modalOpen && (
        <ChainBuilder
          editing={editing}
          groups={groups}
          requestTypes={requestTypes}
          employees={employees}
          onClose={closeModal}
        />
      )}
    </AppListPage>
  );
}
