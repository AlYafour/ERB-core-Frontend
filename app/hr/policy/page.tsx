'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMyPermissions } from '@/lib/hooks/use-my-permissions';
import {
  hrPolicyRulesApi,
  hrPolicyPresetsApi,
  hrPolicyAuditApi,
  type PolicyRule,
  type PolicyPreset,
} from '@/lib/api/hr';
import {
  Button,
  Badge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  BaseModal,
} from '@/components/ui';
import { toast, confirm } from '@/lib/hooks/use-toast';

// ── Rule type groups ──────────────────────────────────────────────────────────

const RULE_TYPE_GROUPS: Record<string, string[]> = {
  'EOS / Gratuity': [
    'eos.gratuity_days_year_1_5',
    'eos.gratuity_days_year_5plus',
    'eos.resignation_prorate_under_1y',
    'eos.resignation_prorate_1_3y',
    'eos.resignation_prorate_3_5y',
    'eos.resignation_prorate_5plus',
  ],
  'Annual Leave': [
    'leave.annual_entitlement_days',
    'leave.carry_forward_max_days',
    'leave.accrual_method',
    'leave.sick_days_paid',
  ],
  'Overtime': [
    'overtime.weekday_rate',
    'overtime.weekend_rate',
    'overtime.public_holiday_rate',
    'overtime.max_daily_hours',
  ],
  'Payroll': ['payroll.monthly_days_basis', 'payroll.probation_deduction'],
  'Penalties': ['penalty.absence_deduction_method'],
  'Working Hours': [
    'work.standard_hours_per_day',
    'work.standard_hours_per_week',
    'work.ramadan_hours_reduction',
  ],
  'General': [
    'general.currency',
    'general.fiscal_year_start_month',
    'general.working_days_per_week',
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusBadge(rule: PolicyRule) {
  if (!rule.is_active)
    return <Badge variant="error">Inactive</Badge>;
  const today = new Date().toISOString().slice(0, 10);
  if (rule.effective_to && rule.effective_to < today)
    return <Badge variant="error">Expired</Badge>;
  return <Badge variant="success">Active</Badge>;
}

function actionBadgeVariant(action: string): 'success' | 'error' | 'info' {
  if (action === 'created') return 'success';
  if (action === 'deactivated') return 'error';
  return 'info';
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--input-border)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--input-bg)',
  color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 4,
};

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PolicyPage() {
  const qc = useQueryClient();
  const { hasPermission, isTenantAdmin } = useMyPermissions();
  const canManage = hasPermission('hr.hr_payroll.create') || isTenantAdmin;

  const { data: effective = [], isLoading: loadingRules } = useQuery({
    queryKey: ['policy-rules-effective'],
    queryFn: () => hrPolicyRulesApi.getEffective(),
  });

  const { data: presets = [], isLoading: loadingPresets } = useQuery({
    queryKey: ['policy-presets'],
    queryFn: () => hrPolicyPresetsApi.getAll(),
  });

  const { data: auditLogs = [], isLoading: loadingAudit } = useQuery({
    queryKey: ['policy-audit'],
    queryFn: () => hrPolicyAuditApi.getAll({ page_size: '50' }),
  });

  // ── Edit modal state ──────────────────────────────────────────────────────

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PolicyRule | null>(null);
  const [formValue, setFormValue] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formEffDate, setFormEffDate] = useState('');
  const [formRef, setFormRef] = useState('');

  const saveMutation = useMutation({
    mutationFn: (data: Partial<PolicyRule>) =>
      editingRule
        ? hrPolicyRulesApi.update(editingRule.id, data)
        : hrPolicyRulesApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-rules-effective'] });
      qc.invalidateQueries({ queryKey: ['policy-audit'] });
      setShowEditModal(false);
      toast('Policy rule saved successfully.', 'success');
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as Error).message ??
        'Failed to save rule';
      toast(msg, 'error');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => hrPolicyRulesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-rules-effective'] });
      qc.invalidateQueries({ queryKey: ['policy-audit'] });
      toast('Rule deactivated.', 'success');
    },
    onError: () => toast('Failed to deactivate rule.', 'error'),
  });

  const applyPresetMutation = useMutation({
    mutationFn: ({ id, effective_from }: { id: number; effective_from: string }) =>
      hrPolicyPresetsApi.apply(id, effective_from),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['policy-rules-effective'] });
      qc.invalidateQueries({ queryKey: ['policy-audit'] });
      toast('Preset applied. All rules created.', 'success');
    },
    onError: () => toast('Failed to apply preset.', 'error'),
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  function openEdit(rule: PolicyRule) {
    setEditingRule(rule);
    setFormValue(String(rule.value));
    setFormDesc(rule.description);
    setFormEffDate(new Date().toISOString().slice(0, 10));
    setFormRef(rule.source_reference);
    setShowEditModal(true);
  }

  async function handleDeactivate(rule: PolicyRule) {
    const ok = await confirm(
      `Deactivate rule "${rule.rule_type_display}"? It will no longer apply to new calculations.`,
    );
    if (ok) deactivateMutation.mutate(rule.id);
  }

  async function handleApplyPreset(preset: PolicyPreset) {
    const today = new Date().toISOString().slice(0, 10);
    const ok = await confirm(
      `Apply preset "${preset.name}"? This creates ${preset.rules_count} new policy rules effective ${today}. Existing rules are not deleted.`,
    );
    if (ok) applyPresetMutation.mutate({ id: preset.id, effective_from: today });
  }

  function handleSave() {
    if (!formValue.trim()) {
      toast('Value is required.', 'error');
      return;
    }
    if (!formEffDate) {
      toast('Effective From date is required.', 'error');
      return;
    }
    saveMutation.mutate({
      rule_type: editingRule?.rule_type,
      value_type: editingRule?.value_type,
      value: formValue,
      effective_from: formEffDate,
      description: formDesc,
      source_reference: formRef,
    });
  }

  // ── Grouped rules ─────────────────────────────────────────────────────────

  const grouped = Object.entries(RULE_TYPE_GROUPS).map(([group, types]) => ({
    group,
    rules: effective.filter(r => types.includes(r.rule_type)),
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Policy Engine
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
          Configurable rules for EOS, payroll, leave, overtime, and penalties — with full version history and audit trail.
        </p>
      </div>

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules">Active Rules</TabsTrigger>
          <TabsTrigger value="presets">Apply Preset</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* ── Active Rules ──────────────────────────────────────────────── */}
        <TabsContent value="rules">
          {loadingRules ? (
            <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>Loading rules...</p>
          ) : (
            grouped.map(({ group, rules }) => (
              <div key={group} style={{ marginBottom: 'var(--space-6)' }}>
                <h2 style={{
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'var(--space-3)',
                  paddingBottom: 8,
                  borderBottom: '1px solid var(--border-subtle)',
                }}>
                  {group}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                  {rules.length === 0 ? (
                    <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', gridColumn: '1 / -1' }}>
                      No rules configured. Apply a preset or add rules manually.
                    </p>
                  ) : (
                    rules.map(rule => (
                      <div
                        key={rule.id}
                        style={{
                          background: 'var(--surface-card)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-lg)',
                          padding: 'var(--space-4)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'monospace' }}>
                              {rule.rule_type}
                            </div>
                            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>
                              {rule.rule_type_display}
                            </div>
                          </div>
                          {statusBadge(rule)}
                        </div>

                        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-primary, #1e40af)', marginBottom: 8 }}>
                          {rule.display_value}
                        </div>

                        {rule.description && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 4 }}>
                            {rule.description}
                          </p>
                        )}
                        {rule.source_reference && (
                          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                            {rule.source_reference}
                          </p>
                        )}

                        {canManage && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                            <Button size="sm" variant="secondary" onClick={() => openEdit(rule)}>
                              Edit
                            </Button>
                            {rule.is_active && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeactivate(rule)}
                                isLoading={deactivateMutation.isPending}
                              >
                                Deactivate
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        {/* ── Presets ───────────────────────────────────────────────────── */}
        <TabsContent value="presets">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            Presets are country/region rule templates. Applying a preset creates new versioned rules effective today — existing rules are not deleted.
          </p>
          {loadingPresets ? (
            <p style={{ color: 'var(--text-secondary)' }}>Loading presets...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 'var(--space-4)' }}>
              {presets.length === 0 ? (
                <p style={{ color: 'var(--text-tertiary)', gridColumn: '1 / -1' }}>
                  No presets found. Run:{' '}
                  <code style={{ fontFamily: 'monospace', background: 'var(--surface-subtle)', padding: '2px 6px', borderRadius: 4 }}>
                    python manage.py seed_policy_presets
                  </code>
                </p>
              ) : (
                presets.map(preset => (
                  <div
                    key={preset.id}
                    style={{
                      background: 'var(--surface-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-5)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                      <span style={{ fontSize: 32 }}>{preset.country_code === 'AE' ? '🇦🇪' : '🌐'}</span>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{preset.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>
                          {preset.rules_count} rules &bull; {preset.country_code}
                        </div>
                      </div>
                    </div>
                    {preset.description && (
                      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>
                        {preset.description}
                      </p>
                    )}
                    {preset.legal_reference && (
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic', marginBottom: 12 }}>
                        {preset.legal_reference}
                      </p>
                    )}
                    {canManage && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApplyPreset(preset)}
                        isLoading={applyPresetMutation.isPending}
                      >
                        Apply to This Company
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Audit Log ─────────────────────────────────────────────────── */}
        <TabsContent value="audit">
          {loadingAudit ? (
            <p style={{ color: 'var(--text-secondary)', padding: 'var(--space-4)' }}>Loading audit log...</p>
          ) : (
            <div style={{ background: 'var(--surface-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-subtle)' }}>
                      {['Date', 'Rule Type', 'Action', 'Old Value', 'New Value', 'Changed By', 'Reason'].map(h => (
                        <th
                          key={h}
                          style={{
                            padding: '10px 16px',
                            textAlign: 'left',
                            fontWeight: 600,
                            color: 'var(--text-secondary)',
                            borderBottom: '1px solid var(--border-subtle)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                          No audit entries yet.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, i) => (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            background: i % 2 === 0 ? 'transparent' : 'var(--surface-subtle)',
                          }}
                        >
                          <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            {new Date(log.changed_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
                            {log.rule_type}
                          </td>
                          <td style={{ padding: '10px 16px' }}>
                            <Badge variant={actionBadgeVariant(log.action)}>{log.action_display}</Badge>
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                            {log.old_value !== null && log.old_value !== undefined ? String(log.old_value) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', fontWeight: 600 }}>
                            {log.new_value !== null && log.new_value !== undefined ? String(log.new_value) : '—'}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>
                            {log.changed_by_name ?? '—'}
                          </td>
                          <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>
                            {log.change_reason || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Edit Rule Modal ───────────────────────────────────────────────── */}
      <BaseModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={editingRule ? `Edit: ${editingRule.rule_type_display}` : 'New Rule'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditModal(false)} disabled={saveMutation.isPending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={saveMutation.isPending}>
              Save Rule
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {editingRule && (
            <div style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              fontSize: 'var(--text-sm)',
              color: '#1e40af',
            }}>
              Saving creates a new version. The current rule will be closed with effective_to = today.
            </div>
          )}

          <div>
            <label style={LABEL}>
              Value{editingRule ? ` (${editingRule.value_type_display})` : ''}
              <span style={{ color: 'var(--color-error)' }}> *</span>
            </label>
            <input
              value={formValue}
              onChange={e => setFormValue(e.target.value)}
              style={INPUT}
              placeholder="e.g. 21 for decimal, monthly for string"
            />
          </div>

          <div>
            <label style={LABEL}>
              Effective From <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="date"
              value={formEffDate}
              onChange={e => setFormEffDate(e.target.value)}
              style={INPUT}
            />
          </div>

          <div>
            <label style={LABEL}>Description</label>
            <textarea
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              rows={2}
              style={{ ...INPUT, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={LABEL}>Legal Reference</label>
            <input
              value={formRef}
              onChange={e => setFormRef(e.target.value)}
              style={INPUT}
              placeholder="Article number, circular, etc."
            />
          </div>
        </div>
      </BaseModal>
    </div>
  );
}
