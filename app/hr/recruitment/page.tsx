'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrRecruitmentApi, JobRequisition, RequisitionPipeline } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import MainLayout from '@/components/layout/MainLayout'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import HasPermission from '@/components/shared/HasPermission'
import { confirm, toast } from '@/lib/hooks/use-toast'
import { BriefcaseIcon, UsersIcon, UserIcon } from '@/components/icons'

const REQ_STATUS_COLORS: Record<string, string> = {
  draft: 'var(--text-tertiary)', open: 'var(--status-success)', on_hold: 'var(--status-warning)', filled: 'var(--brand)', cancelled: 'var(--status-error)',
}
const CAND_STATUS_COLORS: Record<string, string> = {
  applied: 'var(--text-tertiary)', screening: 'var(--status-warning)', interview: 'var(--brand)',
  offer_sent: 'var(--brand)', offer_accepted: 'var(--status-success)', offer_declined: 'var(--status-error)',
  hired: 'var(--status-success)', rejected: 'var(--status-error)', withdrawn: 'var(--text-secondary)',
}
const CAND_STATUS_BG: Record<string, string> = {
  applied: 'rgba(0,0,0,0.06)', screening: 'var(--status-warning-bg)', interview: 'var(--status-warning-bg)',
  offer_sent: 'var(--status-warning-bg)', offer_accepted: 'var(--status-success-bg)', offer_declined: 'var(--status-error-bg)',
  hired: 'var(--status-success-bg)', rejected: 'var(--status-error-bg)', withdrawn: 'rgba(0,0,0,0.06)',
}

const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer_sent', 'offer_accepted', 'hired']

function StatCard({ icon, label, value, color = 'var(--brand)' }: {
  icon: React.ReactNode; label: string; value: string | number; color?: string
}) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  )
}

function RequisitionCard({ req, onClick }: { req: JobRequisition; onClick: () => void }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{req.title}</div>
        <Badge style={{ background: REQ_STATUS_COLORS[req.status], color: '#fff', fontSize: 11 }}>{req.status_display}</Badge>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8 }}>
        {req.department_name || 'No department'} · {req.location || 'Remote/TBD'} · {req.contract_type_display}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--brand)', display: 'flex' }}><UsersIcon className="w-3 h-3" /></span>
          {req.candidates_count} applicants
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--status-warning)', display: 'flex' }}><UserIcon className="w-3 h-3" /></span>
          {req.active_candidates_count} active
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ color: 'var(--status-success)', display: 'flex' }}><BriefcaseIcon className="w-3 h-3" /></span>
          {req.headcount} position{req.headcount > 1 ? 's' : ''}
        </span>
        {req.target_date && <span style={{ color: 'var(--text-tertiary)' }}>Target: {req.target_date}</span>}
      </div>
      {(req.salary_min || req.salary_max) && (
        <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--status-success)', fontWeight: 600 }}>
          {req.currency} {req.salary_min ? Number(req.salary_min).toLocaleString() : '?'} — {req.salary_max ? Number(req.salary_max).toLocaleString() : '?'}
        </div>
      )}
    </div>
  )
}

function KanbanBoard({ pipeline }: { pipeline: RequisitionPipeline }) {
  const qc = useQueryClient()
  const advanceMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.advanceCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast('Candidate advanced', 'success') },
  })
  const rejectMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.rejectCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast('Candidate rejected', 'success') },
  })
  const hireMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.hireCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast('Candidate hired!', 'success') },
  })

  async function handleReject(id: number) {
    const ok = await confirm('Reject candidate?')
    if (ok) rejectMutation.mutate(id)
  }
  async function handleHire(id: number) {
    const ok = await confirm('Confirm hire?')
    if (ok) hireMutation.mutate(id)
  }

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 'var(--space-3)', minWidth: PIPELINE_STAGES.length * 220 }}>
        {PIPELINE_STAGES.map(stage => {
          const col = pipeline.pipeline[stage]
          if (!col) return null
          return (
            <div key={stage} style={{ minWidth: 210, flex: '0 0 210px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '6px 10px', background: CAND_STATUS_BG[stage], borderRadius: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: CAND_STATUS_COLORS[stage] }}>{col.label}</span>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: CAND_STATUS_COLORS[stage], background: CAND_STATUS_BG[stage], borderRadius: 10, padding: '1px 7px' }}>{col.count}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.candidates.map(c => (
                  <div key={c.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>{c.source || 'Direct'}</div>
                    <HasPermission permission="hr_recruitment:manage">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {stage !== 'hired' && stage !== 'offer_accepted' && (
                          <Button size="sm" variant="ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => advanceMutation.mutate(c.id)}>Next</Button>
                        )}
                        {stage === 'offer_accepted' && (
                          <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: 'var(--status-success)', color: '#fff' }} onClick={() => handleHire(c.id)}>Hire</Button>
                        )}
                        {stage !== 'hired' && (
                          <Button size="sm" variant="ghost" style={{ fontSize: 10, padding: '2px 8px', color: 'var(--status-error)' }} onClick={() => handleReject(c.id)}>Reject</Button>
                        )}
                      </div>
                    </HasPermission>
                  </div>
                ))}
                {col.candidates.length === 0 && (
                  <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)', border: '1px dashed var(--card-border)', borderRadius: 6 }}>Empty</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RecruitmentPage() {
  const qc = useQueryClient()
  const [selectedReq, setSelectedReq] = useState<JobRequisition | null>(null)
  const [statusFilter, setStatusFilter] = useState('open')

  const { data: requisitions = [] } = useQuery({
    queryKey: ['requisitions', statusFilter],
    queryFn: () => hrRecruitmentApi.getRequisitions(statusFilter !== 'all' ? { status: statusFilter } : {}).then(r => r.data),
  })
  const { data: pipeline } = useQuery({
    queryKey: ['pipeline', selectedReq?.id],
    queryFn: () => hrRecruitmentApi.getPipeline(selectedReq!.id).then(r => r.data),
    enabled: !!selectedReq,
  })

  const openMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.openRequisition(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requisitions'] }); toast('Requisition opened', 'success') },
  })

  const totalOpen = requisitions.filter(r => r.status === 'open').length
  const totalApplicants = requisitions.reduce((s, r) => s + r.candidates_count, 0)
  const totalActive = requisitions.reduce((s, r) => s + r.active_candidates_count, 0)

  return (
    <MainLayout>
    <div style={{ maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--card-border)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Recruitment</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>Job requisitions and candidate pipeline management</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        <StatCard icon={<BriefcaseIcon className="w-5 h-5" />} label="Open Positions" value={totalOpen} color="var(--status-success)" />
        <StatCard icon={<UsersIcon className="w-5 h-5" />} label="Total Applicants" value={totalApplicants} color="var(--brand)" />
        <StatCard icon={<UserIcon className="w-5 h-5" />} label="Active in Pipeline" value={totalActive} color="var(--status-warning)" />
      </div>

      <Tabs defaultValue="requisitions">
        <TabsList>
          <TabsTrigger value="requisitions">Requisitions</TabsTrigger>
          <TabsTrigger value="pipeline" onClick={() => !selectedReq && requisitions[0] && setSelectedReq(requisitions[0])}>
            Pipeline {selectedReq ? `— ${selectedReq.title}` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="requisitions">
          <div style={{ display: 'flex', gap: 8, marginTop: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            {['all', 'draft', 'open', 'on_hold', 'filled', 'cancelled'].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--card-border)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: statusFilter === s ? 700 : 400, background: statusFilter === s ? 'var(--brand)' : 'transparent', color: statusFilter === s ? '#fff' : 'var(--text-primary)' }}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
            {requisitions.map(req => (
              <div key={req.id}>
                <RequisitionCard req={req} onClick={() => setSelectedReq(req)} />
                {req.status === 'draft' && (
                  <HasPermission permission="hr_recruitment:manage">
                    <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                      <Button size="sm" variant="ghost" style={{ fontSize: 12, color: 'var(--status-success)' }} onClick={() => openMutation.mutate(req.id)}>Open Position</Button>
                    </div>
                  </HasPermission>
                )}
              </div>
            ))}
            {requisitions.length === 0 && <p style={{ color: 'var(--text-tertiary)', gridColumn: '1/-1', padding: 32 }}>No requisitions found.</p>}
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          {selectedReq && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <select value={selectedReq.id} onChange={e => setSelectedReq(requisitions.find(r => r.id === +e.target.value) || null)}
                  style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--card-border)', borderRadius: 4 }}>
                  {requisitions.filter(r => r.status === 'open').map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                <Badge style={{ background: REQ_STATUS_COLORS[selectedReq.status], color: '#fff', fontSize: 11 }}>{selectedReq.status_display}</Badge>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{selectedReq.active_candidates_count} active candidates</span>
              </div>
              {pipeline && <KanbanBoard pipeline={pipeline} />}
            </div>
          )}
          {!selectedReq && <p style={{ marginTop: 'var(--space-4)', color: 'var(--text-tertiary)' }}>Select a requisition to view pipeline.</p>}
        </TabsContent>
      </Tabs>
    </div>
    </MainLayout>
  )
}
