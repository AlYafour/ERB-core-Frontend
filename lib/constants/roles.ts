// Canonical role list — mirrors backend accounts.User.ROLE_CHOICES exactly.
// Import from here instead of duplicating per-page.
export const ROLES: { value: string; label: string }[] = [
  { value: 'employee',            label: 'Employee' },
  { value: 'site_engineer',       label: 'Site Engineer' },
  { value: 'site_manager',        label: 'Site Manager' },
  { value: 'supervisor',          label: 'Supervisor' },
  { value: 'hr_manager',          label: 'HR Manager' },
  { value: 'company_director',    label: 'Company Director' },
  { value: 'procurement_manager', label: 'Procurement Manager' },
  { value: 'procurement_officer', label: 'Procurement Officer' },
  { value: 'admin',               label: 'Admin' },
];
