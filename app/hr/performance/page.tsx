'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrPerformanceApi, PerformanceCycle, PerformanceReview } from '@/lib/api/hr'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import BaseModal from '@/components/shared/BaseModal'
import { useConfirm, toast } from '@/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b', active: '#3b82f6', review: '#8b5cf6', closed: '#6b7280',
}
const REVIEW_STATUS_COLORS: Record<string, string> = {
  pending_self: '#f59e0b', pending_manager: '#3b82f6', pending_hr: '#8b5cf6',
  acknowledged: '#22c55e', closed: '#6b7280',
}
const RATING_STARS: Record<number, string> = { 1: '⭐', 2: '⭐⭐', 3: '⭐⭐⭐', 4: '⭐⭐⭐⭐', 5: '⭐⭐⭐⭐⭐' }

function ProgressRing({ pct }: { pct: number }) {
  const r = 20, c = 2 * Math.PI * r
  return (
    <svg width={50} height={50}>
      <circle cx={25} cy={25} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle cx={25} cy={25} r={r} fill="none" stroke={pct === 100 ? '#22c55e' : '#3b82f6'} strokeWidth={4}
        strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} strokeLinecap="round"
        transform="rotate(-90 25 25)" />
      <text x={25} y={29} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--color-text-primary)">{pct}%</text>
    </svg>
  )
}

export default function PerformancePage() {
  const qc = useQueryClient()
  const confirm = useConfirm()
  const [selectedCycle, setSelectedCycle] = useState<PerformanceCycle | null>(null)
  const [selfModal, setSelfModal] = useState<PerformanceReview | null>(null)
  const [managerModal, setManagerModal] = useState<PerformanceReview | null>(null)
  const [selfRating, setSelfRating] = useState(3)
  const [selfComments, setSelfComments] = useState('')
  const [managerRating, setManagerRating] = useState(3)
  const [managerComments, setManagerComments] = useState('')

  const { data: cycles = [] } = useQuery({
    queryKey: ['perf-cycles'],
    queryFn: () => hrPerformanceApi.getCycles().then(r => r.data),
  })
  const { data: reviews = [] } = useQuery({
    queryKey: ['perf-reviews', selectedCycle?.id],
    queryFn: () => hrPerformanceApi.getReviews(selectedCycle ? { cycle: String(selectedCycle.id) } : {}).then(r => r.data),
    enabled: !!selectedCycle,
  })

  const activateMutation = useMutation({
    mutationFn: (id: number) => hrPerformanceApi.activateCycle(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-cycles'] }); toast({ title: 'Cycle activated' }) },
  })
  const generateMutation = useMutation({
    mutationFn: (id: number) => hrPerformanceApi.generateReviews(id),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: ['perf-reviews'] }); toast({ title: `${r.data.created} review(s) created` }) },
  })
  const selfMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { self_rating: number; self_comments: string } }) =>
      hrPerformanceApi.submitSelf(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-reviews'] }); setSelfModal(null); toast({ title: 'Self evaluation submitted' }) },
  })
  const managerMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { manager_rating: number; manager_comments: string } }) =>
      hrPerformanceApi.submitManager(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-reviews'] }); setManagerModal(null); toast({ title: 'Manager evaluation submitted' }) },
  })
  const acknowledgeMutation = useMutation({
    mutationFn: (id: number) => hrPerformanceApi.acknowledge(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['perf-reviews'] }); toast({ title: 'Review acknowledged' }) },
  })

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>Performance Management</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>Review cycles, evaluations, and goal tracking</p>
        </div>
      </div>

      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="reviews" onClick={() => !selectedCycle && cycles[0] && setSelectedCycle(cycles[0])}>Reviews</TabsTrigger>
        </TabsList>

        {/* Cycles */}
        <TabsContent value="cycles">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {cycles.map(c => (
              <div key={c.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{c.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>{c.cycle_type_display} · {c.start_date} → {c.end_date}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <Badge style={{ background: STATUS_COLORS[c.status], color: '#fff', fontSize: 11 }}>{c.status_display}</Badge>
                    <ProgressRing pct={c.completion_pct} />
                  </div>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>
                  {c.reviews_count} reviews · Self deadline: {c.self_eval_deadline}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="outline" onClick={() => setSelectedCycle(c)}>View Reviews</Button>
                  <HasPermission permission="hr_performance:manage">
                    {c.status === 'draft' && <Button size="sm" variant="outline" style={{ color: '#22c55e' }} onClick={() => activateMutation.mutate(c.id)}>Activate</Button>}
                    {c.status === 'active' && <Button size="sm" variant="outline" onClick={() => generateMutation.mutate(c.id)}>Generate Reviews</Button>}
                  </HasPermission>
                </div>
              </div>
            ))}
            {cycles.length === 0 && <p style={{ color: 'var(--color-text-muted)', gridColumn: '1/-1', padding: 32 }}>No performance cycles yet.</p>}
          </div>
        </TabsContent>

        {/* Reviews */}
        <TabsContent value="reviews">
          {selectedCycle && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <strong>{selectedCycle.name}</strong>
                <select value={selectedCycle.id} onChange={e => setSelectedCycle(cycles.find(c => c.id === +e.target.value) || null)}
                  style={{ fontSize: 12, padding: '4px 8px', border: '1px solid var(--color-border)', borderRadius: 4 }}>
                  {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-hover)' }}>
                      {['Employee', 'Manager', 'Status', 'Self', 'Manager', 'Final', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reviews.map((rv, i) => (
                      <tr key={rv.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 ? 'var(--color-surface-hover)' : 'transparent' }}>
                        <td style={{ padding: '10px 16px', fontWeight: 500 }}>{rv.employee_name}</td>
                        <td style={{ padding: '10px 16px', color: 'var(--color-text-secondary)' }}>{rv.manager_name || '—'}</td>
                        <td style={{ padding: '10px 16px' }}>
                          <Badge style={{ background: REVIEW_STATUS_COLORS[rv.status] || '#6b7280', color: '#fff', fontSize: 10 }}>{rv.status_display}</Badge>
                        </td>
                        <td style={{ padding: '10px 16px' }}>{rv.self_rating ? RATING_STARS[rv.self_rating] : '—'}</td>
                        <td style={{ padding: '10px 16px' }}>{rv.manager_rating ? RATING_STARS[rv.manager_rating] : '—'}</td>
                        <td style={{ padding: '10px 16px', fontWeight: 700 }}>{rv.final_rating ? RATING_STARS[rv.final_rating] : '—'}</td>
                        <td style={{ padding: '10px 16px', display: 'flex', gap: 4 }}>
                          {rv.status === 'pending_self' && (
                            <HasPermission permission="hr_performance:self_evaluate">
                              <Button size="sm" variant="outline" onClick={() => { setSelfModal(rv); setSelfRating(3); setSelfComments('') }}>Self Eval</Button>
                            </HasPermission>
                          )}
                          {rv.status === 'pending_manager' && (
                            <HasPermission permission="hr_performance:manage">
                              <Button size="sm" variant="outline" onClick={() => { setManagerModal(rv); setManagerRating(3); setManagerComments('') }}>Review</Button>
                            </HasPermission>
                          )}
                          {rv.final_rating && rv.status !== 'acknowledged' && (
                            <HasPermission permission="hr_performance:self_evaluate">
                              <Button size="sm" variant="outline" style={{ color: '#22c55e' }} onClick={() => acknowledgeMutation.mutate(rv.id)}>Acknowledge</Button>
                            </HasPermission>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reviews.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No reviews. Generate reviews from the cycle.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Self Eval Modal */}
      {selfModal && (
        <BaseModal open title={`Self Evaluation — ${selfModal.employee_name}`} onClose={() => setSelfModal(null)}
          footer={<Button onClick={() => selfMutation.mutate({ id: selfModal.id, data: { self_rating: selfRating, self_comments: selfComments } })} disabled={selfMutation.isPending}>Submit</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 8 }}>Rating</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setSelfRating(r)} style={{ padding: '6px 14px', borderRadius: 6, border: `2px solid ${selfRating === r ? '#3b82f6' : 'var(--color-border)'}`, background: selfRating === r ? '#eff6ff' : 'transparent', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: selfRating === r ? 700 : 400 }}>
                    {r} {RATING_STARS[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Comments</label>
              <textarea value={selfComments} onChange={e => setSelfComments(e.target.value)} rows={4}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, resize: 'vertical' }} />
            </div>
          </div>
        </BaseModal>
      )}

      {/* Manager Eval Modal */}
      {managerModal && (
        <BaseModal open title={`Manager Evaluation — ${managerModal.employee_name}`} onClose={() => setManagerModal(null)}
          footer={<Button onClick={() => managerMutation.mutate({ id: managerModal.id, data: { manager_rating: managerRating, manager_comments: managerComments } })} disabled={managerMutation.isPending}>Submit</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 8 }}>Rating</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1,2,3,4,5].map(r => (
                  <button key={r} onClick={() => setManagerRating(r)} style={{ padding: '6px 14px', borderRadius: 6, border: `2px solid ${managerRating === r ? '#3b82f6' : 'var(--color-border)'}`, background: managerRating === r ? '#eff6ff' : 'transparent', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: managerRating === r ? 700 : 400 }}>
                    {r} {RATING_STARS[r]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Comments</label>
              <textarea value={managerComments} onChange={e => setManagerComments(e.target.value)} rows={4}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, resize: 'vertical' }} />
            </div>
          </div>
        </BaseModal>
      )}
    </div>
  )
}
