'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrBenefitsApi, BenefitPlan, TravelRequest, ExpenseClaim, Grievance, Asset } from '@/lib/api/hr'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-3)', paddingBottom: 8, borderBottom: '1px solid var(--card-border)' }}>{title}</h3>
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
function AssetsTab() {
  const qc = useQueryClient()
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => hrBenefitsApi.getAssets().then(r => r.data) })
  const { data: assignments = [] } = useQuery({ queryKey: ['assignments'], queryFn: () => hrBenefitsApi.getAssignments().then(r => r.data) })

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
      <div style={{ display: 'flex', gap: 16, marginBottom: 'var(--space-4)' }}>
        <span style={{ fontSize: 'var(--text-sm)' }}>Available: <strong style={{ color: 'var(--status-success)' }}>{available}</strong></span>
        <span style={{ fontSize: 'var(--text-sm)' }}>Assigned: <strong style={{ color: 'var(--brand)' }}>{assigned}</strong></span>
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
    </div>
  )
}

// ─── Travel Requests ──────────────────────────────────────────────────────────
function TravelTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('submitted')
  const { data: travels = [] } = useQuery({ queryKey: ['travel', filter], queryFn: () => hrBenefitsApi.getTravelRequests(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

  const reviewMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => hrBenefitsApi.reviewTravel(id, { approved }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['travel'] }); toast('Travel request updated', 'success') },
  })

  async function handleReview(id: number, approved: boolean) {
    const label = approved ? 'approve' : 'reject'
    const ok = await confirm(`${approved ? 'Approve' : 'Reject'} travel request?`)
    if (ok) reviewMutation.mutate({ id, approved })
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {['all', 'draft', 'submitted', 'approved', 'rejected', 'completed'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s}</button>
        ))}
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
    </div>
  )
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
function ExpensesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('submitted')
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses', filter], queryFn: () => hrBenefitsApi.getExpenses(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

  const approveMutation = useMutation({
    mutationFn: ({ id, approved }: { id: number; approved: boolean }) => hrBenefitsApi.approveExpense(id, { approved }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Expense updated', 'success') },
  })
  const paidMutation = useMutation({
    mutationFn: (id: number) => hrBenefitsApi.markPaid(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast('Marked as paid', 'success') },
  })

  const totalSubmitted = expenses.filter(e => e.status === 'submitted').reduce((s, e) => s + Number(e.amount), 0)

  return (
    <div>
      {filter === 'submitted' && expenses.length > 0 && (
        <div style={{ marginBottom: 'var(--space-3)', padding: '10px 16px', background: 'var(--status-warning-bg)', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }}>
          Pending approval: <strong>AED {totalSubmitted.toLocaleString()}</strong> across {expenses.filter(e => e.status === 'submitted').length} claims
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {['all', 'draft', 'submitted', 'approved', 'rejected', 'paid'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s}</button>
        ))}
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
    </div>
  )
}

// ─── Grievances ───────────────────────────────────────────────────────────────
function GrievancesTab() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('open')
  const { data: grievances = [] } = useQuery({ queryKey: ['grievances', filter], queryFn: () => hrBenefitsApi.getGrievances(filter !== 'all' ? { status: filter } : {}).then(r => r.data) })

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grievances'] }); toast('Grievance resolved', 'success') },
  })

  async function handleEscalate(id: number) {
    const ok = await confirm('Escalate grievance?')
    if (ok) escalateMutation.mutate(id)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        {['all', 'open', 'in_review', 'resolved', 'escalated', 'closed'].map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 11, fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--brand)' : 'transparent', color: filter === s ? '#fff' : 'var(--text-primary)' }}>{s.replace('_', ' ')}</button>
        ))}
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
                    <Button size="sm" style={{ fontSize: 10, background: 'var(--status-success)', color: '#fff' }} onClick={() => resolveMutation.mutate({ id: g.id, resolution: 'Resolved by HR' })}>Resolve</Button>
                    <Button size="sm" variant="ghost" style={{ fontSize: 10, color: 'var(--brand)' }} onClick={() => handleEscalate(g.id)}>Escalate</Button>
                  </>}
                </div>
              </HasPermission>
            </div>
          </div>
        ))}
        {grievances.length === 0 && <p style={{ color: 'var(--text-tertiary)' }}>No grievances found.</p>}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BenefitsPage() {
  const { data: plans = [] } = useQuery({ queryKey: ['benefit-plans'], queryFn: () => hrBenefitsApi.getPlans({ is_active: 'true' }).then(r => r.data) })
  const { data: assets = [] } = useQuery({ queryKey: ['assets'], queryFn: () => hrBenefitsApi.getAssets().then(r => r.data) })
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses-pending'], queryFn: () => hrBenefitsApi.getExpenses({ status: 'submitted' }).then(r => r.data) })
  const { data: grievances = [] } = useQuery({ queryKey: ['grievances-open'], queryFn: () => hrBenefitsApi.getGrievances({ status: 'open' }).then(r => r.data) })

  const kpis = [
    { icon: '🏥', label: 'Active Plans', value: plans.length },
    { icon: '💻', label: 'Assets Available', value: assets.filter(a => a.status === 'available').length },
    { icon: '🧾', label: 'Pending Expenses', value: expenses.length },
    { icon: '⚠️', label: 'Open Grievances', value: grievances.length },
  ]

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Benefits & Welfare</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>Benefit plans, asset management, travel, expenses, and grievances</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {kpis.map(({ icon, label, value }) => (
          <div key={label} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 26 }}>{icon}</span>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</div>
              <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
            </div>
          </div>
        ))}
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
  )
}
