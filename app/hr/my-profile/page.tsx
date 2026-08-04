'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrProfileChangesApi, hrEmployeesApi, type ProfileChangeRequest } from '@/lib/api/hr';
import { useMyEmployeeRecord } from '@/lib/hooks/use-my-employee-record';
import { toast } from '@/lib/hooks/use-toast';
import { getApiError } from '@/lib/utils/error';
import { Button, Badge, PageShell, PageHeader, Loader } from '@/components/ui';
import SearchableDropdown, { type DropdownOption } from '@/components/ui/SearchableDropdown';
import SecuritySettings from '@/components/users/SecuritySettings';
import { NATIONALITY_OPTS, HOME_COUNTRY_OPTS, RELIGION_OPTS, MARITAL_OPTS } from '@/lib/hr/lookups';

// Common fields an employee can request a change to. The backend is the source
// of truth for what is allowed; this only drives the picker + input type.
const REQUESTABLE_FIELDS: { field: string; label: string; options?: DropdownOption[] }[] = [
  { field: 'marital_status', label: 'Marital Status', options: MARITAL_OPTS },
  { field: 'nationality',    label: 'Nationality',    options: NATIONALITY_OPTS },
  { field: 'home_country',   label: 'Home Country',   options: HOME_COUNTRY_OPTS },
  { field: 'religion',       label: 'Religion',       options: RELIGION_OPTS },
  { field: 'address',        label: 'Address' },
];

const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
};
const card: React.CSSProperties = { background: 'var(--card-bg)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', boxShadow: 'var(--shadow-xs)' };

export default function MyProfilePage() {
  const qc = useQueryClient();
  const { emp, isLoading } = useMyEmployeeRecord();

  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  useEffect(() => {
    if (emp) { setEmail(emp.personal_email ?? ''); setMobile(emp.mobile_number ?? ''); }
  }, [emp]);

  const saveSelf = useMutation({
    mutationFn: () => hrProfileChangesApi.updateSelf({ personal_email: email, mobile_number: mobile }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-employee-record'] }); toast('Contact details updated', 'success'); },
    onError: (e) => toast(getApiError(e, 'Failed to update'), 'error'),
  });

  // Request-a-change form
  const [field, setField] = useState(REQUESTABLE_FIELDS[0].field);
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const activeField = REQUESTABLE_FIELDS.find(f => f.field === field)!;

  const submitRequest = useMutation({
    mutationFn: () => hrProfileChangesApi.create({ requested_changes: { [field]: newValue }, reason }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile-changes'] }); toast('Change request submitted for approval', 'success'); setNewValue(''); setReason(''); },
    onError: (e) => toast(getApiError(e, 'Failed to submit request'), 'error'),
  });

  const { data: myRequests } = useQuery({
    queryKey: ['my-profile-changes'],
    queryFn: () => hrProfileChangesApi.getAll({ page_size: 50 }),
  });

  // Documents uploaded by HR/admin to this employee's profile appear here.
  const { data: myDocuments } = useQuery({
    queryKey: ['my-documents', emp?.id],
    queryFn: () => hrEmployeesApi.getDocuments(emp!.id),
    enabled: !!emp?.id,
  });

  const cancelReq = useMutation({
    mutationFn: (id: number) => hrProfileChangesApi.cancel(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-profile-changes'] }); toast('Request cancelled', 'info'); },
    onError: (e) => toast(getApiError(e, 'Failed to cancel'), 'error'),
  });

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (!emp) return <MainLayout><div className="card empty-state"><p style={{ margin: 0 }}>No employee record is linked to your account.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader title="My Profile" description={`${emp.full_name} · ${emp.employee_id}`} breadcrumbs={[{ label: 'HR' }, { label: 'My Profile' }]} />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
          {/* Self-service editable */}
          <div style={{ ...card, flex: '1 1 340px' }}>
            <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>Contact details (you can edit these)</h3>
            <div className="form-field"><label className="form-label">Personal Email</label>
              <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /></div>
            <div className="form-field" style={{ marginTop: 'var(--space-3)' }}><label className="form-label">Mobile Number</label>
              <input className="form-input" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="05x xxx xxxx" /></div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="primary" size="sm" isLoading={saveSelf.isPending} onClick={() => saveSelf.mutate()}>Save contact details</Button>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-3) 0 0' }}>
              Your password, two-factor authentication and biometric login are in the Account Security section below.
            </p>
          </div>

          {/* Request a change (approval required) */}
          <div style={{ ...card, flex: '1 1 340px' }}>
            <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>Request a change (needs approval)</h3>
            <div className="form-field"><label className="form-label">Field</label>
              <select className="form-select" value={field} onChange={e => { setField(e.target.value); setNewValue(''); }}>
                {REQUESTABLE_FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ marginTop: 'var(--space-3)' }}><label className="form-label">New value</label>
              {activeField.options
                ? <SearchableDropdown options={activeField.options} value={newValue || null} onChange={v => setNewValue(String(v ?? ''))} allowClear placeholder="Select…" />
                : <input className="form-input" value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="New value" />}
            </div>
            <div className="form-field" style={{ marginTop: 'var(--space-3)' }}><label className="form-label">Reason</label>
              <textarea className="form-textarea" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this change needed?" /></div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="primary" size="sm" disabled={!newValue.trim()} isLoading={submitRequest.isPending} onClick={() => submitRequest.mutate()}>Submit request</Button>
            </div>
          </div>
        </div>

        {/* My documents (uploaded by HR/admin) */}
        <div style={{ ...card, marginTop: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>My documents</h3>
          {(myDocuments?.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No documents have been added to your profile.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {myDocuments!.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)' }}>{doc.title}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                      {doc.document_type || '—'}
                      {doc.expiry_date ? ` · expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : ''}
                      {doc.is_expired ? ' · EXPIRED' : ''}
                    </div>
                  </div>
                  {doc.file_url && (
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm">View</Button>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My requests */}
        <div style={{ ...card, marginTop: 'var(--space-4)' }}>
          <h3 style={{ margin: '0 0 var(--space-4)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>My change requests</h3>
          {(myRequests?.results?.length ?? 0) === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>No change requests yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {myRequests!.results.map((r: ProfileChangeRequest) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', padding: 'var(--space-3)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: 'var(--text-xs)' }}>
                    {Object.entries(r.requested_changes).map(([f, v]) => (
                      <span key={f}>{f.replace(/_/g, ' ')}: <b>{String(v)}</b> </span>
                    ))}
                    {r.review_note && <span style={{ color: 'var(--status-error)' }}> · {r.review_note}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status.toUpperCase()}</Badge>
                    {r.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => cancelReq.mutate(r.id)}>Cancel</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account security — password, 2FA, biometric login (self-service) */}
        <div style={{ marginTop: 'var(--space-5)' }}>
          <h3 style={{ margin: '0 0 var(--space-3)', fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>Account Security</h3>
          <SecuritySettings />
        </div>
      </PageShell>
    </MainLayout>
  );
}
