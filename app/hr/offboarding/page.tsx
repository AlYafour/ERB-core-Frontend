'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrOffboardingApi, OffboardingProcess } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import MainLayout from '@/components/layout/MainLayout'
import { Badge } from '@/components/ui/Badge'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

// Inline SVG icons for clearance status
const CheckCircleIcon = ({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
)

const CircleIcon = ({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) => (
  <svg className={className} style={style} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <circle cx="12" cy="12" r="10"/>
  </svg>
)

function ClearanceItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)' }}>
      {done
        ? <CheckCircleIcon className="w-4 h-4" style={{ color: 'var(--status-success)', flexShrink: 0 }} />
        : <CircleIcon className="w-4 h-4" style={{ color: 'var(--card-border)', flexShrink: 0 }} />}
      <span style={{ color: done ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: done ? 'line-through' : 'none' }}>{label}</span>
    </div>
  )
}

export default function OffboardingPage() {
  const qc = useQueryClient()
  const { data: processes = [] } = useQuery({
    queryKey: ['offboarding'],
    queryFn: () => hrOffboardingApi.getAll({ status: 'active' }).then(r => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OffboardingProcess> }) => hrOffboardingApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offboarding'] }); toast('Updated', 'success') },
  })
  const completeMutation = useMutation({
    mutationFn: (id: number) => hrOffboardingApi.complete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['offboarding'] }); toast('Offboarding completed', 'success') },
  })

  async function toggle(proc: OffboardingProcess, field: keyof OffboardingProcess) {
    updateMutation.mutate({ id: proc.id, data: { [field]: !proc[field] } })
  }
  async function handleComplete(proc: OffboardingProcess) {
    const ok = await confirm('Mark as completed?')
    if (ok) completeMutation.mutate(proc.id)
  }

  return (
    <MainLayout>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--card-border)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Employee Offboarding</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>Exit management and clearance tracking</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 'var(--space-4)' }}>
        {processes.map(proc => (
          <div key={proc.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{proc.employee_name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Last day: {proc.last_working_day}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)', color: proc.clearance_pct === 100 ? 'var(--status-success)' : 'var(--status-warning)' }}>{proc.clearance_pct}%</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>clearance</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 'var(--space-4)' }}>
              {[
                { label: 'Assets returned', field: 'asset_clearance_done' as keyof OffboardingProcess },
                { label: 'System access revoked', field: 'system_access_revoked' as keyof OffboardingProcess },
                { label: 'Documents collected', field: 'documents_collected' as keyof OffboardingProcess },
                { label: 'Exit interview done', field: 'exit_interview_done' as keyof OffboardingProcess },
              ].map(({ label, field }) => (
                <HasPermission key={field} permission="hr_onboarding:manage" fallback={<ClearanceItem label={label} done={proc[field] as boolean} />}>
                  <button onClick={() => toggle(proc, field)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', width: '100%' }}>
                    <ClearanceItem label={label} done={proc[field] as boolean} />
                  </button>
                </HasPermission>
              ))}
            </div>
            {proc.clearance_pct === 100 && (
              <HasPermission permission="hr_onboarding:manage">
                <Button style={{ width: '100%', background: 'var(--status-success)', color: '#fff' }} onClick={() => handleComplete(proc)}>
                  Mark Offboarding Complete
                </Button>
              </HasPermission>
            )}
          </div>
        ))}
        {processes.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)', gridColumn: '1/-1' }}>No active offboarding processes.</div>}
      </div>
    </div>
    </MainLayout>
  )
}
