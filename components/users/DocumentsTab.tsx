'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hrEmployeesApi, EmployeeDocument } from '@/lib/api/hr';
import { Button, Badge } from '@/components/ui';
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

const DOC_TYPES = Object.entries(DOC_TYPE_LABELS);

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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

  const expiredDocs = docs?.filter((d) => d.is_expired) ?? [];
  const expiringSoon = docs?.filter((d) => !d.is_expired && d.expires_soon) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>

      {/* Alerts */}
      {expiredDocs.length > 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--status-error-bg)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)', fontSize: 'var(--text-sm)' }}>
          {expiredDocs.length} document{expiredDocs.length > 1 ? 's' : ''} expired: {expiredDocs.map((d) => d.title).join(', ')}
        </div>
      )}
      {expiringSoon.length > 0 && (
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--status-warning-bg)', border: '1px solid var(--status-warning)', borderRadius: 'var(--radius-md)', color: 'var(--status-warning)', fontSize: 'var(--text-sm)' }}>
          {expiringSoon.length} document{expiringSoon.length > 1 ? 's expire' : ' expires'} within 30 days
        </div>
      )}

      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showForm ? 'var(--space-4)' : 0 }}>
          <h3 style={{ margin: 0, fontSize: 'var(--text-base)', fontWeight: 'var(--weight-semibold)' }}>
            Documents {docs ? `(${docs.length})` : ''}
          </h3>
          {(isAdmin) && (
            <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Upload'}
            </Button>
          )}
        </div>

        {/* Upload form */}
        {showForm && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)', paddingTop: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <label className="form-label">Title *</label>
              <input className="form-input" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Document title" />
            </div>
            <div>
              <label className="form-label">Type</label>
              <select className="form-select" value={form.document_type} onChange={(e) => setForm((p) => ({ ...p, document_type: e.target.value }))}>
                {DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Expiry Date</label>
              <input type="date" className="form-input" value={form.expiry_date} onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">File</label>
              <input ref={fileRef} type="file" className="form-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes</label>
              <input className="form-input" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="primary" size="sm" onClick={handleUpload} isLoading={uploadMutation.isPending} disabled={uploadMutation.isPending}>Upload</Button>
              <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      <div className="card">
        {isLoading ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>Loading…</p>
        ) : !docs || docs.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>No documents uploaded yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  {['Title', 'Type', 'Expiry', 'Status', 'Uploaded By', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '8px 10px' }}>
                      {doc.file_url ? (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand)', fontWeight: 'var(--weight-medium)' }}>{doc.title}</a>
                      ) : (
                        <span style={{ fontWeight: 'var(--weight-medium)' }}>{doc.title}</span>
                      )}
                      {doc.notes && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>{doc.notes}</div>}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}</td>
                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(doc.expiry_date)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {doc.is_expired ? (
                        <Badge variant="error" size="sm">Expired</Badge>
                      ) : doc.expires_soon ? (
                        <Badge variant="warning" size="sm">Expires Soon</Badge>
                      ) : doc.expiry_date ? (
                        <Badge variant="success" size="sm">Valid</Badge>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{doc.created_by_name || '—'}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" style={{ color: 'var(--status-error)' }} onClick={() => handleDelete(doc)}>Delete</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
