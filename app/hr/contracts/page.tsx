'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrContractsApi, EmployeeContract } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BaseModal } from '@/components/ui/base/BaseModal'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b', active: '#22c55e', expired: '#6b7280', terminated: '#ef4444',
}

export default function ContractsPage() {
  const qc = useQueryClient()
  const [terminateTarget, setTerminateTarget] = useState<EmployeeContract | null>(null)
  const [terminationDate, setTerminationDate] = useState('')
  const [terminationReason, setTerminationReason] = useState('')
  const [filter, setFilter] = useState('active')

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', filter],
    queryFn: () => hrContractsApi.getAll(filter !== 'all' ? { status: filter } : {}).then(r => r.data),
  })
  const { data: expiring = [] } = useQuery({
    queryKey: ['contracts-expiring'],
    queryFn: () => hrContractsApi.expiringSoon(60).then(r => r.data),
  })

  const terminateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { termination_date: string; termination_reason: string } }) => hrContractsApi.terminate(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['contracts'] }); setTerminateTarget(null); toast('Contract terminated', 'success') },
  })

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>Employee Contracts</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>Contract lifecycle management</p>
        </div>
      </div>

      {expiring.length > 0 && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 16px', marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <span style={{ fontWeight: 600, color: '#92400e' }}>{expiring.length} contract{expiring.length > 1 ? 's' : ''} expiring within 60 days</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)' }}>
        {['all', 'draft', 'active', 'expired', 'terminated'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', fontWeight: filter === s ? 700 : 400, background: filter === s ? 'var(--color-primary)' : 'transparent', color: filter === s ? '#fff' : 'var(--color-text-primary)', fontSize: 'var(--text-sm)' }}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
          <thead>
            <tr style={{ background: 'var(--color-surface-hover)' }}>
              {['Employee', 'Type', 'Status', 'Start', 'End', 'Job Title', 'Salary', 'Actions'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contracts.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 ? 'var(--color-surface-hover)' : 'transparent' }}>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{c.employee_name}</td>
                <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{c.contract_type_display}</td>
                <td style={{ padding: '10px 16px' }}>
                  <Badge style={{ background: STATUS_COLORS[c.status] || '#6b7280', color: '#fff', fontSize: 11 }}>{c.status_display}</Badge>
                  {c.is_expiring_soon && <span style={{ marginLeft: 6, fontSize: 12, color: '#f59e0b' }}>⚠️ Expiring</span>}
                </td>
                <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{c.start_date}</td>
                <td style={{ padding: '10px 16px', color: c.is_expiring_soon ? '#f59e0b' : 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{c.end_date || 'Unlimited'}</td>
                <td style={{ padding: '10px 16px' }}>{c.job_title_snapshot}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{parseFloat(c.basic_salary_snapshot).toLocaleString()}</td>
                <td style={{ padding: '10px 16px' }}>
                  {c.document_url && <Button size="sm" variant="ghost" onClick={() => window.open(c.document_url!, '_blank')}>📄</Button>}
                  {c.status === 'active' && (
                    <HasPermission permission="hr_contracts:manage">
                      <Button size="sm" variant="ghost" style={{ color: '#ef4444', marginLeft: 4 }} onClick={() => { setTerminateTarget(c); setTerminationDate(''); setTerminationReason('') }}>Terminate</Button>
                    </HasPermission>
                  )}
                </td>
              </tr>
            ))}
            {contracts.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No contracts found.</td></tr>}
          </tbody>
        </table>
      </div>

      {terminateTarget && (
        <BaseModal isOpen title={`Terminate Contract — ${terminateTarget.employee_name}`} onClose={() => setTerminateTarget(null)}
          footer={<Button style={{ background: '#ef4444', color: '#fff' }} disabled={!terminationDate || terminateMutation.isPending}
            onClick={() => terminateMutation.mutate({ id: terminateTarget.id, data: { termination_date: terminationDate, termination_reason: terminationReason } })}>
            Confirm Termination
          </Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Termination Date *</label>
              <input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Reason</label>
              <input value={terminationReason} onChange={e => setTerminationReason(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6 }} />
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  )
}
