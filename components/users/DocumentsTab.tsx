'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrEmployeesApi, EmployeeDocument } from '@/lib/api/hr';
import { Badge } from '@/components/ui';
import { toast } from '@/lib/hooks/use-toast';
import type { UserTabProps } from './types';

const DOC_TYPE_LABELS: Record<string, string> = {
  passport:    'Passport',
  visa:        'Visa / Residence Permit',
  emirates_id: 'Emirates ID',
  labour_card: 'Labour Card',
  contract:    'Employment Contract',
  certificate: 'Certificate / Qualification',
  medical:     'Medical Document',
  insurance:   'Insurance',
  other:       'Other',
};

const DOC_TYPE_COLOR: Record<string, string> = {
  passport:    '#6366f1',
  visa:        '#0ea5e9',
  emirates_id: '#10b981',
  labour_card: '#f59e0b',
  contract:    '#3b82f6',
  certificate: '#8b5cf6',
  medical:     '#ef4444',
  insurance:   '#14b8a6',
  other:       '#6b7280',
};

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 11, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: 'var(--text-secondary)', display: 'block', marginBottom: 5,
};

export default function DocumentsTab({ emp, isAdmin }: UserTabProps) {
  const empId: number | undefined = emp?.id;
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', document_type: 'other', expiry_date: '', notes: '' });
  const [file, setFile] = useState<File | null>(null);

  const { data: docs, isLoading } = useQuery<EmployeeDocument[]>({
    queryKey: ['emp-documents', empId],
    queryFn: () => hrEmployeesApi.getDocuments(empId!),
    enabled: !!empId,
    staleTime: 60_000,
  });

  const uploadMutation = useMutation({
    mutationFn: (fd: FormData) => hrEmployeesApi.uploadDocument(empId!, fd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emp-documents', empId] });
      toast('Document uploaded.', 'success');
      setShowForm(false);
      setForm({ title: '', document_type: 'other', expiry_date: '', notes: '' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: () => toast('Upload failed.', 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => hrEmployeesApi.deleteDocument(empId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emp-documents', empId] });
      toast('Document deleted.', 'info');
    },
    onError: () => toast('Delete failed.', 'error'),
  });

  const handleUpload = () => {
    if (!form.title.trim()) { toast('Title is required.', 'warning'); return; }
    const fd = new FormData();
    fd.append('title', form.title.trim());
    fd.append('document_type', form.document_type);
    if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
    if (form.notes) fd.append('notes', form.notes);
    if (file) fd.append('file', file);
    uploadMutation.mutate(fd);
  };

  const handleDelete = async (doc: EmployeeDocument) => {
    const { confirm } = await import('@/lib/hooks/use-toast');
    const ok = await confirm(`Delete "${doc.title}"?`);
    if (ok) deleteMutation.mutate(doc.id);
  };

  const expiredDocs   = docs?.filter((d) => d.is_expired) ?? [];
  const expiringSoon  = docs?.filter((d) => !d.is_expired && d.expires_soon) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* ── Alerts ── */}
      {expiredDocs.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          background: 'var(--status-error-bg)',
          border: '1px solid var(--status-error)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-error)',
          fontSize: 'var(--text-sm)', fontWeight: 500,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {expiredDocs.length} document{expiredDocs.length > 1 ? 's' : ''} expired: {expiredDocs.map((d) => d.title).join(', ')}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px',
          background: 'var(--status-warning-bg)',
          border: '1px solid var(--status-warning)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-warning)',
          fontSize: 'var(--text-sm)', fontWeight: 500,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          {expiringSoon.length} document{expiringSoon.length > 1 ? 's expire' : ' expires'} within 30 days
        </div>
      )}

      {/* ── Unified card ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px var(--space-5)',
          background: 'var(--surface-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)' }}>
              Documents
            </p>
            {docs && docs.length > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                background: 'var(--border-subtle)', padding: '2px 7px', borderRadius: 99,
              }}>
                {docs.length}
              </span>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm(!showForm)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 'var(--radius-md)',
                border: showForm ? '1px solid var(--border-default)' : 'none',
                background: showForm ? 'none' : 'var(--brand)',
                color: showForm ? 'var(--text-secondary)' : 'var(--primary-foreground)',
                cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
              }}
            >
              {showForm ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  Cancel
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Upload Document
                </>
              )}
            </button>
          )}
        </div>

        {/* Inline upload form */}
        {showForm && (
          <div style={{
            padding: 'var(--space-4) var(--space-5)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--surface-card)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 'var(--space-3)', alignItems: 'end' }}>
              <div>
                <label style={LABEL_STYLE}>Title *</label>
                <input
                  className="form-input"
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. John's Passport"
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Type</label>
                <select
                  className="form-select"
                  value={form.document_type}
                  onChange={(e) => setForm((p) => ({ ...p, document_type: e.target.value }))}
                >
                  {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Expiry Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={form.expiry_date}
                  onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
                />
              </div>
              <button
                onClick={handleUpload}
                disabled={uploadMutation.isPending}
                style={{
                  padding: '9px 20px', borderRadius: 'var(--radius-md)',
                  border: 'none', background: 'var(--brand)',
                  color: 'var(--primary-foreground)',
                  cursor: uploadMutation.isPending ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--text-sm)', fontWeight: 600,
                  opacity: uploadMutation.isPending ? 0.7 : 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {uploadMutation.isPending ? 'Uploading…' : 'Upload'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
              <div>
                <label style={LABEL_STYLE}>File</label>
                <input
                  ref={fileRef}
                  type="file"
                  className="form-input"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label style={LABEL_STYLE}>Notes</label>
                <input
                  className="form-input"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>
        )}

        {/* Document list */}
        {isLoading ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>Loading…</p>
          </div>
        ) : !docs || docs.length === 0 ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" style={{ marginBottom: 8, opacity: 0.5 }}>
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>No documents uploaded yet.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--surface-subtle)' }}>
                {['Title', 'Type', 'Expiry', 'Status', 'Uploaded By', ''].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '8px 16px',
                    color: 'var(--text-tertiary)', fontSize: 11,
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                    whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr
                  key={doc.id}
                  style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--table-row-hover)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: DOC_TYPE_COLOR[doc.document_type] ?? '#6b7280',
                      }} />
                      <div>
                        {doc.file_url ? (
                          <a
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            {doc.title}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{doc.title}</span>
                        )}
                        {doc.notes && (
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>{doc.notes}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                  </td>
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontFamily: 'ui-monospace, monospace', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {fmtDate(doc.expiry_date)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {doc.is_expired ? (
                      <Badge variant="error" size="sm">Expired</Badge>
                    ) : doc.expires_soon ? (
                      <Badge variant="warning" size="sm">Expires Soon</Badge>
                    ) : doc.expiry_date ? (
                      <Badge variant="success" size="sm">Valid</Badge>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {doc.created_by_name || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(doc)}
                        style={{
                          padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          background: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 600,
                          color: 'var(--status-error)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--status-error-bg)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
