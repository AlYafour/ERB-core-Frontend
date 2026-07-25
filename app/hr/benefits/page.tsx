'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrBenefitsApi, BenefitPlan, TravelRequest, ExpenseClaim, Grievance, Asset, hrEmployeesApi } from '@/lib/api/hr'
import { Badge } from '@/components/ui/Badge'
import MainLayout from '@/components/layout/MainLayout'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'
import { ShieldCheckIcon, BriefcaseIcon, DollarIcon, AlertIcon } from '@/components/icons'
import { BaseModal } from '@/components/ui/base/BaseModal'

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--text-tertiary)', submitted: 'var(--status-warning)', approved: 'var(--status-success)',
  rejected: 'var(--status-error)', paid: 'var(--brand)', completed: 'var(--status-success)',
  cancelled: 'var(--text-secondary)', open: 'var(--status-warning)', in_review: 'var(--brand)',
  resolved: 'var(--status-success)', escalated: 'var(--status-error)', closed: 'var(--text-tertiary)',
  active: 'var(--status-success)', available: 'var(--status-success)', assigned: 'var(--brand)',
  maintenance: 'var(--status-warning)', disposed: 'var(--text-secondary)',
}
const STATUS_BG: Record<string, string> = {
  draft: 'rgba(0,0,0,0.06)', submitted: 'var(--status-warning-bg)', approved: 'var(--status-success-bg)',
  rejected: 'var(--status-error-bg)', paid: 'var(--status-warning-bg)', completed: 'var(--status-success-bg)',
  cancelled: 'rgba(0,0,0,0.06)', open: 'var(--status-warning-bg)', in_review: 'var(--status-warning-bg)',
  resolved: 'var(--status-success-bg)', escalated: 'var(--status-error-bg)', closed: 'rgba(0,0,0,0.06)',
  active: 'var(--status-success-bg)', available: 'var(--status-success-bg)', assigned: 'var(--status-warning-bg)',
  maintenance: 'var(--status-warning-bg)', disposed: 'rgba(0,0,0,0.06)',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'var(--text-tertiary)', medium: 'var(--status-warning)', high: 'var(--status-error)', critical: 'var(--brand)',
}
const PRIORITY_BG: Record<string, string> = {
  low: 'rgba(0,0,0,0.06)', medium: 'var(--status-warning-bg)', high: 'var(--status-error-bg)', critical: 'var(--status-warning-bg)',
}

const F: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--input-border)', background: 'var(--input-bg)',
  color: 'var(--text-primary)', fontSize: 'var(--text-sm)', outline: 'none',
  boxSizing: 'border-box',
}
const L: React.CSSProperties = {
  display: 'block', fontSize: 'var(--text-xs)', fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 4,
}
const FG: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }

function StatCard({ icon, label, value, color = 'var(--brand)' }: {
  icon: React.ReactNode; label: string; value: string | number; color?: string
}) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `color-mix(in srgb, ${color} 8%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  )
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', paddingLeft: 12, borderLeft: '3px solid var(--brand)' }}>
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  )
}

function TableRow({ cells, actions }: { cells: (string | React.ReactNode)[]; actions?: React.ReactNode }) {
  return (
    <tr style={{ borderBottom: '1px solid var(--card-border)' }}>
      {cells.map((c, i) => (
        <td key={i} style={{ padding: '10px 12px', fontSize: 'var(--text-sm)' }}>{c}</td>
      ))}
      {actions && <td style={{ padding: '10px 12px', textAlign: 'right' }}>{actions}</td>}
    </tr>
  )
}

function TableHead({ cols }: { cols: string[] }) {
  return (
    <thead>
      <tr style={{ background: 'var(--surface-secondary)' }}>
        {cols.map(c => <th key={c} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c}</th>)}
        <th style={{ padding: '8px 12px' }} />
      </tr>
    </thead>
  )
}

// ─── Benefit Plans ────────────────────────────────────────────────────────────
function BenefitPlansTab() {
  const { data: plans = [] } = useQuery({ queryKey: ['benefit-plans'], queryFn: () => hrBenefitsApi.getPlans().then(r => r.data) })
  const grouped = plans.reduce((acc, p) => { (acc[p.benefit_type_display] = acc[p.benefit_type_display] || []).push(p); return acc }, {} as Record<string, BenefitPlan[]>)
  return (
    <div>
      {Object.entries(grouped).map(([type, items]) => (
        <Section key={type} title={type}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            {items.map(p => (
              <div key={p.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <Badge style={{ background: p.is_active ? 'var(--status-success-bg)' : 'rgba(0,0,0,0.06)', color: p.is_active ? 'var(--status-success)' : 'var(--text-tertiary)', fontSize: 10 }}>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                {p.provider && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{p.provider}</div>}
                <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)' }}>
                  <span style={{ color: 'var(--status-success)', fontWeight: 600 }}>{p.currency} {Number(p.monthly_cost).toLocaleString()}/mo</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{p.enrollments_count} enrolled</span>
                  {p.is_mandatory && <Badge style={{ background: 'var(--status-warning-bg)', color: 'var(--brand)', fontSize: 9, padding: '1px 6px' }}>Mandatory</Badge>}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ))}
      {plans.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No benefit plans configured.</p>}
    </div>
  )
}

// ─── Assets ───────────────────────────────────────────────────────────────────

const ASSET_TYPES = ['laptop','mobile','sim','vehicle','access_card','uniform','tools','other']
const CURRENCIES = ['AED','USD','EUR','GBP']

function AssetsTab() {
  const qc = useQueryClient()
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => hrBenefitsApi.getAssets().then(r => r.data) })
  const { data: assignments = [] } = useQuery({ queryKey: ['assignments'], queryFn: () => hrBenefitsApi.getAssignments().then(r => r.data) })

  const [showNewAsset, setShowNewAsset] = useState(false)
  const [assetForm, setAssetForm] = useState({ name: '', asset_type: 'laptop', asset_tag: '', serial_number: '', brand: '', purchase_cost: '', currency: 'AED' })

  const [assigningAsset, setAssigningAsset] = useState<Asset | null>(null)
  const [assignForm, setAssignForm] = useState({ employee: '', condition_out: 'good', notes: '' })
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-lookup'],
    queryFn: () => hrEmployeesApi.getAll({ page_size: 200 }).then(r => r.results),
    enabled: showNewAsset || !!assigningAsset,
  })

  const createAssetMut = useMutation({
    mutationFn: () => hrBenefitsApi.createAsset({
      name: assetForm.name,
      asset_type: assetForm.asset_type,
      asset_tag: assetForm.asset_tag || undefined,
      serial_number: assetForm.serial_number || undefined,
      brand: assetForm.brand || undefined,
      purchase_cost: assetForm.purchase_cost || undefined,
      currency: assetForm.currency,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] })
      toast('Asset added', 'success')
      setShowNewAsset(false)
      setAssetForm({ name: '', asset_type: 'laptop', asset_tag: '', serial_number: '', brand: '', purchase_cost: '', currency: 'AED' })
    },
    onError: () => toast('Failed to create asset', 'error'),
  })

  const assignMut = useMutation({
    mutationFn: () => hrBenefitsApi.createAssignment({
      asset: assigningAsset!.id,
      employee: Number(assignForm.employee),
      condition_out: assignForm.condition_out,
      notes: assignForm.notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['assignments'] })
      toast('Asset assigned', 'success')
      setAssigningAsset(null)
      setAssignForm({ employee: '', condition_out: 'good', notes: '' })
    },
    onError: () => toast('Failed to assign asset', 'error'),
  })

  const returnMutation = useMutation({
    mutationFn: (id: number) => hrBenefitsApi.returnAsset(id, { returned_at: new Date().toISOString().slice(0, 10) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); qc.invalidateQueries({ queryKey: ['assignments'] }); toast('Asset returned', 'success') },
  })

  async function handleReturn(id: number) {
    const ok = await confirm('Return asset?')
    if (ok) returnMutation.mutate(id)
  }

  const available = assets.filter(a => a.status === 'available').length
  const assigned = assets.filter(a => a.status === 'assigned').length

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 'var(--space-4)', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-sm)', flex: 1 }}>Available: <strong style={{ color: 'var(--status-success)' }}>{available}</strong> &nbsp; Assigned: <strong style={{ color: 'var(--brand)' }}>{assigned}</strong></span>
        <HasPermission permission="hr_benefits:manage">
          <Button size="sm" onClick={() => setShowNewAsset(true)}>+ Add Asset</Button>
        </HasPermission>
      </div>

      <Section title="Current Assignments">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
            <TableHead cols={['Asset', 'Tag', 'Employee', 'Assigned', 'Status']} />
            <tbody>
              {assignments.filter(a => !a.returned_at).map(a => (
                <TableRow key={a.id} cells={[
                  a.asset_name,
                  <code key="tag" style={{ fontSize: 11 }}>{a.asset_tag || '—'}</code>,
                  a.employee_name,
                  a.assigned_at,
                  <Badge key="s" style={{ background: 'var(--status-warning-bg)', color: 'var(--brand)', fontSize: 10 }}>Assigned</Badge>,
                ]} actions={
                  <HasPermission permission="hr_benefits:manage">
                    <Button size="sm" variant="ghost" style={{ fontSize: 11 }} onClick={() => handleReturn(a.id)}>Return</Button>
                  </HasPermission>
                } />
              ))}
              {assignments.filter(a => !a.returned_at).length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No active assignments</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="All Assets">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
            <TableHead cols={['Name', 'Type', 'Tag', 'Brand', 'Status']} />
            <tbody>
              {assets.map(a => (
                <TableRow key={a.id} cells={[
                  a.name,
                  a.asset_type_display,
                  <code key="tag" style={{ fontSize: 11 }}>{a.asset_tag || '—'}</code>,
                  a.brand || '—',
                  <Badge key="s" style={{ background: STATUS_BG[a.status] || 'rgba(0,0,0,0.06)', color: STATUS_COLORS[a.status] || 'var(--text-tertiary)', fontSize: 10 }}>{a.status}</Badge>,
                ]} actions={a.status === 'available' ? (
                  <HasPermission permission="hr_benefits:manage">
                    <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--brand)', color: '#fff' }} onClick={() => { setAssigningAsset(a); setAssignForm({ employee: '', condition_out: 'good', notes: '' }) }}>Assign</Button>
                  </HasPermission>
                ) : undefined} />
              ))}
              {assets.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No assets found.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Add Asset Modal */}
      <BaseModal isOpen={showNewAsset} onClose={() => setShowNewAsset(false)} title="Add Asset" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setShowNewAsset(false)}>Cancel</Button>
          <Button onClick={() => createAssetMut.mutate()} disabled={!assetForm.name || createAssetMut.isPending}>
            {createAssetMut.isPending ? 'Saving…' : 'Add Asset'}
          </Button>
        </>}>
        <div style={FG}>
          <div><label style={L}>Name *</label><input style={F} value={assetForm.name} onChange={e => setAssetForm(p => ({ ...p, name: e.target.value }))} /></div>
          <div><label style={L}>Type</label>
            <select style={F} value={assetForm.asset_type} onChange={e => setAssetForm(p => ({ ...p, asset_type: e.target.value }))}>
              {ASSET_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Asset Tag</label><input style={F} value={assetForm.asset_tag} onChange={e => setAssetForm(p => ({ ...p, asset_tag: e.target.value }))} /></div>
            <div><label style={L}>Serial Number</label><input style={F} value={assetForm.serial_number} onChange={e => setAssetForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
          </div>
          <div><label style={L}>Brand</label><input style={F} value={assetForm.brand} onChange={e => setAssetForm(p => ({ ...p, brand: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Purchase Cost</label><input style={F} type="number" min="0" value={assetForm.purchase_cost} onChange={e => setAssetForm(p => ({ ...p, purchase_cost: e.target.value }))} /></div>
            <div><label style={L}>Currency</label>
              <select style={F} value={assetForm.currency} onChange={e => setAssetForm(p => ({ ...p, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </BaseModal>

      {/* Assign Asset Modal */}
      <BaseModal isOpen={!!assigningAsset} onClose={() => setAssigningAsset(null)} title={`Assign: ${assigningAsset?.name ?? ''}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setAssigningAsset(null)}>Cancel</Button>
          <Button onClick={() => assignMut.mutate()} disabled={!assignForm.employee || assignMut.isPending}>
            {assignMut.isPending ? 'Assigning…' : 'Assign'}
          </Button>
        </>}>
        <div style={FG}>
          <div><label style={L}>Employee *</label>
            <select style={F} value={assignForm.employee} onChange={e => setAssignForm(p => ({ ...p, employee: e.target.value }))}>
              <option value="">Select employee…</option>
              {employees.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div><label style={L}>Condition Out</label>
            <select style={F} value={assignForm.condition_out} onChange={e => setAssignForm(p => ({ ...p, condition_out: e.target.value }))}>
              {['excellent','good','fair','poor'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label style={L}>Notes</label><textarea style={{ ...F, resize: 'vertical', minHeight: 64 }} value={assignForm.notes} onChange={e => setAssignForm(p => ({ ...p, notes: e.target.value }))} /></div>
        </div>
      </BaseModal>
    </div>
  )
}

// ─── Travel Requests ──────────────────────────────────────────────────────────

const TRAVEL_PURPOSES = ['business','training','conference','site_visit','other']

function TravelTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('submitted')
  const { data: travels = [] } = useQuery({ queryKey: ['travel', filter], queryFn: () => hrBenefitsApi.getTravelRequests(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ purpose: 'business', destination: '', departure_date: '', return_date: '', estimated_cost: '', currency: 'AED', description: '' })

  const reviewMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => hrBenefitsApi.reviewTravel(id, { approved }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['travel'] }); toast('Travel request updated', 'success') },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await hrBenefitsApi.createTravelRequest({
        purpose: form.purpose,
        destination: form.destination,
        departure_date: form.departure_date,
        return_date: form.return_date,
        estimated_cost: form.estimated_cost || undefined,
        currency: form.currency,
        description: form.description,
      })
      await hrBenefitsApi.submitTravel(res.data.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['travel'] })
      toast('Travel request submitted', 'success')
      setShowNew(false)
      setForm({ purpose: 'business', destination: '', departure_date: '', return_date: '', estimated_cost: '', currency: 'AED', description: '' })
    },
    onError: () => toast('Failed to submit request', 'error'),
  })

  async function handleReview(id: number, approved: boolean) {
    const ok = await confirm(`${approved ? 'Approve' : 'Reject'} travel request?`)
    if (ok) reviewMutation.mutate({ id, approved })
  }

  const canSubmit = form.destination && form.departure_date && form.return_date

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'draft', 'submitted', 'approved', 'rejected', 'completed'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>+ New Request</Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
          <TableHead cols={['Employee', 'Destination', 'Purpose', 'Dates', 'Duration', 'Est. Cost', 'Status']} />
          <tbody>
            {travels.map(t => (
              <TableRow key={t.id} cells={[
                t.employee_name,
                t.destination,
                t.purpose_display,
                `${t.departure_date} → ${t.return_date}`,
                `${t.duration_days}d`,
                t.estimated_cost ? `${t.currency} ${Number(t.estimated_cost).toLocaleString()}` : '—',
                <Badge key="s" style={{ background: STATUS_BG[t.status] || 'rgba(0,0,0,0.06)', color: STATUS_COLORS[t.status] || 'var(--text-tertiary)', fontSize: 10 }}>{t.status_display}</Badge>,
              ]} actions={t.status === 'submitted' ? (
                <HasPermission permission="hr_benefits:manage">
                  <div style={{ display: 'flex', gap: 4 }}>
                    <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--status-success)', color: '#fff' }} onClick={() => handleReview(t.id, true)}>Approve</Button>
                    <Button size="sm" variant="ghost" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--status-error)' }} onClick={() => handleReview(t.id, false)}>Reject</Button>
                  </div>
                </HasPermission>
              ) : undefined} />
            ))}
            {travels.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No requests found.</td></tr>}
          </tbody>
        </table>
      </div>

      <BaseModal isOpen={showNew} onClose={() => setShowNew(false)} title="New Travel Request" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending}>
            {createMut.isPending ? 'Submitting…' : 'Submit Request'}
          </Button>
        </>}>
        <div style={FG}>
          <div><label style={L}>Purpose</label>
            <select style={F} value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}>
              {TRAVEL_PURPOSES.map(p => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div><label style={L}>Destination *</label><input style={F} placeholder="e.g. Dubai, UAE" value={form.destination} onChange={e => setForm(p => ({ ...p, destination: e.target.value }))} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Departure Date *</label><input style={F} type="date" value={form.departure_date} onChange={e => setForm(p => ({ ...p, departure_date: e.target.value }))} /></div>
            <div><label style={L}>Return Date *</label><input style={F} type="date" value={form.return_date} onChange={e => setForm(p => ({ ...p, return_date: e.target.value }))} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Estimated Cost</label><input style={F} type="number" min="0" placeholder="0.00" value={form.estimated_cost} onChange={e => setForm(p => ({ ...p, estimated_cost: e.target.value }))} /></div>
            <div><label style={L}>Currency</label>
              <select style={F} value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label style={L}>Description</label><textarea style={{ ...F, resize: 'vertical', minHeight: 72 }} placeholder="Purpose and details…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
      </BaseModal>
    </div>
  )
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = ['travel','accommodation','meals','transport','communication','supplies','training','other']

function ExpensesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('submitted')
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', filter], queryFn: () => hrBenefitsApi.getExpenses(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'travel', amount: '', currency: 'AED', expense_date: '', description: '' })

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => hrBenefitsApi.approveExpense(id, { approved }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Expense updated', 'success') },
  })
  const paidMutation = useMutation({
    mutationFn: (id: number) => hrBenefitsApi.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Marked as paid', 'success') },
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await hrBenefitsApi.createExpense({
        title: form.title,
        category: form.category,
        amount: form.amount,
        currency: form.currency,
        expense_date: form.expense_date,
        description: form.description,
      })
      await hrBenefitsApi.submitExpense(res.data.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      toast('Expense claim submitted', 'success')
      setShowNew(false)
      setForm({ title: '', category: 'travel', amount: '', currency: 'AED', expense_date: '', description: '' })
    },
    onError: () => toast('Failed to submit claim', 'error'),
  })

  const totalSubmitted = expenses.filter(e => e.status === 'submitted').reduce((s, e) => s + Number(e.amount), 0)
  const canSubmit = form.title && form.amount && form.expense_date

  return (
    <div>
      {filter === 'submitted' && expenses.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)', padding: '10px 16px', background: 'var(--status-warning-bg)', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }}>
          Pending approval: <strong>AED {totalSubmitted.toLocaleString()}</strong> across {expenses.filter(e => e.status === 'submitted').length} claims
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'draft', 'submitted', 'approved', 'rejected', 'paid'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>+ New Claim</Button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8 }}>
          <TableHead cols={['Employee', 'Title', 'Category', 'Amount', 'Date', 'Status']} />
          <tbody>
            {expenses.map(e => (
              <TableRow key={e.id} cells={[
                e.employee_name,
                e.title,
                e.category_display,
                <span key="amt" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{e.currency} {Number(e.amount).toLocaleString()}</span>,
                e.expense_date,
                <Badge key="s" style={{ background: STATUS_BG[e.status] || 'rgba(0,0,0,0.06)', color: STATUS_COLORS[e.status] || 'var(--text-tertiary)', fontSize: 10 }}>{e.status_display}</Badge>,
              ]} actions={
                <HasPermission permission="hr_benefits:manage">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {e.status === 'submitted' && <>
                      <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--status-success)', color: '#fff' }} onClick={() => approveMutation.mutate({ id: e.id, approved: true })}>Approve</Button>
                      <Button size="sm" variant="ghost" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--status-error)' }} onClick={() => approveMutation.mutate({ id: e.id, approved: false })}>Reject</Button>
                    </>}
                    {e.status === 'approved' && <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--brand)', color: '#fff' }} onClick={() => paidMutation.mutate(e.id)}>Mark Paid</Button>}
                  </div>
                </HasPermission>
              } />
            ))}
            {expenses.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>No claims found.</td></tr>}
          </tbody>
        </table>
      </div>

      <BaseModal isOpen={showNew} onClose={() => setShowNew(false)} title="New Expense Claim" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending}>
            {createMut.isPending ? 'Submitting…' : 'Submit Claim'}
          </Button>
        </>}>
        <div style={FG}>
          <div><label style={L}>Title *</label><input style={F} placeholder="e.g. Hotel stay – Dubai trip" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
          <div><label style={L}>Category</label>
            <select style={F} value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Amount *</label><input style={F} type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div><label style={L}>Currency</label>
              <select style={F} value={form.currency} onChange={e => setForm(p => ({ ...p, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div><label style={L}>Expense Date *</label><input style={F} type="date" value={form.expense_date} onChange={e => setForm(p => ({ ...p, expense_date: e.target.value }))} /></div>
          <div><label style={L}>Description</label><textarea style={{ ...F, resize: 'vertical', minHeight: 72 }} placeholder="Provide details about this expense…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
        </div>
      </BaseModal>
    </div>
  )
}

// ─── Grievances ───────────────────────────────────────────────────────────────

const GRIEVANCE_TYPES = ['harassment','discrimination','workplace','compensation','workload','policy','other']

function GrievancesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('open')
  const { data: grievances = [] } = useQuery({ queryKey: ['grievances', filter], queryFn: () => hrBenefitsApi.getGrievances(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ grievance_type: 'workplace', priority: 'medium', subject: '', description: '', is_anonymous: false })

  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [resolveText, setResolveText] = useState('')

  const assignMutation = useMutation({
    mutationFn: (id: number) => hrBenefitsApi.assignGrievance(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); toast('Grievance assigned to you', 'success') },
  })
  const escalateMutation = useMutation({
    mutationFn: (id: number) => hrBenefitsApi.escalateGrievance(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); toast('Escalated to critical', 'success') },
  })
  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: number; resolution: string }) => hrBenefitsApi.resolveGrievance(id, { resolution }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); toast('Grievance resolved', 'success'); setResolvingId(null); setResolveText('') },
    onError: () => toast('Failed to resolve grievance', 'error'),
  })

  const createMut = useMutation({
    mutationFn: () => hrBenefitsApi.createGrievance({
      grievance_type: form.grievance_type,
      priority: form.priority as 'low' | 'medium' | 'high' | 'critical',
      subject: form.subject,
      description: form.description,
      is_anonymous: form.is_anonymous,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['grievances'] })
      toast('Grievance submitted', 'success')
      setShowNew(false)
      setForm({ grievance_type: 'workplace', priority: 'medium', subject: '', description: '', is_anonymous: false })
    },
    onError: () => toast('Failed to submit grievance', 'error'),
  })

  async function handleEscalate(id: number) {
    const ok = await confirm('Escalate grievance?')
    if (ok) escalateMutation.mutate(id)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['all', 'open', 'in_review', 'resolved', 'escalated', 'closed'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s.replace('_', ' ')}</button>
          ))}
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>+ New Grievance</Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {grievances.map(g => (
          <div key={g.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderLeft: `4px solid ${PRIORITY_COLORS[g.priority]}`, borderRadius: 8, padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700 }}>{g.subject}</span>
                  <Badge style={{ background: PRIORITY_BG[g.priority], color: PRIORITY_COLORS[g.priority], fontSize: 10 }}>{g.priority_display}</Badge>
                  <Badge style={{ background: STATUS_BG[g.status] || 'rgba(0,0,0,0.06)', color: STATUS_COLORS[g.status] || 'var(--text-tertiary)', fontSize: 10 }}>{g.status_display}</Badge>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                  {g.is_anonymous ? 'Anonymous' : g.employee_name} · {g.grievance_type_display} · {g.created_at.slice(0, 10)}
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{g.description}</div>
                {g.resolution && <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--status-success-bg)', borderRadius: 4, fontSize: 11, color: 'var(--status-success)' }}>Resolution: {g.resolution}</div>}
              </div>
              <HasPermission permission="hr_benefits:manage">
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {g.status === 'open' && <Button size="sm" variant="ghost" style={{ fontSize: 10 }} onClick={() => assignMutation.mutate(g.id)}>Assign to me</Button>}
                  {g.status === 'in_review' && <>
                    <Button size="sm" style={{ fontSize: 10, background: 'var(--status-success)', color: '#fff' }} onClick={() => { setResolvingId(g.id); setResolveText('') }}>Resolve</Button>
                    <Button size="sm" variant="ghost" style={{ fontSize: 10, color: 'var(--brand)' }} onClick={() => handleEscalate(g.id)}>Escalate</Button>
                  </>}
                </div>
              </HasPermission>
            </div>
          </div>
        ))}
        {grievances.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No grievances found.</p>}
      </div>

      {/* New Grievance Modal */}
      <BaseModal isOpen={showNew} onClose={() => setShowNew(false)} title="Submit Grievance" size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
          <Button onClick={() => createMut.mutate()} disabled={!form.subject || !form.description || createMut.isPending}>
            {createMut.isPending ? 'Submitting…' : 'Submit Grievance'}
          </Button>
        </>}>
        <div style={FG}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            <div><label style={L}>Type</label>
              <select style={F} value={form.grievance_type} onChange={e => setForm(p => ({ ...p, grievance_type: e.target.value }))}>
                {GRIEVANCE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div><label style={L}>Priority</label>
              <select style={F} value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {['low','medium','high','critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div><label style={L}>Subject *</label><input style={F} placeholder="Brief description of the issue" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></div>
          <div><label style={L}>Description *</label><textarea style={{ ...F, resize: 'vertical', minHeight: 96 }} placeholder="Provide full details…" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(p => ({ ...p, is_anonymous: e.target.checked }))} />
            Submit anonymously
          </label>
        </div>
      </BaseModal>

      {/* Resolve Grievance Modal */}
      <BaseModal isOpen={resolvingId !== null} onClose={() => { setResolvingId(null); setResolveText('') }} title="Resolve Grievance" size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => { setResolvingId(null); setResolveText('') }}>Cancel</Button>
          <Button onClick={() => resolveMutation.mutate({ id: resolvingId!, resolution: resolveText })} disabled={!resolveText.trim() || resolveMutation.isPending}>
            {resolveMutation.isPending ? 'Saving…' : 'Mark Resolved'}
          </Button>
        </>}>
        <div style={FG}>
          <div><label style={L}>Resolution Details *</label><textarea style={{ ...F, resize: 'vertical', minHeight: 100 }} placeholder="Describe how the grievance was resolved…" value={resolveText} onChange={e => setResolveText(e.target.value)} /></div>
        </div>
      </BaseModal>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BenefitsPage() {
  const { data: plans = [] } = useQuery({ queryKey: ['benefit-plans'], queryFn: () => hrBenefitsApi.getPlans({ is_active: 'true' }).then(r => r.data) })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => hrBenefitsApi.getAssets().then(r => r.data) })
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses-pending'], queryFn: () => hrBenefitsApi.getExpenses({ status: 'submitted' }).then(r => r.data) })
  const { data: grievances = [] } = useQuery({ queryKey: ['grievances-open'], queryFn: () => hrBenefitsApi.getGrievances({ status: 'open' }).then(r => r.data) })

  return (
    <MainLayout>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--card-border)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Benefits &amp; Welfare</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>Benefit plans, asset management, travel, expenses, and grievances</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <StatCard icon={<ShieldCheckIcon className="w-5 h-5" />} label="Active Plans" value={plans.length} color="var(--status-success)" />
        <StatCard icon={<BriefcaseIcon className="w-5 h-5" />} label="Assets Available" value={assets.filter(a => a.status === 'available').length} color="var(--brand)" />
        <StatCard icon={<DollarIcon className="w-5 h-5" />} label="Pending Expenses" value={expenses.length} color="var(--status-warning)" />
        <StatCard icon={<AlertIcon className="w-5 h-5" />} label="Open Grievances" value={grievances.length} color="var(--status-error)" />
      </div>

      <Tabs defaultValue="benefits">
        <TabsList>
          <TabsTrigger value="benefits">Benefit Plans</TabsTrigger>
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="travel">Travel</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="grievances">Grievances</TabsTrigger>
        </TabsList>
        <TabsContent value="benefits" style={{ marginTop: 'var(--space-4)' }}><BenefitPlansTab /></TabsContent>
        <TabsContent value="assets" style={{ marginTop: 'var(--space-4)' }}><AssetsTab /></TabsContent>
        <TabsContent value="travel" style={{ marginTop: 'var(--space-4)' }}><TravelTab /></TabsContent>
        <TabsContent value="expenses" style={{ marginTop: 'var(--space-4)' }}><ExpensesTab /></TabsContent>
        <TabsContent value="grievances" style={{ marginTop: 'var(--space-4)' }}><GrievancesTab /></TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  )
}
