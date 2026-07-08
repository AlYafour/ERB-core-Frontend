'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrDocumentTemplatesApi, hrGeneratedDocsApi, DocumentTemplate, GeneratedDocument } from '@/lib/api/hr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { BaseModal } from '@/components/ui/base/BaseModal'
import { confirm, toast } from '@/lib/hooks/use-toast'
import HasPermission from '@/components/shared/HasPermission'

const TYPE_ICONS: Record<string, string> = {
  salary_certificate: '💰', experience_certificate: '🎓', noc: '📄',
  offer_letter: '📧', joining_letter: '🤝', warning_letter: '⚠️',
  termination_letter: '🚪', custom: '📋',
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#f59e0b', final: '#22c55e', sent: '#3b82f6', voided: '#ef4444',
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
    <div style={{ padding: 'var(--space-6)', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text-primary)' }}>HR Documents</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 'var(--text-sm)' }}>
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
              <div key={t.id} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 28 }}>{TYPE_ICONS[t.template_type] || '📋'}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{t.template_type_display}</div>
                  </div>
                  {t.is_default && <Badge style={{ marginLeft: 'auto', background: '#22c55e', color: '#fff', fontSize: 10 }}>Default</Badge>}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', marginBottom: 12 }}>{t.variables_count} variables</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Button size="sm" variant="ghost" onClick={() => handlePreview(t)}>Preview</Button>
                  <HasPermission permission="hr_documents:manage">
                    <Button size="sm" variant="ghost" onClick={() => setEditTemplate(t)}>Edit</Button>
                  </HasPermission>
                </div>
              </div>
            ))}
            {templates.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', gridColumn: '1/-1', padding: 24 }}>No templates yet. Create one to get started.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="generated">
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, overflowX: 'auto', marginTop: 'var(--space-4)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-surface-hover)' }}>
                  {['Reference', 'Employee', 'Type', 'Status', 'Generated', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {generated.map((doc, i) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--color-border)', background: i % 2 ? 'var(--color-surface-hover)' : 'transparent' }}>
                    <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: 12 }}>{doc.reference_number}</td>
                    <td style={{ padding: '10px 16px' }}>{doc.employee_name}</td>
                    <td style={{ padding: '10px 16px' }}><span style={{ fontSize: 14 }}>{TYPE_ICONS[doc.template_type]}</span> {doc.template_type_display}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <Badge style={{ background: STATUS_COLORS[doc.status] || '#6b7280', color: '#fff', fontSize: 11 }}>{doc.status_display}</Badge>
                    </td>
                    <td style={{ padding: '10px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{new Date(doc.generated_at).toLocaleDateString()}</td>
                    <td style={{ padding: '10px 16px', display: 'flex', gap: 6 }}>
                      {doc.pdf_url && <Button size="sm" variant="ghost" onClick={() => window.open(doc.pdf_url!, '_blank')}>PDF</Button>}
                      {doc.status !== 'voided' && (
                        <HasPermission permission="hr_documents:manage">
                          <Button size="sm" variant="ghost" style={{ color: '#ef4444' }} onClick={() => handleVoid(doc)}>Void</Button>
                        </HasPermission>
                      )}
                    </td>
                  </tr>
                ))}
                {generated.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)' }}>No documents generated yet.</td></tr>}
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
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>Type</label>
              <select value={editTemplate.template_type || ''} onChange={e => setEditTemplate(p => ({ ...p, template_type: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 'var(--text-sm)' }}>
                <option value="">Select...</option>
                {TEMPLATE_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 500, marginBottom: 4 }}>HTML Content (Jinja2/Django templates)</label>
              <textarea value={editTemplate.html_content || ''} onChange={e => setEditTemplate(p => ({ ...p, html_content: e.target.value }))}
                rows={12} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 6, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
            </div>
          </div>
        </BaseModal>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <BaseModal isOpen title="Template Preview" onClose={() => setShowPreview(false)}>
          <div style={{ maxHeight: 600, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 6 }}>
            <iframe srcDoc={previewHtml} style={{ width: '100%', height: 580, border: 'none' }} title="preview" />
          </div>
        </BaseModal>
      )}
    </div>
  )
}
