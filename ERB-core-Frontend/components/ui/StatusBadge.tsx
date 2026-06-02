'use client';

import { cn } from '@/lib/utils/cn';

/* Maps any status string to a semantic color tier */
const STATUS_VARIANT: Record<string, string> = {
  /* generic positive */
  active: 'success', approved: 'success', completed: 'success',
  paid: 'success', received: 'success', awarded: 'success', converted: 'success',
  accepted: 'success', done: 'success', closed_won: 'success',

  /* generic neutral/in-progress */
  pending: 'warning', draft: 'warning', in_progress: 'warning',
  on_going: 'warning', processing: 'warning', submitted: 'warning',
  review: 'info', under_review: 'info', assigned: 'info', accepted_review: 'info',

  /* generic negative */
  rejected: 'error', inactive: 'error', cancelled: 'error',
  on_hold: 'error', failed: 'error', expired: 'error',
  delete_requested: 'error', closed_lost: 'error',

  /* project statuses */
  on_going_project: 'warning', completed_project: 'success',

  /* payroll */
  processed: 'info',

  /* attendance */
  present: 'success', absent: 'error', late: 'warning', half_day: 'info',
  holiday: 'info', weekend: 'default', leave: 'warning',

  /* hr request */
  annual_leave: 'info', sick_leave: 'warning', emergency_leave: 'warning',
  unpaid_leave: 'warning', permission: 'info', resignation: 'error',
  overtime: 'info', salary_advance: 'info',

  /* customer type */
  owner: 'info', commercial: 'warning', consultant: 'success',

  /* default */
  default: 'default', closed: 'default', unknown: 'default',
};

/* Display-friendly labels */
const STATUS_LABEL: Record<string, string> = {
  on_going: 'Ongoing', in_progress: 'In Progress', on_hold: 'On Hold',
  delete_requested: 'Delete Requested', half_day: 'Half Day',
  annual_leave: 'Annual Leave', sick_leave: 'Sick Leave',
  emergency_leave: 'Emergency Leave', unpaid_leave: 'Unpaid Leave',
  salary_advance: 'Salary Advance',
};

interface StatusBadgeProps {
  status: string;
  label?: string;     /* override auto-label */
  className?: string;
}

export default function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const variant = STATUS_VARIANT[status] ?? STATUS_VARIANT[status.replace(/-/g, '_')] ?? 'default';
  const display = label ?? STATUS_LABEL[status] ?? status.replace(/_/g, ' ').replace(/-/g, ' ');

  const variantClass = `badge badge-${variant === 'default' ? '' : variant}`.trim();

  return (
    <span className={cn(variantClass || 'badge', className)}>
      {display.charAt(0).toUpperCase() + display.slice(1)}
    </span>
  );
}
