import type { HRRequestType } from '@/lib/api/hr';

/**
 * Single source of truth for HR request-type display labels.
 *
 * Prefer the tenant-configured RequestType.name / name_ar returned by the API
 * (GET /hr/approvals/request-types/); these hardcoded maps are the fallback for
 * codes a tenant hasn't seeded. Keep BOTH maps in sync with the backend
 * REQUEST_TYPE_CHOICES / DEFAULT_DURATION_MODE.
 */
export const REQUEST_TYPE_LABELS: Record<string, string> = {
  annual_leave:       'Annual Leave',
  sick_leave:         'Sick Leave',
  emergency_leave:    'Emergency Leave',
  unpaid_leave:       'Unpaid Leave',
  work_from_home:     'Work From Home',
  personal_leave:     'Personal Leave',
  business_leave:     'Business Leave',
  missing_punch:      'Missing Punch',
  overtime:           'Overtime',
  advance_salary:     'Salary Advance',
  advance:            'Salary Advance',
  document_request:   'Document Request',
  salary_certificate: 'Salary Certificate',
  expense:            'Expense / Petty Cash',
  generic:            'General Request',
  other:              'Other',
};

export const REQUEST_TYPE_LABELS_AR: Record<string, string> = {
  annual_leave:       'إجازة سنوية',
  sick_leave:         'إجازة مرضية',
  emergency_leave:    'إجازة طارئة',
  unpaid_leave:       'إجازة بدون راتب',
  work_from_home:     'عمل من المنزل',
  personal_leave:     'إذن شخصي',
  business_leave:     'إذن عمل',
  missing_punch:      'بصمة ناقصة',
  overtime:           'عمل إضافي',
  advance_salary:     'سلفة راتب',
  advance:            'سلفة راتب',
  document_request:   'طلب مستند',
  salary_certificate: 'شهادة راتب',
  expense:            'سند صرف نثرية',
  generic:            'طلب عام',
  other:              'أخرى',
};

/**
 * Resolve the display label for a request_type code. Prefers the tenant's
 * configured RequestType name (Arabic when the UI is Arabic), then the
 * bilingual hardcoded fallback, then the raw code as a last resort.
 */
export function resolveRequestTypeLabel(
  code: string,
  types?: Pick<HRRequestType, 'code' | 'name' | 'name_ar'>[] | null,
  isArabic = false,
): string {
  const rt = types?.find(t => t.code === code);
  if (rt) {
    const apiName = isArabic ? (rt.name_ar || rt.name) : rt.name;
    if (apiName) return apiName;
  }
  const map = isArabic ? REQUEST_TYPE_LABELS_AR : REQUEST_TYPE_LABELS;
  return map[code] || REQUEST_TYPE_LABELS[code] || code;
}
