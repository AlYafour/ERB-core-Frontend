'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrWorklogApi, hrEmployeesApi, WorkLog } from '@/lib/api/hr';
import { toast, confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, type Column } from '@/components/ui';
import { RowActions } from '@/components/ui/RowActions';
import { AppListPage } from '@/components/app/AppListPage';
import { BaseModal } from '@/components/ui/base/BaseModal';
import { type FilterField } from '@/components/ui/FilterPanel';
import { useTableState } from '@/lib/hooks/use-table-state';

const STATUS_VARIANT: Record<string, 'default' | 'warning' | 'success' | 'error'> = {
  draft:          'default',
  pending_review: 'warning',
  approved:       'success',
  rejected:       'error',
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

// ── Create Modal ──────────────────────────────────────────────────────────────

function NewWorkLogModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    employee: '',
    date: new Date().toISOString().slice(0, 10),
    hours: '',
    overtime_hours: '',
    notes: '',
  })

  const { data: employees = [] } = useQuery({
    queryKey: ['employees-lookup'],
    queryFn: () => hrEmployeesApi.getAll({ page_size: 200 }).then(r => r.results),
    enabled: isOpen,
  })

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await hrWorklogApi.create({
        employee: Number(form.employee),
        date: form.date,
        hours: Number(form.hours),
        overtime_hours: form.overtime_hours ? Number(form.overtime_hours) : undefined,
        notes: form.notes || undefined,
      })
      await hrWorklogApi.submit(res.data.id)
    },
    onSuccess: () => {
      onSuccess()
      toast('Work log submitted for review', 'success')
      onClose()
      setForm({ employee: '', date: new Date().toISOString().slice(0, 10), hours: '', overtime_hours: '', notes: '' })
    },
    onError: () => toast('Failed to submit work log', 'error'),
  })

  const canSubmit = form.employee && form.date && form.hours && Number(form.hours) > 0

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Log Work Hours" size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => createMut.mutate()} disabled={!canSubmit || createMut.isPending}>
          {createMut.isPending ? 'Submitting…' : 'Submit for Review'}
        </Button>
      </>}>
      <div style={FG}>
        <div><label style={L}>Employee *</label>
          <select style={F} value={form.employee} onChange={e => setForm(p => ({ ...p, employee: e.target.value }))}>
            <option value="">Select employee…</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div><label style={L}>Date *</label>
          <input style={F} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <div><label style={L}>Hours *</label>
            <input style={F} type="number" min="0" max="24" step="0.5" placeholder="8.0" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
          </div>
          <div><label style={L}>Overtime Hours</label>
            <input style={F} type="number" min="0" step="0.5" placeholder="0.0" value={form.overtime_hours} onChange={e => setForm(p => ({ ...p, overtime_hours: e.target.value }))} />
          </div>
        </div>
        <div><label style={L}>Notes</label>
          <textarea style={{ ...F, resize: 'vertical', minHeight: 72 }} placeholder="Tasks completed, remarks…" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
        </div>
      </div>
    </BaseModal>
  )
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({ log, onClose, onSuccess }: { log: WorkLog; onClose: () => void; onSuccess: () => void }) {
  const [reason, setReason] = useState('')
  const rejectMut = useMutation({
    mutationFn: () => hrWorklogApi.reject(log.id, { reason }),
    onSuccess: () => { onSuccess(); toast('Work log rejected', 'success'); onClose(); setReason('') },
    onError: () => toast('Failed to reject', 'error'),
  })
  return (
    <BaseModal isOpen title={`Reject: ${log.employee_name} — ${log.date}`} onClose={onClose} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => rejectMut.mutate()} disabled={!reason.trim() || rejectMut.isPending}
          style={{ background: 'var(--status-error)', color: '#fff' }}>
          {rejectMut.isPending ? 'Rejecting…' : 'Reject'}
        </Button>
      </>}>
      <div style={FG}>
        <div><label style={L}>Reason *</label>
          <textarea style={{ ...F, resize: 'vertical', minHeight: 80 }} placeholder="Explain the reason for rejection…" value={reason} onChange={e => setReason(e.target.value)} />
        </div>
      </div>
    </BaseModal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const filterFields: FilterField[] = [
  { key: 'status', label: 'Status', type: 'select', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ]},
  { key: 'date_from', label: 'From', type: 'date' },
  { key: 'date_to',   label: 'To',   type: 'date' },
]

export default function WorkLogsPage() {
  const tableState = useTableState()
  const { page, search, filters } = tableState
  const qc = useQueryClient()

  const [showNew, setShowNew] = useState(false)
  const [rejectingLog, setRejectingLog] = useState<WorkLog | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-worklogs', page, search, filters],
    queryFn: () => {
      const params: Record<string, string> = { page: String(page) }
      if (search) params.search = search
      Object.entries(filters).forEach(([k, v]) => { if (v != null && v !== '') params[k] = String(v) })
      return hrWorklogApi.getAll(params)
    },
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['hr-worklogs'] })

  const approveMut = useMutation({
    mutationFn: (id: number) => hrWorklogApi.approve(id),
    onSuccess: () => { invalidate(); toast('Work log approved', 'success') },
    onError: () => toast('Failed to approve', 'error'),
  })

  const handleApprove = async (log: WorkLog) => {
    const ok = await confirm(`Approve work log for ${log.employee_name} on ${log.date}?`)
    if (ok) approveMut.mutate(log.id)
  }

  const records    = data?.results ?? []
  const totalCount = data?.count ?? 0

  const columns: Column<WorkLog>[] = [
    {
      key: 'employee_name', header: 'Employee',
      render: r => <span style={{ fontWeight: 600 }}>{r.employee_name}</span>,
    },
    { key: 'date', header: 'Date' },
    {
      key: 'hours', header: 'Hours',
      render: r => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Number(r.hours).toFixed(1)}h
          {Number(r.overtime_hours) > 0 && <span style={{ color: 'var(--status-warning)', marginLeft: 6, fontSize: 11 }}>+{Number(r.overtime_hours).toFixed(1)}h OT</span>}
        </span>
      ),
    },
    {
      key: 'project_name', header: 'Project',
      render: r => <span style={{ color: 'var(--text-secondary)' }}>{r.project_name ?? '—'}</span>,
    },
    {
      key: 'cost_amount', header: 'Cost',
      render: r => r.cost_amount && Number(r.cost_amount) > 0
        ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>AED {Number(r.cost_amount).toLocaleString()}</span>
        : <span style={{ color: 'var(--text-tertiary)' }}>—</span>,
    },
    {
      key: 'status', header: 'Status',
      render: r => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status_display}</Badge>,
    },
    {
      key: 'actions', header: '',
      render: r => (
        <RowActions actions={[
          r.status === 'pending_review' && {
            label: 'Approve',
            onClick: () => handleApprove(r),
            variant: 'success' as const,
          },
          r.status === 'pending_review' && {
            label: 'Reject',
            onClick: () => setRejectingLog(r),
            variant: 'danger' as const,
          },
        ].filter(Boolean) as any} />
      ),
    },
  ]

  return (
    <AppListPage
      title="Work Logs"
      description="Track and approve employee work hours per day."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'HR' }, { label: 'Work Logs' }]}
      totalCount={totalCount}
      createAction={
        <Button variant="primary" size="sm" onClick={() => setShowNew(true)}>
          + Log Hours
        </Button>
      }
      filterFields={filterFields}
      searchPlaceholder="Search by employee…"
      columns={columns}
      data={records}
      isLoading={isLoading}
      error={error}
      emptyTitle="No work logs found."
      tableState={tableState}
      paginatedData={data}
      pageSize={50}
    >
      <NewWorkLogModal isOpen={showNew} onClose={() => setShowNew(false)} onSuccess={invalidate} />
      {rejectingLog && (
        <RejectModal log={rejectingLog} onClose={() => setRejectingLog(null)} onSuccess={invalidate} />
      )}
    </AppListPage>
  )
}
