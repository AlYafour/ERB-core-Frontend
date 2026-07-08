'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrRecruitmentApi, JobRequisition, RequisitionPipeline } from '@/lib/api/hr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import HasPermission from '@/components/shared/HasPermission'
import { useConfirm, toast } from '@/hooks/use-toast'

const REQ_STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', open: '#22c55e', on_hold: '#f59e0b', filled: '#3b82f6', cancelled: '#ef4444',
}
const CAND_STATUS_COLORS: Record<string, string> = {
  applied: '#94a3b8', screening: '#f59e0b', interview: '#3b82f6',
  offer_sent: '#8b5cf6', offer_accepted: '#22c55e', offer_declined: '#ef4444',
  hired: '#16a34a', rejected: '#dc2626', withdrawn: '#6b7280',
}

const PIPELINE_STAGES = ['applied', 'screening', 'interview', 'offer_sent', 'offer_accepted', 'hired']

function RequisitionCard({ req, onClick }: { req: JobRequisition; onClick: () => void }) {
  return (
    <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-4)', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{req.title}</div>
        <Badge style={{ background: REQ_STATUS_COLORS[req.status], color: '#fff', fontSize: 11 }}>{req.status_display}</Badge>
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        {req.department_name || 'No department'} · {req.location || 'Remote/TBD'} · {req.contract_type_display}
      </div>
      <div style={{ display: 'flex', gap: 16, fontSize: 'var(--text-xs)' }}>
        <span>👥 {req.candidates_count} applicants</span>
        <span>🔥 {req.active_candidates_count} active</span>
        <span>🎯 {req.headcount} position{req.headcount > 1 ? 's' : ''}</span>
        {req.target_date && <span>📅 {req.target_date}</span>}
      </div>
      {(req.salary_min || req.salary_max) && (
        <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: '#22c55e', fontWeight: 600 }}>
          {req.currency} {req.salary_min ? Number(req.salary_min).toLocaleString() : '?'} — {req.salary_max ? Number(req.salary_max).toLocaleString() : '?'}
        </div>
      )}
    </div>
  )
}

function KanbanBoard({ pipeline }: { pipeline: RequisitionPipeline }) {
  const qc = useQueryClient()
  const confirm = useConfirm()

  const advanceMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.advanceCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast({ title: 'Candidate advanced' }) },
  })
  const rejectMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.rejectCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast({ title: 'Candidate rejected' }) },
  })
  const hireMutation = useMutation({
    mutationFn: (id: number) => hrRecruitmentApi.hireCandidate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['pipeline'] }); toast({ title: 'Candidate hired!' }) },
  })

  async function handleReject(id: number) {
    const ok = await confirm({ title: 'Reject candidate?', description: 'This will mark the candidate as rejected.' })
    if (ok) rejectMutation.mutate(id)
  }
  async function handleHire(id: number) {
    const ok = await confirm({ title: 'Confirm hire?', description: 'Candidate will be marked as hired.' })
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '6px 10px', background: CAND_STATUS_COLORS[stage] + '20', borderRadius: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 'var(--text-xs)', color: CAND_STATUS_COLORS[stage] }}>{col.label}</span>
                <span style={{ fontWeight: 700, fontSize: 'var(--text-xs)', color: CAND_STATUS_COLORS[stage], background: CAND_STATUS_COLORS[stage] + '30', borderRadius: 10, padding: '1px 7px' }}>{col.count}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.candidates.map(c => (
                  <div key={c.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8 }}>{c.source || 'Direct'}</div>
                    <HasPermission permission="hr_recruitment:manage">
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {stage !== 'hired' && stage !== 'offer_accepted' && (
                          <Button size="sm" variant="outline" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => advanceMutation.mutate(c.id)}>Next</Button>
                        )}
                        {stage === 'offer_accepted' && (
                          <Button size="sm" style={{ fontSize: 10, padding: '2px 8px', background: '#22c55e', color: '#fff' }} onClick={() => handleHire(c.id)}>Hire</Button>
                        )}
                        {stage !== 'hired' && (
                          <Button size="sm" variant="outline" style={{ fontSize: 10, padding: '2px 8px', color: '#ef4444' }} onClick={() => handleReject(c.id)}>Reject</Button>
                        )}
                      </div>
                    </HasPermission>
                  </div>
                ))}
                {col.candidates.length === 0 && (
                  <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', border: '1px dashed var(--color-border)', borderRadius: 6 }}>Empty</div>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['requisitions'] }); toast({ title: 'Requisition opened' }) },
  })

  const totalOpen = requisitions.filter(r => r.status === 'open').length
  const totalApplicants = requisitions.reduce((s, r) => s + r.candidates_count, 0)
  const totalActive = requisitions.reduce((s, r) => s + r.active_candidates_count, 0)

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1440, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Recruitment</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>Job requisitions and candidate pipeline management</p>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
        {[
          { label: 'Open Positions', value: totalOpen },
          { label: 'Total Applicants', value: totalApplicants },
          { label: 'Active in Pipeline', value: totalActive },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          </div>
        ))}
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
                style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--color-border)', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: statusFilter === s ? 700 : 400, background: statusFilter === s ? 'var(--color-primary)' : 'transparent', color: statusFilter === s ? '#fff' : 'var(--color-text-primary)' }}>
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
                      <Button size="sm" variant="outline" style={{ fontSize: 12, color: '#22c55e' }} onClick={() => openMutation.mutate(req.id)}>Open Position</Button>
                    </div>
                  </HasPermission>
                )}
              </div>
            ))}
            {requisitions.length === 0 && <p style={{ color: 'var(--color-text-muted)', gridColumn: '1/-1', padding: 32 }}>No requisitions found.</p>}
          </div>
        </TabsContent>

        <TabsContent value="pipeline">
          {selectedReq && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <select value={selectedReq.id} onChange={e => setSelectedReq(requisitions.find(r => r.id === +e.target.value) || null)}
                  style={{ fontSize: 12, padding: '6px 10px', border: '1px solid var(--color-border)', borderRadius: 4 }}>
                  {requisitions.filter(r => r.status === 'open').map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
                </select>
                <Badge style={{ background: REQ_STATUS_COLORS[selectedReq.status], color: '#fff', fontSize: 11 }}>{selectedReq.status_display}</Badge>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{selectedReq.active_candidates_count} active candidates</span>
              </div>
              {pipeline && <KanbanBoard pipeline={pipeline} />}
            </div>
          )}
          {!selectedReq && <p style={{ marginTop: 'var(--space-4)', color: 'var(--color-text-muted)' }}>Select a requisition to view pipeline.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
