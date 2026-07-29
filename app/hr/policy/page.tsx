'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrPolicySetsApi, hrPolicyPresetsApi, hrPolicyAuditApi, PolicySet, PolicyPreset, PolicyPreviewResult } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BaseModal } from '@/components/ui/base/BaseModal'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'
import HRSettingsNav from '@/components/hr/HRSettingsNav'

const MODULE_ICONS: Record<string, string> = {
  eos: '📋', payroll: '💰', leave: '🏖️', overtime: '⏰', penalty: '⚠️', attendance: '📅', general: '⚙️',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--status-warning)', active: 'var(--status-success)', archived: 'var(--text-secondary)',
}

const STRATEGY_LABELS: Record<string, string> = {
  first_match: 'First Match', sum_all: 'Sum All',
  multiply_factors: 'Multiply Factors', pipeline: 'Pipeline',
}

function SetCard({ ps, onClone, onActivate, onArchive, onPreview }: {
  ps: PolicySet
  onClone: () => void
  onActivate: () => void
  onArchive: () => void
  onPreview: () => void
}) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 28 }}>{MODULE_ICONS[ps.module] || '⚙️'}</span>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>{ps.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{ps.module_display} · v{ps.version}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Badge style={{ background: STATUS_COLORS[ps.status], color: '#fff', fontSize: 11 }}>{ps.status_display}</Badge>
          {ps.country_code && <Badge style={{ background: '#f1f5f9', color: '#475569', fontSize: 11 }}>{ps.country_code}</Badge>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
        <span>Strategy: <strong style={{ color: 'var(--text-primary)' }}>{STRATEGY_LABELS[ps.calculation_strategy] || ps.calculation_strategy}</strong></span>
        <span>Rules: <strong style={{ color: 'var(--text-primary)' }}>{ps.rules_count}</strong></span>
        <span>From: <strong style={{ color: 'var(--text-primary)' }}>{ps.effective_from}</strong></span>
      </div>

      {ps.rules.length > 0 && (
        <div style={{ background: '#f8fafc', borderRadius: 6, padding: '10px 12px', maxHeight: 160, overflowY: 'auto' }}>
          {ps.rules.map(rule => (
            <div key={rule.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #e2e8f0', fontSize: 'var(--text-xs)' }}>
              <div>
                <span style={{ fontFamily: 'monospace', color: 'var(--brand)' }}>{rule.rule_key}</span>
                {' — '}
                <span style={{ color: 'var(--text-secondary)' }}>{rule.label}</span>
              </div>
              <span style={{ color: 'var(--text-tertiary)', fontFamily: 'monospace', marginLeft: 8 }}>
                {rule.formula || String(rule.value ?? '')}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Button size="sm" variant="ghost" onClick={onPreview}>Preview / Test</Button>
        <HasPermission permission="hr_policy:manage">
          {!ps.is_locked && (
            <Button size="sm" variant="ghost" style={{ color: 'var(--status-success)' }} onClick={onActivate}>Activate</Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClone}>Clone → New Version</Button>
          {ps.status !== 'archived' && (
            <Button size="sm" variant="ghost" style={{ color: 'var(--status-error)' }} onClick={onArchive}>Archive</Button>
          )}
        </HasPermission>
      </div>
    </div>
  )
}

export default function PolicyPage() {
  const qc = useQueryClient()

  const { data: sets = [] } = useQuery({
    queryKey: ['policy-sets'],
    queryFn: () => hrPolicySetsApi.getAll().then(r => r.data),
  })
  const { data: presets = [] } = useQuery({
    queryKey: ['policy-presets'],
    queryFn: () => hrPolicyPresetsApi.getAll().then(r => r.data),
  })
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['policy-audit'],
    queryFn: () => hrPolicyAuditApi.getAll().then(r => r.data),
  })

  const [previewSet, setPreviewSet] = useState<PolicySet | null>(null)
  const [previewContext, setPreviewContext] = useState('{}')
  const [previewResult, setPreviewResult] = useState<PolicyPreviewResult | null>(null)
  const [previewError, setPreviewError] = useState('')

  const cloneMutation = useMutation({
    mutationFn: (id: number) => hrPolicySetsApi.clone(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policy-sets'] }); toast('Cloned to new draft version', 'success') },
  })
  const activateMutation = useMutation({
    mutationFn: (id: number) => hrPolicySetsApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policy-sets'] }); toast('Policy Set activated', 'success') },
    onError: (e: unknown) => toast((e as Error).message, 'error'),
  })
  const archiveMutation = useMutation({
    mutationFn: (id: number) => hrPolicySetsApi.archive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policy-sets'] }); toast('Archived', 'success') },
  })
  const applyPresetMutation = useMutation({
    mutationFn: ({ id, effective_from }: { id: number; effective_from: string }) => hrPolicyPresetsApi.apply(id, effective_from),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['policy-sets'] }); toast('Preset applied — review draft sets then activate each one', 'success') },
  })

  async function handleActivate(ps: PolicySet) {
    const ok = await confirm('Activate policy set?')
    if (ok) activateMutation.mutate(ps.id)
  }
  async function handleArchive(ps: PolicySet) {
    const ok = await confirm('Archive this set?')
    if (ok) archiveMutation.mutate(ps.id)
  }
  async function handleApplyPreset(preset: PolicyPreset) {
    const today = new Date().toISOString().slice(0, 10)
    const ok = await confirm(`Apply: ${preset.name}`)
    if (ok) applyPresetMutation.mutate({ id: preset.id, effective_from: today })
  }

  async function runPreview() {
    if (!previewSet) return
    setPreviewError('')
    setPreviewResult(null)
    try {
      const ctx = JSON.parse(previewContext)
      const r = await hrPolicySetsApi.preview(previewSet.id, ctx)
      setPreviewResult(r.data)
    } catch (e: unknown) {
      setPreviewError((e as Error).message || 'Error running preview')
    }
  }

  const byModule = sets.reduce<Record<string, PolicySet[]>>((acc, ps) => {
    if (!acc[ps.module]) acc[ps.module] = []
    acc[ps.module].push(ps)
    return acc
  }, {})

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
      <HRSettingsNav />
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>Policy Engine</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
          Configurable rule sets for EOS, payroll, leave, overtime and penalties. Rules support conditions, formulas, and pipeline strategies. All calculations are audited and snapshotted.
        </p>
      </div>

      <Tabs defaultValue="sets">
        <TabsList>
          <TabsTrigger value="sets">Policy Sets</TabsTrigger>
          <TabsTrigger value="presets">Apply Preset</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="sets">
          {Object.keys(byModule).length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
              No policy sets yet. Apply a preset to get started.
            </div>
          )}
          {Object.entries(byModule).map(([module, moduleSets]) => (
            <div key={module} style={{ marginBottom: 'var(--space-6)' }}>
              <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{MODULE_ICONS[module] || '⚙️'}</span>
                {moduleSets[0]?.module_display || module}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(460px, 1fr))', gap: 'var(--space-4)' }}>
                {moduleSets.map(ps => (
                  <SetCard
                    key={ps.id}
                    ps={ps}
                    onClone={() => cloneMutation.mutate(ps.id)}
                    onActivate={() => handleActivate(ps)}
                    onArchive={() => handleArchive(ps)}
                    onPreview={() => { setPreviewSet(ps); setPreviewResult(null); setPreviewError('') }}
                  />
                ))}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="presets">
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            Presets create draft policy sets that you then review and activate per module.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 'var(--space-4)' }}>
            {presets.map(preset => (
              <div key={preset.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <span style={{ fontSize: 32 }}>{preset.country_code === 'AE' ? '🇦🇪' : '🌐'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{preset.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{preset.sets_count} module sets</div>
                  </div>
                </div>
                {preset.description && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 12 }}>{preset.description}</p>}
                <HasPermission permission="hr_policy:manage">
                  <Button onClick={() => handleApplyPreset(preset)} disabled={applyPresetMutation.isPending}>Apply to This Company</Button>
                </HasPermission>
              </div>
            ))}
            {presets.length === 0 && (
              <p style={{ color: 'var(--text-secondary)' }}>
                No presets found. Run: <code>python manage.py seed_policy_presets</code>
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  {['Date', 'Entity', 'Action', 'Changed By', 'Reason'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log, i) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 === 0 ? 'transparent' : 'var(--surface-subtle)' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(log.changed_at).toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}><code style={{ fontSize: 11 }}>{log.entity_type}#{log.entity_id}</code></td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge style={{ background: log.action === 'activated' ? 'var(--status-success)' : log.action === 'archived' ? 'var(--text-secondary)' : 'var(--brand)', color: '#fff', fontSize: 11 }}>{log.action_display}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{log.changed_by_name || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', fontSize: 'var(--text-xs)' }}>{log.change_reason || '—'}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No entries yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {previewSet && (
        <BaseModal
          isOpen={!!previewSet}
          onClose={() => setPreviewSet(null)}
          title={`Preview: ${previewSet.name}`}
          footer={<Button onClick={runPreview}>Run Preview</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>
                Context (JSON) — provide all relevant variables
              </label>
              <textarea
                value={previewContext}
                onChange={e => setPreviewContext(e.target.value)}
                rows={6}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, fontFamily: 'monospace', fontSize: 'var(--text-sm)', resize: 'vertical' }}
                placeholder='{"service_years": 6.5, "basic_salary": 15000, "termination_reason": "resignation"}'
              />
            </div>
            {previewError && <div style={{ color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>{previewError}</div>}
            {previewResult && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--status-warning-bg)', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#1e40af' }}>
                    {previewResult.final_output?.toLocaleString() ?? '—'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)' }}>
                    {previewResult.output_type} · {previewResult.calculation_strategy}<br />
                    {previewResult.matched_rules_count} matched · {previewResult.skipped_rules_count} skipped
                  </div>
                </div>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {previewResult.rule_evaluations.map((ev, i) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 6, background: ev.applied ? 'var(--status-success-bg)' : '#fafafa', border: `1px solid ${ev.applied ? '#bbf7d0' : '#e2e8f0'}`, fontSize: 'var(--text-xs)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: ev.applied ? 'var(--status-success)' : 'var(--text-tertiary)' }}>
                          {ev.applied ? '✓' : '✗'} [{ev.rule_key}] {ev.label}
                        </span>
                        {ev.formula_result !== null && ev.applied && (
                          <span style={{ fontWeight: 700, color: '#1e40af' }}>= {ev.formula_result}</span>
                        )}
                      </div>
                      {ev.formula && <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{ev.formula}</div>}
                      {ev.skipped_reason && <div style={{ color: 'var(--status-error)' }}>{ev.skipped_reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </BaseModal>
      )}
      </div>
    </div>
  )
}
