'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { AppListPage } from '@/components/app/AppListPage';
import { useTableState } from '@/lib/hooks/use-table-state';
import { type Column } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Button } from '@/components/ui';
import { type FilterField } from '@/components/ui/FilterPanel';
import SearchableDropdown from '@/components/ui/SearchableDropdown';
import { hrPenaltyRulesApi, hrEmployeeGroupsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import { toast, confirm } from '@/lib/hooks/use-toast';
import type { PenaltyRule, PenaltyTier, PenaltyRuleType, PenaltyPenaltyType, EmployeeGroup } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const RULE_TYPES: { value: PenaltyRuleType; label: string; color: string; bg: string }[] = [
  { value: 'LATENESS',    label: 'Lateness',    color: 'var(--brand)',        bg: 'var(--brand-muted)' },
  { value: 'EARLY_LEAVE', label: 'Early Leave', color: 'var(--text-secondary)', bg: 'var(--border-subtle)' },
  { value: 'ABSENCE',     label: 'Absence',     color: 'var(--color-error)',  bg: 'var(--color-error-light)' },
];

const PENALTY_TYPES: { value: PenaltyPenaltyType; label: string }[] = [
  { value: 'FIXED_AMOUNT',   label: 'Fixed Amount (AED)' },
  { value: 'HOURLY_RATE',    label: 'Hourly Rate ×' },
  { value: 'DAILY_FRACTION', label: 'Daily Rate ×' },
  { value: 'WARNING_ONLY',   label: 'Warning Only' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type TierRow = {
  _key: string;
  id: number | null;
  min_minutes: string;
  max_minutes: string;
  penalty_type: PenaltyPenaltyType;
  penalty_value: string;
  label: string;
};

const EMPTY_TIER = (): TierRow => ({
  _key: Math.random().toString(36).slice(2),
  id: null,
  min_minutes: '',
  max_minutes: '',
  penalty_type: 'FIXED_AMOUNT',
  penalty_value: '',
  label: '',
});

type FormState = {
  name: string;
  rule_type: PenaltyRuleType;
  is_active: boolean;
  priority: number;
  employee_group: number | null;
  grace_minutes: number;
  allow_compensation: boolean;
  counts_extra_as_overtime: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  rule_type: 'LATENESS',
  is_active: true,
  priority: 0,
  employee_group: null,
  grace_minutes: 0,
  allow_compensation: false,
  counts_extra_as_overtime: false,
};

// ── Style helpers ─────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
  color: 'var(--text-tertiary)', textTransform: 'uppercase',
  letterSpacing: '0.06em', display: 'block', marginBottom: 5,
};

const INPUT: React.CSSProperties = {
  width: '100%', padding: '0 10px',
  height: 34,
  border: '1px solid var(--input-border)', borderRadius: 'var(--radius-md)',
  background: 'var(--input-bg)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)', outline: 'none',
  boxSizing: 'border-box',
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

// ── Sub-components ────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none',
        background: value ? 'var(--brand)' : 'var(--border-default)',
        cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 22 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: 'var(--primary-foreground)', transition: 'left 0.15s',
      }} />
    </button>
  );
}

function RuleTypeBadge({ type }: { type: PenaltyRuleType }) {
  const t = RULE_TYPES.find(r => r.value === type)!;
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 10,
      fontWeight: 600, color: t.color, background: t.bg,
      whiteSpace: 'nowrap',
    }}>
      {t.label}
    </span>
  );
}

// ── Tier row in the builder ───────────────────────────────────────────────────

function TierRowUI({
  tier, index, total,
  onChange, onMove, onRemove,
}: {
  tier: TierRow;
  index: number;
  total: number;
  onChange: (patch: Partial<TierRow>) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isWarning = tier.penalty_type === 'WARNING_ONLY';

  return (
    <div style={{
      background: 'var(--surface-subtle)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Row 1: ordinal + minute range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          minWidth: 22, height: 22, borderRadius: '50%',
          background: 'var(--brand)', color: 'var(--primary-foreground)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {index + 1}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <input
            type="number"
            min={0}
            placeholder="From (min)"
            value={tier.min_minutes}
            onChange={e => onChange({ min_minutes: e.target.value })}
            style={{ ...INPUT, width: 110 }}
          />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>–</span>
          <input
            type="number"
            min={0}
            placeholder="To (blank = ∞)"
            value={tier.max_minutes}
            onChange={e => onChange({ max_minutes: e.target.value })}
            style={{ ...INPUT, width: 120 }}
          />
          <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>min</span>
        </div>
        {/* Reorder + remove */}
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          {(['↑', '↓'] as const).map((arrow, di) => {
            const dir = (di === 0 ? -1 : 1) as -1 | 1;
            const disabled = di === 0 ? index === 0 : index === total - 1;
            return (
              <button
                key={arrow}
                type="button"
                onClick={() => onMove(dir)}
                disabled={disabled}
                style={{
                  width: 26, height: 26, border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)', background: 'var(--surface-raised)',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.35 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {arrow}
              </button>
            );
          })}
          <button
            type="button"
            onClick={onRemove}
            style={{
              width: 26, height: 26, border: '1px solid var(--status-error-border)',
              borderRadius: 'var(--radius-sm)', background: 'var(--color-error-light)',
              cursor: 'pointer', color: 'var(--color-error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>

      {/* Row 2: penalty type + value + label */}
      <div style={{ display: 'grid', gridTemplateColumns: '160px 100px 1fr', gap: 8 }}>
        <select
          value={tier.penalty_type}
          onChange={e => onChange({ penalty_type: e.target.value as PenaltyPenaltyType, penalty_value: e.target.value === 'WARNING_ONLY' ? '0' : tier.penalty_value })}
          style={SELECT}
        >
          {PENALTY_TYPES.map(pt => (
            <option key={pt.value} value={pt.value}>{pt.label}</option>
          ))}
        </select>
        <input
          type="number"
          min={0}
          step="0.01"
          placeholder={isWarning ? '—' : 'Amount'}
          value={isWarning ? '' : tier.penalty_value}
          disabled={isWarning}
          onChange={e => onChange({ penalty_value: e.target.value })}
          style={{ ...INPUT, opacity: isWarning ? 0.4 : 1 }}
        />
        <input
          type="text"
          placeholder='Label (e.g. "First offence")'
          value={tier.label}
          onChange={e => onChange({ label: e.target.value })}
          style={INPUT}
        />
      </div>
    </div>
  );
}

// ── Rule builder modal ────────────────────────────────────────────────────────

function RuleBuilder({
  editing, groups, onClose,
}: {
  editing: PenaltyRule | null;
  groups: EmployeeGroup[];
  onClose: () => void;
}) {
  const qc = useQueryClient();

  const [form, setForm] = useState<FormState>(() =>
    editing
      ? {
          name: editing.name,
          rule_type: editing.rule_type,
          is_active: editing.is_active,
          priority: editing.priority,
          employee_group: editing.employee_group,
          grace_minutes: editing.grace_minutes,
          allow_compensation: editing.allow_compensation,
          counts_extra_as_overtime: editing.counts_extra_as_overtime,
        }
      : EMPTY_FORM
  );

  const [tiers, setTiers] = useState<TierRow[]>(() =>
    editing?.tiers?.length
      ? editing.tiers
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(t => ({
            _key: String(t.id),
            id: t.id,
            min_minutes: String(t.min_minutes),
            max_minutes: t.max_minutes != null ? String(t.max_minutes) : '',
            penalty_type: t.penalty_type,
            penalty_value: t.penalty_value,
            label: t.label,
          }))
      : [EMPTY_TIER()]
  );

  const [saving, setSaving] = useState(false);

  const setField = (patch: Partial<FormState>) => setForm(f => ({ ...f, ...patch }));

  const groupOptions = useMemo(() => [
    { value: '__catchall__', label: 'Any group (catch-all)', searchText: 'any catch-all' },
    ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.code})`, searchText: `${g.name} ${g.code}` })),
  ], [groups]);

  const updateTier = (i: number, patch: Partial<TierRow>) =>
    setTiers(ts => ts.map((t, idx) => idx === i ? { ...t, ...patch } : t));

  const moveTier = (i: number, dir: -1 | 1) => {
    setTiers(ts => {
      const next = [...ts];
      const j = i + dir;
      if (j < 0 || j >= next.length) return ts;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  // ── Diff-based tier sync (same pattern as chain step-sync) ──────────────────
  const syncTiers = async (ruleId: number) => {
    let existing: PenaltyTier[] = [];
    if (editing) {
      existing = await hrPenaltyRulesApi.getTiers(ruleId);
    }
    const remaining = new Map(existing.map(t => [t.id, t]));

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const payload: Partial<PenaltyTier> = {
        rule: ruleId,
        order: i + 1,
        min_minutes: Number(tier.min_minutes) || 0,
        max_minutes: tier.max_minutes !== '' ? Number(tier.max_minutes) : null,
        penalty_type: tier.penalty_type,
        penalty_value: tier.penalty_type === 'WARNING_ONLY' ? '0' : (tier.penalty_value || '0'),
        label: tier.label,
      };
      if (tier.id !== null && remaining.has(tier.id)) {
        await hrPenaltyRulesApi.updateTier(tier.id, payload);
        remaining.delete(tier.id);
      } else {
        await hrPenaltyRulesApi.createTier(payload);
      }
    }
    for (const id of remaining.keys()) {
      await hrPenaltyRulesApi.deleteTier(id);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast('Rule name is required', 'error'); return; }
    if (tiers.length === 0) { toast('At least one tier is required', 'error'); return; }

    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      if (t.min_minutes === '') { toast(`Tier ${i + 1}: "From" minutes is required`, 'error'); return; }
      if (t.penalty_type !== 'WARNING_ONLY' && !t.penalty_value) {
        toast(`Tier ${i + 1}: amount / multiplier is required`, 'error'); return;
      }
      if (t.max_minutes !== '' && Number(t.max_minutes) <= Number(t.min_minutes)) {
        toast(`Tier ${i + 1}: "To" must be greater than "From"`, 'error'); return;
      }
    }

    setSaving(true);
    try {
      const header: Partial<PenaltyRule> = {
        name: form.name.trim(),
        rule_type: form.rule_type,
        is_active: form.is_active,
        priority: form.priority,
        employee_group: form.employee_group,
        grace_minutes: form.grace_minutes,
        allow_compensation: form.allow_compensation,
        counts_extra_as_overtime: form.counts_extra_as_overtime,
      };

      let rule: PenaltyRule;
      if (editing) {
        rule = await hrPenaltyRulesApi.update(editing.id, header);
      } else {
        rule = await hrPenaltyRulesApi.create(header);
      }

      await syncTiers(rule.id);
      await qc.invalidateQueries({ queryKey: ['penalty-rules'] });
      toast(editing ? 'Rule updated' : 'Rule created', 'success');
      onClose();
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const msg = errData
        ? Object.values(errData).flat().join(' ')
        : 'Save failed';
      toast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.35)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: 'var(--surface-base)', borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-xl)', width: '100%', maxWidth: 640,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', border: '1px solid var(--border-subtle)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              {editing ? 'Edit Penalty Rule' : 'New Penalty Rule'}
            </p>
            {editing && (
              <p style={{ margin: '2px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                {editing.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Row 1: Name + Active */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={LABEL}>Rule Name</label>
              <input
                style={INPUT}
                value={form.name}
                onChange={e => setField({ name: e.target.value })}
                placeholder="e.g. Site Workers — Lateness"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, paddingBottom: 1 }}>
              <span style={LABEL}>Active</span>
              <Toggle value={form.is_active} onChange={v => setField({ is_active: v })} />
            </div>
          </div>

          {/* Row 2: Type + Category + Priority */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 10 }}>
            <div>
              <label style={LABEL}>Rule Type</label>
              <select
                value={form.rule_type}
                onChange={e => setField({ rule_type: e.target.value as PenaltyRuleType })}
                style={SELECT}
              >
                {RULE_TYPES.map(rt => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL}>Category</label>
              <SearchableDropdown
                options={groupOptions}
                value={form.employee_group ?? '__catchall__'}
                onChange={v => setField({ employee_group: v === '__catchall__' ? null : v as number })}
                allowClear={false}
                placeholder="Any (catch-all)"
                onCreateOption={async (label) => {
                  const code = label.toUpperCase().replace(/[^A-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
                  const g = await hrEmployeeGroupsApi.create({ name: label, name_ar: '', code, description: '', is_active: true });
                  qc.invalidateQueries({ queryKey: ['employee-groups'] });
                  return { value: g.id, label: `${g.name} (${g.code})` };
                }}
              />
            </div>
            <div>
              <label style={LABEL}>Priority</label>
              <input
                type="number" min={0} style={INPUT}
                value={form.priority}
                onChange={e => setField({ priority: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Settings — divider-separated rows */}
          <div>
            <p style={{ ...LABEL, marginBottom: 2 }}>Rule Settings</p>

            <div style={{
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              {/* Grace minutes */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    Grace period
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Minutes ignored before any tier fires
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <input
                    type="number" min={0}
                    style={{ ...INPUT, width: 68, textAlign: 'center' }}
                    value={form.grace_minutes}
                    onChange={e => setField({ grace_minutes: Number(e.target.value) })}
                  />
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>min</span>
                </div>
              </div>

              {/* Allow compensation */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '10px 14px',
                borderBottom: '1px solid var(--border-subtle)',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    Allow compensation
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Extra hours same day can offset lateness or early-leave
                  </div>
                </div>
                <Toggle value={form.allow_compensation} onChange={v => setField({ allow_compensation: v })} />
              </div>

              {/* Counts extra as overtime */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, padding: '10px 14px',
              }}>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)' }}>
                    Extra time counts as overtime
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    Hours beyond scheduled are counted toward overtime
                  </div>
                </div>
                <Toggle value={form.counts_extra_as_overtime} onChange={v => setField({ counts_extra_as_overtime: v })} />
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* Tiers */}
          <div>
            <p style={{ ...LABEL, marginBottom: 8 }}>Penalty Tiers</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tiers.map((tier, i) => (
                <TierRowUI
                  key={tier._key}
                  tier={tier}
                  index={i}
                  total={tiers.length}
                  onChange={patch => updateTier(i, patch)}
                  onMove={dir => moveTier(i, dir)}
                  onRemove={() => setTiers(ts => ts.filter((_, idx) => idx !== i))}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setTiers(ts => [...ts, EMPTY_TIER()])}
              style={{
                marginTop: 8, padding: '7px 14px',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-md)',
                background: 'none', cursor: 'pointer',
                color: 'var(--brand)',
                fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
                width: '100%',
              }}
            >
              + Add Tier
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
              &quot;From&quot; is inclusive; &quot;To&quot; is exclusive. Leave &quot;To&quot; blank for the last tier. Grace minutes are subtracted before matching.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-subtle)',
          display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0,
          background: 'var(--surface-subtle)',
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '7px 16px', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: 'var(--surface-base)',
              cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-primary)',
              fontWeight: 'var(--weight-medium)',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '7px 20px', border: 'none',
              borderRadius: 'var(--radius-md)',
              background: saving ? 'var(--text-tertiary)' : 'var(--brand)',
              color: 'var(--primary-foreground)', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)',
            }}
          >
            {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Create Rule')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PenaltyRulesPage() {
  const { user } = useAuth();
  const { hasPermission } = useMyPermissions();
  const router = useRouter();
  const qc = useQueryClient();
  const admin = hasPermission('hr.hr_penalty.view');

  const tableState = useTableState();
  const { search, filters } = tableState;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing,   setEditing]   = useState<PenaltyRule | null>(null);

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['penalty-rules'],
    queryFn: hrPenaltyRulesApi.getAll,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['employee-groups'],
    queryFn: async (): Promise<EmployeeGroup[]> => {
      const res = await hrEmployeeGroupsApi.getAll();
      return res.results ?? [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, val }: { id: number; val: boolean }) =>
      hrPenaltyRulesApi.update(id, { is_active: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['penalty-rules'] }),
    onError: () => toast('Failed to update', 'error'),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => hrPenaltyRulesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['penalty-rules'] }); toast('Rule deleted', 'success'); },
    onError: () => toast('Delete failed', 'error'),
  });

  const seedMutation = useMutation({
    mutationFn: hrPenaltyRulesApi.seedUaeRules,
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['penalty-rules'] });
      toast(`Added ${data.created_rules} rules · ${data.created_tiers} tiers (${data.skipped_existing} already existed)`, 'success');
    },
    onError: () => toast('Seed failed', 'error'),
  });

  const openNew   = () => { setEditing(null); setModalOpen(true); };
  const openEdit  = (r: PenaltyRule) => { setEditing(r); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const handleDelete = useCallback(async (r: PenaltyRule) => {
    const ok = await confirm(`Delete rule "${r.name}"? This cannot be undone.`);
    if (ok) deleteRule.mutate(r.id);
  }, [deleteRule]);

  useEffect(() => {
    if (user && !admin) router.replace('/');
  }, [user, admin, router]);
  if (user && !admin) return null;

  // Client-side filtering (search + is_active filter)
  const filtered = rules.filter(r => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.name.toLowerCase().includes(q) &&
        !(r.employee_group_name ?? '').toLowerCase().includes(q)
      ) return false;
    }
    const isActiveFilter = filters.is_active as string | undefined;
    if (isActiveFilter === 'true'  && !r.is_active) return false;
    if (isActiveFilter === 'false' &&  r.is_active) return false;
    return true;
  });

  // ── Column definitions ──────────────────────────────────────────────────────

  const columns: Column<PenaltyRule>[] = [
    {
      key: 'name',
      header: 'Rule Name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)',
            color: r.is_active ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}>
            {r.name}
          </span>
          {r.priority > 0 && (
            <span style={{
              fontSize: 10, padding: '1px 5px',
              background: 'var(--surface-subtle)', color: 'var(--text-tertiary)',
              borderRadius: 8, border: '1px solid var(--border-subtle)',
            }}>
              P{r.priority}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'rule_type',
      header: 'Type',
      render: (r) => <RuleTypeBadge type={r.rule_type} />,
    },
    {
      key: 'employee_group_name',
      header: 'Group',
      render: (r) => (
        <span style={{
          fontSize: 'var(--text-xs)',
          color: r.employee_group ? 'var(--text-primary)' : 'var(--text-tertiary)',
          fontStyle: r.employee_group ? 'normal' : 'italic',
        }}>
          {r.employee_group_name ?? 'Any (catch-all)'}
        </span>
      ),
    },
    {
      key: 'tiers',
      header: 'Tiers',
      render: (r) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 24, height: 24, borderRadius: '50%',
          background: r.tiers?.length ? 'var(--brand-muted)' : 'var(--surface-subtle)',
          color: r.tiers?.length ? 'var(--brand)' : 'var(--text-tertiary)',
          border: r.tiers?.length ? '1px solid var(--brand)' : '1px solid var(--border-subtle)',
          fontSize: 11, fontWeight: 700,
        }}>
          {r.tiers?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'grace_minutes',
      header: 'Grace',
      render: (r) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
          {r.grace_minutes > 0 ? `${r.grace_minutes} min` : '—'}
        </span>
      ),
    },
    {
      key: 'is_active',
      header: 'Active',
      render: (r) => admin ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); toggleActive.mutate({ id: r.id, val: !r.is_active }); }}
          title={r.is_active ? 'Click to deactivate' : 'Click to activate'}
          style={{
            width: 36, height: 20, borderRadius: 10, border: 'none',
            background: r.is_active ? 'var(--brand)' : 'var(--border-default)',
            cursor: 'pointer', position: 'relative', transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2,
            left: r.is_active ? 18 : 2,
            width: 16, height: 16, borderRadius: '50%',
            background: 'var(--primary-foreground)', transition: 'left 0.15s',
          }} />
        </button>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: r.is_active ? 'var(--brand)' : 'var(--border-default)',
          display: 'inline-block',
        }} />
      ),
    },
    {
      key: 'actions' as any,
      header: '',
      render: (r) => admin ? (
        <RowActions
          actions={[
            { label: 'Edit', onClick: () => openEdit(r) },
            { separator: true },
            { label: 'Delete', variant: 'danger', onClick: () => handleDelete(r) },
          ]}
        />
      ) : null,
    },
  ];

  // ── Filter fields ───────────────────────────────────────────────────────────

  const filterFields: FilterField[] = [
    {
      name: 'is_active',
      label: 'Status',
      type: 'select',
      group: 'Filters',
      options: [
        { value: 'true',  label: 'Active' },
        { value: 'false', label: 'Inactive' },
      ],
    },
  ];

  return (
    <AppListPage
      title="Penalty Rules"
      description="Configure tiered penalty rules per employee group and event type (lateness, early leave, absence)."
      showBack={false}
      totalCount={filtered.length}
      createAction={
        admin ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              variant="secondary"
              size="sm"
            >
              {seedMutation.isPending ? 'Adding…' : '⬇ UAE Rules'}
            </Button>
            <Button onClick={openNew} variant="primary" size="sm">
              + New Rule
            </Button>
          </div>
        ) : undefined
      }
      filterFields={filterFields}
      searchPlaceholder="Search rules…"
      columns={columns}
      data={filtered}
      isLoading={isLoading}
      tableState={tableState}
      selectable={admin}
      emptyTitle={
        rules.length === 0
          ? 'No rules yet. Click "+ New Rule" to create the first one.'
          : 'No rules match the current filters.'
      }
    >
      {modalOpen && (
        <RuleBuilder
          editing={editing}
          groups={groups}
          onClose={closeModal}
        />
      )}
    </AppListPage>
  );
}
