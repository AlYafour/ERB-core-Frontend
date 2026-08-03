import type { ApprovalStatus } from '@/lib/api/approvals';

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
  role: 'site_engineer' | 'procurement_manager' | 'procurement_officer' | 'super_admin'
      | 'admin' | 'employee' | 'hr_manager' | 'hr_secretary' | 'company_director';
  phone: string;
  job_title?: string;
  avatar?: string;
  avatar_url?: string;
  stamp_url?: string | null;
  is_staff: boolean;
  is_active: boolean;
  is_superuser?: boolean;
  date_joined?: string;
  /** Full PermissionSet object returned by the API */
  permission_set?: PermissionSet | null;
  created_at?: string;
  /** True when the user is a company admin (role==='admin' / permission level ≥100). */
  is_company_admin?: boolean;
  /** SaaS multi-tenant fields */
  is_platform_admin?: boolean;
  tenant?: string | null;
  /** Security fields */
  is_2fa_enabled?: boolean;
  webauthn_credentials?: { credential_id: string; device_name: string }[];
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
  primary_manager?: number | null;
  primary_manager_name?: string | null;
  primary_manager_position?: string | null;
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
  /** Accounting defaults (Item Master pattern) — account ids */
  expense_account?: number | null;
  inventory_account?: number | null;
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
  is_direct?: boolean;
  is_vehicle?: boolean;
  is_vehicle_effective?: boolean;
  parent: number | null;
  parent_code?: string | null;
  parent_desc?: string | null;
  is_active: boolean;
  default_account?: number | null;
  default_account_code?: string | null;
  effective_account_code?: string | null;
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

export interface PurchaseRequestCharge {
  id: number;
  purchase_request_id?: number;
  description: string;
  charge_type: 'lump_sum' | 'per_unit';
  rate: number;
  quantity: number;
  total: number;
}

export interface PurchaseOrderCharge {
  id: number;
  purchase_order_id?: number;
  pr_charge_id?: number | null;
  description: string;
  charge_type: 'lump_sum' | 'per_unit';
  rate: number;
  quantity: number;
  total: number;
}

export interface PurchaseRequest {
  id: number;
  code: string;
  title: string;
  approval_status?: ApprovalStatus | null;
  project?: Project | number | null;
  project_id?: number | null;
  project_code?: string;
  request_date: string;
  required_by: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  notes: string;
  rejection_reason?: string;
  resubmit_comment?: string;
  created_by: number;
  created_by_name?: string;
  created_by_phone?: string;
  approved_by?: number | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  items: PurchaseRequestItem[];
  charges: PurchaseRequestCharge[];
  total_items?: number;
  has_quotation_requests?: boolean;
  has_purchase_orders?: boolean;
  has_active_purchase_orders?: boolean;
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
  created_by: number;
  created_by_name: string;
  awarded_by?: number;
  awarded_by_name?: string;
  awarded_at?: string;
  created_at: string;
  updated_at: string;
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
  approval_status?: ApprovalStatus | null;
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
  transportation_charge: number;
  transport_vat_included?: boolean;
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
  project_engineer_name?: string | null;
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
  charges?: PurchaseOrderCharge[];
  charges_vat?: number;
  financials?: POFinancials;
}

/** Canonical server-computed financial breakdown (single source of truth). */
export interface POFinancials {
  items_subtotal: number;
  items_vat: number;
  charges_total: number;
  subtotal: number;
  discount: number;
  transport: number;
  vat_total: number;
  grand_total: number;
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
  journal_entry?: { id: string; number: string | null; status: string } | null;
  created_by: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

// ── HR Module Types ────────────────────────────────────────────────────────────

export interface HRLegalEntity {
  id: number;
  name: string;
  name_ar?: string;
  employee_count: number;
  created_at: string;
  updated_at: string;
}

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
  department: number | null;
  department_name: string | null;
  default_permission_set: number | null;
  default_permission_set_name: string | null;
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

export interface WorkTeam {
  id: number;
  name: string;
  name_ar: string;
  code: string;
  description: string;
  employee_group: number | null;
  employee_group_name: string | null;
  supervisor: number | null;
  supervisor_name: string | null;
  member_count: number;
  is_active: boolean;
  // Phase 1 additions
  department?: number | null;
  department_name?: string | null;
  project?: number | null;
  project_name?: string | null;
  location?: number | null;
  location_name?: string | null;
  parent_team?: number | null;
  parent_team_name?: string | null;
  main_manager?: number | null;
  main_manager_name?: string | null;
  team_type?: number | null;
  team_type_name?: string | null;
  status?: 'active' | 'inactive' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface TeamType {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  created_at: string;
}

export interface WorkTeamMember {
  id: number;
  work_team: number;
  work_team_name?: string;
  employee: number;
  employee_name: string;
  employee_id?: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended';
  is_primary: boolean;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export interface HREmployeeUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  full_name_ar: string;
  phone: string;
  avatar: string | null;
  stamp_url?: string | null;
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
  is_manager: boolean;
  location: number | null;
  location_name: string | null;
  legal_entity?: number | null;
  legal_entity_name?: string | null;
  office_location: number | null;
  office_location_name: string | null;
  department: number | null;
  department_name: string | null;
  department_detail?: HRDepartment;
  position: number | null;
  position_title: string | null;
  position_detail?: HRPosition;
  direct_manager?: number | null;
  direct_manager_name?: string | null;
  direct_manager_detail?: HREmployee;
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
  effective_shift: number | null;
  shift_name: string | null;
  shift_start_time: string | null;
  shift_end_time: string | null;
  leave_overlay?: string | null;
  scheduled_hours: number | null;
  late_minutes: number | null;
  early_leave_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkLog {
  id: number;
  tenant: number | null;
  employee: number;
  employee_name: string | null;
  employee_id_code: string | null;
  attendance: number | null;
  date: string;
  project: number | null;
  project_name: string | null;
  project_code: string | null;
  work_team: number | null;
  work_team_name: string | null;
  location: number | null;
  location_name: string | null;
  /** DRF decimal returned as string, e.g. "8.00" */
  hours: string;
  overtime_hours: string;
  cost_amount: string;
  is_auto: boolean;
  status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  status_display: string;
  notes: string;
  rejection_reason: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShiftDaySchedule {
  id?: number;
  day: number;
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  break_mins: number;
}

export interface HRShift {
  id: number;
  name: string;
  name_ar: string;
  shift_type: 'morning' | 'evening' | 'night' | 'flexible';
  start_time: string;
  end_time: string;
  break_start: string | null;
  break_end: string | null;
  break_mins: number;
  work_days: number[];
  is_active: boolean;
  day_schedules: ShiftDaySchedule[];
  created_at: string;
  updated_at: string;
}

export interface HRRequest {
  id: number;
  employee: number;
  employee_name: string;
  employee_name_ar?: string | null;
  employee_id_code: string;
  employee_avatar?: string | null;
  employee_position?: string | null;
  employee_department?: string | null;
  request_type: 'annual_leave' | 'sick_leave' | 'emergency_leave' | 'unpaid_leave' | 'work_from_home' | 'personal_leave' | 'business_leave' | 'missing_punch' | 'overtime' | 'advance_salary' | 'document_request' | 'other';
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  start_date: string | null;
  end_date: string | null;
  days: string | null;
  start_time?: string | null;
  end_time?: string | null;
  hours?: string | null;
  duration_mode?: 'days' | 'hours' | 'both' | 'none';
  punch_kind?: 'clock_in' | 'clock_out' | 'break_out' | 'break_in' | '';
  reason: string;
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
  approval_status?: ApprovalStatus | null;
  // Set only by the /my-approvals hub: the caller's relationship to this request.
  my_approval_status?: 'action_needed' | 'upcoming' | 'approved_by_me' | 'rejected_by_me' | 'closed_no_action';
  attachments?: {
    id: string | number;
    name: string;
    size: number;
    url: string | null;
    uploaded_by_name: string | null;
    created_at: string;
  }[];
  created_at: string;
  updated_at: string;
}

export interface EmployeeBankAccount {
  id: number;
  employee: number;
  bank_name: string;
  account_holder_name: string;
  iban: string;
  account_number: string;
  swift_code: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendancePolicy {
  id: number;
  tenant: string | null;
  employee_group: number | null;
  employee_group_name: string | null;
  name: string;
  enforce_punch_windows: boolean;
  checkin_opens_before_min: number;
  checkin_closes_after_min: number;
  checkin_minor_late_min: number;
  break_opens_before_min: number;
  break_closes_after_min: number;
  break_max_min: number;
  break_grace_min: number;
  checkout_opens_after_min: number;
  checkout_closes_after_min: number;
  emergency_enabled: boolean;
  emergency_monthly_limit: number;
  emergency_validity_min: number;
  emergency_min_reason_chars: number;
  emergency_followup_days: number;
  missing_punch_detection_enabled: boolean;
  missing_punch_lookback_days: number;
  missing_checkout_assume_shift_end: boolean;
  verify_wifi: boolean;
  verify_beacon: boolean;
  verify_device: boolean;
  verification_mode: 'all' | 'any';
  device_trust_on_first_use: boolean;
  escalation_enabled: boolean;
  escalate_manager_after: number;
  escalate_hr_after: number;
  grade_b_threshold: number;
  grade_c_threshold: number;
  points_minor_late: number;
  points_severe_late: number;
  points_absent: number;
  points_missing_punch: number;
  points_out_of_range: number;
  points_mock_location: number;
  zone_yellow_at: number;
  zone_orange_at: number;
  zone_red_at: number;
  block_mock_location: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AttendanceGradeRow {
  employee: number;
  employee_name: string;
  employee_id_code: string;
  late: number;
  minor?: number;
  severe?: number;
  absent: number;
  missing: number;
  out_of_range: number;
  mock?: number;
  total: number;
  grade: 'A' | 'B' | 'C';
  score: number;
  zone: 'green' | 'yellow' | 'orange' | 'red';
}

export interface AttendanceGradeReport {
  start: string;
  end: string;
  summary: { A: number; B: number; C: number };
  rows: AttendanceGradeRow[];
}

export interface TrustedDevice {
  id: number;
  employee: number;
  employee_name: string | null;
  employee_id_code: string | null;
  device_uuid: string;
  label: string;
  platform: 'ios' | 'android' | 'web' | 'other';
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

export interface LocationSignal {
  id: number;
  office_location: number;
  office_location_name: string | null;
  kind: 'wifi' | 'beacon';
  identifier: string;
  label: string;
  is_active: boolean;
  created_at: string;
}

export interface EmergencyExit {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  requested_at: string;
  reason: string;
  ack_confirmed: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired';
  valid_until: string;
  follow_up_due: string | null;
  left_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_note: string;
  month: number;
  year: number;
  created_at: string;
}

interface PunchWindow {
  opens?: string;
  closes?: string;
  open_now: boolean;
}

export interface MissingPunch {
  date: string;
  kind: 'clock_out' | 'break_in' | 'clock_in' | 'break_out';
  suggested_time: string | null;
  shift_end: string | null;
  label: string;
}

export interface PunchStatus {
  server_time: string;
  enforced: boolean;
  check_in: PunchWindow;
  break_start: PunchWindow;
  check_out: PunchWindow;
  break_end?: { deadline: string; open_now: boolean };
  missing_punches?: number;
  score?: number;
  zone?: 'green' | 'yellow' | 'orange' | 'red';
  emergency: {
    enabled: boolean;
    monthly_limit?: number;
    used_this_month?: number;
    remaining?: number;
    min_reason_chars?: number;
    validity_min?: number;
    has_pending?: boolean;
    pending_valid_until?: string | null;
  };
}

export interface HRCompanySettings {
  id: number;
  timezone: string;
  working_days: number[];
  work_start_time: string;
  work_end_time: string;
  checkin_cutoff_time: string | null;
  late_threshold_mins: number;
  office_address: string;
  geofence_enforcement: 'enforce' | 'warn' | 'off';
  geofence_accuracy_slack_m?: number;
  currency: string;
  annual_leave_days: number;
  sick_leave_days: number;
  working_hours_per_day?: number;
  overtime_multiplier?: string;
  working_days_per_month?: number;
  payroll_cutoff_day?: number;
  payroll_deduction_base?: 'basic' | 'total';
  payroll_deduction_divisor?: number;
  // Attendance policy
  overtime_enabled?: boolean;
  break_deduction_mode?: 'as_taken' | 'minimum' | 'fixed';
  clip_checkin_to_shift_start?: boolean;
  clip_checkout_to_shift_end?: boolean;
  work_hours_arrival_grace_min?: number;
  work_hours_break_grace_min?: number;
  min_punch_gap_seconds?: number;
  notifications_enabled?: boolean;
  notify_late_arrival?: boolean;
  notify_incomplete_hours?: boolean;
  notify_recipients?: { employee?: boolean; direct_manager?: boolean; hr?: boolean };
  notify_cc_emails?: string[];
  late_notify_after_mins?: number;
  late_notify_subject?: string;
  late_notify_body?: string;
  notify_footer?: string;
  // Per-event toggles (the wider 10-template attendance notice suite)
  notify_on_time_checkin?: boolean;
  notify_absent?: boolean;
  notify_day_complete?: boolean;
  notify_break_issues?: boolean;
  notify_missing_checkout?: boolean;
  notify_checkin_correction?: boolean;
  absent_cutoff_time?: string | null;
  notify_legal_ref?: string;
  notify_contact_email?: string;
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
  period_start: string | null;
  period_end: string | null;
  partial_deduct_days?: string;
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
  leave_type: 'annual_leave' | 'sick_leave' | 'emergency_leave' | 'unpaid_leave' | 'personal_leave' | 'business_leave' | 'maternity_leave' | 'paternity_leave' | 'other';
  annual_entitlement_days: string;
  monthly_accrual_days: string;
  max_accrual_days: string;
  accrual_start_month: number;
  effective_from: string;
  encashment_rate_base: 'basic' | 'total';
  encashment_rate_divisor: string;
  is_paid: boolean;
  deduct_over_limit: boolean;
  over_limit_deduction_per_day: string;
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

export type LoanType = 'salary_advance' | 'vehicle' | 'personal' | 'medical' | 'housing' | 'other';

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  salary_advance: 'Salary Advance',
  vehicle:        'Vehicle Purchase',
  personal:       'Personal Loan',
  medical:        'Medical',
  housing:        'Housing',
  other:          'Other',
};

export interface EmployeeLoan {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  hr_request: number | null;
  loan_type: LoanType;
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
  role: number | null;
  role_display: string | null;
  role_name: string;           // legacy
  specific_user: number | null;
  sod_fallback_strategy: ApproverStrategy | '';
  sod_fallback_role: number | null;
  sod_role_display: string | null;
  sod_fallback_role_name: string;  // legacy
  sod_fallback_user: number | null;
  escalation_after_hours: number | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalPolicy {
  id: number;
  request_types: number[];
  request_type_names: string[];
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
  | 'review' | 'approved' | 'rejected' | 'closed';

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

export interface TimeEntry {
  id: number;
  task: number;
  logged_by: number;
  logged_by_detail: { id: number; full_name: string; avatar_url: string | null };
  hours: string;
  description: string;
  date: string;
  created_at: string;
}

export interface TaskDependency {
  id: number;
  task: number;
  depends_on: number;
  depends_on_detail: { id: number; title: string; status: TaskStatus; priority: TaskPriority; task_type: TaskType };
}

export interface TaskTemplate {
  id: number;
  name: string;
  description: string;
  task_type: TaskType;
  priority: TaskPriority;
  requires_approval: boolean;
  subtask_titles: string[];
  created_by: number | null;
  created_by_detail?: { id: number; full_name: string; avatar_url: string | null };
  created_at: string;
}

// ── Payroll Run ────────────────────────────────────────────────────────────────
export type PayrollRunStatus = 'draft' | 'processing' | 'processed' | 'paid' | 'cancelled';

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  month_name: string;
  status: PayrollRunStatus;
  status_display: string;
  total_employees: number;
  total_net: string;
  notes: string;
  paid_at: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── End of Service ─────────────────────────────────────────────────────────────
export type EOSStatus = 'draft' | 'approved' | 'paid' | 'cancelled';
export type EOSTerminationReason =
  | 'resignation' | 'termination' | 'mutual_agreement'
  | 'contract_expiry' | 'death' | 'disability' | 'retirement';

export interface EOSCalculation {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  hire_date: string;
  termination_date: string;
  termination_reason: EOSTerminationReason;
  termination_reason_display: string;
  years_of_service: string;
  basic_salary_snapshot: string;
  gratuity_days: string;
  gratuity_amount: string;
  leave_balance_days: string;
  leave_encashment_amount: string;
  other_deductions: string;
  other_additions: string;
  total_settlement: string;
  status: EOSStatus;
  status_display: string;
  notes: string;
  paid_at: string | null;
  calculated_by: number | null;
  calculated_by_name: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EOSPreview {
  employee_id: number;
  employee_name: string;
  hire_date: string;
  termination_date: string;
  years_of_service: string;
  basic_salary: string;
  daily_rate: string;
  gratuity_days: string;
  gratuity_amount: string;
  leave_balance_days: string;
  leave_encashment: string;
  other_additions: string;
  other_deductions: string;
  total_settlement: string;
  law_reference: string;
}

// ── Salary History ─────────────────────────────────────────────────────────────
export type SalaryChangeReason =
  | 'hire' | 'annual_review' | 'promotion' | 'correction' | 'backfill' | 'other';

export interface SalaryHistory {
  id: number;
  employee: number;
  employee_name: string;
  employee_id_code: string;
  effective_date: string;
  basic_salary: string;
  housing_allowance: string;
  transport_allowance: string;
  other_allowances: string;
  gross_salary: string;
  change_reason: SalaryChangeReason;
  change_reason_display: string;
  notes: string;
  changed_by: number | null;
  changed_by_name: string | null;
  created_at: string;
}
