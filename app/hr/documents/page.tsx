'use client'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrDocumentTemplatesApi, hrGeneratedDocsApi, DocumentTemplate, GeneratedDocument } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BaseModal } from '@/components/ui/base/BaseModal'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'
import HRSettingsNav from '@/components/hr/HRSettingsNav'

const TYPE_ICONS: Record<string, string> = {
  salary_certificate: '💰', experience_certificate: '🎓', noc: '📄',
  offer_letter: '📧', joining_letter: '🤝', warning_letter: '⚠️',
  termination_letter: '🚪', custom: '📋',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'var(--status-warning)', final: 'var(--status-success)', sent: 'var(--brand)', voided: 'var(--status-error)',
}

export default function DocumentsPage() {
  const qc = useQueryClient()
const [editTemplate, setEditTemplate] = useState<Partial<DocumentTemplate> | null>(null)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const { data: templates = [] } = useQuery({
    queryKey: ['doc-templates'],
    queryFn: () => hrDocumentTemplatesApi.getAll().then(r => r.data),
  })
  const { data: generated = [] } = useQuery({
    queryKey: ['doc-generated'],
    queryFn: () => hrGeneratedDocsApi.getAll().then(r => r.data),
  })

  // ── Generated-docs search / filters / sort ──────────────────────────────────
  const [genSearch, setGenSearch] = useState('')
  const [genType, setGenType]     = useState('')
  const [genStatus, setGenStatus] = useState('')
  const [genFrom, setGenFrom]     = useState('')
  const [genTo, setGenTo]         = useState('')
  const [genSort, setGenSort]     = useState<'newest' | 'oldest'>('newest')

  const genTypeOptions = useMemo(() => {
    const seen = new Map<string, string>()
    generated.forEach(d => { if (d.template_type) seen.set(d.template_type, d.template_type_display || d.template_type) })
    return Array.from(seen.entries())
  }, [generated])

  const filteredGen = useMemo(() => {
    let list = generated
    const q = genSearch.trim().toLowerCase()
    if (q) list = list.filter(d => (d.employee_name || '').toLowerCase().includes(q) || (d.reference_number || '').toLowerCase().includes(q))
    if (genType) list = list.filter(d => d.template_type === genType)
    if (genStatus) list = list.filter(d => d.status === genStatus)
    if (genFrom) list = list.filter(d => d.generated_at >= genFrom)
    if (genTo) list = list.filter(d => d.generated_at <= genTo + 'T23:59:59')
    return [...list].sort((a, b) => genSort === 'newest'
      ? +new Date(b.generated_at) - +new Date(a.generated_at)
      : +new Date(a.generated_at) - +new Date(b.generated_at))
  }, [generated, genSearch, genType, genStatus, genFrom, genTo, genSort])

  const saveMutation = useMutation({
    mutationFn: (data: Partial<DocumentTemplate>) =>
      data.id ? hrDocumentTemplatesApi.update(data.id, data) : hrDocumentTemplatesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doc-templates'] }); setEditTemplate(null); toast('Template saved', 'success') },
  })
  const voidMutation = useMutation({
    mutationFn: (id: number) => hrGeneratedDocsApi.void(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doc-generated'] }); toast('Document voided', 'success') },
  })

  async function handlePreview(t: DocumentTemplate) {
    const r = await hrDocumentTemplatesApi.preview(t.id, {
      employee_name: 'Sample Employee', company_name: 'Company Name',
      job_title: 'Engineer', department: 'Engineering', basic_salary: '10,000.00',
      total_salary: '13,500.00', reference_number: 'PREV-2026', issue_date: new Date().toLocaleDateString(),
    })
    setPreviewHtml(r.data.html)
    setShowPreview(true)
  }

  async function handleVoid(doc: GeneratedDocument) {
    const ok = await confirm('Void document?')
    if (ok) voidMutation.mutate(doc.id)
  }

  const TEMPLATE_TYPE_OPTIONS = [
    'salary_certificate', 'experience_certificate', 'noc', 'offer_letter',
    'joining_letter', 'warning_letter', 'termination_letter', 'custom',
  ]

  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto', display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
      <HRSettingsNav />
      <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>HR Documents</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
            Document templates and generated records
          </p>
        </div>
        <HasPermission permission="hr_documents:manage">
          <Button onClick={() => setEditTemplate({ is_active: true, is_default: false, variables: [] })}>+ New Template</Button>
        </HasPermission>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="generated">Generated ({generated.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
            {templates.map(t => (
              <div key={t.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{TYPE_ICONS[t.template_type] || '📋'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>{t.template_type_display}</div>
                  </div>
                  {t.is_default && <Badge style={{ marginLeft: 'auto', background: 'var(--status-success)', color: '#fff', fontSize: 10 }}>Default</Badge>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 12 }}>{t.variables_count} variables</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="ghost" onClick={() => handlePreview(t)}>Preview</Button>
                  <HasPermission permission="hr_documents:manage">
                    <Button size="sm" variant="ghost" onClick={() => setEditTemplate(t)}>Edit</Button>
                  </HasPermission>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p style={{ color: 'var(--text-tertiary)', gridColumn: '1/-1', padding: 24 }}>No templates yet. Create one to get started.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="generated">
          {/* Search / filters / sort */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'flex-end', marginTop: 'var(--space-4)' }}>
            <input className="form-input" style={{ flex: '1 1 200px', minWidth: 180 }} placeholder="Search employee or reference…" value={genSearch} onChange={e => setGenSearch(e.target.value)} />
            <select className="form-select" style={{ width: 160 }} value={genType} onChange={e => setGenType(e.target.value)}>
              <option value="">All types</option>
              {genTypeOptions.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <select className="form-select" style={{ width: 140 }} value={genStatus} onChange={e => setGenStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="draft">Draft</option><option value="final">Final</option>
              <option value="sent">Sent</option><option value="voided">Voided</option>
            </select>
            <div><label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>From</label>
              <input className="form-input" type="date" style={{ width: 150 }} value={genFrom} onChange={e => setGenFrom(e.target.value)} /></div>
            <div><label style={{ display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)' }}>To</label>
              <input className="form-input" type="date" style={{ width: 150 }} value={genTo} onChange={e => setGenTo(e.target.value)} /></div>
            <select className="form-select" style={{ width: 130 }} value={genSort} onChange={e => setGenSort(e.target.value as 'newest' | 'oldest')}>
              <option value="newest">Newest first</option><option value="oldest">Oldest first</option>
            </select>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 8, overflowX: 'auto', marginTop: 'var(--space-3)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--surface-subtle)' }}>
                  {['Reference', 'Employee', 'Type', 'Status', 'Generated', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--card-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGen.map((doc, i) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--card-border)', background: i % 2 ? 'var(--surface-subtle)' : 'transparent' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{doc.reference_number}</td>
                    <td style={{ padding: '10px 16px' }}>{doc.employee_name}</td>
                    <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 14 }}>{TYPE_ICONS[doc.template_type]}</span> {doc.template_type_display}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge style={{ background: STATUS_COLORS[doc.status] || 'var(--text-secondary)', color: '#fff', fontSize: 11 }}>{doc.status_display}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{new Date(doc.generated_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                      {doc.pdf_url && <Button size="sm" variant="ghost" onClick={() => window.open(doc.pdf_url!, '_blank')}>PDF</Button>}
                      {doc.status !== 'voided' && (
                        <HasPermission permission="hr_documents:manage">
                          <Button size="sm" variant="ghost" style={{ color: 'var(--status-error)' }} onClick={() => handleVoid(doc)}>Void</Button>
                        </HasPermission>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredGen.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>{generated.length === 0 ? 'No documents generated yet.' : 'No documents match your filters.'}</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Template Edit Modal */}
      {editTemplate !== null && (
        <BaseModal isOpen title={editTemplate.id ? 'Edit Template' : 'New Template'} onClose={() => setEditTemplate(null)}
          footer={<Button onClick={() => saveMutation.mutate(editTemplate)} disabled={saveMutation.isPending}>Save</Button>}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Name</label>
              <input value={editTemplate.name || ''} onChange={e => setEditTemplate(p => ({ ...p, name: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Type</label>
              <select value={editTemplate.template_type || ''} onChange={e => setEditTemplate(p => ({ ...p, template_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }}>
                <option value="">Select...</option>
                {TEMPLATE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>HTML Content (Jinja2/Django templates)</label>
              <textarea value={editTemplate.html_content || ''} onChange={e => setEditTemplate(p => ({ ...p, html_content: e.target.value }))}
                rows={12} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
          </div>
        </BaseModal>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <BaseModal isOpen title="Template Preview" onClose={() => setShowPreview(false)}>
          <div style={{ maxHeight: 600, overflowY: 'auto', border: '1px solid var(--card-border)', borderRadius: 6 }}>
            <iframe srcDoc={previewHtml} style={{ width: '100%', height: 580, border: 'none' }} title="preview" />
          </div>
        </BaseModal>
      )}
      </div>
    </div>
  )
}
