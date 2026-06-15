// Permission Types (declared before User so User can reference them)
export interface Permission {
  id: number;
  name: string;
  category: string;
  action: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PermissionSet {
  id: number;
  name: string;
  description?: string;
  permissions: Permission[];
  permissions_count: number;
  is_active: boolean;
  is_system: boolean;
  created_at?: string;
  updated_at?: string;
}

// User Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name_ar?: string;
  role: 'site_engineer' | 'procurement_manager' | 'procurement_officer' | 'super_admin';
  phone: string;
  job_title?: string;
  avatar?: string;
  avatar_url?: string;
  is_staff: boolean;
  is_active: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  /** Full PermissionSet object returned by the API */
  permission_set?: PermissionSet | null;
  created_at?: string;
  /** SaaS multi-tenant fields */
  is_platform_admin?: boolean;
  tenant?: string | null;
}

export interface MunicipalViolation {
  id: number;
  raw_message: string;
  sender: string;
  received_at: string;
  violation_description: string;
  area: string;
  sector: string;
  plot: string;
  violation_date: string;
  deadline_days: number | null;
  fine_amount: string | null;
  reference_number: string;
  verification_code: string;
  violation_url: string;
  project: number | null;
  project_name: string | null;
  notified_engineer: number | null;
  engineer_name: string | null;
  status: 'new' | 'notified' | 'resolved' | 'fined';
  status_display: string;
  parse_error: string;
  resolve_token: string;
  resolved_by_name: string | null;
  resolved_at: string | null;
  updated_at: string;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  tokens: {
    access: string;
    refresh: string;
  };
}

// Pagination
export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// Notification Types
export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  related_object_type: string | null;
  related_object_id: number | null;
  created_at: string;
}

// Project Types
export interface Project {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  image?: string;
  image_url?: string;
  location?: string;
  contact_person?: string;
  mobile_number?: string;
  sector?: string;
  plot?: string;
  project_status: 'on_going' | 'completed' | 'on_hold' | 'cancelled';
  consultant?: string;
  description?: string;
  responsible_engineer?: number | null;
  responsible_engineer_name?: string | null;
  responsible_engineer_phone?: string | null;
  responsible_engineer_email?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Supplier Types
export interface Supplier {
  id: number;
  name: string;
  business_name?: string;
  business_name_ar?: string;
  supplier_number?: string;
  image?: string;
  image_url?: string;
  first_name?: string;
  last_name?: string;
  contact_person: string;
  email: string;
  telephone?: string;
  phone: string;
  mobile?: string;
  street_address_1?: string;
  street_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  address: string;
  tax_id: string;
  trn?: string;
  currency?: string;
  description?: string;
  status?: 'SUPPLIER' | 'SUBCON';
  supplier_history?: boolean;
  bank_name: string;
  bank_account: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Product Types
export interface Product {
  id: number;
  name: string;
  name_ar?: string;
  code: string;
  sku?: string;
  barcode?: string;
  image?: string;
  image_url?: string;
  description: string;
  internal_notes?: string;
  brand?: string;
  category: string;
  tags?: string;
  unit: 'piece' | 'pcs' | 'kg' | 'kl' | 'meter' | 'lm' | 'liter' | 'box' | 'pack' | 'pkt' | 'bag' | 'roll' | 'ctn' | 'ton' | 'trip' | 'sqm' | 'cbm' | 'pump' | 'sheet' | 'brd' | 'drm' | 'doz' | 'ls' | 'set' | 'ream' | 'bundle' | 'nos' | 'mtr' | 'qty' | 'pair' | 'can' | 'gal' | 'day' | 'hour' | 'month';
  supplier?: number | Supplier;
  unit_price?: number;
  sell_price?: number;
  buy_price?: number;
  minimum_price?: number;
  average_cost?: number;
  discount?: number;
  discount_type?: 'percentage' | 'fixed';
  tax1?: number;
  tax2?: number;
  track_stock?: boolean;
  stock_balance?: number;
  low_stock_threshold?: number;
  profit_margin?: number;
  status?: 'active' | 'inactive' | 'archived';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Cost Code Types
export interface CostCode {
  id: number;
  qb_code: string;
  excel_code: string;
  description: string;
  level: 1 | 2 | 3;
  parent: number | null;
  parent_code?: string | null;
  parent_desc?: string | null;
  is_active: boolean;
}

// Purchase Request Types
export interface PurchaseRequestItem {
  id?: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit: string;
  project_site: string;
  reason: string;
  notes: string;
  created_at?: string;
}

export interface PurchaseRequest {
  id: number;
  code: string;
  title: string;
  project?: Project | number | null;
  project_id?: number | null;
  project_code?: string;
  request_date: string;
  required_by: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string;
  rejection_reason?: string;
  created_by: number;
  created_by_name?: string;
  created_by_phone?: string;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  items: PurchaseRequestItem[];
  total_items?: number;
  has_quotation_requests?: boolean;
  has_purchase_orders?: boolean;
  has_awarded_quotation?: boolean;
  allow_additional_orders?: boolean;
  created_at: string;
  updated_at: string;
}

// Quotation Request Types
export interface QuotationRequestItem {
  id?: number;
  product_id: number;
  product?: Product;
  quantity: number;
  notes: string;
}

export interface QuotationRequest {
  id: number;
  purchase_request: number | PurchaseRequest;
  supplier: number | Supplier;
  notes: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
  items: QuotationRequestItem[];
  project_name?: string | null;
  project_code?: string | null;
}

// Purchase Quotation Types
export interface PurchaseQuotationItem {
  id?: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax?: number;
  tax_rate?: number;
  total: number;
  notes?: string;
}

export interface PurchaseQuotation {
  id: number;
  quotation_number: string;
  quotation_request: number | QuotationRequest;
  quotation_request_id?: number;
  quotation_request_code?: string;
  purchase_request?: number | PurchaseRequest | null;
  purchase_request_id?: number | null;
  purchase_request_code?: string | null;
  has_awarded_quotation?: boolean;
  supplier: number | Supplier;
  quotation_date: string;
  valid_until?: string;
  status?: 'pending' | 'awarded' | 'rejected' | 'expired';
  total: number;
  subtotal?: number;
  tax_amount?: number;
  discount?: number;
  tax_rate?: number;
  payment_terms?: string;
  delivery_method?: 'pickup' | 'delivery';
  delivery_terms?: string;
  notes?: string;
  attachments?: string[];
  created_by: number;
  created_by_name: string;
  awarded_by?: number;
  awarded_by_name?: string;
  awarded_at?: string;
  created_at: string;
  items: PurchaseQuotationItem[];
  project_name?: string | null;
  project_code?: string | null;
}

// Purchase Order Types
export interface PurchaseOrderItem {
  id?: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
  total: number;
  notes?: string;
  created_at?: string;
}

export interface POAmendmentRequest {
  id: number;
  purchase_order: number;
  requested_by: number | null;
  requested_by_name: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  manager_notes: string;
  revision_po: number | null;
  revision_po_id: number | null;
  revision_po_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  terms_and_conditions?: string;
  cost_code?: CostCode | null;
  cost_code_id?: number | null;
  id: number;
  order_number: string;
  purchase_request?: number | PurchaseRequest;
  purchase_quotation?: number | PurchaseQuotation;
  supplier: number | Supplier;
  order_date: string;
  delivery_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled' | 'amendment_requested' | 'superseded';
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total: number;
  payment_terms?: string;
  delivery_method?: 'pickup' | 'delivery';
  delivery_terms?: string;
  notes?: string;
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  created_by: number;
  created_by_name: string;
  created_by_phone?: string;
  quotation_created_by_name?: string | null;
  pr_created_by_name?: string | null;
  pr_created_by_phone?: string | null;
  project_name?: string | null;
  project_code?: string | null;
  project_location?: string | null;
  has_grn?: boolean;
  grns_count?: number;
  revision_number?: number;
  parent_po?: number | null;
  parent_order_number?: string | null;
  pending_amendment?: POAmendmentRequest | null;
  latest_approved_amendment?: POAmendmentRequest | null;
  revisions_count?: number;
  created_at: string;
  updated_at: string;
  items: PurchaseOrderItem[];
}

// Goods Receiving Types
export interface GRNItem {
  id?: number;
  purchase_order_item_id: number;
  product_id: number;
  product?: Product;
  ordered_quantity: number;
  received_quantity: number;
  rejected_quantity: number;
  quality_status: 'good' | 'damaged' | 'defective' | 'missing';
  notes?: string;
  created_at?: string;
}

export interface GoodsReceivedNote {
  id: number;
  purchase_order?: number | PurchaseOrder;
  purchase_order_id: number;
  grn_number: string;
  receipt_date: string;
  status: 'draft' | 'partial' | 'completed' | 'cancelled';
  notes?: string;
  items: GRNItem[];
  received_by: number;
  received_by_name?: string;
  total_items?: number;
  total_received_quantity?: number;
  invoices?: Array<{ id: number; invoice_number: string; [key: string]: any }>;
  material_images?: Array<{ id: number; image: string; image_url: string; created_at: string }>;
  supplier_invoice_file?: string | null;
  supplier_invoice_file_url?: string | null;
  invoice_delivery_status?: 'not_delivered' | 'delivered';
  created_at: string;
  updated_at: string;
}

// Purchase Invoice Types
export interface PurchaseInvoiceItem {
  id?: number;
  purchase_order_item_id: number;
  product_id: number;
  product?: Product;
  quantity: number;
  unit_price: number;
  discount?: number;
  tax_rate?: number;
  total?: number;
  notes?: string;
  created_at?: string;
}

export interface PurchaseInvoice {
  id: number;
  purchase_order?: number | PurchaseOrder;
  purchase_order_id: number;
  grn?: number | any;
  grn_id?: number;
  invoice_number: string;
  invoice_date: string;
  due_date?: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled';
  subtotal?: number;
  tax_rate?: number;
  tax_amount?: number;
  discount?: number;
  total: number;
  paid_amount?: number;
  remaining_amount?: number;
  is_fully_paid?: boolean;
  items: PurchaseInvoiceItem[];
  approved_by?: number;
  approved_by_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

// ── HR Module Types ────────────────────────────────────────────────────────────

export interface HRLocationType {
  id: number;
  name: string;
  name_ar: string;
  icon: string;
  color: string;
  locations_count: number;
  created_at: string;
  updated_at: string;
}

export interface HRLocation {
  id: number;
  name: string;
  name_ar: string;
  location_type: number | null;
  location_type_name: string | null;
  location_type_icon: string | null;
  location_type_color: string | null;
  parent: number | null;
  parent_name: string | null;
  address: string;
  description: string;
  is_active: boolean;
  employee_count: number;
  children_count: number;
  created_at: string;
  updated_at: string;
}

export interface HRDepartment {
  id: number;
  name: string;
  name_ar: string;
  description: string;
  manager: number | null;
  manager_name: string | null;
  parent: number | null;
  parent_name: string | null;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface HRPosition {
  id: number;
  title: string;
  title_ar: string;
  level: number;
  base_salary: string | null;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeeGroup {
  id: number;
  name: string;
  name_ar: string;
  code: string;
  description: string;
  is_active: boolean;
  member_count: number;
  default_shift?: number | null;
  default_shift_name?: string | null;
  default_manager?: number | null;
  default_manager_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface HREmployeeUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  full_name_ar: string;
  phone: string;
  avatar: string | null;
  role: string;
}

export interface HREmployee {
  id: number;
  employee_id: string;
  user: HREmployeeUser;
  user_id?: number;
  full_name: string;
  email: string;
  avatar: string | null;
  // Personal Info
  salary_display_name?: string;
  gender: string;
  date_of_birth: string | null;
  nationality: string;
  home_country?: string;
  religion?: string;
  national_id: string;
  passport_number?: string;
  passport_issue_date?: string | null;
  passport_expiry_date?: string | null;
  personal_email?: string;
  // Employment
  employment_type: 'full_time' | 'part_time' | 'contract' | 'intern';
  join_date: string;
  probation_end_date?: string | null;
  end_date: string | null;
  is_active: boolean;
  work_location?: string;
  location: number | null;
  location_name: string | null;
  department: number | null;
  department_name: string | null;
  department_detail?: HRDepartment;
  position: number | null;
  position_title: string | null;
  position_detail?: HRPosition;
  manager: number | null;
  manager_detail?: HREmployee;
  direct_manager?: number | null;
  direct_manager_name?: string | null;
  indirect_manager?: number | null;
  indirect_manager_name?: string | null;
  employee_group?: number | null;
  employee_group_name?: string | null;
  employee_group_code?: string | null;
  // Contact
  mobile_number?: string;
  extension_number?: string;
  address?: string;
  marital_status?: string;
  // UAE Legal
  sponsor_name?: string;
  sponsor_id?: string;
  labor_card?: string;
  labor_card_expiry?: string | null;
  mol_number?: string;
  resident_id?: string;
  is_citizen?: boolean;
  // Salary
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowances: string;
  total_salary: string;
  emergency_contact?: HREmergencyContact;
  created_at: string;
  updated_at: string;
}

export interface HREmergencyContact {
  id: number;
  name: string;
  relationship: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface OfficeLocation {
  id: number;
  name: string;
  name_ar: string;
  latitude: number;
  longitude: number;
  radius_m: number;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HRAttendance {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_lat: number | null;
  check_in_lng: number | null;
  check_out_lat: number | null;
  check_out_lng: number | null;
  check_in_address: string;
  matched_location: number | null;
  matched_location_name: string | null;
  is_out_of_range: boolean;
  break_start: string | null;
  break_end: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'holiday' | 'on_leave';
  work_hours: number | null;
  overtime_hours: number | null;
  duration_hours: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface HRShift {
  id: number;
  name: string;
  name_ar: string;
  shift_type: 'morning' | 'evening' | 'night' | 'flexible';
  start_time: string;
  end_time: string;
  break_mins: number;
  work_days: number[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface HRRequest {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  request_type: 'annual_leave' | 'sick_leave' | 'emergency_leave' | 'unpaid_leave' | 'work_from_home' | 'overtime' | 'advance_salary' | 'document_request' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  days: string | null;
  reason: string;
  attachments: string[];
  approver: number | null;
  approver_name: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  reject_reason: string;
  notes: string;
  approval_instance_id: number | null;
  current_approval_step: {
    step_order: number;
    strategy: string;
    resolved_approver_id: number | null;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface HRLeaveBalance {
  id: number;
  employee: number;
  employee_name: string;
  year: number;
  leave_type: 'annual_leave' | 'sick_leave' | 'emergency_leave' | 'unpaid_leave';
  total_days: string;
  used_days: string;
  pending_days: string;
  remaining_days: string;
  created_at: string;
  updated_at: string;
}

export interface ConfirmedPenalty {
  id: number;
  date: string;
  amount: string;
  rule_name: string | null;
  tier_label: string | null;
  minutes_evaluated: number;
  was_compensated: boolean;
}

export interface PayrollLeaveEncashmentRow {
  id: number;
  leave_type: string;
  days_encashed: string;
  rate_per_day: string;
  encashment_amount: string;
}

export interface HRPayroll {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  month: number;
  year: number;
  month_name: string;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowances: string;
  overtime_amount: string;
  leave_encashment: string;
  deductions: string;
  absence_deduction: string;
  penalty_deduction: string;
  loan_deduction: string;
  gross_salary: string;
  net_salary: string;
  confirmed_penalties: ConfirmedPenalty[];
  loan_installments: PayrollLoanInstallment[];
  approved_encashments: PayrollLeaveEncashmentRow[];
  working_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  status: 'draft' | 'processed' | 'paid';
  paid_at: string | null;
  notes: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayrollLoanInstallment {
  id: number;
  loan_id: number;
  amount: string;
  loan_notes: string;
  loan_total: string;
  loan_remaining: string;
}

// ── Leave Management ──────────────────────────────────────────────────────────

export interface LeavePolicy {
  id: number;
  tenant: string | null;
  employee_group: number | null;
  employee_group_name: string | null;
  leave_type: 'annual_leave' | 'sick_leave';
  annual_entitlement_days: string;
  monthly_accrual_days: string;
  max_accrual_days: string;
  accrual_start_month: number;
  effective_from: string;
  encashment_rate_base: 'basic' | 'total';
  encashment_rate_divisor: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveEncashment {
  id: number;
  tenant: string | null;
  employee: number;
  employee_name: string;
  leave_type: 'annual_leave' | 'sick_leave';
  days_encashed: string;
  rate_per_day: string;
  encashment_amount: string;
  month: number;
  year: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes: string;
  hr_request: number | null;
  payroll: number | null;
  created_by: number | null;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeLoan {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  hr_request: number | null;
  total_amount: string;
  installment_amount: string;
  remaining_balance: string;
  start_month: number;
  start_year: number;
  status: 'active' | 'completed' | 'cancelled' | 'paused';
  notes: string;
  number_of_installments: number;
  installments_taken: number;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── Approval Chains ───────────────────────────────────────────────────────────

export type ApproverStrategy = 'DIRECT_MANAGER' | 'INDIRECT_MANAGER' | 'ROLE' | 'SPECIFIC_USER';
export type ConditionOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

export interface ApprovalStep {
  id: number;
  policy: number;
  order: number;
  approver_strategy: ApproverStrategy;
  role_name: string;
  specific_user: number | null;
  escalation_after_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalPolicy {
  id: number;
  request_type: number;
  name: string;
  is_active: boolean;
  priority: number;
  employee_group: number | null;
  employee_group_name: string | null;
  condition_field: string;
  condition_operator: ConditionOperator | '';
  condition_value: string | null;
  steps: ApprovalStep[];
  created_at: string;
  updated_at: string;
}

// ── Penalty Rules (P2) ───────────────────────────────────────────────────────

export type PenaltyRuleType = 'LATENESS' | 'EARLY_LEAVE' | 'ABSENCE';
export type PenaltyPenaltyType = 'FIXED_AMOUNT' | 'HOURLY_RATE' | 'DAILY_FRACTION' | 'WARNING_ONLY';

export interface PenaltyTier {
  id: number;
  rule: number;
  order: number;
  min_minutes: number;
  max_minutes: number | null;
  penalty_type: PenaltyPenaltyType;
  penalty_value: string;
  label: string;
  created_at: string;
}

export interface PenaltyRule {
  id: number;
  name: string;
  rule_type: PenaltyRuleType;
  is_active: boolean;
  priority: number;
  employee_group: number | null;
  employee_group_name: string | null;
  grace_minutes: number;
  allow_compensation: boolean;
  counts_extra_as_overtime: boolean;
  tiers: PenaltyTier[];
  created_at: string;
  updated_at: string;
}

// ── Tasks Module ──────────────────────────────────────────────────────────────

export type TaskStatus =
  | 'draft' | 'assigned' | 'accepted' | 'in_progress'
  | 'submitted' | 'review' | 'approved' | 'rejected' | 'closed';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type TaskType = 'task' | 'request' | 'issue' | 'followup';
export type TeamMemberRole = 'leader' | 'member' | 'observer';

export interface MiniUser {
  id: number;
  username: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

export interface Team {
  id: number;
  name: string;
  description: string;
  created_by: number;
  created_by_detail: MiniUser;
  members: TeamMember[];
  member_count: number;
  tasks_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: number;
  team: number;
  user: number;
  user_detail: MiniUser;
  role: TeamMemberRole;
  joined_at: string;
}

export interface TaskListItem {
  id: number;
  title: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: number;
  created_by_detail: MiniUser;
  assigned_to: number | null;
  assigned_to_detail: MiniUser | null;
  assigned_team: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  requires_approval: boolean;
  subtasks_total: number;
  subtasks_done: number;
  comments_count: number;
  attachments_count: number;
}

export interface SubTask {
  id: number;
  task: number;
  title: string;
  is_completed: boolean;
  completed_by: number | null;
  completed_by_detail: MiniUser | null;
  completed_at: string | null;
  order: number;
  created_at: string;
}

export interface TaskComment {
  id: number;
  task: number;
  author: number;
  author_detail: MiniUser;
  content: string;
  is_system: boolean;
  attachments: TaskAttachmentItem[];
  created_at: string;
  updated_at: string;
}

export interface TaskAttachmentItem {
  id: number;
  task: number;
  comment: number | null;
  uploaded_by: number;
  uploaded_by_detail: MiniUser;
  file: string;
  file_url: string | null;
  file_name: string;
  file_size: number;
  created_at: string;
}

export interface TaskActivity {
  id: number;
  task: number;
  actor: number;
  actor_detail: MiniUser;
  action: string;
  details: Record<string, string>;
  created_at: string;
}

export interface TaskDetail {
  id: number;
  title: string;
  description: string;
  task_type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  created_by: number;
  created_by_detail: MiniUser;
  assigned_to: number | null;
  assigned_to_detail: MiniUser | null;
  assigned_team: number | null;
  watchers: number[];
  watchers_detail: MiniUser[];
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  closed_at: string | null;
  requires_approval: boolean;
  approved_by: number | null;
  approved_by_detail: MiniUser | null;
  rejection_reason: string;
  project: number | null;
  department: number | null;
  location: number | null;
  subtasks: SubTask[];
  comments: TaskComment[];
  attachments: TaskAttachmentItem[];
  activities: TaskActivity[];
  created_at: string;
  updated_at: string;
}

export interface MyTask {
  id: number;
  owner: number;
  title: string;
  note: string;
  is_done: boolean;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  order: number;
  created_at: string;
  done_at: string | null;
}

export interface TaskStats {
  my_tasks: number;
  created_by_me: number;
  pending_review: number;
  overdue: number;
  completed_this_month: number;
  by_status: Record<TaskStatus, number>;
  by_priority: Record<TaskPriority, number>;
}
