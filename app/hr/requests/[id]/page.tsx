'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrRequestsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader, PageHeader, PageShell } from '@/components/ui';
import { useState } from 'react';

const STATUS_VARIANT: Record<string, string> = {
  pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
};

const typeLabels: Record<string, string> = {
  annual_leave: 'Annual Leave', sick_leave: 'Sick Leave',
  emergency_leave: 'Emergency Leave', unpaid_leave: 'Unpaid Leave',
  work_from_home: 'Work From Home', overtime: 'Overtime',
  advance_salary: 'Advance Salary', document_request: 'Document Request',
  other: 'Other',
};

export default function HRRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super_admin' || user?.is_staff || user?.is_superuser;
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const { data: req, isLoading, error } = useQuery({
    queryKey: ['hr-request', id],
    queryFn: () => hrRequestsApi.getById(Number(id)),
  });

  const approveMutation = useMutation({
    mutationFn: () => hrRequestsApi.approve(Number(id)),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-request', id] }); toast('Request approved', 'success'); },
    onError: () => toast('Failed to approve', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => hrRequestsApi.reject(Number(id), reason),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hr-request', id] }); toast('Request rejected', 'success'); setShowRejectInput(false); },
    onError: () => toast('Failed to reject', 'error'),
  });

  const handleApprove = async () => {
    const ok = await confirm('Approve this request?');
    if (ok) approveMutation.mutate();
  };

  if (isLoading) return <MainLayout><div className="card empty-state"><Loader /></div></MainLayout>;
  if (error || !req) return <MainLayout><div className="card empty-state"><p style={{ color: 'var(--color-error)', margin: 0 }}>Request not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <PageShell>
        <PageHeader
          title={typeLabels[req.request_type] || req.request_type}
          description={`#${req.id} — ${req.employee_name} (${req.employee_id_code})`}
          breadcrumbs={[{ label: 'HR' }, { label: 'Requests', href: '/hr/requests' }, { label: `#${req.id}` }]}
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Badge variant={(STATUS_VARIANT[req.status] as any) || 'default'}>{req.status.toUpperCase()}</Badge>
              {isAdmin && req.status === 'pending' && (
                <>
                  <Button variant="success" size="sm" onClick={handleApprove} isLoading={approveMutation.isPending}>Approve</Button>
                  <Button variant="destructive" size="sm" onClick={() => setShowRejectInput(!showRejectInput)}>Reject</Button>
                </>
              )}
            </div>
          }
        />

        <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{new Date(req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
            {[
              ['Employee', `${req.employee_name} (${req.employee_id_code})`],
              ['Type', typeLabels[req.request_type] || req.request_type],
              ['Start Date', req.start_date ? new Date(req.start_date).toLocaleDateString() : '—'],
              ['End Date', req.end_date ? new Date(req.end_date).toLocaleDateString() : '—'],
              ['Days', req.days || '—'],
              ['Approver', req.approver_name || '—'],
              ['Approved At', req.approved_at ? new Date(req.approved_at).toLocaleString() : '—'],
              ['Rejected At', req.rejected_at ? new Date(req.rejected_at).toLocaleString() : '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{label}</p>
                <p style={{ fontWeight: 'var(--weight-medium)', marginTop: 'var(--space-1)', marginBottom: 0 }}>{value}</p>
              </div>
            ))}
          </div>

          {req.reason && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Reason</p>
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>{req.reason}</p>
            </div>
          )}

          {req.reject_reason && (
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-3)' }}>
              <p style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', margin: '0 0 var(--space-1) 0' }}>Rejection Reason</p>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error)', margin: 0 }}>{req.reject_reason}</p>
            </div>
          )}
        </div>

        {showRejectInput && (
          <div className="card" style={{ maxWidth: '42rem', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', margin: 0 }}>Rejection Reason</p>
            <textarea
              className="form-textarea"
              rows={3} placeholder="Rejection reason (required)..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <Button variant="destructive" size="sm"
                disabled={!rejectReason.trim() || rejectMutation.isPending}
                isLoading={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate(rejectReason)}>
                Confirm Rejection
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowRejectInput(false); setRejectReason(''); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </PageShell>
    </MainLayout>
  );
}
