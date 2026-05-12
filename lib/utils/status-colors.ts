import type { BadgeProps } from '@/components/ui/Badge';

type Variant = NonNullable<BadgeProps['variant']>;

export const PRODUCT_STATUS: Record<string, Variant> = {
  active:   'success',
  inactive: 'error',
  archived: 'info',
};

export const PR_STATUS: Record<string, Variant> = {
  approved: 'success',
  rejected: 'error',
  pending:  'warning',
  draft:    'info',
};

export const PO_STATUS: Record<string, Variant> = {
  draft:     'info',
  pending:   'warning',
  approved:  'success',
  rejected:  'error',
  completed: 'success',
  cancelled: 'error',
};

export const PQ_STATUS: Record<string, Variant> = {
  pending:  'warning',
  awarded:  'success',
  rejected: 'error',
  expired:  'info',
};

export const GRN_STATUS: Record<string, Variant> = {
  completed: 'success',
  cancelled: 'error',
  partial:   'warning',
  draft:     'info',
};

export const CUSTOMER_TYPE: Record<string, Variant> = {
  owner:      'info',
  commercial: 'warning',
  consultant: 'default',
};

export const PROJECT_STATUS: Record<string, Variant> = {
  on_going:  'success',
  completed: 'info',
  on_hold:   'warning',
  cancelled: 'error',
};

export const INVOICE_STATUS: Record<string, Variant> = {
  draft:     'info',
  pending:   'warning',
  approved:  'success',
  rejected:  'error',
  paid:      'success',
  cancelled: 'error',
};

export const ATTENDANCE_STATUS: Record<string, Variant> = {
  present:  'success',
  absent:   'error',
  late:     'warning',
  half_day: 'info',
  holiday:  'default',
  on_leave: 'default',
};

export const HR_REQUEST_STATUS: Record<string, Variant> = {
  pending:   'warning',
  approved:  'success',
  rejected:  'error',
  cancelled: 'default',
};

export const PAYROLL_STATUS: Record<string, Variant> = {
  draft:     'default',
  processed: 'info',
  paid:      'success',
};
