'use client';

import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import MainLayout from '@/components/layout/MainLayout';
import { hrRequestsApi } from '@/lib/api/hr';
import { useAuth } from '@/lib/hooks/use-auth';
import { toast } from '@/lib/hooks/use-toast';
import { confirm } from '@/lib/hooks/use-toast';
import { Button, Badge, Loader } from '@/components/ui';
import Link from 'next/link';
import { useState } from 'react';

const statusColors: Record<string, string> = {
  pending: 'badge-warning', approved: 'badge-success',
  rejected: 'badge-error', cancelled: 'badge-default',
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

  if (isLoading) return <MainLayout><div className="card text-center py-16"><Loader className="mx-auto mb-4" /></div></MainLayout>;
  if (error || !req) return <MainLayout><div className="card text-center py-16"><p className="text-destructive">Request not found.</p></div></MainLayout>;

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Link href="/hr/requests"><Button variant="ghost" size="sm">← Back</Button></Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{typeLabels[req.request_type] || req.request_type}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">#{req.id} — {req.employee_name} ({req.employee_id_code})</p>
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <Badge className={statusColors[req.status] || 'badge-default'}>{req.status.toUpperCase()}</Badge>
            <span className="text-sm text-muted-foreground">{new Date(req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
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
                <p className="text-muted-foreground text-xs uppercase tracking-wide">{label}</p>
                <p className="font-medium text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {req.reason && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Reason</p>
              <p className="text-sm text-foreground">{req.reason}</p>
            </div>
          )}

          {req.reject_reason && (
            <div className="border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Rejection Reason</p>
              <p className="text-sm text-destructive">{req.reject_reason}</p>
            </div>
          )}
        </div>

        {isAdmin && req.status === 'pending' && (
          <div className="card space-y-3">
            <p className="text-sm font-semibold text-foreground">Actions</p>
            <div className="flex gap-3">
              <Button variant="primary" onClick={handleApprove} isLoading={approveMutation.isPending}>Approve</Button>
              <Button variant="secondary" onClick={() => setShowRejectInput(!showRejectInput)}>Reject</Button>
            </div>
            {showRejectInput && (
              <div className="space-y-2">
                <textarea
                  className="w-full px-3 py-2 rounded-md border text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  rows={3} placeholder="Rejection reason (required)..."
                  value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                />
                <Button variant="destructive" size="sm"
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  isLoading={rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate(rejectReason)}>
                  Confirm Rejection
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
