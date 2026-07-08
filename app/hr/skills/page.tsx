'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrSkillsApi, hrTrainingApi, Skill, TrainingRecord } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'
import { BriefcaseIcon } from '@/components/icons'

const LEVEL_COLORS: Record<number, string> = { 1: 'var(--text-tertiary)', 2: 'var(--brand)', 3: 'var(--status-success)', 4: 'var(--status-warning)' }
const LEVEL_LABELS: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Expert' }

export default function SkillsPage() {
  const qc = useQueryClient()
  const { data: skills = [] } = useQuery({ queryKey: ['skills'], queryFn: () => hrSkillsApi.getAll().then(r => r.data) })
  const { data: training = [] } = useQuery({ queryKey: ['training'], queryFn: () => hrTrainingApi.getAll().then(r => r.data) })

  const byCategory = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category_name || 'Uncategorised'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(s)
    return acc
  }, {})

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', paddingBottom: 'var(--space-4)', borderBottom: '1px solid var(--card-border)' }}>
        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Skills &amp; Training</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: '4px 0 0' }}>Skills library and employee training records</p>
      </div>

      <Tabs defaultValue="skills">
        <TabsList>
          <TabsTrigger value="skills">Skills Library ({skills.length})</TabsTrigger>
          <TabsTrigger value="training">Training Records ({training.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="skills">
          <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {Object.entries(byCategory).map(([cat, catSkills]) => (
              <div key={cat} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 12, borderLeft: '3px solid var(--brand)' }}>
                  <span style={{ color: 'var(--brand)', display: 'flex' }}><BriefcaseIcon className="w-4 h-4" /></span>
                  <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0, fontSize: 'var(--text-base)' }}>{cat}</h3>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginLeft: 4 }}>{catSkills.length} skills</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {catSkills.map(s => (
                    <div key={s.id} style={{ padding: '6px 12px', background: 'var(--surface-subtle)', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                      {s.name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {skills.length === 0 && <p style={{ color: 'var(--text-tertiary)', padding: 32 }}>No skills defined yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="training">
          <div style={{ marginTop: 'var(--space-4)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  {['Employee', 'Course', 'Provider', 'Dates', 'Cost', 'Skills', 'Certificate'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {training.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 ? 'var(--surface-subtle)' : 'transparent' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{t.employee_name}</td>
                    <td style={{ padding: '10px 16px' }}>{t.course_name}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{t.provider || '—'}</td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{t.start_date}{t.end_date ? ` → ${t.end_date}` : ''}</td>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{t.cost ? `${t.currency} ${parseFloat(t.cost).toLocaleString()}` : '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(t.skills_list ?? []).map(s => <Badge key={s.id} style={{ fontSize: 10, background: 'var(--status-warning-bg)', color: 'var(--brand)' }}>{s.name}</Badge>)}
                      </div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      {t.certificate_url ? <Button size="sm" variant="ghost" onClick={() => window.open(t.certificate_url!, '_blank')}>View</Button> : '—'}
                    </td>
                  </tr>
                ))}
                {training.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>No training records yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
