/** Role code strings — use these constants instead of inline literals. */
export const ROLE_CODES = {
  EMPLOYEE:             'employee',
  SITE_ENGINEER:        'site_engineer',
  SITE_MANAGER:         'site_manager',
  SUPERVISOR:           'supervisor',
  HR_MANAGER:           'hr_manager',
  HR_SECRETARY:         'hr_secretary',
  COMPANY_DIRECTOR:     'company_director',
  PROCUREMENT_MANAGER:  'procurement_manager',
  PROCUREMENT_OFFICER:  'procurement_officer',
  ADMIN:                'admin',
} as const;

// Canonical role list — mirrors backend accounts.User.ROLE_CHOICES exactly.
// Import from here instead of duplicating per-page.
export const ROLES: { value: string; label: string }[] = [
  { value: 'employee',            label: 'Employee' },
  { value: 'site_engineer',       label: 'Site Engineer' },
  { value: 'site_manager',        label: 'Site Manager' },
  { value: 'supervisor',          label: 'Supervisor' },
  { value: 'hr_manager',          label: 'HR Manager' },
  { value: 'hr_secretary',        label: 'HR Secretary' },
  { value: 'company_director',    label: 'Company Director' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'admin',               label: 'Admin' },
];
