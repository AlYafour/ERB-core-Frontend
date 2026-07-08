'use client'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrOnboardingApi, OnboardingProcess } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--brand)', completed: 'var(--status-success)', cancelled: 'var(--text-secondary)',
}
const TASK_STATUS_COLORS: Record<string, string> = {
  pending: 'var(--status-warning)', in_progress: 'var(--brand)', completed: 'var(--status-success)', skipped: 'var(--text-secondary)',
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div style={{ background: 'var(--border-subtle)', borderRadius: 4, height: 6, width: '100%' }}>
      <div style={{ background: pct === 100 ? 'var(--status-success)' : 'var(--brand)', borderRadius: 4, height: 6, width: `${pct}%`, transition: 'width 0.3s' }} />
    </div>
  )
}

export default function OnboardingPage() {
  const qc = useQueryClient()
  const { data: processes = [] } = useQuery({
    queryKey: ['onboarding-processes'],
    queryFn: () => hrOnboardingApi.getProcesses({ status: 'active' }).then(r => r.data),
  })

  const completeTaskMutation = useMutation({
    mutationFn: ({ processId, taskId }: { processId: number; taskId: number }) =>
      hrOnboardingApi.completeTask(processId, taskId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['onboarding-processes'] }); toast('Task completed', 'success') },
  })

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>Employee Onboarding</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>Active onboarding processes and task checklists</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {processes.map(proc => (
          <div key={proc.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{proc.employee_name}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>Started {proc.start_date}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontWeight: 700, color: proc.completion_pct === 100 ? 'var(--status-success)' : 'var(--brand)', fontSize: 'var(--text-base)' }}>{proc.completion_pct}%</span>
                <Badge style={{ background: STATUS_COLORS[proc.status], color: '#fff', fontSize: 11 }}>{proc.status_display}</Badge>
              </div>
            </div>
            <ProgressBar pct={proc.completion_pct} />
            <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {proc.task_instances.map(task => (
                <div key={task.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: task.status === 'completed' ? 'var(--status-success-bg)' : 'var(--surface-subtle)', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{task.status === 'completed' ? '✅' : task.status === 'skipped' ? '⏭️' : '🔲'}</span>
                    <div>
                      <div style={{ fontSize: 'var(--text-sm)', fontWeight: task.status === 'completed' ? 400 : 500, textDecoration: task.status === 'completed' ? 'line-through' : 'none', color: task.status === 'completed' ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>{task.title}</div>
                      {task.due_date && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Due: {task.due_date} · {task.assignee_role}</div>}
                    </div>
                  </div>
                  {task.status === 'pending' && (
                    <HasPermission permission="hr_onboarding:manage">
                      <Button size="sm" variant="ghost" onClick={() => completeTaskMutation.mutate({ processId: proc.id, taskId: task.id })}>
                        Complete
                      </Button>
                    </HasPermission>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {processes.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-tertiary)' }}>No active onboarding processes.</div>}
      </div>
    </div>
  )
}
